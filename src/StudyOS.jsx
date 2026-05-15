import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import CityPage from './CityPage.jsx'
import StudyRoom from './StudyRoom.jsx'

const QUOTES = [
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Success is not final, failure is not fatal.', author: 'Winston Churchill' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Hard work beats talent when talent doesn\'t work hard.', author: 'Tim Notke' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'You don\'t rise to the level of your goals, you fall to the level of your systems.', author: 'James Clear' },
]

const AWARDS = [
  { id: 'first_session', icon: '🌱', title: 'First Steps', desc: 'Complete your first session', req: s => (s.sessions || []).length >= 1, criteria: '1 session' },
  { id: 'streak_3', icon: '🔥', title: 'On Fire', desc: '3-day streak', req: s => s.streak >= 3, criteria: '3 day streak' },
  { id: 'streak_7', icon: '⚡', title: 'Weekly Warrior', desc: '7-day streak', req: s => s.streak >= 7, criteria: '7 day streak' },
  { id: 'streak_30', icon: '🏆', title: 'Iron Discipline', desc: '30-day streak', req: s => s.streak >= 30, criteria: '30 day streak' },
  { id: 'hours_10', icon: '⏰', title: 'Time Investor', desc: '10 hours studied', req: s => (s.totalMinutes || 0) >= 600, criteria: '10 hours' },
  { id: 'hours_50', icon: '📚', title: 'Knowledge Seeker', desc: '50 hours studied', req: s => (s.totalMinutes || 0) >= 3000, criteria: '50 hours' },
  { id: 'hours_100', icon: '💎', title: 'Century Scholar', desc: '100 hours studied', req: s => (s.totalMinutes || 0) >= 6000, criteria: '100 hours' },
  { id: 'days_10', icon: '📅', title: 'Consistent', desc: '10 days studied', req: s => (s.studiedDays || []).length >= 10, criteria: '10 study days' },
  { id: 'days_50', icon: '🌟', title: 'Dedicated', desc: '50 days studied', req: s => (s.studiedDays || []).length >= 50, criteria: '50 study days' },
  { id: 'goal_met', icon: '🎯', title: 'Goal Crusher', desc: 'Hit daily goal once', req: s => (s.todayMinutes || 0) >= (s.dailyGoal || 120), criteria: 'Hit daily goal' },
]

const SUBJECT_COLORS = ['#d4a853','#c9956a','#5c8c6e','#4a7a9b','#8b7a9b','#c0574a','#7a9b4a','#9b4a7a']

const defaultState = () => ({
  streak: 0, studiedDays: [], missedDays: [], totalMinutes: 0, todayMinutes: 0,
  events: [], diary: [], marks: [], sessions: [], examGroups: [],
  subjects: ['Mathematics', 'Science', 'English', 'History', 'Physics'],
  subjectMinutes: {}, subjectTargets: {},
  dailyGoal: 120, weeklyGoal: 900, targetPct: 98,
  did: '', plan: '',
  timerMode: 'focus', timerTotal: 1500,
  distractionCount: 0, lastStudiedDate: null,
  studyMode: 'focus',
  settings: {
    darkMode: true, sound: true, strictMode: false, autoBreak: false,
    autoNextSession: false, sessionSounds: true, animatedBg: true,
    studyReminders: true, breakReminders: true, goalReminder: true, streakNotif: true,
    detectInactivity: false, warnQuit: true, pauseStreakExams: false,
    focusSessionMins: 25, breakMins: 5, longBreakMins: 15,
    burnoutDetection: false, moodCheckins: true, dopamineDetox: false,
  },
  aiHistory: [],
})

function notify(msg) {
  const el = document.getElementById('kosm-notif')
  if (!el) return
  el.querySelector('.notif-msg').textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 3500)
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function calcStreak(days) {
  if (!days || days.length === 0) return 0
  const sorted = [...days].sort().reverse()
  const today = todayKey()
  let streak = 0
  let check = new Date(today)
  for (const d of sorted) {
    const dt = new Date(d)
    const diff = Math.round((check - dt) / 86400000)
    if (diff === 0 || diff === 1) { streak++; check = dt } else break
  }
  return streak
}

function isFocusTimerMode(mode) {
  return mode === 'focus' || mode === 'custom'
}

