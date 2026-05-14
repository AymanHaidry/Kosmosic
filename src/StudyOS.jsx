import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import CityPage from './CityPage.jsx'

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
  { id: 'first_session', icon: '🌱', title: 'First Steps', desc: 'Complete your first session', req: s => s.sessions?.length >= 1 },
  { id: 'streak_3', icon: '🔥', title: 'On Fire', desc: '3-day streak', req: s => s.streak >= 3 },
  { id: 'streak_7', icon: '⚡', title: 'Weekly Warrior', desc: '7-day streak', req: s => s.streak >= 7 },
  { id: 'streak_30', icon: '🏆', title: 'Iron Discipline', desc: '30-day streak', req: s => s.streak >= 30 },
  { id: 'hours_10', icon: '⏰', title: 'Time Investor', desc: '10 hours studied', req: s => (s.totalMinutes || 0) >= 600 },
  { id: 'hours_50', icon: '📚', title: 'Knowledge Seeker', desc: '50 hours studied', req: s => (s.totalMinutes || 0) >= 3000 },
  { id: 'hours_100', icon: '💎', title: 'Century Scholar', desc: '100 hours studied', req: s => (s.totalMinutes || 0) >= 6000 },
  { id: 'days_10', icon: '📅', title: 'Consistent', desc: '10 days studied', req: s => (s.studiedDays || []).length >= 10 },
  { id: 'days_50', icon: '🌟', title: 'Dedicated', desc: '50 days studied', req: s => (s.studiedDays || []).length >= 50 },
  { id: 'goal_met', icon: '🎯', title: 'Goal Crusher', desc: 'Hit daily goal once', req: s => (s.todayMinutes || 0) >= (s.dailyGoal || 120) },
]

const SUBJECT_COLORS = ['#d4a853','#c9956a','#5c8c6e','#4a7a9b','#8b7a9b','#c0574a','#7a9b4a','#9b4a7a']

