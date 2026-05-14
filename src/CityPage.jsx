import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

const DEMO_USERS = [
  { id: 'd1', name: 'Arjun P.', hours: 312, streak: 47, studying: true, mode: 'deep', subject: 'Physics', rank: 'Penthouse' },
  { id: 'd2', name: 'Mia K.', hours: 189, streak: 22, studying: true, mode: 'focus', subject: 'Mathematics', rank: 'Tower' },
  { id: 'd3', name: 'Zaid R.', hours: 78, streak: 14, studying: false, mode: null, subject: 'Chemistry', rank: 'Mid-Rise' },
  { id: 'd4', name: 'Sofia L.', hours: 445, streak: 63, studying: true, mode: 'exam', subject: 'Biology', rank: 'Skyline' },
  { id: 'd5', name: 'Rayan M.', hours: 23, streak: 5, studying: false, mode: null, subject: 'English', rank: 'Apartment' },
  { id: 'd6', name: 'Emma T.', hours: 156, streak: 31, studying: true, mode: 'focus', subject: 'History', rank: 'Tower' },
  { id: 'd7', name: 'Kai S.', hours: 9, streak: 2, studying: false, mode: null, subject: 'Art', rank: 'Studio' },
  { id: 'd8', name: 'Priya V.', hours: 267, streak: 38, studying: true, mode: 'deep', subject: 'Computer Science', rank: 'Penthouse' },
]

function getBuildingSpec(hours, streak) {
  const level = Math.floor(Math.log2(Math.max(hours + 1, 1)))
  const height = Math.min(20, Math.max(3, Math.floor(hours / 15) + 3))
  const width = Math.min(70, Math.max(30, 28 + level * 4))
  const floors = height
  const windowsPerFloor = Math.floor(width / 14)
  let style = 'basic'
  if (hours >= 200) style = 'cyberpunk'
  else if (hours >= 100) style = 'glass'
  else if (hours >= 50) style = 'modern'
  else if (hours >= 20) style = 'mid'
  return { height, width, floors, windowsPerFloor, style, level }
}

function getWindowColor(mode, idx, floor, totalFloors) {
  if (!mode) return null
  const r = Math.random()
  if (r > 0.6) return null
  if (mode === 'deep') return 'blue'
  if (mode === 'exam') return 'red'
  if (mode === 'focus') return 'yellow'
  return 'yellow'
}

