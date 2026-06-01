import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

/* ─── Helpers ─── */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function fmtTime(secs) {
  const m = Math.floor(Math.abs(secs) / 60).toString().padStart(2, '0')
  const s = (Math.abs(secs) % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function fmtHours(secs) {
  return (Math.abs(secs) / 3600).toFixed(1)
}

/* ─── Themes ─── */
const ROOM_THEMES = {
  default: { icon: '🏙️', name: 'Standard', bg: 'transparent', overlay: 'transparent' },
  night: { icon: '🌙', name: '2AM Grind', bg: '#05050a', overlay: 'radial-gradient(circle at 50% 0%, rgba(30,35,60,0.4) 0%, transparent 80%)' },
  cafe: { icon: '☕', name: 'Cafe', bg: '#14100c', overlay: 'radial-gradient(circle at 50% 50%, rgba(60,40,20,0.1) 0%, transparent 100%)' },
  library: { icon: '📚', name: 'Library', bg: '#0d1117', overlay: 'linear-gradient(to right, rgba(20,30,40,0.2), transparent, rgba(20,30,40,0.2))' },
  space: { icon: '🚀', name: 'Mission Control', bg: '#000000', overlay: 'radial-gradient(ellipse at bottom, rgba(0,255,231,0.05) 0%, transparent 60%)' },
  rain: { icon: '🌧️', name: 'Rain', bg: '#0a111a', overlay: 'linear-gradient(180deg, rgba(50,70,90,0.1) 0%, transparent 100%)' },
}

export default function StudyRoom({ S, session, isStudying, timerSecs, timerMode }) {
  const [view, setView] = useState('lobby')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  
  const [members, setMembers] = useState([])
  const [feed, setFeed] = useState([]) // Chat + Activity
  const [chatInput, setChatInput] = useState('')
  
  // Room Synced State
  const [roomMotto, setRoomMotto] = useState('Silent work. Loud results.')
  const [roomTheme, setRoomTheme] = useState('default')
  const [groupGoalCurrent, setGroupGoalCurrent] = useState(0)
  const groupGoalTarget = 50 // Fixed target for demo
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)

  const chatRef = useRef(null)
  const channelRef = useRef(null)
  const prevStudyingRef = useRef(isStudying)

  const myName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Anonymous'
  const myId = session?.user?.id

  /* ─── Presence State ─── */
  const presenceRef = useRef({
    user_id: myId,
    name: myName,
    streak: S?.streak || 0,
    subject: S?.activeSubject || 'General',
    studying: isStudying,
    timer_secs: timerSecs,
    timer_mode: timerMode,
    total_secs: S?.totalMinutes ? S.totalMinutes * 60 : 0,
    last_active: Date.now()
  })

  useEffect(() => {
    presenceRef.current = {
      ...presenceRef.current,
      streak: S?.streak || 0,
      subject: S?.activeSubject || 'General',
      studying: isStudying,
      timer_secs: timerSecs,
      timer_mode: timerMode,
      total_secs: (S?.totalMinutes || 0) * 60 + (isStudying ? timerSecs : 0),
    }
  }, [S, isStudying, timerSecs, timerMode])

  /* ─── Auto-Reconnect ─── */
  useEffect(() => {
    const saved = localStorage.getItem('kosmosic_room_code')
    if (saved && myId) {
      setRoomCode(saved)
      setView('room')
    }
  }, [myId])

  /* ─── Room Connection & Sync ─── */
  useEffect(() => {
    if (view !== 'room' || !roomCode || !myId) return
    let mounted = true
    setLoading(true)

    const channel = supabase.channel(`kosmosic-room-${roomCode}`, {
      config: { presence: { key: myId } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!mounted) return
        const state = channel.presenceState()
        const users = Object.values(state).map(p => p[0])
        setMembers(users)
        
        // Calculate Group Goal dynamically based on connected users' total time
        const totalRoomSecs = users.reduce((acc, user) => acc + (user.total_secs || 0), 0)
        setGroupGoalCurrent(totalRoomSecs / 3600)
        setLoading(false)
      })
      .on('broadcast', { event: 'feed' }, ({ payload }) => {
        if (!mounted) return
        setFeed(prev => [...prev.slice(-99), payload])
        setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50)
      })
      .on('broadcast', { event: 'room_state' }, ({ payload }) => {
        if (!mounted) return
        if (payload.motto) setRoomMotto(payload.motto)
        if (payload.theme) setRoomTheme(payload.theme)
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !mounted) return
        await channel.track(presenceRef.current)
        
        // System Join Message
        channel.send({ type: 'broadcast', event: 'feed', payload: { type: 'activity', text: `${myName} entered the grid.`, ts: Date.now() } })
      })

    channelRef.current = channel

    const heartbeat = setInterval(() => {
      channelRef.current?.track(presenceRef.current).catch(() => {})
    }, 5000)

    return () => {
      mounted = false
      clearInterval(heartbeat)
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [view, roomCode, myId, myName])

  /* ─── Activity Broadcasting (Detecting state changes) ─── */
  useEffect(() => {
    if (view === 'room' && channelRef.current && prevStudyingRef.current !== isStudying) {
      const action = isStudying ? `initiated ${timerMode || 'Focus'} Protocol` : 'disengaged and went on break'
      const payload = { type: 'activity', text: `${myName} ${action}.`, ts: Date.now() }
      
      channelRef.current.send({ type: 'broadcast', event: 'feed', payload })
      setFeed(prev => [...prev.slice(-99), payload])
      setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50)
      
      prevStudyingRef.current = isStudying
    }
  }, [isStudying, timerMode, view, myName])

  /* ─── Actions ─── */
  const createRoom = () => {
    const code = generateCode()
    setRoomCode(code)
    localStorage.setItem('kosmosic_room_code', code)
    setView('room')
  }

  const joinRoom = (code) => {
    if (!code || code.length < 4) return setError('Invalid sector code.')
    const upper = code.trim().toUpperCase()
    setError('')
    setRoomCode(upper)
    localStorage.setItem('kosmosic_room_code', upper)
    setView('room')
  }

  const leaveRoom = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'feed', payload: { type: 'activity', text: `${myName} disconnected.`, ts: Date.now() } })
    channelRef.current?.unsubscribe()
    channelRef.current = null
    localStorage.removeItem('kosmosic_room_code')
    setView('lobby')
    setRoomCode('')
    setJoinCode('')
    setMembers([])
    setFeed([])
  }

  const sendInteraction = (type, content) => {
    if (!roomCode || !myId) return
    const payload = { type, name: myName, text: content, ts: Date.now() }
    
    channelRef.current?.send({ type: 'broadcast', event: 'feed', payload })
    setFeed(prev => [...prev.slice(-99), payload])
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50)
    setChatInput('')
    setShowEmojis(false)
  }

  const updateRoomState = (key, value) => {
    if (key === 'motto') setRoomMotto(value)
    if (key === 'theme') setRoomTheme(value)
    channelRef.current?.send({ type: 'broadcast', event: 'room_state', payload: { [key]: value } })
  }

  /* ─── Lobby View ─── */
  if (view === 'lobby') {
    return (
      <div className="page active" style={{ maxWidth: 800 }}>
        <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 40 }}>
          <div className="heading" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Study Sectors</div>
          <div style={{ color: 'var(--text3)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto' }}>
            Synchronize your focus. Enter a shared grid where silence is enforced and progress is visible.
          </div>
        </div>

        <div className="grid2" style={{ gap: 20 }}>
          <div className="card card-premium" style={{ textAlign: 'center', padding: '40px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚡</div>
            <div className="heading-sm" style={{ marginBottom: 8 }}>Initialize Sector</div>
            <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 24 }}>Generate a secure coordination code.</div>
            <button className="btn btn-primary" onClick={createRoom} style={{ width: '100%', padding: '12px' }}>Initialize</button>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 16 }}>📡</div>
            <div className="heading-sm" style={{ marginBottom: 8 }}>Connect to Sector</div>
            <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 20 }}>Enter active coordination code.</div>
            <input
              type="text"
              placeholder="ENTER CODE"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom(joinCode)}
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontWeight: 700, fontSize: '1.2rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}
            />
            {error && <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-ghost" onClick={() => joinRoom(joinCode)} style={{ width: '100%', padding: '12px' }}>Connect</button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Derived States for Room View ─── */
  const activeMembers = members.filter(m => m.studying)
  const activeCount = activeMembers.length
  const totalCount = Math.max(members.length, 1)
  const heatPct = Math.round((activeCount / totalCount) * 100)
  
  // 10. The Killer Feature: Shared Silence / Deep Focus Mode
  const isDeepFocus = members.length > 0 && activeCount === totalCount
  
  const currentTheme = ROOM_THEMES[roomTheme] || ROOM_THEMES.default
  const goalProgress = Math.min(100, (groupGoalCurrent / groupGoalTarget) * 100)

  /* ─── Room View ─── */
  return (
    <div className="page active" style={{ 
      maxWidth: 1200, 
      padding: '20px 24px', 
      minHeight: 'calc(100vh - 80px)',
      background: currentTheme.bg,
      transition: 'all 2s ease',
      position: 'relative'
    }}>
      
      {/* Theme Background Injector */}
      <div style={{ position: 'fixed', inset: 0, background: currentTheme.overlay, pointerEvents: 'none', zIndex: 0, transition: 'all 2s ease' }} />
      
      {/* Deep Focus Mode Global Overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99,
        background: isDeepFocus ? 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.6) 100%)' : 'transparent',
        backdropFilter: isDeepFocus ? 'grayscale(0.5) contrast(1.1)' : 'none',
        transition: 'all 3s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: isDeepFocus ? 1 : 0
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top Navigation & Motto */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div className="heading" style={{ fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Sector {roomCode}</div>
              <div style={{ 
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 10px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer'
              }} onClick={() => navigator.clipboard?.writeText(roomCode)} title="Copy Code">
                COPY
              </div>
            </div>
            
            {/* 9. Room Motto */}
            <input 
              value={roomMotto}
              onChange={e => updateRoomState('motto', e.target.value)}
              placeholder="Set room motto..."
              style={{
                background: 'transparent', border: 'none', color: 'var(--text3)', fontStyle: 'italic',
                fontSize: '0.9rem', width: '300px', outline: 'none', padding: 0
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* 4. Ambient Room Themes Selector */}
            <select 
              value={roomTheme} 
              onChange={e => updateRoomState('theme', e.target.value)}
              style={{ width: 'auto', padding: '6px 12px', background: 'var(--surface2)', fontSize: '0.75rem', borderRadius: 20 }}
            >
              {Object.entries(ROOM_THEMES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.name}</option>
              ))}
            </select>
            <button className="btn btn-danger btn-sm" onClick={leaveRoom}>Disconnect</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          
          {/* Main Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Top Dashboard Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              
              {/* 1. Study Heat */}
              <div className="card" style={{ padding: '20px', borderColor: isDeepFocus ? 'var(--accent)' : 'var(--border)', transition: 'all 1s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="sec-label" style={{ margin: 0 }}>Room Focus Level</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isDeepFocus ? 'var(--accent)' : 'var(--text)' }}>
                    {heatPct}%
                  </div>
                </div>
                
                <div style={{ width: '100%', height: 6, background: 'var(--surface3)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${heatPct}%`, height: '100%', borderRadius: 3,
                    background: isDeepFocus ? 'linear-gradient(90deg, #e5c07b, #d19a66)' : 'var(--text2)',
                    boxShadow: isDeepFocus ? '0 0 10px rgba(229,192,123,0.8)' : 'none',
                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                  }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text3)' }}>
                  <span>{activeCount} studying · {totalCount - activeCount} on break</span>
                  {isDeepFocus && <span style={{ color: 'var(--accent)', fontWeight: 700, animation: 'pulse 2s infinite' }}>🔥 LOCKED IN</span>}
                </div>
              </div>

              {/* 5. Group Goal */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="sec-label" style={{ margin: 0 }}>Room Target</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>
                    {groupGoalCurrent.toFixed(1)} / {groupGoalTarget} hrs
                  </div>
                </div>
                
                <div style={{ width: '100%', height: 6, background: 'var(--surface3)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${goalProgress}%`, height: '100%', borderRadius: 3,
                    background: goalProgress >= 100 ? 'var(--green)' : 'var(--blue)',
                    transition: 'width 1s'
                  }} />
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textAlign: 'right' }}>
                  {goalProgress >= 100 ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>🎉 Target Reached</span> : 'Collective effort'}
                </div>
              </div>
            </div>

            {/* 3. Desk View Cards (Members) */}
            <div>
              <div className="sec-label" style={{ marginBottom: 16 }}>Active Desks ({members.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {members.map(member => {
                  const isMe = member.user_id === myId
                  const modeColor = member.timer_mode === 'deep' ? 'var(--blue)' : member.timer_mode === 'exam' ? 'var(--red)' : 'var(--accent)'
                  
                  // 7. Last Seen Working formatting
                  const statusText = member.studying ? `Working for ${fmtHours(member.total_secs)}h` : `Idle. Last active recently.`

                  return (
                    <div 
                      key={member.user_id} 
                      className="card"
                      title={statusText}
                      style={{ 
                        padding: '0', 
                        fontFamily: "monospace", 
                        background: isMe ? 'var(--surface2)' : 'var(--surface)',
                        borderColor: member.studying ? `${modeColor}50` : 'var(--border)',
                        boxShadow: member.studying ? `0 4px 20px ${modeColor}15` : 'none',
                        transition: 'all 0.3s ease',
                        cursor: 'default'
                      }}
                    >
                      {/* Terminal-style Desk Card Header */}
                      <div style={{ 
                        padding: '8px 12px', borderBottom: '1px dashed var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: member.studying ? `${modeColor}10` : 'transparent'
                      }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: member.studying ? modeColor : 'var(--text2)' }}>
                          {member.name} {isMe && '(*)'}
                        </span>
                        {member.studying && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: modeColor, animation: 'pulse 1.5s infinite' }} />
                        )}
                      </div>
                      
                      {/* Desk Content */}
                      <div style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Subject:</span>
                          <span style={{ color: 'var(--text)' }}>{member.subject || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Timer:</span>
                          <span style={{ color: member.studying ? modeColor : 'var(--text3)', fontWeight: member.studying ? 700 : 400 }}>
                            {member.studying ? fmtTime(member.timer_secs) : '--:--'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Streak:</span>
                          <span style={{ color: '#e5c07b' }}>🔥 {member.streak} days</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Mode:</span>
                          <span style={{ color: 'var(--text3)' }}>{member.studying ? member.timer_mode?.toUpperCase() : 'STANDBY'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Feed & Leaderboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* 8. Mini Leaderboard */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="sec-label">Today's Focus (Room)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {[...members].sort((a, b) => (b.total_secs || 0) - (a.total_secs || 0)).slice(0, 5).map((m, i) => (
                  <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: 8, color: 'var(--text2)' }}>
                      <span style={{ color: 'var(--text3)', width: '12px' }}>{i+1}.</span>
                      <span style={{ fontWeight: m.user_id === myId ? 600 : 400, color: m.user_id === myId ? 'var(--accent)' : 'inherit' }}>{m.name}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{fmtHours(m.total_secs || 0)}h</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Live Activity Feed (Replaces standard chat) */}
            <div className="card" style={{ 
              flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', height: 500,
              opacity: isDeepFocus ? 0.4 : 1, transition: 'opacity 2s ease'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between' }}>
                <span className="sec-label" style={{ margin: 0 }}>Activity & Comms</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
              </div>
              
              <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {feed.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: 20 }}>
                    Grid communication initialized.
                  </div>
                )}
                {feed.map((item, i) => {
                  if (item.type === 'activity') {
                    return (
                      <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text3)', textAlign: 'center', padding: '4px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', background: 'var(--surface)', margin: '4px 0' }}>
                        {item.text}
                      </div>
                    )
                  }
                  
                  // Standard Chat
                  const isMe = item.name === myName
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginBottom: 2 }}>{item.name}</div>
                      <div style={{
                        background: isMe ? 'var(--surface3)' : 'var(--surface2)',
                        border: `1px solid ${isMe ? 'var(--border2)' : 'var(--border)'}`,
                        color: 'var(--text)', padding: '8px 12px', borderRadius: 8,
                        fontSize: '0.85rem', maxWidth: '90%', wordBreak: 'break-word',
                      }}>
                        {item.text}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Chat Input Area (File, Emoji, GIF) */}
              <div style={{ padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg)', position: 'relative' }}>
                
                {/* Fake Emoji Picker popover */}
                {showEmojis && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'flex', gap: 8, marginBottom: 8 }}>
                    {['🔥', '👍', '🚀', '💀', '💯', '📚'].map(emoji => (
                      <span key={emoji} style={{ cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setChatInput(prev => prev + emoji)}>
                        {emoji}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => setShowEmojis(!showEmojis)} title="Emojis">😀</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => sendInteraction('chat', `[Sent a GIF: Focus Mode]`)} title="Send GIF">GIF</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => sendInteraction('chat', `[Attached File: study_notes.pdf]`)} title="Attach File">📎</button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Broadcast message..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && chatInput.trim() && sendInteraction('chat', chatInput.trim())}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={() => sendInteraction('chat', chatInput.trim())} 
                    disabled={!chatInput.trim()}
                    style={{ padding: '0 16px' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}
