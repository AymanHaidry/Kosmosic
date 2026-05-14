import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const QUOTES = [
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Education is the passport to the future.', author: 'Malcolm X' },
  { text: 'The more that you read, the more things you will know.', author: 'Dr. Seuss' },
]

const FEATURES = [
  { icon: '⏱', title: 'Pomodoro Focus Timer', desc: 'Beautiful circular timer with focus, short break, and long break modes. Custom durations supported.' },
  { icon: '📊', title: 'Deep Analytics', desc: 'Track study time by subject, visualize 14-day heatmaps, monitor streaks and daily goals.' },
  { icon: '📅', title: 'Smart Calendar', desc: 'See your study history at a glance. Mark study days, add exam events, plan the week.' },
  { icon: '📝', title: 'Study Diary', desc: "Capture what you did today and plan for tomorrow. Your daily OS isn't just a timer — it's a journal." },
  { icon: '🏆', title: 'Awards & Milestones', desc: 'Unlock badges as you hit streaks, study hours, and subject mastery. Discipline becomes identity.' },
  { icon: '🤖', title: 'AI Study Coach', desc: 'Get personalized advice, motivation, and study plans from an intelligent AI companion.' },
  { icon: '🎵', title: 'Focus Music', desc: 'Search and play study music directly inside the app. Lo-fi, classical, ambient — your choice.' },
  { icon: '📈', title: 'Marks Tracker', desc: 'Log your grades per subject. Track trends, spot weak areas, and celebrate improvements.' },
  { icon: '☁️', title: 'Cloud Sync', desc: 'Every session, every streak, every note synced to the cloud via Supabase. Access anywhere.' },
]

export default function Launcher({ session }) {
  const nav = useNavigate()
  const particlesRef = useRef(null)
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])

  useEffect(() => {
    if (!particlesRef.current) return
    const container = particlesRef.current
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.cssText = `left:${Math.random()*100}%;animation-delay:${Math.random()*15}s;animation-duration:${10+Math.random()*10}s;width:${2+Math.random()*2}px;height:${p.style.width}`
      container.appendChild(p)
    }
    return () => { if (container) container.innerHTML = '' }
  }, [])

  const goToApp = () => nav('/app')

  return (
    <div className="launcher">
      <div className="particles" ref={particlesRef} />

      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {session ? (
            <button className="launch-btn-primary" style={{ padding: '8px 22px', fontSize: '0.82rem' }} onClick={goToApp}>
              Open App
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={goToApp}>Sign In</button>
              <button className="btn btn-primary btn-sm" onClick={goToApp}>Get Started</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="launch-hero">
        <div className="launch-badge">✦ Study OS — Built Different</div>
        <h1 className="launch-title">
          Your mind.<br />
          <span>Engineered</span> to win.
        </h1>
        <p className="launch-sub">
          Kosmosic is the premium study operating system for students who refuse to settle. Track streaks, crush goals, and build the discipline that separates the 1% from everyone else.
        </p>
        <div className="launch-cta">
          <button className="launch-btn-primary" onClick={goToApp}>
            {session ? 'Open Your Dashboard' : 'Start for Free — No Card Needed'}
          </button>
          <button className="launch-btn-ghost" onClick={goToApp}>
            See It in Action →
          </button>
        </div>

        {/* MOCK PREVIEW */}
        <div className="launch-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c0574a' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d4a853' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#5c8c6e' }} />
            <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text3)', fontFamily: "'Anthropic Serif',Georgia,serif" }}>Kosmosic — Study OS</span>
          </div>
          <div className="launch-stats-row">
            {[
              { n: '42', l: 'Day Streak' },
              { n: '312h', l: 'Total Study' },
              { n: '94%', l: 'Goal Rate' },
              { n: '8', l: 'Awards' },
            ].map(s => (
              <div key={s.l} className="launch-stat">
                <div className="launch-stat-n">{s.n}</div>
                <div className="launch-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
          {/* Mini timer preview */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '20px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="#d4a853" strokeWidth="4"
                  strokeLinecap="round" strokeDasharray="276" strokeDashoffset="69"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(212,168,83,0.5))' }} />
              </svg>
              <div style={{ marginTop: -70, fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: '1.4rem', fontWeight: 400, color: 'var(--text)' }}>18:45</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 38 }}>Focus</div>
            </div>
            <div style={{ flex: 1, maxWidth: 300 }}>
              <div className="quote-card" style={{ padding: '16px 18px' }}>
                <div className="quote-mark" style={{ fontSize: '3rem', top: -6 }}>"</div>
                <div className="quote-text" style={{ fontSize: '0.85rem' }}>{quote.text}</div>
                <div className="quote-author">— {quote.author}</div>
              </div>
            </div>
          </div>
          {/* Heatmap preview */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: 14 }, (_, i) => {
              const rand = Math.random()
              const cls = rand > 0.3 ? 'heat-cell studied' : rand > 0.1 ? 'heat-cell missed' : 'heat-cell'
              return <div key={i} className={cls} style={{ width: 24, height: 24 }}>{i + 1}</div>
            })}
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="launch-ticker-section">
        <div className="ticker-track">
          {['BEAT MEDIOCRITY','98% IS THE FLOOR','FAANG OR NOTHING','STAY HUNGRY STAY FOOLISH','BUILD THE FUTURE','FLY HIGH ✈','NO DAYS OFF',
            'BEAT MEDIOCRITY','98% IS THE FLOOR','FAANG OR NOTHING','STAY HUNGRY STAY FOOLISH','BUILD THE FUTURE','FLY HIGH ✈','NO DAYS OFF'].map((t, i) => (
            <span key={i} className={i % 2 === 1 ? 'accent' : ''}>{i % 2 === 1 ? '◆' : t}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section className="launch-features">
        {FEATURES.map(f => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </section>

      {/* CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '60px 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <div className="sec-label" style={{ marginBottom: 16 }}>Ready to ascend?</div>
          <h2 style={{ fontFamily: "'Anthropic Serif',Georgia,serif", fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 700, marginBottom: 16, lineHeight: 1.2 }}>
            Your 98% era starts now.
          </h2>
          <p style={{ color: 'var(--text2)', marginBottom: 32, fontSize: '0.95rem', lineHeight: 1.6 }}>
            Join students who have replaced scattered effort with ruthless focus. Kosmosic is free. Your future isn't.
          </p>
          <button className="launch-btn-primary" onClick={goToApp} style={{ fontSize: '1.05rem', padding: '16px 48px' }}>
            {session ? 'Continue to Dashboard' : 'Create Free Account'}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="launch-footer">
        <div className="launch-footer-logo">
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <p>Study OS for the relentless.<br />
          <span style={{ color: 'var(--text3)' }}>© {new Date().getFullYear()} Kosmosic. Built with precision.</span>
        </p>
      </footer>
    </div>
  )
}