const defaultState = () => ({
  streak: 0, studiedDays: [], missedDays: [], totalMinutes: 0, todayMinutes: 0,
  events: [], diary: [], marks: [], sessions: [],
  subjects: ['Mathematics', 'Science', 'English', 'History', 'Physics'],
  subjectMinutes: {},
  dailyGoal: 120, targetPct: 98,
  did: '', plan: '',
  timerMode: 'focus', timerTotal: 1500,
  distractionCount: 0, lastStudiedDate: null,
  settings: { darkMode: true, sound: true, strictMode: false, autoBreak: false },
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

  // Timer state
  const [timerSecs, setTimerSecs] = useState(1500)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerMode, setTimerMode] = useState('focus')
  const [timerTotal, setTimerTotal] = useState(1500)
  const [customMins, setCustomMins] = useState(45)
  const timerRef = useRef(null)
  const sessionStartRef = useRef(null)

  // Theme
  const [dark, setDark] = useState(true)

  // Quote
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])

  // Particles
  const particlesRef = useRef(null)

  useEffect(() => {
    if (!particlesRef.current) return
    const c = particlesRef.current
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.cssText = `left:${Math.random()*100}%;animation-delay:${Math.random()*15}s;animation-duration:${10+Math.random()*10}s`
      c.appendChild(p)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Load user data
  useEffect(() => {
    if (!session) return
    loadData()
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
      setS(merged)
      setDark(merged.settings?.darkMode !== false)
    }
    setDataLoaded(true)
  }

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

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSecs(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setTimerRunning(false)
            handleTimerComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  const handleTimerComplete = () => {
    notify(timerMode === 'focus' ? 'Focus session complete! Take a break.' : 'Break over. Back to work.')
    if (timerMode === 'focus' && sessionStartRef.current) {
      const mins = Math.round((Date.now() - sessionStartRef.current) / 60000)
      if (mins > 0) {
        const today = todayKey()
        updateS(prev => {
          const sessions = [...(prev.sessions || []), { date: today, mins, mode: 'focus', ts: Date.now() }]
          const totalMinutes = (prev.totalMinutes || 0) + mins
          const todayMinutes = (prev.todayMinutes || 0) + mins
          const studiedDays = prev.studiedDays?.includes(today) ? prev.studiedDays : [...(prev.studiedDays || []), today]
          const streak = calcStreak(studiedDays)
          return { ...prev, sessions, totalMinutes, todayMinutes, studiedDays, streak, lastStudiedDate: today }
        })
      }
    }
    sessionStartRef.current = null
  }

  const startTimer = () => {
    if (timerMode === 'focus') sessionStartRef.current = Date.now()
    setTimerRunning(true)
  }

  const pauseTimer = () => setTimerRunning(false)

  const resetTimer = () => {
    setTimerRunning(false)
    setTimerSecs(timerTotal)
    sessionStartRef.current = null
  }

  const setMode = (mode, mins) => {
    setTimerRunning(false)
    setTimerMode(mode)
    const secs = mins * 60
    setTimerTotal(secs)
    setTimerSecs(secs)
  }

  const calcStreak = (days) => {
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

  // Reset today's minutes at midnight
  useEffect(() => {
    const today = todayKey()
    if (S.lastStudiedDate && S.lastStudiedDate !== today) {
      updateS(prev => ({ ...prev, todayMinutes: 0 }))
    }
  }, [])

  const initials = session
    ? (session.user.user_metadata?.full_name || session.user.email || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'KS'

  if (!session) return <AuthView authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPass={authPass} setAuthPass={setAuthPass} authName={authName} setAuthName={setAuthName} authErr={authErr} authLoading={authLoading} handleAuth={handleAuth} signInGoogle={signInGoogle} nav={nav} />

  if (!dataLoaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
      <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", color: 'var(--accent)' }}>Loading your data...</div>
    </div>
  )

  const goalPct = Math.min(100, Math.round(((S.todayMinutes || 0) / (S.dailyGoal || 120)) * 100))

  return (
    <div>
      <div className="particles" ref={particlesRef} />

      {/* NOTIFICATION */}
      <div className="notif" id="kosm-notif">
        <div className="notif-dot" />
        <span className="notif-msg" />
      </div>

      {/* MOBILE NAV OVERLAY */}
      <div className={`mobile-nav-overlay ${mobileOpen ? 'open' : ''}`}>
        {['city','dash','timer','music','cal','marks','diary','awards','ai','settings'].map(p => (
          <a key={p} href="#" className={page === p ? 'active' : ''} onClick={e => { e.preventDefault(); setPage(p); setMobileOpen(false) }}>
            {{ city:'City', dash:'Home', timer:'Focus', music:'Music', cal:'Calendar', marks:'Marks', diary:'Diary', awards:'Awards', ai:'AI Coach', settings:'Settings' }[p]}
          </a>
        ))}
      </div>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <div className="nav-tabs">
          {[['city','City 🏙'],['dash','Home'],['timer','Focus'],['music','Music'],['cal','Calendar'],['marks','Marks'],['diary','Diary'],['awards','Awards'],['ai','AI Coach'],['settings','Settings']].map(([p, label]) => (
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

      {/* TICKER — only show outside city page */}
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

      {/* ══ CITY ══ */}
      {page === 'city' && (
        <CityPage S={S} session={session} isStudying={timerRunning && timerMode === 'focus'} studyMode={timerMode} />
      )}

      {/* ══ DASHBOARD ══ */}
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

      {/* ══ TIMER ══ */}
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
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={startTimer} disabled={timerRunning}>▶ Start</button>
              <button className="btn btn-ghost" onClick={pauseTimer} disabled={!timerRunning}>⏸ Pause</button>
              <button className="btn btn-ghost" onClick={resetTimer}>↺ Reset</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Subject for This Session</div>
          <div className="chip-group" style={{ justifyContent: 'flex-start' }}>
            {(S.subjects || []).map((sub, i) => (
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
                  <div className="event-title">{sess.mode === 'focus' ? 'Focus Session' : 'Break'} — {sess.mins} min</div>
                  <div className="event-note">{sess.date}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══ MUSIC ══ */}
      <div className={`page ${page === 'music' ? 'active' : ''}`}>
        <MusicPage />
      </div>

      {/* ══ CALENDAR ══ */}
      <div className={`page ${page === 'cal' ? 'active' : ''}`}>
        <CalendarPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* ══ MARKS ══ */}
      <div className={`page ${page === 'marks' ? 'active' : ''}`}>
        <MarksPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* ══ DIARY ══ */}
      <div className={`page ${page === 'diary' ? 'active' : ''}`}>
        <DiaryPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* ══ AWARDS ══ */}
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
                <div style={{ fontSize: '0.6rem', textAlign: 'center', lineHeight: 1.3 }}>{a.title}</div>
                {!unlocked && <div style={{ fontSize: '0.55rem', color: 'var(--text3)' }}>Locked</div>}
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

      {/* ══ AI COACH ══ */}
      <div className={`page ${page === 'ai' ? 'active' : ''}`}>
        <AIPage S={S} updateS={updateS} notify={notify} />
      </div>

      {/* ══ SETTINGS ══ */}
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
   MUSIC PAGE (YouTube embed)
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
        return { ...prev, studiedDays: newStudied, streak: calcStreak(newStudied) }
      }
    })
  }

  const calcStreak = (days) => {
    if (!days || days.length === 0) return 0
    const sorted = [...days].sort().reverse()
    const td = todayKey()
    let streak = 0; let check = new Date(td)
    for (const d of sorted) {
      const dt = new Date(d)
      const diff = Math.round((check - dt) / 86400000)
      if (diff === 0 || diff === 1) { streak++; check = dt } else break
    }
    return streak
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
                onClick={() => markStudied(dateKey)} title="Click to toggle studied/missed">
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
  const [sub, setSub] = useState('')
  const [score, setScore] = useState('')
  const [total, setTotal] = useState('100')
  const [label, setLabel] = useState('')

  const addMark = () => {
    if (!sub || !score) { notify('Fill in subject and score.'); return }
    const mark = { id: Date.now(), subject: sub, score: +score, total: +total || 100, label, date: todayKey() }
    updateS(prev => ({ ...prev, marks: [...(prev.marks || []), mark] }))
    setSub(''); setScore(''); setTotal('100'); setLabel('')
    notify('Mark added.')
  }

  const marks = S.marks || []
  const subjects = [...new Set(marks.map(m => m.subject))]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Marks Tracker</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Log grades, track trends, celebrate wins.</div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-label">Add Mark</div>
        <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Subject</label>
            <input type="text" placeholder="Mathematics" value={sub} onChange={e => setSub(e.target.value)} list="subjects-list" />
            <datalist id="subjects-list">{(S.subjects || []).map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Label (test/exam)</label>
            <input type="text" placeholder="Midterm" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Score</label>
            <input type="number" placeholder="85" value={score} onChange={e => setScore(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Out of</label>
            <input type="number" placeholder="100" value={total} onChange={e => setTotal(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addMark}>+ Add Mark</button>
      </div>

      {subjects.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Averages by Subject</div>
          {subjects.map(s => {
            const subMarks = marks.filter(m => m.subject === s)
            const avg = Math.round(subMarks.reduce((a, m) => a + (m.score / m.total * 100), 0) / subMarks.length)
            return (
              <div key={s} className="subject-row">
                <div className="subject-name">{s}</div>
                <div className="subject-bar-track">
                  <div className="subject-bar-fill" style={{ width: `${avg}%`, background: avg >= 80 ? 'var(--green)' : avg >= 60 ? 'var(--accent)' : 'var(--red)' }} />
                </div>
                <div className="subject-pct">{avg}%</div>
              </div>
            )
          })}
        </div>
      )}

      {marks.length > 0 && (
        <div className="card">
          <div className="sec-label">All Marks</div>
          <table className="marks-table">
            <thead>
              <tr><th>Subject</th><th>Label</th><th>Score</th><th>%</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {[...marks].reverse().map(m => (
                <tr key={m.id}>
                  <td>{m.subject}</td>
                  <td>{m.label || '—'}</td>
                  <td>{m.score}/{m.total}</td>
                  <td style={{ color: m.score/m.total >= 0.8 ? 'var(--green)' : m.score/m.total >= 0.6 ? 'var(--accent)' : 'var(--red)', fontWeight: 600 }}>
                    {Math.round(m.score / m.total * 100)}%
                  </td>
                  <td>{m.date}</td>
                  <td><button className="btn btn-ghost btn-xs" onClick={() => updateS(prev => ({ ...prev, marks: prev.marks.filter(x => x.id !== m.id) }))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const [newSubject, setNewSubject] = useState('')

  const toggleSetting = (key) => {
    updateS(prev => ({ ...prev, settings: { ...prev.settings, [key]: !prev.settings?.[key] } }))
  }

  const addSubject = () => {
    if (!newSubject.trim()) return
    if ((S.subjects || []).includes(newSubject.trim())) { notify('Subject already exists.'); return }
    updateS(prev => ({ ...prev, subjects: [...(prev.subjects || []), newSubject.trim()] }))
    setNewSubject('')
    notify('Subject added.')
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Settings</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>{session?.user?.email}</div>
      </div>

      <div className="card settings-section" style={{ marginBottom: 14 }}>
        <div className="settings-section-title">Appearance</div>
        <div className="toggle-wrap">
          <div className="toggle-info">
            <div className="toggle-name">Dark Mode</div>
            <div className="toggle-sub">Switch between dark and light themes</div>
          </div>
          <div className={`toggle ${dark ? 'on' : ''}`} onClick={() => { setDark(d => !d); updateS(prev => ({ ...prev, settings: { ...prev.settings, darkMode: !dark } })) }} />
        </div>
      </div>

      <div className="card settings-section" style={{ marginBottom: 14 }}>
        <div className="settings-section-title">Focus</div>
        <div className="form-group">
          <label className="form-label">Daily Goal (minutes)</label>
          <input type="number" value={S.dailyGoal || 120} min={15} max={720}
            onChange={e => updateS(prev => ({ ...prev, dailyGoal: +e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Target Score (%)</label>
          <input type="number" value={S.targetPct || 98} min={50} max={100}
            onChange={e => updateS(prev => ({ ...prev, targetPct: +e.target.value }))} />
        </div>
        <div className="toggle-wrap">
          <div className="toggle-info">
            <div className="toggle-name">Strict Mode</div>
            <div className="toggle-sub">Warn before quitting a focus session</div>
          </div>
          <div className={`toggle ${S.settings?.strictMode ? 'on' : ''}`} onClick={() => toggleSetting('strictMode')} />
        </div>
        <div className="toggle-wrap">
          <div className="toggle-info">
            <div className="toggle-name">Auto-Start Breaks</div>
            <div className="toggle-sub">Automatically start break timer after focus</div>
          </div>
          <div className={`toggle ${S.settings?.autoBreak ? 'on' : ''}`} onClick={() => toggleSetting('autoBreak')} />
        </div>
      </div>

      <div className="card settings-section" style={{ marginBottom: 14 }}>
        <div className="settings-section-title">Subjects</div>
        <div style={{ marginBottom: 12 }}>
          {(S.subjects || []).map((sub, i) => (
            <div key={sub} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{sub}</span>
              <button className="btn btn-ghost btn-xs btn-danger" onClick={() => updateS(prev => ({ ...prev, subjects: prev.subjects.filter(s => s !== sub) }))}>Remove</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Add subject..." value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} />
          <button className="btn btn-primary btn-sm" onClick={addSubject} style={{ flexShrink: 0 }}>Add</button>
        </div>
      </div>

      <div className="card settings-section" style={{ marginBottom: 14 }}>
        <div className="settings-section-title">Danger Zone</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign Out</button>
          <button className="btn btn-danger btn-sm" onClick={() => {
            if (confirm('Reset ALL data? This cannot be undone.')) {
              updateS(defaultState())
              notify('Data reset.')
            }
          }}>Reset All Data</button>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
        <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", color: 'var(--accent)', marginBottom: 4 }}>Kosmosic — Study OS</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Built for the relentless. Version 2.0</div>
      </div>
    </div>
  )
}
