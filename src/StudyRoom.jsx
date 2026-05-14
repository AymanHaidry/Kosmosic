import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function fmtTime(secs) {
  const m = Math.floor(Math.abs(secs) / 60).toString().padStart(2, '0')
  const s = (Math.abs(secs) % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function StudyRoom({ S, session, isStudying, timerSecs, timerMode }) {
  const [view, setView] = useState('lobby') // lobby | room
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [error, setError] = useState('')
  const channelRef = useRef(null)
  const chatRef = useRef(null)

  const myName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Anonymous'
  const myId = session?.user?.id

  const joinRoom = async (code) => {
    if (!code || code.length < 4) { setError('Enter a valid room code.'); return }
    const upper = code.trim().toUpperCase()
    setError('')
    setRoomCode(upper)
    await connectToRoom(upper)
    setView('room')
  }

  const createRoom = async () => {
    const code = generateCode()
    setRoomCode(code)
    await connectToRoom(code)
    setView('room')
  }

  const connectToRoom = async (code) => {
    if (channelRef.current) channelRef.current.unsubscribe()

    const channel = supabase.channel(`kosmosic-room-${code}`, {
      config: { presence: { key: myId } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.entries(state).map(([uid, presences]) => ({
          id: uid,
          ...(presences[0] || {}),
        }))
        setMembers(users)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages(prev => [...prev.slice(-49), payload])
        setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: myId,
            name: myName,
            streak: S.streak || 0,
            subject: S.activeSubject || 'General',
            studying: isStudying,
            timer_secs: timerSecs,
            timer_mode: timerMode,
            joined_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel
  }

  // Keep presence updated as timer/study state changes
  useEffect(() => {
    if (view !== 'room' || !channelRef.current) return
    channelRef.current.track({
      user_id: myId,
      name: myName,
      streak: S.streak || 0,
      subject: S.activeSubject || 'General',
      studying: isStudying,
      timer_secs: timerSecs,
      timer_mode: timerMode,
      joined_at: new Date().toISOString(),
    })
  }, [isStudying, timerSecs, timerMode, S.activeSubject, S.streak])

  const leaveRoom = () => {
    if (channelRef.current) channelRef.current.unsubscribe()
    channelRef.current = null
    setMembers([])
    setMessages([])
    setRoomCode('')
    setView('lobby')
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !channelRef.current) return
    const msg = { name: myName, text: chatInput.trim(), ts: Date.now() }
    await channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg })
    setMessages(prev => [...prev.slice(-49), msg])
    setChatInput('')
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50)
  }

  if (view === 'lobby') return (
    <div className="page active">
      <div style={{ marginBottom: 28 }}>
        <div className="heading" style={{ marginBottom: 6 }}>Study Rooms</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem', maxWidth: 500 }}>
          Create a room and share the code. Friends join and you all appear on the same screen — timers running, streaks visible. The communal 2AM session, built different.
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: 20 }}>
        <div className="card card-premium" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏠</div>
          <div className="heading-sm" style={{ marginBottom: 8 }}>Create a Room</div>
          <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 20 }}>
            Get a 6-letter code to share with friends
          </div>
          <button className="btn btn-primary" onClick={createRoom} style={{ width: '100%' }}>
            Create Room
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🚪</div>
          <div className="heading-sm" style={{ marginBottom: 8 }}>Join a Room</div>
          <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 16 }}>
            Enter the room code from your friend
          </div>
          <input type="text" placeholder="ENTER CODE" value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinRoom(joinCode)}
            style={{ textAlign: 'center', letterSpacing: '0.2em', fontWeight: 700, fontSize: '1.1rem', marginBottom: 10 }} />
          {error && <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginBottom: 8 }}>{error}</div>}
          <button className="btn btn-ghost" onClick={() => joinRoom(joinCode)} style={{ width: '100%' }}>
            Join Room
          </button>
        </div>
      </div>

      <div className="card">
        <div className="sec-label">How It Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '📋', t: 'Create or join a room', d: 'One person creates, gets a code. Everyone else enters that code.' },
            { icon: '⏱', t: 'Run your own timer', d: 'Each person controls their own Focus timer. The room just shows everyone\'s live status.' },
            { icon: '👁', t: 'See each other live', d: 'Names, streaks, what subject, timer countdown — all visible in real-time.' },
            { icon: '💬', t: 'Quick chat', d: 'Short messages to stay accountable. Not for distraction — for motivation.' },
          ].map(item => (
            <div key={item.t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{item.t}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{item.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const me = members.find(m => m.id === myId)
  const others = members.filter(m => m.id !== myId)
  const activeCount = members.filter(m => m.studying).length

  return (
    <div className="page active">
      {/* Room Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="heading" style={{ marginBottom: 4 }}>Room: {roomCode}</div>
          <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>
            {members.length} member{members.length !== 1 ? 's' : ''} · {activeCount} studying now
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 14px', fontFamily: "'Anthropic Serif',Georgia,serif", fontWeight: 700, letterSpacing: '0.15em', fontSize: '1rem', color: 'var(--accent)' }}>
            {roomCode}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(roomCode); }}>Copy</button>
          <button className="btn btn-danger btn-sm" onClick={leaveRoom}>Leave</button>
        </div>
      </div>

      {/* Members Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
        {members.map(member => {
          const isMe = member.id === myId
          const modeColor = member.timer_mode === 'deep' ? 'var(--blue)' : member.timer_mode === 'long' ? 'var(--green)' : 'var(--accent)'
          return (
            <div key={member.id} className={`card ${isMe ? 'card-premium' : ''}`} style={{ position: 'relative', padding: 16 }}>
              {isMe && (
                <div style={{ position: 'absolute', top: 10, right: 10, fontSize: '0.58rem', background: 'var(--accent)', color: '#000', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>YOU</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${member.studying ? modeColor : 'var(--surface3)'}, ${member.studying ? 'var(--accent2)' : 'var(--surface2)'})`,
                  display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#fff',
                  boxShadow: member.studying ? `0 0 16px ${modeColor}40` : 'none',
                  transition: 'box-shadow 0.5s',
                }}>
                  {member.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>🔥 {member.streak || 0} day streak</div>
                </div>
              </div>

              {/* Timer display */}
              <div style={{
                background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px',
                textAlign: 'center', marginBottom: 8, border: '1px solid var(--border)',
              }}>
                {member.studying ? (
                  <>
                    <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontVariantNumeric: 'tabular-nums', fontSize: '1.6rem', fontWeight: 400, color: modeColor }}>
                      {fmtTime(member.timer_secs || 0)}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
                      {{ focus: 'Focus', short: 'Short Break', long: 'Long Break' }[member.timer_mode] || 'Focus'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text3)', padding: '4px 0' }}>Not studying</div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: member.studying ? '#5c8c6e' : 'var(--text3)',
                  boxShadow: member.studying ? '0 0 6px rgba(92,140,110,0.6)' : 'none',
                  animation: member.studying ? 'pulse 1.5s infinite' : 'none',
                }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                  {member.studying ? (member.subject || 'Studying') : 'Idle'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chat */}
      <div className="card">
        <div className="sec-label">Room Chat</div>
        <div ref={chatRef} style={{ height: 160, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: '0.78rem', fontStyle: 'italic' }}>No messages yet. Say hi.</div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: msg.name === myName ? 'var(--accent)' : 'var(--text2)', flexShrink: 0 }}>{msg.name}:</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.4 }}>{msg.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Send a message..." value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={sendChat} style={{ flexShrink: 0 }}>Send</button>
        </div>
      </div>
    </div>
  )
}
