/* ═══════════════════════════════════════════════════════════════
   KOSMOSIC DEMO MODE
   ═══════════════════════════════════════════════════════════════

   WHAT THIS IS:
   A self-contained demo mode that generates synthetic but realistic
   user data locally in the browser. NO database writes. NO fake
   accounts. NO deceptive activity.

   HOW TO USE:
   1. Import DemoProvider and wrap your app
   2. Add ?demo=1 to your URL to activate
   3. A "DEMO MODE" banner appears on every screen
   4. All data lives in memory and resets on refresh

   ═══════════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useMemo } from 'react'

// ─── DEMO CONFIG ──────────────────────────────────────────────
const DEMO_CONFIG = {
  userCount: 6,
  names: ['Aarav', 'Priya', 'Zaid', 'Ananya', 'Rohan', 'Meera'],
  subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
  modes: ['focus', 'deep', 'exam'],
  maxStreak: 45,
  maxHours: 180,
  maxTodayMinutes: 140,
}

// ─── DEMO DATA GENERATOR ──────────────────────────────────────
function generateDemoUsers() {
  const users = []
  const today = new Date().toISOString().split('T')[0]

  for (let i = 0; i < DEMO_CONFIG.userCount; i++) {
    const hours = Math.floor(Math.random() * DEMO_CONFIG.maxHours)
    const streak = Math.floor(Math.random() * DEMO_CONFIG.maxStreak)
    const todayMins = Math.floor(Math.random() * DEMO_CONFIG.maxTodayMinutes)
    const isStudying = Math.random() > 0.6
    const mode = DEMO_CONFIG.modes[Math.floor(Math.random() * DEMO_CONFIG.modes.length)]

    // Generate realistic studied days (streak-aware)
    const studiedDays = []
    const missedDays = []
    const streakLen = Math.min(streak, 30)
    for (let d = 0; d < streakLen; d++) {
      const date = new Date()
      date.setDate(date.getDate() - d)
      studiedDays.push(date.toISOString().split('T')[0])
    }
    // Add some older studied days
    for (let d = streakLen + 2; d < streakLen + 15; d += Math.floor(Math.random() * 4) + 2) {
      const date = new Date()
      date.setDate(date.getDate() - d)
      studiedDays.push(date.toISOString().split('T')[0])
    }

    // Generate sessions
    const sessions = []
    const sessionCount = Math.floor(hours / 2) + Math.floor(Math.random() * 10)
    for (let s = 0; s < sessionCount; s++) {
      const date = new Date()
      date.setDate(date.getDate() - Math.floor(Math.random() * 30))
      sessions.push({
        date: date.toISOString().split('T')[0],
        mins: 20 + Math.floor(Math.random() * 40),
        mode: DEMO_CONFIG.modes[Math.floor(Math.random() * DEMO_CONFIG.modes.length)],
        ts: date.getTime(),
        subject: DEMO_CONFIG.subjects[Math.floor(Math.random() * DEMO_CONFIG.subjects.length)],
      })
    }

    // Generate activity feed
    const activityFeed = []
    const recentEvents = [
      { icon: '⏱', text: `Completed ${20 + Math.floor(Math.random() * 30)}min focus session`, time: '2h ago' },
      { icon: '🔥', text: `Now on a ${streak}-day streak!`, time: '3h ago' },
      { icon: '📚', text: 'Hit 50 hours total study!', time: '1d ago' },
      { icon: '🎯', text: 'Hit daily goal', time: '2d ago' },
      { icon: '🏆', text: 'Unlocked Weekly Warrior', time: '3d ago' },
    ]
    for (let e = 0; e < 3 + Math.floor(Math.random() * 4); e++) {
      activityFeed.push(recentEvents[e % recentEvents.length])
    }

    // Generate subject minutes
    const subjectMinutes = {}
    DEMO_CONFIG.subjects.forEach(sub => {
      subjectMinutes[sub] = Math.floor(Math.random() * hours * 12)
    })

    users.push({
      id: `demo-user-${i}`,
      name: DEMO_CONFIG.names[i],
      email: `${DEMO_CONFIG.names[i].toLowerCase()}@demo.kosmosic`,
      displayName: DEMO_CONFIG.names[i],
      totalMinutes: hours * 60,
      todayMinutes: todayMins,
      streak,
      studiedDays: studiedDays.sort(),
      missedDays,
      sessions: sessions.sort((a, b) => b.ts - a.ts),
      activityFeed,
      subjectMinutes,
      subjects: DEMO_CONFIG.subjects,
      dailyGoal: 120,
      weeklyGoal: 900,
      targetPct: 98,
      isStudying,
      studyMode: mode,
      buildingTier: Math.min(6, Math.floor(Math.log2(Math.max(hours + 1, 1)))),
      lastActive: new Date().toISOString(),
    })
  }

  return users
}

// ─── DEMO CONTEXT ─────────────────────────────────────────────
const DemoContext = createContext(null)

export function DemoProvider({ children }) {
  const isDemo = typeof window !== 'undefined' && 
    new URLSearchParams(window.location.search).get('demo') === '1'

  const demoUsers = useMemo(() => isDemo ? generateDemoUsers() : [], [isDemo])
  const [activeDemoUser, setActiveDemoUser] = useState(0)

  const currentUser = isDemo ? demoUsers[activeDemoUser] : null

  const value = {
    isDemo,
    demoUsers,
    currentUser,
    activeDemoUser,
    setActiveDemoUser,
    allResidents: demoUsers.map(u => ({
      id: u.id,
      name: u.name,
      hours: Math.floor(u.totalMinutes / 60),
      streak: u.streak,
      studying: u.isStudying,
      mode: u.studyMode,
      subject: u.studyMode === 'exam' ? 'Exam' : u.studyMode === 'deep' ? 'Deep Work' : 'Focus',
      isMe: u.id === currentUser?.id,
    })),
  }

  return (
    <DemoContext.Provider value={value}>
      {children}
      {isDemo && <DemoBanner />}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  return useContext(DemoContext) || { isDemo: false }
}

// ─── DEMO BANNER ──────────────────────────────────────────────
function DemoBanner() {
  const { demoUsers, activeDemoUser, setActiveDemoUser } = useDemo()

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'linear-gradient(135deg, #d4a853 0%, #c9956a 100%)',
      borderRadius: 16,
      padding: '12px 20px',
      boxShadow: '0 8px 32px rgba(212,168,83,0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      fontFamily: "'Anthropic Serif', Georgia, serif",
      maxWidth: '90vw',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1.2rem' }}>🎬</span>
        <div>
          <div style={{ fontWeight: 700, color: '#111', fontSize: '0.85rem' }}>
            DEMO MODE — Synthetic Data
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.6)' }}>
            No database writes · Refresh to reset · Not real users
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.7)', fontWeight: 600 }}>
          View as:
        </span>
        {demoUsers.map((u, i) => (
          <button
            key={u.id}
            onClick={() => setActiveDemoUser(i)}
            style={{
              background: activeDemoUser === i ? '#111' : 'rgba(0,0,0,0.15)',
              color: activeDemoUser === i ? '#d4a853' : '#111',
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: "'Anthropic Serif', Georgia, serif",
            }}
          >
            {u.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── DEMO HOOKS FOR COMPONENTS ────────────────────────────────

/**
 * Use this in StudyOS.jsx to get demo session data
 * Returns null if not in demo mode
 */
