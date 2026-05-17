import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import Launcher from './Launcher.jsx'
import StudyOS from './StudyOS.jsx'
import StudyRoom from './StudyRoom'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.addEventListener('click', (e) => {
      const ripple = document.createElement('div')
      ripple.className = 'click-ripple'
      ripple.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:20px;height:20px;margin-left:-10px;margin-top:-10px`
      document.body.appendChild(ripple)
      setTimeout(() => ripple.remove(), 500)
    })
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
      <div style={{ fontFamily: "'Anthropic Serif',Georgia,serif", color: 'var(--accent)', fontSize: '1.2rem' }}>Loading...</div>
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={<Launcher session={session} />} />
      <Route path="/launcher" element={<Launcher session={session} />} />
      <Route path="/app" element={<StudyOS session={session} />} />
      <Route path="/app/*" element={<StudyOS session={session} />} />
    </Routes>
  )
}