export default function StudyOS({ session }) {
  const nav = useNavigate()
  const [page, setPage] = useState('dash')
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authName, setAuthName] = useState('')
  const [authErr, setAuthErr] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [S, setS] = useState(defaultState())
  const [dataLoaded, setDataLoaded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // ─── CLOUD TIMER STATE ───
  const [timerSecs, setTimerSecs] = useState(1500)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerMode, setTimerMode] = useState('focus')
  const [timerTotal, setTimerTotal] = useState(1500)
  const [customMins, setCustomMins] = useState(45)
  const [timerReady, setTimerReady] = useState(false)
  const timerRef = useRef(null)
  const segmentStartRef = useRef(null)

  const [dark, setDark] = useState(true)
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const particlesRef = useRef(null)

  useEffect(() => {
    if (!particlesRef.current) return
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.cssText = `left:${Math.random()*100}%;animation-delay:${Math.random()*15}s;animation-duration:${10+Math.random()*10}s`
      particlesRef.current.appendChild(p)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // ─── LOAD USER DATA + CLOUD TIMER ───
  useEffect(() => {
    if (!session) return
    loadData()
    loadCloudTimer()
  }, [session])

  const loadData = async () => {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    if (error && error.code !== 'PGRST116') { console.error(error); setDataLoaded(true); return }
    if (data?.data) {
      const merged = { ...defaultState(), ...data.data }
      const today = todayKey()
      if (merged.lastStudiedDate && merged.lastStudiedDate !== today) {
        merged.todayMinutes = 0
      }
      setS(merged)
      setDark(merged.settings?.darkMode !== false)
    }
    setDataLoaded(true)
  }

  // ─── CLOUD TIMER: LOAD FROM DB ───
  const loadCloudTimer = async () => {
    if (!session?.user?.id) return
    const { data } = await supabase
      .from('timer_state')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (data) {
      const now = Date.now()
      const startedAt = data.started_at ? new Date(data.started_at).getTime() : 0
      const wasRunning = data.is_running && startedAt

      let newSecs = data.timer_secs
      let newTotal = data.timer_total || 1500
      let newMode = data.timer_mode || 'focus'
      let newStudyMode = data.study_mode || 'focus'

      if (wasRunning) {
        const elapsed = Math.floor((now - startedAt) / 1000)
        if (data.segment_start_secs != null) {
          newSecs = Math.max(0, data.segment_start_secs - elapsed)
        } else {
          // legacy fallback
          newSecs = Math.max(0, data.timer_secs - elapsed)
        }

        if (newSecs <= 0) {
          // Timer completed while away
          const completedSecs = data.segment_start_secs || data.timer_total || 1500
          if (isFocusTimerMode(newMode) && completedSecs > 0) {
            recordFocusSessionDirect(completedSecs, newStudyMode)
          }
          setTimerRunning(false)
          segmentStartRef.current = null
        } else {
          setTimerRunning(true)
          segmentStartRef.current = data.segment_start_secs || data.timer_secs
          startLocalTimer()
        }
      } else {
        setTimerRunning(false)
        segmentStartRef.current = null
      }

      setTimerSecs(newSecs)
      setTimerTotal(newTotal)
      setTimerMode(newMode)
      updateS(prev => ({ ...prev, studyMode: newStudyMode }))
    }
    setTimerReady(true)
  }

  // ─── SAVE DATA ───
  const saveData = useCallback(async (newS) => {
    if (!session) return
    await supabase.from('user_data').upsert(
      { user_id: session.user.id, data: newS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  }, [session])

  const updateS = useCallback((updater) => {
    setS(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      clearTimeout(window._saveTimeout)
      window._saveTimeout = setTimeout(() => saveData(next), 1200)
      return next
    })
  }, [saveData])

  // ─── CLOUD TIMER: SAVE TO DB ───
  const saveCloudTimer = useCallback(async (updates) => {
    if (!session?.user?.id) return
    await supabase.from('timer_state').upsert({
      user_id: session.user.id,
      timer_secs: updates.timer_secs ?? timerSecs,
      timer_total: updates.timer_total ?? timerTotal,
      timer_mode: updates.timer_mode ?? timerMode,
      is_running: updates.is_running ?? timerRunning,
      started_at: updates.started_at ?? null,
      paused_at: updates.paused_at ?? null,
      segment_start_secs: updates.segment_start_secs ?? segmentStartRef.current,
      study_mode: updates.study_mode ?? S.studyMode,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }, [session, timerSecs, timerTotal, timerMode, timerRunning, S.studyMode])

  // ─── LOCAL TIMER INTERVAL ───
  const startLocalTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimerSecs(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setTimerRunning(false)
          handleTimerComplete(segmentStartRef.current || timerTotal)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ─── TIMER COMPLETION ───
  const handleTimerComplete = useCallback((elapsedSecs) => {
    notify(isFocusTimerMode(timerMode) ? '✓ Session complete! Take a break.' : 'Break over. Back to work.')
    if (isFocusTimerMode(timerMode)) {
      recordFocusSessionDirect(elapsedSecs, S.studyMode)
    }
    segmentStartRef.current = null
    saveCloudTimer({ is_running: false, started_at: null, timer_secs: 0, segment_start_secs: null })
  }, [timerMode, S.studyMode])

  // ─── RECORD SESSION (direct, no closure dependencies on timer state) ───
  const recordFocusSessionDirect = (elapsedSecs, studyMode) => {
    const mins = Math.round(elapsedSecs / 60)
    if (mins < 1) return
    const today = todayKey()
    const subject = S.activeSubject || 'General'
    updateS(prev => {
      const sessions = [...(prev.sessions || []), { date: today, mins, mode: studyMode || 'focus', ts: Date.now(), subject }]
      const totalMinutes = (prev.totalMinutes || 0) + mins
      const todayMinutes = (prev.todayMinutes || 0) + mins
      const studiedDays = prev.studiedDays?.includes(today) ? prev.studiedDays : [...(prev.studiedDays || []), today]
      const missedDays = (prev.missedDays || []).filter(d => d !== today)
      const streak = calcStreak(studiedDays)
      const subjectMinutes = { ...prev.subjectMinutes, [subject]: (prev.subjectMinutes?.[subject] || 0) + mins }
      return { ...prev, sessions, totalMinutes, todayMinutes, studiedDays, missedDays, streak, lastStudiedDate: today, subjectMinutes }
    })
  }

  // ─── TIMER CONTROLS ───
  const startTimer = async () => {
    if (timerSecs <= 0) return
    const now = new Date().toISOString()
    segmentStartRef.current = timerSecs
    setTimerRunning(true)
    await saveCloudTimer({ is_running: true, started_at: now, segment_start_secs: timerSecs, timer_secs: timerSecs })
    startLocalTimer()
  }

  const pauseTimer = async () => {
    clearInterval(timerRef.current)
    setTimerRunning(false)
    if (isFocusTimerMode(timerMode) && segmentStartRef.current !== null) {
      const elapsedSecs = segmentStartRef.current - timerSecs
      recordFocusSessionDirect(elapsedSecs, S.studyMode)
      segmentStartRef.current = null
    }
    await saveCloudTimer({ is_running: false, paused_at: new Date().toISOString(), timer_secs: timerSecs, segment_start_secs: null })
  }

  const resetTimer = async () => {
    clearInterval(timerRef.current)
    if (isFocusTimerMode(timerMode) && segmentStartRef.current !== null && timerRunning) {
      const elapsedSecs = segmentStartRef.current - timerSecs
      recordFocusSessionDirect(elapsedSecs, S.studyMode)
    }
    setTimerRunning(false)
    setTimerSecs(timerTotal)
    segmentStartRef.current = null
    await saveCloudTimer({ is_running: false, timer_secs: timerTotal, started_at: null, segment_start_secs: null })
  }

  const setMode = async (mode, mins) => {
    clearInterval(timerRef.current)
    if (isFocusTimerMode(timerMode) && segmentStartRef.current !== null && timerRunning) {
      const elapsedSecs = segmentStartRef.current - timerSecs
      recordFocusSessionDirect(elapsedSecs, S.studyMode)
    }
    setTimerRunning(false)
    setTimerMode(mode)
    const secs = mins * 60
    setTimerTotal(secs)
    setTimerSecs(secs)
    segmentStartRef.current = null
    await saveCloudTimer({ timer_mode: mode, timer_total: secs, timer_secs: secs, is_running: false, started_at: null, segment_start_secs: null })
  }

  const toggleTimer = () => {
    if (timerRunning) pauseTimer()
    else startTimer()
  }

  const timerProgress = timerTotal > 0 ? (timerTotal - timerSecs) / timerTotal : 0
  const circumference = 628
  const dashoffset = circumference * (1 - timerProgress)

  const signOut = async () => {
    await supabase.auth.signOut()
    nav('/')
  }

  const handleAuth = async () => {
    setAuthErr('')
    if (!authEmail || !authPass) { setAuthErr('Please fill in all fields.'); return }
    setAuthLoading(true)
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: authEmail, password: authPass,
        options: { data: { full_name: authName || authEmail.split('@')[0] } }
      })
      if (error) { setAuthErr(error.message); setAuthLoading(false); return }
      notify('Account created! Welcome to Kosmosic.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
      if (error) { setAuthErr(error.message); setAuthLoading(false); return }
      notify('Welcome back.')
    }
    setAuthLoading(false)
  }

  const signInGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/app' } })
  }

  const initials = session
    ? (session.user.user_metadata?.full_name || session.user.email || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'KS'

  if (!session) return <AuthView authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPass={authPass} setAuthPass={setAuthPass} authName={authName} setAuthName={setAuthName} authErr={authErr} authLoading={authLoading} handleAuth={handleAuth} signInGoogle={signInGoogle} nav={nav} />

  if (!dataLoaded || !timerReady) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
      <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", color: 'var(--accent)' }}>Loading your data...</div>
    </div>
  )

  const goalPct = Math.min(100, Math.round(((S.todayMinutes || 0) / (S.dailyGoal || 120)) * 100))

  return (
    <div>
      <div className="particles" ref={particlesRef} />

      <div className="notif" id="kosm-notif">
        <div className="notif-dot" />
        <span className="notif-msg" />
      </div>

      <div className={`mobile-nav-overlay ${mobileOpen ? 'open' : ''}`}>
        {['city','room','dash','timer','music','cal','marks','diary','awards','ai','settings'].map(p => (
          <a key={p} href="#" className={page === p ? 'active' : ''} onClick={e => { e.preventDefault(); setPage(p); setMobileOpen(false) }}>
            {{ city:'City 🏙', room:'Study Rooms', dash:'Home', timer:'Focus', music:'Music', cal:'Calendar', marks:'Marks', diary:'Diary', awards:'Awards', ai:'AI Coach', settings:'Settings' }[p]}
          </a>
        ))}
      </div>

      <nav className="nav">
        <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <div className="nav-tabs">
          {[['city','City 🏙'],['room','Rooms'],['dash','Home'],['timer','Focus'],['music','Music'],['cal','Calendar'],['marks','Marks'],['diary','Diary'],['awards','Awards'],['ai','AI'],['settings','Settings']].map(([p, label]) => (
            <button key={p} className={`tab ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{label}</button>
          ))}
        </div>
        <div className="nav-right">
          <button className="icon-btn" onClick={() => setDark(d => !d)} title="Toggle theme">{dark ? '☀' : '☾'}</button>
          <div className="user-avatar" onClick={() => setPage('settings')} title="Settings">{initials}</div>
          <button className={`burger-btn ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(o => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {page !== 'city' && (
        <div className="ticker">
          <div className="ticker-track">
            {['BEAT MEDIOCRITY','◆','98% IS THE FLOOR','◆','FAANG OR NOTHING','◆','STAY HUNGRY STAY FOOLISH','◆','BUILD THE FUTURE','◆','FLY HIGH ✈','◆','NO DAYS OFF','◆',
              'BEAT MEDIOCRITY','◆','98% IS THE FLOOR','◆','FAANG OR NOTHING','◆','STAY HUNGRY STAY FOOLISH','◆','BUILD THE FUTURE','◆','FLY HIGH ✈','◆','NO DAYS OFF','◆'].map((t, i) => (
              <span key={i} className={t === '◆' ? 'accent' : ''}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {page === 'city' && (
        <CityPage S={S} session={session} isStudying={timerRunning && isFocusTimerMode(timerMode)} studyMode={S.studyMode || 'focus'} />
      )}

      {page === 'room' && (
        <StudyRoom S={S} session={session} isStudying={timerRunning && isFocusTimerMode(timerMode)} timerSecs={timerSecs} timerMode={timerMode} />
      )}

      {/* DASHBOARD */}
      <div className={`page ${page === 'dash' ? 'active' : ''}`}>
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="card card-premium" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="sec-label">Current Streak</div>
            <div className="streak-wrap" style={{ padding: '10px 0' }}>
              <div className="streak-ring">
                <div className="streak-num">{S.streak || 0}</div>
                <div className="streak-label">days</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
                {(S.streak || 0) > 0 ? '🔥 Keep going' : 'Start today!'}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="sec-label">Overview</div>
            <div className="grid2">
              <div className="stat-cell">
                <div className="stat-num" style={{ color: 'var(--green)' }}>{(S.studiedDays || []).length}</div>
                <div className="stat-label">Days Studied</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num" style={{ color: 'var(--red)' }}>{(S.missedDays || []).length}</div>
                <div className="stat-label">Missed</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num" style={{ color: 'var(--accent)' }}>{Math.floor((S.totalMinutes || 0) / 60)}h</div>
                <div className="stat-label">Total Study</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num" style={{ color: 'var(--blue)' }}>{S.todayMinutes || 0}m</div>
                <div className="stat-label">Today</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="sec-label" style={{ margin: 0 }}>Today's Goal</div>
            <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', color: 'var(--text3)' }}>
              {S.todayMinutes || 0} / {S.dailyGoal || 120} min
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${goalPct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <span style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{goalPct}%</span>
          </div>
        </div>

        <div className="quote-card" style={{ marginBottom: 14 }}>
          <div className="quote-mark">"</div>
          <div className="quote-text">{quote.text}</div>
          <div className="quote-author">— {quote.author}</div>
        </div>

        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="card">
            <div className="sec-label">What I Did Today</div>
            <textarea placeholder="Write what you accomplished..." value={S.did || ''} style={{ minHeight: 72 }}
              onChange={e => updateS(prev => ({ ...prev, did: e.target.value }))} />
          </div>
          <div className="card">
            <div className="sec-label">Plan for Tomorrow</div>
            <textarea placeholder="Set tomorrow's agenda..." value={S.plan || ''} style={{ minHeight: 72 }}
              onChange={e => updateS(prev => ({ ...prev, plan: e.target.value }))} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Last 14 Days</div>
          <div className="heatmap-row">
            {Array.from({ length: 14 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (13 - i))
              const key = d.toISOString().split('T')[0]
              const day = d.getDate()
              const studied = (S.studiedDays || []).includes(key)
              const missed = (S.missedDays || []).includes(key)
              return <div key={key} className={`heat-cell ${studied ? 'studied' : missed ? 'missed' : ''}`}>{day}</div>
            })}
          </div>
        </div>

        <div className="card">
          <div className="sec-label">Subject Breakdown</div>
          {(S.subjects || []).map((sub, i) => {
            const mins = (S.subjectMinutes || {})[sub] || 0
            const total = Object.values(S.subjectMinutes || {}).reduce((a, b) => a + b, 0) || 1
            const pct = Math.round((mins / total) * 100)
            return (
              <div key={sub} className="subject-row">
                <div className="subject-name">{sub}</div>
                <div className="subject-bar-track">
                  <div className="subject-bar-fill" style={{ width: `${pct}%`, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                </div>
                <div className="subject-pct">{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* TIMER */}
      <div className={`page ${page === 'timer' ? 'active' : ''}`}>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label" style={{ textAlign: 'center' }}>Focus Timer</div>
          <div className="timer-wrap">
            <div className="timer-circle-wrap">
              <svg width="220" height="220" viewBox="0 0 220 220">
                <circle className="timer-circle-bg" cx="110" cy="110" r="100" />
                <circle className="timer-circle-fg" cx="110" cy="110" r="100"
                  strokeDashoffset={dashoffset} />
              </svg>
              <div className="timer-inner">
                <div className="timer-time">{fmtTime(timerSecs)}</div>
                <div className="timer-mode-label">{{ focus: 'Focus', short: 'Short Break', long: 'Long Break', custom: 'Custom' }[timerMode]}</div>
              </div>
            </div>
            <div className="chip-group">
              {[['focus', '25m Focus', 25], ['short', '5m Break', 5], ['long', '15m Break', 15]].map(([m, label, mins]) => (
                <button key={m} className={`chip ${timerMode === m ? 'active' : ''}`} onClick={() => setMode(m, mins)}>{label}</button>
              ))}
              <button className={`chip ${timerMode === 'custom' ? 'active' : ''}`} onClick={() => setMode('custom', customMins)}>Custom</button>
            </div>
            {timerMode === 'custom' && (
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Minutes:</label>
                <input type="number" value={customMins} min={1} max={300} style={{ width: 80, display: 'inline-block' }}
                  onChange={e => { setCustomMins(+e.target.value); setMode('custom', +e.target.value) }} />
              </div>
            )}

            {/* Session Type Toggles */}
            <div style={{ marginTop: 14, marginBottom: 10 }}>
              <div className="sec-label" style={{ textAlign: 'center', fontSize: '0.72rem', marginBottom: 8 }}>Session Type</div>
              <div className="chip-group" style={{ justifyContent: 'center' }}>
                {[
                  ['focus', '⚡ Focus'],
                  ['deep', '🧠 Deep Work'],
                  ['exam', '📝 Exam Mode']
                ].map(([m, label]) => (
                  <button key={m} className={`chip ${S.studyMode === m ? 'active' : ''}`}
                    onClick={() => updateS(prev => ({ ...prev, studyMode: m }))}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={toggleTimer}>
                {timerRunning ? '⏸ Pause' : '▶ Start'}
              </button>
              {(!timerRunning && timerSecs !== timerTotal) && (
                <button className="btn btn-ghost" onClick={resetTimer}>↺ Reset</button>
              )}
            </div>
            {timerRunning && (
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.72rem', color: 'var(--green)' }}>
                ☁ Synced across devices · {S.studyMode === 'deep' ? 'Deep Work' : S.studyMode === 'exam' ? 'Exam Mode' : 'Focus'}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Subject for This Session</div>
          <div className="chip-group" style={{ justifyContent: 'flex-start' }}>
            {(S.subjects || []).map((sub) => (
              <button key={sub} className={`chip ${S.activeSubject === sub ? 'active' : ''}`}
                onClick={() => updateS(prev => ({ ...prev, activeSubject: sub }))}>
                {sub}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="sec-label">Session Log</div>
          {(S.sessions || []).length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>No sessions yet today.</div>
          ) : (
            [...(S.sessions || [])].reverse().slice(0, 10).map((sess, i) => (
              <div key={i} className="event-row">
                <div className="event-dot" style={{ background: 'var(--accent)' }} />
                <div className="event-info">
                  <div className="event-title">{sess.mode === 'focus' ? 'Focus Session' : sess.mode === 'deep' ? 'Deep Work' : sess.mode === 'exam' ? 'Exam Mode' : 'Break'} — {sess.mins} min</div>
                  <div className="event-note">{sess.date} {sess.subject && `· ${sess.subject}`}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MUSIC */}
      <div className={`page ${page === 'music' ? 'active' : ''}`}>
        <MusicPage />
      </div>

      {/* CALENDAR */}
      <div className={`page ${page === 'cal' ? 'active' : ''}`}>
        <CalendarPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* MARKS */}
      <div className={`page ${page === 'marks' ? 'active' : ''}`}>
        <MarksPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* DIARY */}
      <div className={`page ${page === 'diary' ? 'active' : ''}`}>
        <DiaryPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* AWARDS */}
      <div className={`page ${page === 'awards' ? 'active' : ''}`}>
        <div style={{ marginBottom: 20 }}>
          <div className="heading" style={{ marginBottom: 4 }}>Awards</div>
          <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Badges earned through discipline and consistency.</div>
        </div>
        <div className="gift-grid">
          {AWARDS.map(a => {
            const unlocked = a.req(S)
            return (
              <div key={a.id} className={`gift-card ${unlocked ? 'unlocked' : ''}`} title={a.desc}>
                <div className="gift-icon" style={{ filter: unlocked ? 'none' : 'grayscale(1) opacity(0.4)' }}>{a.icon}</div>
                <div style={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text3)', textAlign: 'center', marginTop: 4 }}>
                  {a.criteria}
                </div>
                <div style={{ fontSize: '0.55rem', color: unlocked ? 'var(--green)' : 'var(--text3)', textAlign: 'center', marginTop: 2 }}>
                  {unlocked ? '✓ Unlocked' : 'Locked'}
                </div>
              </div>
            )
          })}
        </div>
        <div className="section-gap" />
        <div className="card">
          <div className="sec-label">Progress</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Awards Unlocked</span>
            <span style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontWeight: 700, color: 'var(--accent)' }}>
              {AWARDS.filter(a => a.req(S)).length} / {AWARDS.length}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(AWARDS.filter(a => a.req(S)).length / AWARDS.length * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* AI */}
      <div className={`page ${page === 'ai' ? 'active' : ''}`}>
        <AIPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* SETTINGS */}
      <div className={`page ${page === 'settings' ? 'active' : ''}`}>
        <SettingsPage S={S} updateS={updateS} dark={dark} setDark={setDark} signOut={signOut} session={session} notify={notify} />
      </div>
    </div>
  )
}

/* ══════════════════════════════
   AUTH VIEW
══════════════════════════════ */
function AuthView({ authMode, setAuthMode, authEmail, setAuthEmail, authPass, setAuthPass, authName, setAuthName, authErr, authLoading, handleAuth, signInGoogle, nav }) {
  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div className="nav-logo-mark">K</div>
            <span style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '1.3rem', fontWeight: 700 }}>Kosmosic</span>
          </div>
        </div>
        <div className="auth-title">{authMode === 'login' ? 'Welcome back' : 'Create account'}</div>
        <div className="auth-sub">{authMode === 'login' ? 'Sign in to your study OS' : 'Start your journey to 98%'}</div>
        <button className="auth-btn-google" onClick={signInGoogle}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <div className="auth-divider">or</div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" placeholder="you@example.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input type="password" placeholder="••••••••" value={authPass} onChange={e => setAuthPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
        </div>
        {authMode === 'signup' && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" placeholder="Alex Chen" value={authName} onChange={e => setAuthName(e.target.value)} />
          </div>
        )}
        {authErr && <div className="auth-error">{authErr}</div>}
        <button className="btn-auth" onClick={handleAuth} disabled={authLoading}>
          {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
        <div className="auth-switch">
          {authMode === 'login'
            ? <>Don't have an account? <a onClick={() => setAuthMode('signup')}>Sign up free</a></>
            : <>Already have an account? <a onClick={() => setAuthMode('login')}>Sign in</a></>
          }
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════
   MUSIC PAGE
══════════════════════════════ */
function MusicPage() {
  const [search, setSearch] = useState('')
  const [videoId, setVideoId] = useState('')
  const [playlists] = useState([
    { label: 'Lo-Fi Hip Hop', id: 'jfKfPfyJRdk' },
    { label: 'Deep Focus', id: 'WPni755-Krg' },
    { label: 'Classical Study', id: 'mPZkdNFkNps' },
    { label: 'Jazz Study', id: 'Dx5qFachd3A' },
    { label: 'Ambient Focus', id: '5qap5aO4i9A' },
    { label: 'Piano Concentration', id: 'HuFYqnbVbzY' },
  ])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!search.trim()) return
    const q = encodeURIComponent(search + ' study music')
    window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank')
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Focus Music</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Study playlists curated for deep work.</div>
      </div>
      {videoId && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Now Playing</div>
          <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9' }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              allow="autoplay; encrypted-media" allowFullScreen style={{ border: 'none', display: 'block' }} />
          </div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Quick Play</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {playlists.map(p => (
            <button key={p.id} className={`btn ${videoId === p.id ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setVideoId(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="sec-label">Search on YouTube</div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Search music..." value={search} onChange={e => setSearch(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Search</button>
        </form>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 8 }}>Opens YouTube search in a new tab.</div>
      </div>
    </div>
  )
}

/* ══════════════════════════════
   CALENDAR PAGE
══════════════════════════════ */
function CalendarPage({ S, updateS, notify }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [showEventModal, setShowEventModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', note: '', color: '#d4a853' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayKey()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const addEvent = () => {
    if (!newEvent.title || !newEvent.date) { notify('Fill in title and date.'); return }
    updateS(prev => ({ ...prev, events: [...(prev.events || []), { ...newEvent, id: Date.now() }] }))
    setNewEvent({ title: '', date: '', note: '', color: '#d4a853' })
    setShowEventModal(false)
    notify('Event added.')
  }

  const markStudied = (dateKey) => {
    updateS(prev => {
      const studied = prev.studiedDays || []
      const missed = prev.missedDays || []
      if (studied.includes(dateKey)) {
        return { ...prev, studiedDays: studied.filter(d => d !== dateKey), missedDays: [...missed, dateKey] }
      } else if (missed.includes(dateKey)) {
        return { ...prev, missedDays: missed.filter(d => d !== dateKey) }
      } else {
        const newStudied = [...studied, dateKey]
        return { ...prev, studiedDays: newStudied, streak: calcStreak(newStudied), missedDays: missed.filter(d => d !== dateKey) }
      }
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="heading">{monthNames[month]} {year}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
          <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowEventModal(true)}>+ Event</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cal-grid">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="cal-head-cell">{d}</div>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`e${i}`} className="cal-cell empty" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateKey === today
            const studied = (S.studiedDays || []).includes(dateKey)
            const missed = (S.missedDays || []).includes(dateKey)
            const hasEvent = (S.events || []).some(e => e.date === dateKey)
            return (
              <div key={day} className={`cal-cell ${isToday ? 'today' : ''} ${studied ? 'studied' : ''} ${missed ? 'missed' : ''}`}
                onClick={() => markStudied(dateKey)} title="Click to toggle studied → missed → clear">
                {day}
                {hasEvent && <div style={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text3)' }}>Click a day to mark as studied → missed → clear</div>
      </div>

      {(S.events || []).length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Events</div>
          {(S.events || []).sort((a, b) => a.date > b.date ? 1 : -1).map(evt => (
            <div key={evt.id} className="event-row">
              <div className="event-dot" style={{ background: evt.color || 'var(--accent)' }} />
              <div className="event-info">
                <div className="event-title">{evt.title}</div>
                {evt.note && <div className="event-note">{evt.note}</div>}
              </div>
              <div className="event-date">{evt.date}</div>
              <button className="btn btn-ghost btn-xs" onClick={() => updateS(prev => ({ ...prev, events: prev.events.filter(e => e.id !== evt.id) }))}>✕</button>
            </div>
          ))}
        </div>
      )}

      {showEventModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowEventModal(false)}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-title">Add Event</div>
              <button className="modal-close" onClick={() => setShowEventModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input type="text" placeholder="Exam, assignment, etc." value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="text" placeholder="YYYY-MM-DD" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <input type="text" placeholder="Any extra details..." value={newEvent.note} onChange={e => setNewEvent(p => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={addEvent}>Add Event</button>
              <button className="btn btn-ghost" onClick={() => setShowEventModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════
   MARKS PAGE
══════════════════════════════ */
function MarksPage({ S, updateS, notify }) {
  const [examName, setExamName] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [sub, setSub] = useState('')
  const [score, setScore] = useState('')
  const [total, setTotal] = useState('100')
  const [chartTab, setChartTab] = useState('bar')
  const barRef = useRef(null)
  const radarRef = useRef(null)
  const barInstance = useRef(null)
  const radarInstance = useRef(null)

  const examGroups = S.examGroups || []
  const allSubjects = S.subjects || []
  const dark = document.documentElement.getAttribute('data-theme') !== 'light'
  const textColor = dark ? 'rgba(245,240,232,0.7)' : 'rgba(26,23,20,0.7)'
  const gridColor = dark ? 'rgba(255,251,240,0.06)' : 'rgba(60,50,35,0.08)'

  const createExam = () => {
    if (!examName.trim()) { notify('Enter exam name.'); return }
    const ex = { id: Date.now(), name: examName.trim(), date: todayKey(), marks: [] }
    updateS(prev => ({ ...prev, examGroups: [...(prev.examGroups || []), ex] }))
    setSelectedExam(String(ex.id))
    setExamName('')
    notify(`Exam "${ex.name}" created.`)
  }

  const addMark = () => {
    if (!sub || !score) { notify('Fill subject and score.'); return }
    if (!selectedExam) { notify('Select or create an exam first.'); return }
    const mark = { id: Date.now(), subject: sub, score: +score, total: +total || 100, date: todayKey() }
    updateS(prev => ({
      ...prev,
      examGroups: prev.examGroups.map(ex =>
        String(ex.id) === selectedExam ? { ...ex, marks: [...ex.marks, mark] } : ex
      ),
      marks: [...(prev.marks || []), { ...mark, label: examGroups.find(e => String(e.id) === selectedExam)?.name || '' }]
    }))
    setSub(''); setScore(''); setTotal('100')
    notify('Mark added.')
  }

  const deleteExam = (id) => {
    if (!confirm('Delete this exam and all its marks?')) return
    updateS(prev => ({ ...prev, examGroups: prev.examGroups.filter(e => String(e.id) !== String(id)) }))
    if (selectedExam === String(id)) setSelectedExam('')
  }

  useEffect(() => {
    if (!barRef.current || chartTab !== 'bar') return
    if (barInstance.current) barInstance.current.destroy()
    const Chart = window.Chart
    if (!Chart || examGroups.length === 0) return

    const examNames = examGroups.map(e => e.name)
    const colors = ['#d4a853','#5c8c6e','#4a7a9b','#c9956a','#8b7a9b','#c0574a','#7a9b4a']

    const datasets = allSubjects.map((sub, i) => ({
      label: sub,
      data: examGroups.map(ex => {
        const m = ex.marks.find(mk => mk.subject === sub)
        return m ? Math.round(m.score / m.total * 100) : null
      }),
      backgroundColor: colors[i % colors.length] + 'cc',
      borderColor: colors[i % colors.length],
      borderWidth: 1,
      borderRadius: 4,
    }))

    barInstance.current = new Chart(barRef.current, {
      type: 'bar',
      data: { labels: examNames, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Georgia,serif', size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Georgia,serif' } }, grid: { color: gridColor } },
          y: { min: 0, max: 100, ticks: { color: textColor, callback: v => v + '%', font: { family: 'Georgia,serif' } }, grid: { color: gridColor } }
        }
      }
    })
    return () => barInstance.current?.destroy()
  }, [examGroups, chartTab, allSubjects])

  useEffect(() => {
    if (!radarRef.current || chartTab !== 'radar') return
    if (radarInstance.current) radarInstance.current.destroy()
    const Chart = window.Chart
    if (!Chart) return

    const subjectAvgs = allSubjects.map(sub => {
      const allMarks = examGroups.flatMap(ex => ex.marks.filter(m => m.subject === sub))
      if (allMarks.length === 0) return 0
      return Math.round(allMarks.reduce((a, m) => a + (m.score / m.total * 100), 0) / allMarks.length)
    })
    const targets = allSubjects.map(sub => (S.subjectTargets || {})[sub] || S.targetPct || 80)

    radarInstance.current = new Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: allSubjects,
        datasets: [
          {
            label: 'Target',
            data: targets,
            borderColor: '#d4a85388', backgroundColor: 'rgba(212,168,83,0.08)',
            borderWidth: 2, pointBackgroundColor: '#d4a853',
            borderDash: [5, 3],
          },
          {
            label: 'Achieved',
            data: subjectAvgs,
            borderColor: '#5c8c6e', backgroundColor: 'rgba(92,140,110,0.15)',
            borderWidth: 2, pointBackgroundColor: '#5c8c6e',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Georgia,serif', size: 11 } } }
        },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { color: textColor, backdropColor: 'transparent', stepSize: 20, font: { family: 'Georgia,serif', size: 10 } },
            grid: { color: gridColor },
            pointLabels: { color: textColor, font: { family: 'Georgia,serif', size: 11 } }
          }
        }
      }
    })
    return () => radarInstance.current?.destroy()
  }, [examGroups, chartTab, allSubjects, S.subjectTargets, S.targetPct])

  const currentExam = examGroups.find(e => String(e.id) === selectedExam)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Marks Tracker</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Track grades by exam. Visualize trends. Hit targets.</div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Exam</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {examGroups.map(ex => (
            <button key={ex.id} className={`chip ${selectedExam === String(ex.id) ? 'active' : ''}`}
              onClick={() => setSelectedExam(String(ex.id))}>
              {ex.name}
            </button>
          ))}
          <button className="chip" onClick={() => setSelectedExam('')}>+ New Exam</button>
        </div>
        {!selectedExam && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Exam name (e.g. Term 1, Midterm)" value={examName}
              onChange={e => setExamName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createExam()} />
            <button className="btn btn-primary btn-sm" onClick={createExam} style={{ flexShrink: 0 }}>Create</button>
          </div>
        )}
        {currentExam && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
              <strong>{currentExam.name}</strong> · {currentExam.date} · {currentExam.marks.length} entries
            </span>
            <button className="btn btn-danger btn-xs" onClick={() => deleteExam(currentExam.id)}>Delete Exam</button>
          </div>
        )}
      </div>

      {selectedExam && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Add Mark to {currentExam?.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: 120 }}>
              <label className="form-label">Subject</label>
              <input type="text" placeholder="Mathematics" value={sub} onChange={e => setSub(e.target.value)} list="sub-list" />
              <datalist id="sub-list">{allSubjects.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div style={{ flex: 1, minWidth: 70 }}>
              <label className="form-label">Score</label>
              <input type="number" placeholder="87" value={score} onChange={e => setScore(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 70 }}>
              <label className="form-label">Out of</label>
              <input type="number" placeholder="100" value={total} onChange={e => setTotal(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addMark} style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1 }}>+ Add</button>
          </div>
          {currentExam?.marks.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <table className="marks-table">
                <thead><tr><th>Subject</th><th>Score</th><th>%</th><th /></tr></thead>
                <tbody>
                  {currentExam.marks.map(m => (
                    <tr key={m.id}>
                      <td>{m.subject}</td>
                      <td>{m.score}/{m.total}</td>
                      <td style={{ color: m.score/m.total >= 0.8 ? 'var(--green)' : m.score/m.total >= 0.6 ? 'var(--accent)' : 'var(--red)', fontWeight: 600 }}>
                        {Math.round(m.score / m.total * 100)}%
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => {
                          updateS(prev => ({ ...prev, examGroups: prev.examGroups.map(ex => String(ex.id) === selectedExam ? { ...ex, marks: ex.marks.filter(x => x.id !== m.id) } : ex) }))
                        }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {examGroups.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="sec-label" style={{ margin: 0 }}>Analytics</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${chartTab === 'bar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartTab('bar')}>Bar Chart</button>
              <button className={`btn btn-sm ${chartTab === 'radar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartTab('radar')}>Spider Chart</button>
            </div>
          </div>
          {chartTab === 'bar' && (
            <>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 10 }}>Score (%) by subject across all exams</div>
              <div style={{ height: 280, position: 'relative' }}><canvas ref={barRef} /></div>
            </>
          )}
          {chartTab === 'radar' && (
            <>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 10 }}>Target vs achieved average per subject</div>
              <div style={{ height: 320, position: 'relative' }}><canvas ref={radarRef} /></div>
            </>
          )}
        </div>
      )}

      {examGroups.length > 0 && (
        <div className="card">
          <div className="sec-label">Subject Targets (%)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allSubjects.map(sub => (
              <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text)', flex: 1 }}>{sub}</div>
                <input type="number" min={0} max={100} style={{ width: 72, textAlign: 'center' }}
                  value={(S.subjectTargets || {})[sub] || S.targetPct || 80}
                  onChange={e => updateS(prev => ({ ...prev, subjectTargets: { ...prev.subjectTargets, [sub]: +e.target.value } }))} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════
   DIARY PAGE
══════════════════════════════ */
function DiaryPage({ S, updateS, notify }) {
  const [entry, setEntry] = useState('')
  const [mood, setMood] = useState('focused')

  const addEntry = () => {
    if (!entry.trim()) return
    const e = { id: Date.now(), text: entry, mood, ts: new Date().toLocaleString(), date: todayKey() }
    updateS(prev => ({ ...prev, diary: [...(prev.diary || []), e] }))
    setEntry('')
    notify('Entry saved.')
  }

  const MOODS = [{ v: 'focused', l: '🎯 Focused' }, { v: 'motivated', l: '⚡ Motivated' }, { v: 'tired', l: '😴 Tired' }, { v: 'stressed', l: '😤 Stressed' }, { v: 'proud', l: '🏆 Proud' }]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Study Diary</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Capture thoughts, reflections, and breakthroughs.</div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">New Entry</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {MOODS.map(m => (
            <button key={m.v} className={`chip ${mood === m.v ? 'active' : ''}`} onClick={() => setMood(m.v)}>{m.l}</button>
          ))}
        </div>
        <textarea placeholder="What's on your mind? Wins, struggles, insights..." value={entry}
          onChange={e => setEntry(e.target.value)} style={{ minHeight: 100 }} />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={addEntry}>Save Entry</button>
      </div>
      {(S.diary || []).length === 0
        ? <div className="card" style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>No diary entries yet. Start writing.</div>
        : [...(S.diary || [])].reverse().map(e => (
          <div key={e.id} className="diary-entry">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="diary-ts">{e.ts} · {MOODS.find(m => m.v === e.mood)?.l || ''}</div>
              <button className="btn btn-ghost btn-xs" onClick={() => updateS(prev => ({ ...prev, diary: prev.diary.filter(x => x.id !== e.id) }))}>✕</button>
            </div>
            <div className="diary-text">{e.text}</div>
          </div>
        ))
      }
    </div>
  )
}

/* ══════════════════════════════
   AI PAGE
══════════════════════════════ */
function AIPage({ S, updateS, notify }) {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const SUGGESTIONS = [
    'Give me a study plan for tomorrow',
    'How do I improve my concentration?',
    'I keep procrastinating. Help.',
    'Suggest a revision strategy for exams',
    'How can I make my streak last longer?',
  ]

  const ask = async (q) => {
    const question = q || prompt.trim()
    if (!question) return
    setLoading(true)
    setResponse('')

    const ctx = `User stats: ${S.streak || 0} day streak, ${Math.floor((S.totalMinutes || 0) / 60)} hours total study, goal ${S.dailyGoal || 120} min/day, subjects: ${(S.subjects || []).join(', ')}.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 512, messages: [{ role: 'user', content: `You are Kosmosic AI — a sharp, encouraging study coach for ambitious students. Be concise, practical, and motivating. ${ctx}\n\nStudent: ${question}` }] })
      })
      if (res.ok) {
        const data = await res.json()
        setResponse(data.content?.[0]?.text || 'No response.')
      } else {
        setResponse(getLocalAIResponse(question, S))
      }
    } catch {
      setResponse(getLocalAIResponse(question, S))
    }
    setLoading(false)
    setPrompt('')
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="heading">AI Coach</div>
        <span className="ai-tag">✦ Smart</span>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Ask Your Coach</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input type="text" placeholder="Ask anything about studying..." value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} />
          <button className="btn btn-primary btn-sm" onClick={() => ask()} disabled={loading} style={{ flexShrink: 0 }}>
            {loading ? '...' : 'Ask'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      </div>
      {(loading || response) && (
        <div className="card">
          <div className="sec-label">Response</div>
          <div className="ai-response-box">
            {loading ? <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 0.8s infinite', marginRight: 8 }} />Thinking...</> : response}
          </div>
        </div>
      )}
    </div>
  )
}

function getLocalAIResponse(q, S) {
  const ql = q.toLowerCase()
  if (ql.includes('plan') || ql.includes('schedule')) return `Here's a solid plan for tomorrow:\n\n1. Start with your hardest subject (${(S.subjects || ['Math'])[0]}) for 45 min while your mind is fresh.\n2. Take a 10-min break — walk, stretch, hydrate.\n3. Tackle your second priority for 30 min.\n4. Review your notes from today for 15 min.\n5. End with something you enjoy studying.\n\nYou have a ${S.streak || 0}-day streak. Protect it. Start before you feel ready.`
  if (ql.includes('procrastinat')) return `Procrastination is the gap between intention and action. Close it fast:\n\n• Use the 2-minute rule: if it takes under 2 minutes, do it now.\n• Start with the ugliest task — momentum builds after the first rep.\n• Remove friction: phone in another room, tab blocker on.\n• Your ${S.streak || 0}-day streak is evidence you CAN do this. Trust the system, not the mood.`
  if (ql.includes('concentrat') || ql.includes('focus')) return `To enter deep focus:\n\n• Block 90-minute chunks — this matches your ultradian rhythm.\n• Phone in airplane mode or in another room entirely.\n• Use the Pomodoro timer in the Focus tab.\n• Background music (lo-fi, classical) works for most people.\n• Hydrate before starting — dehydration kills focus faster than distraction.\n\nYour brain needs about 23 minutes to reach deep focus. Protect that ramp-up time.`
  if (ql.includes('streak')) return `Your current streak is ${S.streak || 0} days. To extend it:\n\n• Never miss two days in a row — one miss is an accident, two is a habit.\n• Set a non-negotiable minimum: even 15 minutes counts.\n• Track it here so it hurts to break.\n• Attach it to an identity: "I'm someone who studies every day."\n\nStreaks compound. 30 days feels impossible. Then it feels automatic.`
  return `You've studied ${Math.floor((S.totalMinutes || 0) / 60)} hours total with a ${S.streak || 0}-day streak. That's real progress — most people quit long before they get here.\n\nKey principles:\n• Consistency beats intensity every time.\n• Your environment shapes your output more than your willpower.\n• Review is more powerful than re-reading — test yourself.\n• Sleep is not optional — it's when memories consolidate.\n\nKeep showing up. That's the entire secret.`
}

/* ══════════════════════════════
   SETTINGS PAGE
══════════════════════════════ */
function SettingsPage({ S, updateS, dark, setDark, signOut, session, notify }) {
  const s = S.settings || {}

  const toggle = (key) => updateS(prev => ({
    ...prev,
    settings: { ...prev.settings, [key]: !prev.settings[key] }
  }))

  const setNum = (key, val) => updateS(prev => ({
    ...prev,
    settings: { ...prev.settings, [key]: +val }
  }))

  const exportICS = () => {
    const sessions = S.sessions || []
    const events = S.events || []
    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kosmosic//StudyOS//EN\n'
    sessions.forEach(sess => {
      const date = sess.date.replace(/-/g, '')
      ics += `BEGIN:VEVENT\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nSUMMARY:Study Session (${sess.mins}m)\nDESCRIPTION:${sess.mode} session · ${sess.subject || 'General'}\\nTotal: ${sess.mins} minutes\nEND:VEVENT\n`
    })
    events.forEach(evt => {
      const date = evt.date.replace(/-/g, '')
      ics += `BEGIN:VEVENT\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nSUMMARY:${evt.title}\nDESCRIPTION:${evt.note || ''}\nEND:VEVENT\n`
    })
    ics += 'END:VCALENDAR'
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kosmosic-calendar-${todayKey()}.ics`
    a.click()
    URL.revokeObjectURL(url)
    notify('Calendar exported.')
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Settings</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Customize your study environment.</div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Appearance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Dark Mode</span>
          <button className={`chip ${dark ? 'active' : ''}`} onClick={() => setDark(d => !d)}>{dark ? 'On' : 'Off'}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Animated Background</span>
          <button className={`chip ${s.animatedBg ? 'active' : ''}`} onClick={() => toggle('animatedBg')}>{s.animatedBg ? 'On' : 'Off'}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Timer</div>
        {[
          ['sound', 'Sound Effects'],
          ['sessionSounds', 'Session Sounds'],
          ['autoBreak', 'Auto-start Breaks'],
          ['autoNextSession', 'Auto-next Session'],
          ['strictMode', 'Strict Mode (no pause)'],
        ].map(([key, label], i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{label}</span>
            <button className={`chip ${s[key] ? 'active' : ''}`} onClick={() => toggle(key)}>{s[key] ? 'On' : 'Off'}</button>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
          <div>
            <label className="form-label">Focus (min)</label>
            <input type="number" value={s.focusSessionMins || 25} onChange={e => setNum('focusSessionMins', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Break (min)</label>
            <input type="number" value={s.breakMins || 5} onChange={e => setNum('breakMins', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Long Break (min)</label>
            <input type="number" value={s.longBreakMins || 15} onChange={e => setNum('longBreakMins', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Notifications</div>
        {[
          ['studyReminders', 'Study Reminders'],
          ['breakReminders', 'Break Reminders'],
          ['goalReminder', 'Goal Reminder'],
          ['streakNotif', 'Streak Notifications'],
        ].map(([key, label], i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{label}</span>
            <button className={`chip ${s[key] ? 'active' : ''}`} onClick={() => toggle(key)}>{s[key] ? 'On' : 'Off'}</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Wellness</div>
        {[
          ['burnoutDetection', 'Burnout Detection'],
          ['moodCheckins', 'Mood Check-ins'],
          ['dopamineDetox', 'Dopamine Detox'],
        ].map(([key, label], i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{label}</span>
            <button className={`chip ${s[key] ? 'active' : ''}`} onClick={() => toggle(key)}>{s[key] ? 'On' : 'Off'}</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Privacy & Safety</div>
        {[
          ['detectInactivity', 'Detect Inactivity'],
          ['warnQuit', 'Warn on Quit'],
          ['pauseStreakExams', 'Pause Streak During Exams'],
        ].map(([key, label], i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{label}</span>
            <button className={`chip ${s[key] ? 'active' : ''}`} onClick={() => toggle(key)}>{s[key] ? 'On' : 'Off'}</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Data & Sync</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
          Your streak, study time, days studied, and calendar events are automatically synced to the cloud every few seconds. 
          You can also export your data or calendar for external use.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const dataStr = JSON.stringify(S, null, 2)
            const blob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `kosmosic-backup-${todayKey()}.json`
            a.click()
            URL.revokeObjectURL(url)
            notify('Data exported.')
          }}>Export JSON</button>
          <button className="btn btn-ghost btn-sm" onClick={exportICS}>Export Calendar (.ics)</button>
          <button className="btn btn-danger btn-sm" onClick={signOut}>Sign Out</button>
        </div>
      </div>
    </div>
  )
}