export function useDemoSession() {
  const { isDemo, currentUser } = useDemo()
  if (!isDemo) return null

  return {
    user: {
      id: currentUser.id,
      email: currentUser.email,
      user_metadata: { full_name: currentUser.displayName },
    },
  }
}

/**
 * Use this to get demo user state (replaces Supabase user_data)
 */
export function useDemoState() {
  const { isDemo, currentUser } = useDemo()
  if (!isDemo) return null

  return {
    streak: currentUser.streak,
    studiedDays: currentUser.studiedDays,
    missedDays: currentUser.missedDays,
    totalMinutes: currentUser.totalMinutes,
    todayMinutes: currentUser.todayMinutes,
    sessions: currentUser.sessions,
    subjects: currentUser.subjects,
    subjectMinutes: currentUser.subjectMinutes,
    dailyGoal: currentUser.dailyGoal,
    weeklyGoal: currentUser.weeklyGoal,
    targetPct: currentUser.targetPct,
    activityFeed: currentUser.activityFeed,
    studyMode: currentUser.studyMode,
    activeSubject: currentUser.subjects[0],
    settings: {
      darkMode: true,
      sound: true,
      strictMode: false,
      autoBreak: false,
      autoNextSession: false,
      sessionSounds: true,
      animatedBg: true,
      studyReminders: true,
      breakReminders: true,
      goalReminder: true,
      streakNotif: true,
      detectInactivity: false,
      warnQuit: true,
      pauseStreakExams: false,
      focusSessionMins: 25,
      breakMins: 5,
      longBreakMins: 15,
      burnoutDetection: false,
      moodCheckins: true,
      dopamineDetox: false,
      theme: 'premium-dark',
      pushNotifications: false,
    },
    did: '',
    plan: '',
    events: [],
    diary: [],
    marks: [],
    examGroups: [],
    aiHistory: [],
    lastStudiedDate: currentUser.studiedDays.at(-1) || null,
  }
}

/**
 * Use this in CityPage for demo city data
 */
export function useDemoCityProfiles() {
  const { isDemo, demoUsers } = useDemo()
  if (!isDemo) return []

  return demoUsers.map(u => ({
    user_id: u.id,
    display_name: u.name,
    total_hours: Math.floor(u.totalMinutes / 60),
    streak: u.streak,
    studied_days: u.studiedDays.length,
    goals_hit: u.sessions.length,
    avg_score: 85 + Math.floor(Math.random() * 12),
    is_studying: u.isStudying,
    study_mode: u.studyMode,
    missed_streak: u.missedDays.length,
    is_exam_mode: u.studyMode === 'exam',
    building_tier: u.buildingTier,
    last_active: u.lastActive,
    updated_at: u.lastActive,
  }))
}

export default DemoProvider
