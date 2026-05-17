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

const THEMES = [
  { id:'premium-dark',  label:'Premium Dark',   icon:'✦' },
  { id:'premium-light', label:'Premium Light',   icon:'☀' },
  { id:'pure-dark',     label:'Pure Dark',       icon:'⬛' },
  { id:'pure-light',    label:'Pure Light',      icon:'⬜' },
  { id:'neon',          label:'Neon',            icon:'⚡' },
  { id:'minecraft',     label:'Minecraft',       icon:'🟩' },
  { id:'garden',        label:'Garden',          icon:'🌿' },
  { id:'skylines',      label:'Skylines',        icon:'🌃' },
  { id:'tame-impala',   label:'Tame Impala',     icon:'🔮' },
  { id:'vibe-coded',    label:'Vibe Coded',      icon:'🌈' },
]

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
    theme: 'premium-dark',
  },
  aiHistory: [],
  activityFeed: [],
})

function sendBrowserNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

function notify(msg, { browser = false, title = 'Kosmosic' } = {}) {
  const el = document.getElementById('kosm-notif')
  if (el) {
    el.querySelector('.notif-msg').textContent = msg
    el.classList.add('show')
    setTimeout(() => el.classList.remove('show'), 3500)
  }
  if (browser) sendBrowserNotif(title, msg)
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function cleanStudiedDays(days) {
  if (!days || !Array.isArray(days)) return []
  return days.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
}

function calcStreakFromDays(days) {
  const clean = cleanStudiedDays(days)
  if (clean.length === 0) return 0
  const sorted = [...clean].sort().reverse()
  const td = todayKey()
  let streak = 0
  let check = new Date(td)
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

/* ══════════════════════════════
   JELLYFISH PET
══════════════════════════════ */
function JellyfishPet({ daysSinceStudy }) {
  const dead = daysSinceStudy > 2
  const sick = daysSinceStudy === 2
  const health = dead ? 0 : sick ? 50 : 100
  const color = dead ? '#555' : sick ? '#f0a' : '#7ef'
  const glow = dead ? 'none' : sick ? '0 0 18px rgba(255,0,170,0.5)' : '0 0 24px rgba(100,240,255,0.7)'

  return (
    <div style={{ textAlign:'center', padding:'12px 0' }}>
      <div style={{ position:'relative', display:'inline-block', filter:dead?'grayscale(1)':'none', transition:'all 1s', animation: dead ? 'none' : 'jellybob 3s ease-in-out infinite' }}>
        <svg width="70" height="80" viewBox="0 0 70 80" style={{ filter:`drop-shadow(${glow})`, transition:'filter 1s' }}>
          <ellipse cx="35" cy="34" rx="24" ry="22" fill={color} fillOpacity="0.35" />
          <ellipse cx="35" cy="32" rx="24" ry="22" fill={color} fillOpacity="0.6" />
          <ellipse cx="27" cy="22" rx="7" ry="5" fill="rgba(255,255,255,0.35)" transform="rotate(-15 27 22)" />
          {dead ? (
            <>
              <line x1="25" y1="36" x2="29" y2="40" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="29" y1="36" x2="25" y2="40" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="41" y1="36" x2="45" y2="40" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="45" y1="36" x2="41" y2="40" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M28 44 Q35 40 42 44" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </>
          ) : sick ? (
            <>
              <ellipse cx="27" cy="37" rx="3" ry="3.5" fill="rgba(255,255,255,0.8)" />
              <ellipse cx="43" cy="37" rx="3" ry="3.5" fill="rgba(255,255,255,0.8)" />
              <ellipse cx="27.5" cy="36.5" rx="1.2" ry="1.5" fill="#444" />
              <ellipse cx="43.5" cy="36.5" rx="1.2" ry="1.5" fill="#444" />
              <path d="M28 46 Q35 43 42 46" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="27" cy="36" rx="3" ry="3.5" fill="rgba(255,255,255,0.85)" />
              <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="rgba(255,255,255,0.85)" />
              <ellipse cx="27.5" cy="35.5" rx="1.5" ry="1.8" fill="#114" />
              <ellipse cx="43.5" cy="35.5" rx="1.5" ry="1.8" fill="#114" />
              <path d="M29 45 Q35 49 41 45" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {[14,22,30,38,46,54].map((tx, i) => (
            <path key={i} d={`M${tx} 54 Q${tx + (i%2===0?-4:4)} ${62+i*1.5} ${tx} ${70+i}`} fill="none" stroke={color} strokeWidth={i%2===0?2:1.5} strokeOpacity="0.7" strokeLinecap="round" style={{ animation: dead ? 'none' : `tentacle${i%3} 2.5s ease-in-out ${i*0.3}s infinite` }} />
          ))}
        </svg>
      </div>
      <div style={{ fontSize:'0.68rem', color:'var(--text3)', marginTop:4, fontFamily:"'Anthropic Serif',Georgia,serif" }}>
        {dead ? '💀 Your jellyfish died! Study now to revive.' : sick ? `😰 Lumina is unwell (${daysSinceStudy}d absent)` : `💙 Lumina is happy${health===100?' & thriving':''}`}
      </div>
      {dead && (
        <div style={{ fontSize:'0.62rem', color:'var(--red)', marginTop:2 }}>Start a session to bring her back</div>
      )}
    </div>
  )
}

/* ══════════════════════════════
   ACTIVITY FEED
══════════════════════════════ */
function ActivityFeed({ events }) {
  if (!events || events.length === 0) return (
    <div style={{ color:'var(--text3)', fontSize:'0.78rem', textAlign:'center', padding:'16px 0' }}>No recent activity yet — start your first session!</div>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {events.slice(0, 8).map((ev, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--surface2)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', transition:'all 0.2s' }}>
          <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{ev.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.82rem', color:'var(--text)', fontWeight:500 }}>{ev.text}</div>
            <div style={{ fontSize:'0.62rem', color:'var(--text3)', marginTop:2 }}>{ev.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════
   MAIN STUDY OS
══════════════════════════════ */
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
  const timerStartRef = useRef(null)
  const activeSubjectRef = useRef(S.activeSubject || 'General')

  useEffect(() => {
    activeSubjectRef.current = S.activeSubject || 'General'
  }, [S.activeSubject])

  // Theme
  const [dark, setDark] = useState(true)
  const [theme, setTheme] = useState('premium-dark')
  const [showThemePicker, setShowThemePicker] = useState(false)

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
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // ─── LOAD USER DATA + CLOUD TIMER ───
  useEffect(() => {
    if (!session) return
    loadData()
    loadCloudTimer()
  }, [session])

  useEffect(() => {
    if (!timerRunning && timerMode === 'focus') {
      const mins = S.settings?.focusSessionMins || 25
      const secs = mins * 60
      setTimerTotal(secs)
      setTimerSecs(secs)
      saveCloudTimer({ timer_total: secs, timer_secs: secs, timer_mode: 'focus' })
    }
  }, [S.settings?.focusSessionMins, timerMode, timerRunning])

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
      // FIX: Clean corrupted studiedDays and recalculate streak from Supabase data
      merged.studiedDays = cleanStudiedDays(merged.studiedDays || [])
      merged.streak = calcStreakFromDays(merged.studiedDays)
      setS(merged)
      setDark(merged.settings?.darkMode !== false)
      const savedTheme = merged.settings?.theme || 'premium-dark'
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
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
          newSecs = Math.max(0, data.timer_secs - elapsed)
        }

        if (newSecs <= 0) {
          const completedSecs = data.segment_start_secs || data.timer_total || 1500
          if (isFocusTimerMode(newMode) && completedSecs > 0) {
            recordFocusSessionDirect(completedSecs, newStudyMode, activeSubjectRef.current)
          }
          setTimerRunning(false)
          segmentStartRef.current = null
        } else {
          setTimerRunning(true)
          segmentStartRef.current = data.segment_start_secs || data.timer_secs
          timerStartRef.current = Date.now() - elapsed * 1000
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
    timerStartRef.current = Date.now()
    const startSecs = timerSecs
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000)
      const remaining = Math.max(0, startSecs - elapsed)
      setTimerSecs(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        setTimerRunning(false)
        handleTimerComplete(segmentStartRef.current || timerTotal)
      }
    }, 1000)
  }

  // ─── TIMER COMPLETION ───
  const handleTimerComplete = useCallback((elapsedSecs) => {
    notify(isFocusTimerMode(timerMode) ? '✓ Session complete! Take a break.' : 'Break over. Back to work.')
    if (isFocusTimerMode(timerMode)) {
      recordFocusSessionDirect(elapsedSecs, S.studyMode, activeSubjectRef.current)
    }
    segmentStartRef.current = null
    timerStartRef.current = null
    saveCloudTimer({ is_running: false, started_at: null, timer_secs: 0, segment_start_secs: null })
  }, [timerMode, S.studyMode])

   // ─── RECORD SESSION (direct, no closure dependencies on timer state) ───
  const recordFocusSessionDirect = (elapsedSecs, studyMode, subject) => {
    const mins = Math.round(elapsedSecs / 60)
    if (mins < 1) return
    const today = todayKey()
    const activeSub = subject || 'General'
    const timeStr = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })

    updateS(prev => {
      const sessions = [...(prev.sessions || []), { date: today, mins, mode: studyMode || 'focus', ts: Date.now(), subject: activeSub }]
      const totalMinutes = (prev.totalMinutes || 0) + mins
      const todayMinutes = (prev.todayMinutes || 0) + mins
      // FIX: Clean studiedDays before adding today, dedupe, then recalculate streak
      const cleanDays = cleanStudiedDays(prev.studiedDays || [])
      const studiedDays = cleanDays.includes(today) ? cleanDays : [...cleanDays, today]
      const missedDays = (prev.missedDays || []).filter(d => d !== today)
      const streak = calcStreakFromDays(studiedDays)
      const isNewStreak = streak > (prev.streak || 0)
      const subjectMinutes = { ...prev.subjectMinutes, [activeSub]: (prev.subjectMinutes?.[activeSub] || 0) + mins }

      const feedEvents = [
        { icon:'⏱', text:`Completed ${mins}min ${activeSub !== 'General' ? `(${activeSub})` : 'focus'} session`, time: timeStr },
        ...(isNewStreak && streak > 0 ? [{ icon:'🔥', text:`Now on a ${streak}-day streak!`, time: timeStr }] : []),
        ...(totalMinutes >= 600 && (prev.totalMinutes||0) < 600 ? [{ icon:'⏰', text:'Hit 10 hours total study!', time: timeStr }] : []),
        ...(totalMinutes >= 3000 && (prev.totalMinutes||0) < 3000 ? [{ icon:'📚', text:'Hit 50 hours total study!', time: timeStr }] : []),
        ...(totalMinutes >= 6000 && (prev.totalMinutes||0) < 6000 ? [{ icon:'💎', text:'Hit 100 hours! Century Scholar!', time: timeStr }] : []),
      ]
      const activityFeed = [...feedEvents, ...(prev.activityFeed || [])].slice(0, 20)

      return { ...prev, sessions, totalMinutes, todayMinutes, studiedDays, missedDays, streak, lastStudiedDate: today, subjectMinutes, activityFeed }
    })
  }
  // ─── TIMER CONTROLS ───
  const startTimer = async () => {
    if (timerSecs <= 0) return
    const now = new Date().toISOString()
    segmentStartRef.current = timerSecs
    timerStartRef.current = Date.now()
    setTimerRunning(true)
    await saveCloudTimer({ is_running: true, started_at: now, segment_start_secs: timerSecs, timer_secs: timerSecs })
    startLocalTimer()
  }

  const pauseTimer = async () => {
    clearInterval(timerRef.current)
    setTimerRunning(false)
    let remaining = timerSecs
    if (isFocusTimerMode(timerMode) && segmentStartRef.current !== null && timerStartRef.current) {
      const realElapsed = Math.floor((Date.now() - timerStartRef.current) / 1000)
      const elapsedSecs = Math.min(segmentStartRef.current, realElapsed)
      remaining = Math.max(0, segmentStartRef.current - elapsedSecs)
      setTimerSecs(remaining)
      if (elapsedSecs > 0) {
        recordFocusSessionDirect(elapsedSecs, S.studyMode, activeSubjectRef.current)
      }
      segmentStartRef.current = null
      timerStartRef.current = null
    }
    await saveCloudTimer({ is_running: false, paused_at: new Date().toISOString(), timer_secs: remaining, segment_start_secs: null })
  }

  const resetTimer = async () => {
    clearInterval(timerRef.current)
    if (isFocusTimerMode(timerMode) && segmentStartRef.current !== null && timerRunning && timerStartRef.current) {
      const realElapsed = Math.floor((Date.now() - timerStartRef.current) / 1000)
      const elapsedSecs = Math.min(segmentStartRef.current, realElapsed)
      if (elapsedSecs > 0) {
        recordFocusSessionDirect(elapsedSecs, S.studyMode, activeSubjectRef.current)
      }
    }
    setTimerRunning(false)
    setTimerSecs(timerTotal)
    segmentStartRef.current = null
    timerStartRef.current = null
    await saveCloudTimer({ is_running: false, timer_secs: timerTotal, started_at: null, segment_start_secs: null })
  }

  const setMode = async (mode, mins) => {
    clearInterval(timerRef.current)
    if (isFocusTimerMode(timerMode) && segmentStartRef.current !== null && timerRunning && timerStartRef.current) {
      const realElapsed = Math.floor((Date.now() - timerStartRef.current) / 1000)
      const elapsedSecs = Math.min(segmentStartRef.current, realElapsed)
      if (elapsedSecs > 0) {
        recordFocusSessionDirect(elapsedSecs, S.studyMode, activeSubjectRef.current)
      }
    }
    setTimerRunning(false)
    setTimerMode(mode)
    const secs = mins * 60
    setTimerTotal(secs)
    setTimerSecs(secs)
    segmentStartRef.current = null
    timerStartRef.current = null
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
        {['dash','timer','city','room','music','cal','marks','diary','awards','ai','profile','settings'].map(p => (
          <a key={p} href="#" className={page === p ? 'active' : ''} onClick={e => { e.preventDefault(); setPage(p); setMobileOpen(false); setShowThemePicker(false) }}>
            {{ city:'City', room:'Study Rooms', dash:'Home', timer:'Focus', music:'Music', cal:'Calendar', marks:'Marks', diary:'Diary', awards:'Awards', ai:'AI Coach', profile:'Profile', settings:'Settings' }[p]}
          </a>
        ))}
      </div>

      <nav className="nav">
        <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => nav('/')}>
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <div className="nav-tabs">
          {[['dash','Home'],['timer','Focus'],['city','City'],['room','Rooms'],['music','Music'],['cal','Calendar'],['marks','Marks'],['diary','Diary'],['awards','Awards'],['ai','AI'],['settings','Settings']].map(([p, label]) => (
            <button key={p} className={`tab ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{label}</button>
          ))}
        </div>
        <div className="nav-right" style={{ position:'relative' }}>
          <button className="icon-btn" onClick={() => setShowThemePicker(p => !p)} title="Change theme" style={{ fontSize:'0.8rem' }}>🎨</button>
          {showThemePicker && (
            <div style={{ position:'absolute', top:44, right:0, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:14, padding:10, minWidth:200, zIndex:200, boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:'0.6rem', color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8, padding:'0 4px', fontFamily:"'Anthropic Serif',Georgia,serif" }}>Theme</div>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => { setTheme(t.id); updateS(prev => ({ ...prev, settings: { ...prev.settings, theme: t.id } })); setShowThemePicker(false) }}
                  style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'7px 10px', borderRadius:8, border:'none', background: theme === t.id ? 'var(--accent-soft)' : 'transparent', color: theme === t.id ? 'var(--accent)' : 'var(--text2)', cursor:'pointer', fontSize:'0.78rem', fontFamily:"'Anthropic Serif',Georgia,serif", transition:'all 0.15s' }}>
                  <span>{t.icon}</span><span>{t.label}</span>
                  {theme === t.id && <span style={{ marginLeft:'auto', color:'var(--accent)' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div className="user-avatar" onClick={() => { setPage('profile'); setShowThemePicker(false) }} title="Profile">{initials}</div>
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

      {/* ══ DASHBOARD ══ */}
      <div className={`page ${page === 'dash' ? 'active' : ''}`}>
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="card card-premium" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems:'center' }}>
            <div className="sec-label" style={{width:'100%'}}>Current Streak</div>
            <div className="streak-wrap" style={{ padding: '10px 0' }}>
              <div className="streak-ring">
                <div className="streak-num">{S.streak || 0}</div>
                <div className="streak-label">days</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
                {(S.streak || 0) > 0 ? '🔥 Keep going' : 'Start today!'}
              </div>
            </div>
            {(() => {
              const lastStudied = (S.studiedDays||[]).sort().at(-1)
              const daysSince = lastStudied ? Math.floor((Date.now() - new Date(lastStudied))/86400000) : 999
              return <JellyfishPet daysSinceStudy={daysSince} />
            })()}
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

        <div className="card" style={{ marginBottom: 14 }}>
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

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-label">Activity Feed</div>
          <ActivityFeed events={S.activityFeed || []} />
        </div>
      </div>

      {/* ══ PROFILE ══ */}
      <div className={`page ${page === 'profile' ? 'active' : ''}`}>
        {(() => {
          const displayName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Scholar'
          const email = session?.user?.email || ''
          const totalHours = Math.floor((S.totalMinutes||0)/60)
          const totalMins = (S.totalMinutes||0) % 60
          const examGroups = S.examGroups || []
          const allSubjects = S.subjects || []
          const subjectScores = {}
          examGroups.forEach(ex => {
            ex.marks?.forEach(m => {
              if (!subjectScores[m.subject]) subjectScores[m.subject] = []
              subjectScores[m.subject].push(m.score / m.total * 100)
            })
          })
          const subjectAvgs = Object.entries(subjectScores).map(([sub, scores]) => ({ sub, avg: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) }))
          const strongestSubject = subjectAvgs.sort((a,b)=>b.avg-a.avg)[0]
          const lastStudied = (S.studiedDays||[]).sort().at(-1)
          const daysSince = lastStudied ? Math.floor((Date.now()-new Date(lastStudied))/86400000) : 999
          const unlockedAwards = AWARDS.filter(a => a.req(S))
          const studyingNow = timerRunning && isFocusTimerMode(timerMode)
          return (
            <>
              <div className="card card-premium" style={{ marginBottom:14, textAlign:'center', padding:'32px 20px', background:'linear-gradient(135deg,rgba(212,168,83,0.15),rgba(201,149,106,0.08))' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', fontWeight:700, color:'#fff', margin:'0 auto 14px', boxShadow:'0 0 30px rgba(212,168,83,0.3)', fontFamily:"'Anthropic Serif',Georgia,serif" }}>
                  {displayName[0]?.toUpperCase()}
                </div>
                <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'1.5rem', fontWeight:700, color:'var(--text)', marginBottom:4 }}>{displayName}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text3)', marginBottom:12 }}>{email}</div>
                <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                  {studyingNow && <span style={{ background:'rgba(92,140,110,0.2)', color:'var(--green)', borderRadius:20, padding:'3px 12px', fontSize:'0.65rem', border:'1px solid rgba(92,140,110,0.3)', fontWeight:600 }}>● Studying now</span>}
                  {(S.streak||0) > 0 && <span style={{ background:'var(--accent-soft)', color:'var(--accent)', borderRadius:20, padding:'3px 12px', fontSize:'0.65rem', border:'1px solid rgba(212,168,83,0.3)' }}>🔥 {S.streak}-day streak</span>}
                  {unlockedAwards.length > 0 && <span style={{ background:'rgba(74,122,155,0.15)', color:'var(--blue)', borderRadius:20, padding:'3px 12px', fontSize:'0.65rem', border:'1px solid rgba(74,122,155,0.3)' }}>🏆 {unlockedAwards.length} award{unlockedAwards.length!==1?'s':''}</span>}
                </div>
              </div>

              <div className="grid4" style={{ marginBottom:14 }}>
                {[
                  { n:`${totalHours}h ${totalMins}m`, l:'Total Study', c:'var(--accent)' },
                  { n:S.streak||0, l:'Day Streak', c:'var(--green)' },
                  { n:(S.studiedDays||[]).length, l:'Days Studied', c:'var(--blue)' },
                  { n:unlockedAwards.length, l:'Awards', c:'var(--accent2)' },
                ].map(s => (
                  <div key={s.l} className="card" style={{ textAlign:'center', padding:'16px 8px' }}>
                    <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'1.6rem', fontWeight:700, color:s.c, lineHeight:1, marginBottom:4 }}>{s.n}</div>
                    <div style={{ fontSize:'0.6rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="grid2" style={{ marginBottom:14 }}>
                <div className="card">
                  <div className="sec-label">Study Identity</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
                    {[
                      { label:'Strongest Subject', val: strongestSubject ? `${strongestSubject.sub} (${strongestSubject.avg}%)` : 'No marks yet', icon:'📚' },
                      { label:'Favorite Mode', val: (S.sessions||[]).length > 0 ? (S.studyMode === 'deep' ? 'Deep Work' : S.studyMode === 'exam' ? 'Exam Mode' : 'Focus') : 'Not set', icon:'🎯' },
                      { label:'Daily Goal', val: `${S.dailyGoal||120} min/day`, icon:'📅' },
                      { label:'City Zone', val: (() => { const h=totalHours; if(h>=100)return'Metro'; if(h>=30)return'Forest/Mountain'; if(h>=10)return'Beach'; return'Starting Village' })(), icon:'🏙' },
                      { label:'Pet Status', val: daysSince > 2 ? '💀 Lumina died' : daysSince === 2 ? '😰 Lumina is sick' : '💙 Lumina is thriving', icon:'🪼' },
                    ].map(r => (
                      <div key={r.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                        <span style={{ fontSize:'1rem' }}>{r.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'0.62rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{r.label}</div>
                          <div style={{ fontSize:'0.82rem', color:'var(--text)', marginTop:1 }}>{r.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="sec-label">Earned Awards ({unlockedAwards.length}/{AWARDS.length})</div>
                  <div className="gift-grid" style={{ marginTop:8 }}>
                    {AWARDS.map(a => {
                      const unlocked = a.req(S)
                      return (
                        <div key={a.id} className={`gift-card ${unlocked ? 'unlocked' : ''}`} style={{ opacity: unlocked ? 1 : 0.3 }}>
                          <div className="gift-icon">{a.icon}</div>
                          <div style={{ fontSize:'0.55rem', textAlign:'center', lineHeight:1.3 }}>{a.title}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {subjectAvgs.length > 0 && (
                <div className="card" style={{ marginBottom:14 }}>
                  <div className="sec-label">Subject Breakdown</div>
                  {subjectAvgs.map((sa, i) => (
                    <div key={sa.sub} className="subject-row">
                      <div className="subject-name">{sa.sub}</div>
                      <div className="subject-bar-track"><div className="subject-bar-fill" style={{ width:`${sa.avg}%`, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} /></div>
                      <div className="subject-pct">{sa.avg}%</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <div className="sec-label">Edit Profile</div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input type="text" defaultValue={displayName} placeholder="Your name" onBlur={e => {
                    if (e.target.value.trim()) {
                      supabase.auth.updateUser({ data: { full_name: e.target.value.trim() } })
                      notify('Profile updated!')
                    }
                  }} />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-primary" onClick={() => notify('Profile updated!')}>Save Changes</button>
                  <button className="btn btn-ghost" onClick={() => setPage('settings')}>Settings →</button>
                </div>
              </div>
            </>
          )
        })()}
      </div>

      {/* ══ TIMER (OLD LOOK + NEW LOGIC) ══ */}
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
              {[['focus', `${S.settings?.focusSessionMins || 25}m Focus`, S.settings?.focusSessionMins || 25], ['short', '5m Break', 5], ['long', '15m Break', 15]].map(([m, label, mins]) => (
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
      let studied = [...(prev.studiedDays || [])]
      let missed = [...(prev.missedDays || [])]

      if (studied.includes(dateKey)) {
        studied = studied.filter(d => d !== dateKey)
        if (!missed.includes(dateKey)) missed.push(dateKey)
      } else if (missed.includes(dateKey)) {
        missed = missed.filter(d => d !== dateKey)
      } else {
        if (!studied.includes(dateKey)) studied.push(dateKey)
        missed = missed.filter(d => d !== dateKey)
      }

      return { ...prev, studiedDays: studied, missedDays: missed, streak: calcStreakFromDays(studied) }
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
    const examLabel = examGroups.find(e => String(e.id) === selectedExam)?.name || ''
    updateS(prev => ({
      ...prev,
      examGroups: prev.examGroups.map(ex =>
        String(ex.id) === selectedExam ? { ...ex, marks: [...ex.marks, mark] } : ex
      ),
      marks: [...(prev.marks || []), { ...mark, label: examLabel }]
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
  const [newSubject, setNewSubject] = useState('')
  const [displayName, setDisplayName] = useState(session?.user?.user_metadata?.full_name || '')
  const [activeSection, setActiveSection] = useState('account')

  const set = (key, val) => updateS(prev => ({ ...prev, settings: { ...prev.settings, [key]: val } }))
  const toggle = (key) => set(key, !S.settings?.[key])

  const addSubject = () => {
    if (!newSubject.trim()) return
    if ((S.subjects || []).includes(newSubject.trim())) { notify('Subject already exists.'); return }
    updateS(prev => ({ ...prev, subjects: [...(prev.subjects || []), newSubject.trim()] }))
    setNewSubject('')
    notify('Subject added.')
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'kosmosic-data.json'; a.click()
    URL.revokeObjectURL(url)
    notify('Data exported.')
  }

  const SECTIONS = [
    { id: 'account', label: 'Account' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'focus', label: 'Focus Session' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'subjects', label: 'Subjects' },
    { id: 'data', label: 'Data & Privacy' },
    { id: 'danger', label: 'Danger Zone' },
  ]

  const Toggle = ({ skey, label, sub }) => (
    <div className="toggle-wrap">
      <div className="toggle-info">
        <div className="toggle-name">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <div className={`toggle ${S.settings?.[skey] ? 'on' : ''}`} onClick={() => toggle(skey)} />
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="heading" style={{ marginBottom: 4 }}>Settings</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>{session?.user?.email}</div>
      </div>

      {/* Section Nav Pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {SECTIONS.map(s => (
          <button key={s.id} className={`chip ${activeSection === s.id ? 'active' : ''}`} onClick={() => setActiveSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── ACCOUNT ── */}
      {activeSection === 'account' && (
        <div className="card settings-section">
          <div className="settings-section-title">Account</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'grid', placeItems: 'center', fontSize: '1.4rem', fontWeight: 700, color: '#fff', border: '3px solid var(--border2)', flexShrink: 0 }}>
              {(displayName || session?.user?.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>{displayName || 'Your Name'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{session?.user?.email}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                await supabase.auth.updateUser({ data: { full_name: displayName } })
                notify('Name updated.')
              }} style={{ flexShrink: 0 }}>Save</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" value={session?.user?.email || ''} disabled style={{ opacity: 0.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign Out</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              await supabase.auth.resetPasswordForEmail(session?.user?.email)
              notify('Password reset email sent.')
            }}>Change Password</button>
          </div>
        </div>
      )}

      {/* ── APPEARANCE ── */}
      {activeSection === 'appearance' && (
        <div className="card settings-section">
          <div className="settings-section-title">Appearance</div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Theme</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['dark', 'Dark'], ['light', 'Light'], ['system', 'System']].map(([val, label]) => (
                <button key={val} className={`chip ${(S.settings?.theme || 'dark') === val ? 'active' : ''}`}
                  onClick={() => {
                    set('theme', val)
                    if (val !== 'system') { const isDark = val === 'dark'; setDark(isDark); set('darkMode', isDark) }
                    else { const sys = window.matchMedia('(prefers-color-scheme: dark)').matches; setDark(sys); set('darkMode', sys) }
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="divider" />
          <Toggle skey="animatedBg" label="Animated Background" sub="Floating particles and gradient pulses" />
          <Toggle skey="dopamineDetox" label="Dopamine Detox Mode" sub="Minimal UI — removes color accents and animations" />
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {activeSection === 'notifications' && (
        <div className="card settings-section">
          <div className="settings-section-title">Notifications</div>
          <Toggle skey="studyReminders" label="Study Reminders" sub="Remind you to start your daily session" />
          <div className="divider" />
          <Toggle skey="breakReminders" label="Break Reminders" sub="Notify when it's time to take a break" />
          <div className="divider" />
          <Toggle skey="goalReminder" label="Daily Goal Reminder" sub="Alert when you haven't met today's goal" />
          <div className="divider" />
          <Toggle skey="streakNotif" label="Streak Notifications" sub="Warn when your streak is at risk" />
          <div className="divider" />
          <Toggle skey="sessionSounds" label="Session Sounds" sub="Play sounds at start and end of focus sessions" />
        </div>
      )}

      {/* ── FOCUS SESSION ── */}
      {activeSection === 'focus' && (
        <div className="card settings-section">
          <div className="settings-section-title">Focus Session</div>
          <div className="grid2" style={{ gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Focus Session (min)</label>
              <input type="number" min={5} max={180} value={S.settings?.focusSessionMins || 25}
                onChange={e => set('focusSessionMins', +e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Short Break (min)</label>
              <input type="number" min={1} max={30} value={S.settings?.breakMins || 5}
                onChange={e => set('breakMins', +e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Long Break (min)</label>
              <input type="number" min={5} max={60} value={S.settings?.longBreakMins || 15}
                onChange={e => set('longBreakMins', +e.target.value)} />
            </div>
          </div>
          <div className="divider" />
          <Toggle skey="autoBreak" label="Auto-Start Breaks" sub="Automatically start break when focus ends" />
          <div className="divider" />
          <Toggle skey="autoNextSession" label="Auto-Start Next Session" sub="Loop automatically after break" />
          <div className="divider" />
          <Toggle skey="strictMode" label="Strict Mode" sub="Warn before quitting a session early" />
          <div className="divider" />
          <Toggle skey="warnQuit" label="Warn Before Quitting Focus" sub="Confirmation dialog when leaving mid-session" />
          <div className="divider" />
          <Toggle skey="detectInactivity" label="Detect Inactivity" sub="Pause timer if no input detected for 5 minutes" />
          <div className="divider" />
          <Toggle skey="pauseStreakExams" label="Pause Streaks During Exams" sub="Don't break your streak during exam periods" />
        </div>
      )}

      {/* ── PRODUCTIVITY ── */}
      {activeSection === 'productivity' && (
        <div className="card settings-section">
          <div className="settings-section-title">Productivity Goals</div>
          <div className="form-group">
            <label className="form-label">Daily Goal (minutes)</label>
            <input type="number" value={S.dailyGoal || 120} min={15} max={720}
              onChange={e => updateS(prev => ({ ...prev, dailyGoal: +e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Weekly Target (minutes)</label>
            <input type="number" value={S.weeklyGoal || 900} min={60} max={5040}
              onChange={e => updateS(prev => ({ ...prev, weeklyGoal: +e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Target Score (%)</label>
            <input type="number" value={S.targetPct || 98} min={50} max={100}
              onChange={e => updateS(prev => ({ ...prev, targetPct: +e.target.value }))} />
          </div>
          <div className="divider" />
          <Toggle skey="burnoutDetection" label="Burnout Detection" sub="Alert when study patterns suggest overload" />
          <div className="divider" />
          <Toggle skey="moodCheckins" label="Mood Check-ins" sub="Prompt for mood at start of each session" />
        </div>
      )}

      {/* ── SUBJECTS ── */}
      {activeSection === 'subjects' && (
        <div className="card settings-section">
          <div className="settings-section-title">Subjects</div>
          <div style={{ marginBottom: 14 }}>
            {(S.subjects || []).map(sub => (
              <div key={sub} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{sub}</span>
                <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)', borderColor: 'rgba(192,87,74,0.25)' }}
                  onClick={() => updateS(prev => ({ ...prev, subjects: prev.subjects.filter(s => s !== sub) }))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Add subject..." value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSubject()} />
            <button className="btn btn-primary btn-sm" onClick={addSubject} style={{ flexShrink: 0 }}>Add</button>
          </div>
        </div>
      )}

      {/* ── DATA ── */}
      {activeSection === 'data' && (
        <div className="card settings-section">
          <div className="settings-section-title">Data & Privacy</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
            All your data is stored in Supabase and synced across devices. You own your data — export or delete it at any time.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={exportData}>⬇ Export Data (JSON)</button>
          </div>
          <div className="divider" />
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text2)' }}>Supabase project:</strong> todzlszlihqzytihejiq.supabase.co<br />
            <strong style={{ color: 'var(--text2)' }}>Data model:</strong> Single JSONB column, one row per user, full RLS protection.
          </div>
        </div>
      )}

      {/* ── DANGER ZONE ── */}
      {activeSection === 'danger' && (
        <div className="card" style={{ border: '1px solid rgba(192,87,74,0.25)' }}>
          <div className="settings-section-title" style={{ color: 'var(--red)' }}>Danger Zone</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>Reset All Data</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Wipe streaks, sessions, marks, diary entries</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => {
                if (confirm('Reset ALL data? Streaks, sessions, marks, diary — everything. Cannot be undone.')) {
                  updateS(defaultState()); notify('Data reset.')
                }
              }}>Reset</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>Sign Out</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Sign out of this device</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign Out</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--red)' }}>Delete Account</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Permanently delete your account and all data</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => {
                if (confirm('Delete your account? This is permanent and cannot be undone.')) {
                  notify('Contact support to complete account deletion.')
                }
              }}>Delete Account</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", color: 'var(--accent)', marginBottom: 4, fontSize: '0.9rem' }}>Kosmosic — Study OS</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>Version 2.0 · Built for the relentless</div>
      </div>
    </div>
  )
}