function Building({ user, spec, x, isMe, onClick, studying, mode, animOffset }) {
  const { height, width, floors, windowsPerFloor, style } = spec
  const pxH = height * 18

  const getBuildingBg = () => {
    if (style === 'cyberpunk') return 'linear-gradient(180deg, #0a0818 0%, #12102a 100%)'
    if (style === 'glass') return 'linear-gradient(180deg, #0d1a1f 0%, #111820 100%)'
    if (style === 'modern') return 'linear-gradient(180deg, #141414 0%, #1a1a1a 100%)'
    return 'linear-gradient(180deg, #111 0%, #1a1915 100%)'
  }

  const getBorderColor = () => {
    if (isMe) return 'rgba(212,168,83,0.8)'
    if (style === 'cyberpunk') return 'rgba(100,80,255,0.4)'
    if (style === 'glass') return 'rgba(80,160,200,0.3)'
    return 'rgba(255,251,240,0.12)'
  }

  const getGlow = () => {
    if (isMe && studying) return '0 0 30px rgba(212,168,83,0.4), 0 0 60px rgba(212,168,83,0.15)'
    if (isMe) return '0 0 20px rgba(212,168,83,0.2)'
    if (studying && mode === 'deep') return '0 0 20px rgba(80,120,255,0.25)'
    if (studying) return '0 0 16px rgba(255,220,80,0.2)'
    return 'none'
  }

  const windows = []
  for (let f = 0; f < floors; f++) {
    for (let w = 0; w < windowsPerFloor; w++) {
      const isLit = studying && Math.sin(f * 7 + w * 13 + animOffset) > 0.1
      const wMode = isLit ? mode : null
      windows.push({ f, w, lit: isLit, mode: wMode })
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', bottom: 40, left: x,
        width, height: pxH,
        background: getBuildingBg(),
        border: `1px solid ${getBorderColor()}`,
        borderBottom: 'none',
        borderRadius: '3px 3px 0 0',
        boxShadow: getGlow(),
        cursor: 'pointer',
        transition: 'box-shadow 0.5s ease',
        overflow: 'hidden',
        zIndex: isMe ? 10 : 5,
      }}
    >
      {/* Building texture lines */}
      {style === 'cyberpunk' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: '30%', width: 1, height: '100%', background: 'rgba(100,80,255,0.15)' }} />
          <div style={{ position: 'absolute', top: 0, left: '60%', width: 1, height: '100%', background: 'rgba(100,80,255,0.1)' }} />
        </>
      )}
      {style === 'glass' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(80,160,200,0.05) 50%, transparent 100%)' }} />
      )}

      {/* Windows */}
      <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
        {Array.from({ length: floors }, (_, f) => (
          <div key={f} style={{ display: 'flex', gap: 3, justifyContent: 'center', flex: 1, alignItems: 'center' }}>
            {Array.from({ length: windowsPerFloor }, (_, w) => {
              const win = windows.find(x => x.f === f && x.w === w)
              const lit = win?.lit
              const wm = win?.mode
              const color = lit
                ? wm === 'deep' ? 'rgba(80,120,255,0.9)'
                  : wm === 'exam' ? 'rgba(220,80,80,0.9)'
                  : 'rgba(255,215,80,0.9)'
                : 'rgba(255,255,255,0.04)'
              const glow = lit
                ? wm === 'deep' ? '0 0 6px rgba(80,120,255,0.8)'
                  : wm === 'exam' ? '0 0 6px rgba(220,80,80,0.8)'
                  : '0 0 6px rgba(255,215,80,0.7)'
                : 'none'
              return (
                <div key={w} style={{
                  width: 6, height: 7, background: color,
                  borderRadius: 1, boxShadow: glow,
                  transition: 'background 1s ease, box-shadow 1s ease',
                }} />
              )
            })}
          </div>
        ))}
      </div>

      {/* Rooftop antenna/spire for tall buildings */}
      {spec.height >= 12 && (
        <div style={{
          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 16,
          background: isMe ? 'var(--accent)' : style === 'cyberpunk' ? 'rgba(100,80,255,0.8)' : 'rgba(255,251,240,0.2)',
          boxShadow: isMe ? '0 0 8px rgba(212,168,83,0.6)' : 'none',
        }} />
      )}

      {/* Me indicator */}
      {isMe && (
        <div style={{
          position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', borderRadius: 4, padding: '2px 6px',
          fontSize: '0.55rem', fontWeight: 700, color: '#000', whiteSpace: 'nowrap',
          fontFamily: "'Anthropic Serif',Georgia,serif",
        }}>YOU</div>
      )}

      {/* Study glow overlay */}
      {studying && (
        <div style={{
          position: 'absolute', inset: 0,
          background: mode === 'deep'
            ? 'linear-gradient(0deg, rgba(80,120,255,0.04) 0%, transparent 60%)'
            : 'linear-gradient(0deg, rgba(255,215,80,0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

export default function CityPage({ S, session, isStudying, studyMode }) {
  const [onlineUsers, setOnlineUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [animOffset, setAnimOffset] = useState(0)
  const [time, setTime] = useState(new Date())
  const channelRef = useRef(null)

  const myHours = Math.floor((S.totalMinutes || 0) / 60)
  const mySpec = getBuildingSpec(myHours, S.streak || 0)
  const myUsername = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'You'

  // Animate windows flicker
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimOffset(o => o + 0.3)
      setTime(new Date())
    }, 800)
    return () => clearInterval(interval)
  }, [])

  // Supabase Realtime presence
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel('kosmosic-city', {
      config: { presence: { key: session.user.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.entries(state).map(([uid, presences]) => ({
          id: uid,
          ...(presences[0] || {}),
        })).filter(u => u.id !== session.user.id)
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: session.user.id,
            name: myUsername,
            hours: myHours,
            streak: S.streak || 0,
            studying: isStudying,
            mode: studyMode || null,
            subject: S.activeSubject || 'General',
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [session, isStudying, studyMode, myHours, S.streak])

  // Build city layout
  const isNight = time.getHours() >= 20 || time.getHours() < 7
  const allUsers = [
    ...DEMO_USERS,
    ...onlineUsers.filter(u => !DEMO_USERS.find(d => d.id === u.id)),
  ]

  // Calculate positions
  const buildingData = []
  let xCursor = 20
  allUsers.forEach((user, i) => {
    const spec = getBuildingSpec(user.hours || 0, user.streak || 0)
    buildingData.push({ user, spec, x: xCursor })
    xCursor += spec.width + 8
  })
  // Insert MY building after ~half
  const myInsertX = buildingData.length > 0 ? Math.floor(buildingData.length / 2) : 0
  let totalWidth = xCursor + mySpec.width + 20

  const skyColor = isNight
    ? 'linear-gradient(180deg, #02010a 0%, #080615 40%, #0c0b18 100%)'
    : 'linear-gradient(180deg, #0c1a2e 0%, #0f2340 40%, #0c0b18 100%)'

  const getRankLabel = (hours) => {
    if (hours >= 200) return { label: 'Skyline Tower', color: '#d4a853' }
    if (hours >= 100) return { label: 'Penthouse', color: '#c9956a' }
    if (hours >= 50) return { label: 'High-Rise', color: '#4a7a9b' }
    if (hours >= 20) return { label: 'Mid-Rise', color: '#5c8c6e' }
    if (hours >= 5) return { label: 'Apartment', color: '#7a7468' }
    return { label: 'Studio', color: '#5a5248' }
  }

  const myRank = getRankLabel(myHours)

  return (
    <div style={{ position: 'relative', zIndex: 2 }}>
      {/* HEADER */}
      <div style={{ padding: '80px 24px 0', maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div className="heading" style={{ marginBottom: 4 }}>Study City</div>
            <div style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>
              {onlineUsers.length + DEMO_USERS.filter(d => d.studying).length} studying live right now
              <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5c8c6e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ color: '#5c8c6e' }}>Live</span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(255,215,80,0.9)', boxShadow: '0 0 6px rgba(255,215,80,0.7)' }} />
              <span style={{ color: 'var(--text3)' }}>Focus</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(80,120,255,0.9)', boxShadow: '0 0 6px rgba(80,120,255,0.8)' }} />
              <span style={{ color: 'var(--text3)' }}>Deep Work</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(220,80,80,0.9)', boxShadow: '0 0 6px rgba(220,80,80,0.8)' }} />
              <span style={{ color: 'var(--text3)' }}>Exam</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ color: 'var(--text3)' }}>Offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* CITY VIEWPORT */}
      <div style={{
        width: '100%', height: 440,
        background: skyColor,
        position: 'relative', overflow: 'hidden',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Stars */}
        {isNight && Array.from({ length: 60 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23) % 45}%`,
            width: i % 5 === 0 ? 2 : 1,
            height: i % 5 === 0 ? 2 : 1,
            background: '#fff',
            borderRadius: '50%',
            opacity: 0.3 + (i % 7) * 0.1,
            animation: `pulse ${2 + (i % 4)}s ease-in-out infinite`,
            animationDelay: `${(i % 5) * 0.4}s`,
          }} />
        ))}

        {/* Moon/Sun */}
        <div style={{
          position: 'absolute', right: 60, top: 30,
          width: isNight ? 28 : 40, height: isNight ? 28 : 40,
          borderRadius: '50%',
          background: isNight
            ? 'radial-gradient(circle at 35% 35%, #e8dfc8, #c4b896)'
            : 'radial-gradient(circle, #FFD580, #FF9F00)',
          boxShadow: isNight
            ? '0 0 20px rgba(232,223,200,0.15)'
            : '0 0 40px rgba(255,160,0,0.3)',
        }} />

        {/* Ambient fog/haze at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(0deg, rgba(12,11,9,0.8) 0%, transparent 100%)',
          zIndex: 20, pointerEvents: 'none',
        }} />

        {/* City scrollable container */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: '100%', height: '100%',
          overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{ position: 'relative', width: Math.max(totalWidth + 200, 900), height: '100%', minWidth: '100%' }}>

            {/* Ground */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
              background: 'linear-gradient(0deg, #090808 0%, #111010 100%)',
              borderTop: '1px solid rgba(212,168,83,0.12)',
              zIndex: 15,
            }}>
              {/* Road markings */}
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: `${i * 100 + 40}px`,
                  width: 40, height: 2, background: 'rgba(255,251,240,0.06)',
                  transform: 'translateY(-50%)',
                }} />
              ))}
            </div>

            {/* Demo buildings left side */}
            {buildingData.slice(0, Math.ceil(buildingData.length / 2)).map(({ user, spec, x }) => (
              <Building
                key={user.id}
                user={user}
                spec={spec}
                x={x}
                isMe={false}
                studying={user.studying}
                mode={user.mode}
                animOffset={animOffset}
                onClick={() => setSelectedUser(user)}
              />
            ))}

            {/* MY BUILDING — center */}
            <Building
              user={{ name: myUsername, hours: myHours, streak: S.streak || 0, studying: isStudying, mode: studyMode }}
              spec={mySpec}
              x={buildingData.slice(0, Math.ceil(buildingData.length / 2)).reduce((acc, b) => acc + b.spec.width + 8, 20)}
              isMe={true}
              studying={isStudying}
              mode={studyMode || 'focus'}
              animOffset={animOffset}
              onClick={() => setSelectedUser({ name: myUsername, hours: myHours, streak: S.streak || 0, studying: isStudying, isMe: true })}
            />

            {/* Demo buildings right side */}
            {buildingData.slice(Math.ceil(buildingData.length / 2)).map(({ user, spec, x }) => (
              <Building
                key={user.id}
                user={user}
                spec={spec}
                x={x + mySpec.width + 12}
                isMe={false}
                studying={user.studying}
                mode={user.mode}
                animOffset={animOffset}
                onClick={() => setSelectedUser(user)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* BELOW CITY */}
      <div style={{ padding: '16px 24px 40px', maxWidth: 920, margin: '0 auto' }}>

        {/* YOUR BUILDING CARD */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div className="card card-premium">
            <div className="sec-label">Your Building</div>
            <div style={{ display: 'flex', align: 'center', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '1.3rem', fontWeight: 700, color: myRank.color, marginBottom: 2 }}>
                  {myRank.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{myHours}h studied · {S.streak || 0} day streak</div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.6 }}>
              {myHours < 5 && "Your studio is quiet. Start studying to light it up."}
              {myHours >= 5 && myHours < 20 && "Your apartment windows are starting to glow. Keep going."}
              {myHours >= 20 && myHours < 50 && "Your mid-rise is rising. The city is noticing."}
              {myHours >= 50 && myHours < 100 && "Your high-rise towers above most. Neighbors look up."}
              {myHours >= 100 && myHours < 200 && "Penthouse life. You're becoming a local legend."}
              {myHours >= 200 && "Skyline Tower. You're the most recognizable building in the city."}
            </div>
            {isStudying && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--accent)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                Your windows are glowing right now
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div className="sec-label" style={{ marginBottom: 6 }}>Next Level</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.min(100, (myHours % 50) * 2)}%` }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: 4 }}>
                {Math.max(0, 50 - (myHours % 50))}h until next upgrade
              </div>
            </div>
          </div>

          <div className="card">
            <div className="sec-label">City Leaderboard</div>
            {[...DEMO_USERS, { id: 'me', name: myUsername + ' (you)', hours: myHours, streak: S.streak || 0, studying: isStudying }]
              .sort((a, b) => b.hours - a.hours)
              .slice(0, 5)
              .map((u, i) => {
                const rank = getRankLabel(u.hours)
                const isMe = u.id === 'me'
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontWeight: 700, fontSize: '0.8rem', color: i === 0 ? '#d4a853' : i === 1 ? '#aaa' : i === 2 ? '#c9956a' : 'var(--text3)', width: 16 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: isMe ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name}
                        {u.studying && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#5c8c6e', display: 'inline-block' }} />}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: rank.color }}>{rank.label}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{u.hours}h</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text3)' }}>🔥 {u.streak}d</div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* LIVE ACTIVITY */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="sec-label" style={{ margin: 0 }}>Live Activity</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>Real-time · updates every second</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...DEMO_USERS.filter(d => d.studying), ...onlineUsers.filter(u => u.studying)].map(u => (
              <div key={u.id} className="card-inner" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
                onClick={() => setSelectedUser(u)}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: u.mode === 'deep' ? 'rgba(80,120,255,0.9)' : u.mode === 'exam' ? 'rgba(220,80,80,0.9)' : 'rgba(255,215,80,0.9)',
                  boxShadow: u.mode === 'deep' ? '0 0 6px rgba(80,120,255,0.8)' : u.mode === 'exam' ? '0 0 6px rgba(220,80,80,0.8)' : '0 0 6px rgba(255,215,80,0.7)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)' }}>{u.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{u.subject || 'Studying'}</div>
                </div>
              </div>
            ))}
            {!isStudying && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', padding: '8px 0' }}>
                Start a focus session to appear here with a glowing window →
              </div>
            )}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="card">
          <div className="sec-label">How Your Building Evolves</div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { label: 'Studio', hours: '0–5h', color: '#5a5248' },
              { label: 'Apartment', hours: '5–20h', color: '#7a7468' },
              { label: 'Mid-Rise', hours: '20–50h', color: '#5c8c6e' },
              { label: 'High-Rise', hours: '50–100h', color: '#4a7a9b' },
              { label: 'Penthouse', hours: '100–200h', color: '#c9956a' },
              { label: 'Skyline Tower', hours: '200h+', color: '#d4a853' },
            ].map((tier, i) => (
              <div key={tier.label} style={{
                flex: '0 0 auto', textAlign: 'center', padding: '12px 16px',
                background: myHours >= [0,5,20,50,100,200][i] ? 'var(--accent-soft)' : 'var(--surface2)',
                border: `1px solid ${myHours >= [0,5,20,50,100,200][i] ? tier.color + '50' : 'var(--border)'}`,
                borderRadius: 10,
              }}>
                <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontWeight: 700, color: tier.color, fontSize: '0.82rem', marginBottom: 2 }}>{tier.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{tier.hours}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* USER PROFILE MODAL */}
      {selectedUser && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setSelectedUser(null)}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-title">{selectedUser.name}</div>
              <button className="modal-close" onClick={() => setSelectedUser(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="card-inner" style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)' }}>{selectedUser.hours}h</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Study</div>
              </div>
              <div className="card-inner" style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--green)' }}>🔥{selectedUser.streak}d</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streak</div>
              </div>
            </div>
            <div className="card-inner" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: selectedUser.studying
                    ? selectedUser.mode === 'deep' ? 'rgba(80,120,255,0.9)' : 'rgba(255,215,80,0.9)'
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: selectedUser.studying ? '0 0 8px rgba(255,215,80,0.7)' : 'none',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>
                    {selectedUser.studying ? `Studying ${selectedUser.subject || 'right now'}` : 'Offline'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                    {selectedUser.studying ? 'Window is glowing' : 'Window is dark'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.6 }}>
              {getRankLabel(selectedUser.hours).label} · {selectedUser.hours}h studied
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )

  function _unused(hours) {
    if (hours >= 200) return { label: 'Skyline Tower', color: '#d4a853' }
    if (hours >= 100) return { label: 'Penthouse', color: '#c9956a' }
    if (hours >= 50) return { label: 'High-Rise', color: '#4a7a9b' }
    if (hours >= 20) return { label: 'Mid-Rise', color: '#5c8c6e' }
    if (hours >= 5) return { label: 'Apartment', color: '#7a7468' }
    return { label: 'Studio', color: '#5a5248' }
  }
}
