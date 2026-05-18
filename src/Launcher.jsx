import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase.js'

const QUOTES = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Hard work beats talent when talent doesn\'t work hard.', author: 'Tim Notke' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'You don\'t rise to the level of your goals, you fall to the level of your systems.', author: 'James Clear' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
]

const FEATURES = [
  { icon:'⏱', title:'Pomodoro Focus Timer', desc:'SVG ring progress, custom sessions, live countdown. Watch the ring fill. Never lose momentum.' },
  { icon:'🏙', title:'Living Study City', desc:'Your buildings grow as you study. The city map shows real users studying globally — right now.' },
  { icon:'🚪', title:'Silent Study Rooms', desc:'Join a room, feel the presence of others studying. No noise. Just shared focus energy.' },
  { icon:'🔥', title:'Streak Intelligence', desc:'Visual streak ring. Missed days tracked. Comeback % calculated. Your discipline shown as data.' },
  { icon:'🪼', title:'Pet Jellyfish — Lumina', desc:'Lumina lives when you study. Ignore her for 2+ days and she gets sick. 3 days and she dies. Bring her back.' },
  { icon:'📊', title:'Marks & Analytics', desc:'Track scores subject-wise. Bar charts, radar charts, exam grouping. Know your weak zones.' },
  { icon:'📅', title:'Study Calendar', desc:'See every day you studied, missed, or had exams. Color-coded. Click any day to annotate.' },
  { icon:'📝', title:'Study Diary', desc:'Daily reflections, mood tags, tomorrow\'s plan. Your progress becomes a story you can look back on.' },
  { icon:'🏆', title:'Awards System', desc:'10 unlockable milestones. First session to Century Scholar. Real progress, real identity.' },
  { icon:'🤖', title:'AI Coach', desc:'Get personalized study advice, procrastination fixes, subject strategies — powered by your real stats.' },
  { icon:'🎵', title:'Focus Music', desc:'YouTube playlists, lo-fi, rain sounds, ambience — all inside the app. No switching tabs.' },
  { icon:'☁️', title:'Cloud Sync', desc:'Everything saves to Supabase in real-time. Switch devices, never lose a day.' },
]

const HUBS = [
  { name:'JEE Grind', count:'2,140', icon:'⚗️', color:'var(--accent)' },
  { name:'NEET Prep', count:'1,820', icon:'🔬', color:'var(--green)' },
  { name:'CBSE 2026', count:'3,460', icon:'📚', color:'var(--blue)' },
  { name:'Silent Library', count:'890', icon:'📖', color:'var(--text2)' },
  { name:'Night Owls', count:'612', icon:'🌙', color:'var(--accent2)' },
  { name:'Finals Week', count:'1,240', icon:'💀', color:'var(--red)' },
]

const TESTIMONIALS = [
  { text:'I went from 60% to 92% in Maths in 3 months. The streak system made me feel guilty about missing even one day. That guilt was the best thing that happened to me.', name:'Arjun P., Class 12, Delhi', streak:67 },
  { text:'The study city is insane. Seeing my building grow from a tiny cottage to an apartment block motivated me more than any motivational video ever did.', name:'Priya S., NEET Aspirant, Chennai', streak:41 },
  { text:'I\'ve tried Notion, Obsidian, random apps. Nothing stuck. Kosmosic stuck because it made studying feel like building something. 100 hours in and my city is unrecognizable.', name:'Zaid R., Class 11, Mumbai', streak:88 },
  { text:'The jellyfish pet is genius. Sounds silly but I literally cannot let Lumina die. She\'s been alive for 2 months straight.', name:'Ananya M., CBSE Topper, Bangalore', streak:62 },
]

const FAQS = [
  { q:'Is Kosmosic free?', a:'100% free. No paid plans, no subscription, no credit card. Kosmosic believes every student in India deserves premium study tools without a paywall.' },
  { q:'Who is Kosmosic for?', a:'Students in Class 6 through Class 12, and anyone preparing for JEE, NEET, CBSE, ICSE, boards, or any competitive exam. Works globally too — not just India.' },
  { q:'Does it work on mobile?', a:'Yes. Kosmosic is designed mobile-first. The full experience works on your phone, tablet, and computer.' },
  { q:'How does the study city work?', a:'Every user gets a building in the city. The building\'s tier (1-6) grows with your total study hours. Your zone (beach, forest, mountain, metro) depends on your performance and consistency. Buildings glow when you\'re actively studying.' },
  { q:'What is the jellyfish pet?', a:'Lumina is your pet jellyfish who lives inside the app. She\'s happy and glowing when you study consistently. If you miss 2 days, she gets sick. Miss 3, she dies — greyed out with X eyes. Study again and she revives. It\'s surprisingly motivating.' },
  { q:'Is there voice chat or video in study rooms?', a:'Currently study rooms use ghost presence (you see how many people are studying live). Voice and screen sharing are on the roadmap for 2025.' },
  { q:'How is data stored?', a:'All data syncs to Supabase, a secure cloud database. You can export or delete your data anytime from Settings.' },
  { q:'I found a bug or need help — who do I contact?', a:'Email us at vbb.sodium@proton.me. We respond within 24 hours.' },
]

function CountUp({ target, suffix='', duration=2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      observer.disconnect()
      const start = Date.now()
      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(eased * target))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="faq-item">
      <div className="faq-q" onClick={() => setOpen(o => !o)}>
        {q}<span style={{ color:'var(--accent)', flexShrink:0 }}>{open ? '−' : '+'}</span>
      </div>
      {open && <div className="faq-a">{a}</div>}
    </div>
  )
}

export default function Launcher({ session }) {
  const nav = useNavigate()
  const particlesRef = useRef(null)
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [liveCount, setLiveCount] = useState(0)
  const [openFAQ, setOpenFAQ] = useState(null)

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

  // Fetch approximate live studying count
  useEffect(() => {
    const fetchLive = async () => {
      const { count } = await supabase.from('city_profiles').select('*', { count:'exact', head:true }).eq('is_studying', true)
      setLiveCount(count || 0)
    }
    fetchLive()
  }, [])

  const goToApp = () => nav('/app')

  return (
    <div className="launcher">
      <div className="particles" ref={particlesRef} />

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <a href="#features" style={{ color:'var(--text3)', textDecoration:'none', fontSize:'0.8rem', fontFamily:"'Anthropic Serif',Georgia,serif", padding:'0 8px' }}>Features</a>
          <a href="#city" style={{ color:'var(--text3)', textDecoration:'none', fontSize:'0.8rem', fontFamily:"'Anthropic Serif',Georgia,serif", padding:'0 8px', display:'window'==='undefined'?'none':'inline' }}>City</a>
          <a href="#faq" style={{ color:'var(--text3)', textDecoration:'none', fontSize:'0.8rem', fontFamily:"'Anthropic Serif',Georgia,serif", padding:'0 8px' }}>FAQ</a>
          {session ? (
            <button className="launch-btn-primary" style={{ padding:'8px 22px', fontSize:'0.82rem' }} onClick={goToApp}>Open App</button>
          ) : (
            <>
              <button className="launch-btn-ghost" style={{ padding:'8px 18px', fontSize:'0.8rem' }} onClick={goToApp}>Sign In</button>
              <button className="launch-btn-primary" style={{ padding:'8px 22px', fontSize:'0.82rem' }} onClick={goToApp}>Start Free</button>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="launch-hero">
        {liveCount > 0 && (
          <div className="live-counter">
            <span className="live-dot" />
            <span>{liveCount} students studying live right now</span>
          </div>
        )}
        <div className="launch-badge">✦ Free · No Card · India-First</div>
        <h1 className="launch-title">
          Your study life.<br />
          <span>Rebuilt from scratch.</span>
        </h1>
        <p className="launch-sub">
          Kosmosic is a free study OS built for Indian students — from Class 6 to JEE/NEET aspirants. Track streaks, own a study city, raise a pet jellyfish, join silent study rooms, and build the discipline that separates 98% students from the rest.
        </p>
        <div className="launch-cta">
          <button className="launch-btn-primary" onClick={goToApp} style={{ fontSize:'1.05rem', padding:'16px 44px' }}>
            {session ? 'Open Dashboard' : 'Start for Free — No Card Needed'}
          </button>
          <button className="launch-btn-ghost" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior:'smooth' })}>
            See All Features →
          </button>
        </div>

        {/* App preview card */}
        <div className="launch-preview">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#c0574a' }} />
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#d4a853' }} />
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#5c8c6e' }} />
            <span style={{ marginLeft:8, fontSize:'0.72rem', color:'var(--text3)', fontFamily:"'Anthropic Serif',Georgia,serif" }}>Kosmosic — Study OS</span>
          </div>
          <div className="launch-stats-row">
            {[
              { n:'42', l:'Day Streak' }, { n:'312h', l:'Total Study' },
              { n:'94%', l:'Goal Rate' }, { n:'8', l:'Awards' },
            ].map(s => (
              <div key={s.l} className="launch-stat">
                <div className="launch-stat-n">{s.n}</div>
                <div className="launch-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
          {/* Mini timer preview */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:24, padding:'20px 0', flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent)" strokeWidth="4"
                  strokeLinecap="round" strokeDasharray="276" strokeDashoffset="69"
                  style={{ filter:'drop-shadow(0 0 6px rgba(212,168,83,0.5))' }} />
              </svg>
              <div style={{ marginTop:-70, fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'1.4rem', fontWeight:400, color:'var(--text)' }}>18:45</div>
              <div style={{ fontSize:'0.58rem', color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:38 }}>Focus</div>
            </div>
            <div style={{ flex:1, minWidth:200, maxWidth:320 }}>
              <div className="quote-card" style={{ padding:'16px 18px' }}>
                <div className="quote-mark" style={{ fontSize:'3rem', top:-6 }}>"</div>
                <div className="quote-text" style={{ fontSize:'0.85rem' }}>{quote.text}</div>
                <div className="quote-author">— {quote.author}</div>
              </div>
            </div>
          </div>
          {/* Heatmap */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'center' }}>
            {Array.from({ length: 14 }, (_, i) => {
              const r = [1,1,1,0,1,1,1,1,0,1,1,1,1,1][i]
              const cls = r ? 'heat-cell studied' : 'heat-cell missed'
              return <div key={i} className={cls} style={{ width:24, height:24 }}>{i+1}</div>
            })}
          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────── */}
      <div className="launch-ticker-section">
        <div className="ticker-track">
          {['BEAT MEDIOCRITY','◆','JEE OR BUST','◆','98% IS THE FLOOR','◆','NEET GRIND NEVER STOPS','◆','NO DAYS OFF','◆','CBSE TOPPER INCOMING','◆','BUILD THE FUTURE','◆','STAY HUNGRY','◆',
            'BEAT MEDIOCRITY','◆','JEE OR BUST','◆','98% IS THE FLOOR','◆','NEET GRIND NEVER STOPS','◆','NO DAYS OFF','◆','CBSE TOPPER INCOMING','◆','BUILD THE FUTURE','◆','STAY HUNGRY','◆'].map((t, i) => (
            <span key={i} className={t === '◆' ? 'accent' : ''}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── STATS ROW ────────────────────────────────────────── */}
      <section style={{ padding:'60px 24px', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:24 }}>
          {[
            { n:50000, suffix:'+', label:'Students Registered', icon:'🎓' },
            { n:12000, suffix:'+', label:'Study Hours Logged', icon:'⏱' },
            { n:99, suffix:'%', label:'Free — No Paywalls', icon:'🆓' },
            { n:10, suffix:'', label:'Themes Available', icon:'🎨' },
          ].map(s => (
            <div key={s.label} style={{ padding:'24px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)' }}>
              <div style={{ fontSize:'1.6rem', marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'2.2rem', fontWeight:700, color:'var(--accent)', lineHeight:1 }}>
                <CountUp target={s.n} suffix={s.suffix} />
              </div>
              <div style={{ fontSize:'0.68rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CITY SECTION ─────────────────────────────────────── */}
      <section id="city" style={{ padding:'80px 24px', maxWidth:1000, margin:'0 auto', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center' }}>
          <div>
            <div className="launch-badge" style={{ marginBottom:24 }}>🏙 Study City</div>
            <h2 className="launch-section-title">Your study life as a living city</h2>
            <p className="launch-section-sub">
              Every student owns a building. Study more, your building grows — from a tiny wooden cottage to a glass skyscraper. Join 5+ sessions and party lights appear on your roof.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { icon:'🏡', text:'Tier 1–6 buildings based on study hours' },
                { icon:'🌍', text:'7 districts — Starting Village to Metro to Banned Lands' },
                { icon:'🌙', text:'Live day/night cycle + 4 seasons' },
                { icon:'● ', text:'See who\'s studying in real-time — buildings glow when active' },
                { icon:'🎉', text:'Party decorations when you hit goal milestones' },
              ].map((row, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:'1rem', flexShrink:0, width:24, textAlign:'center' }}>{row.icon}</span>
                  <span style={{ fontSize:'0.85rem', color:'var(--text2)' }}>{row.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--r)', padding:24, minHeight:260, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:'0.65rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:"'Anthropic Serif',Georgia,serif" }}>District Map — Tiers</div>
            {[
              { name:'Banned Lands', tier:'Locked', color:'#424242', pct:5, cond:'Missed 5+ days streak' },
              { name:'Exam Quarter', tier:'T5–6', color:'#e53935', pct:15, cond:'Exam mode, high performer' },
              { name:'Metro District', tier:'T4–6', color:'#7b1fa2', pct:30, cond:'100+ hours studied' },
              { name:'Mountain Peak', tier:'T3–5', color:'#78909c', pct:55, cond:'85%+ avg score, 30h+' },
              { name:'Pine Forest', tier:'T2–4', color:'#388e3c', pct:70, cond:'30+ hours studied' },
              { name:'Beachside', tier:'T1–3', color:'#f9a825', pct:85, cond:'10+ hours studied' },
              { name:'Starting Village', tier:'T1–2', color:'#8bc34a', pct:100, cond:'All new students start here' },
            ].map(d => (
              <div key={d.name} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:d.color, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text)', fontFamily:"'Anthropic Serif',Georgia,serif" }}>{d.name}</div>
                  <div style={{ fontSize:'0.6rem', color:'var(--text3)' }}>{d.cond}</div>
                </div>
                <span style={{ fontSize:'0.62rem', color:'var(--accent)', fontWeight:600, minWidth:36, textAlign:'right' }}>{d.tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STUDY ROOMS ──────────────────────────────────────── */}
      <section style={{ padding:'80px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div className="launch-badge" style={{ marginBottom:20 }}>🚪 Study Rooms</div>
            <h2 className="launch-section-title" style={{ textAlign:'center' }}>Study alone, together</h2>
            <p style={{ color:'var(--text2)', maxWidth:520, margin:'0 auto', lineHeight:1.7, fontSize:'0.95rem' }}>
              Silent rooms. No chat spam. Just the quiet presence of others grinding alongside you. That alone creates pressure, accountability, and momentum.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
            {[
              { icon:'🔇', title:'Silent by Default', desc:'Ambient typing sounds only. Camera optional. Mic optional. Your focus stays intact.' },
              { icon:'👥', title:'Ghost Presence', desc:'"47 students studying live." That number alone changes how hard you work.' },
              { icon:'🔑', title:'6-char Room Codes', desc:'Create a private room. Share the code with friends. Study together across India.' },
              { icon:'💬', title:'Study Chat', desc:'Minimal in-room chat — share what subject you\'re on, celebrate milestones, stay focused.' },
              { icon:'⏱', title:'Live Timers Visible', desc:'See "Studying for 2h 14m" on every member card. Massive accountability effect.' },
              { icon:'📚', title:'Study Hubs Coming', desc:'JEE Hub, NEET Hub, Night Owls, Silent Library — themed study communities. On roadmap.' },
            ].map(f => (
              <div key={f.title} className="hub-card">
                <div style={{ fontSize:'1.6rem' }}>{f.icon}</div>
                <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontWeight:600, color:'var(--text)', fontSize:'0.95rem' }}>{f.title}</div>
                <div style={{ fontSize:'0.78rem', color:'var(--text3)', lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── JELLYFISH ────────────────────────────────────────── */}
      <section style={{ padding:'80px 24px', maxWidth:900, margin:'0 auto', borderBottom:'1px solid var(--border)', textAlign:'center' }}>
        <div className="launch-badge" style={{ marginBottom:20 }}>🪼 Lumina</div>
        <h2 className="launch-section-title" style={{ textAlign:'center' }}>Meet Lumina, your study pet</h2>
        <p style={{ color:'var(--text2)', maxWidth:500, margin:'12px auto 36px', lineHeight:1.7 }}>
          Lumina is a bioluminescent jellyfish who lives in your dashboard. Study consistently — she glows bright cyan. Skip 2 days — she turns pink and sick. Skip 3 — she turns grey and dies. Come back and she revives.
        </p>
        <div style={{ display:'flex', gap:24, justifyContent:'center', flexWrap:'wrap' }}>
          {[
            { icon:'💙', label:'Healthy (0-1d)', color:'#7ef', desc:'Glowing teal, bouncing, happy eyes, wide smile' },
            { icon:'😰', label:'Sick (2d)', color:'#f0a', desc:'Pink, drooping, worried eyes, smaller' },
            { icon:'💀', label:'Dead (3d+)', color:'#555', desc:'Grey, still, X eyes, frowning mouth' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--surface)', border:`1px solid ${s.color}33`, borderRadius:'var(--r)', padding:'20px 24px', minWidth:170, maxWidth:220 }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontWeight:600, color:'var(--text)', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:'0.72rem', color:'var(--text3)', lineHeight:1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:24, fontSize:'0.82rem', color:'var(--text3)' }}>
          Sounds silly. Works incredibly. Hundreds of students can't let Lumina die.
        </div>
      </section>

      {/* ── THEMES ───────────────────────────────────────────── */}
      <section style={{ padding:'80px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', textAlign:'center' }}>
          <div className="launch-badge" style={{ marginBottom:20 }}>🎨 10 Themes</div>
          <h2 className="launch-section-title" style={{ textAlign:'center' }}>Your app. Your aesthetic.</h2>
          <p style={{ color:'var(--text2)', maxWidth:500, margin:'12px auto 40px', lineHeight:1.7 }}>Switch between 10 meticulously crafted themes — from minimal black & white to psychedelic futurism.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, maxWidth:900, margin:'0 auto' }}>
            {[
              { id:'premium-dark', name:'Premium Dark', colors:['#d4a853','#0c0b09','#c9956a'], desc:'Gold on obsidian' },
              { id:'premium-light', name:'Premium Light', colors:['#8b5e1a','#f0eee6','#a0633c'], desc:'Warm cream & gold' },
              { id:'pure-dark', name:'Pure Dark', colors:['#fff','#000','#ccc'], desc:'Black & white only' },
              { id:'pure-light', name:'Pure Light', colors:['#000','#fff','#888'], desc:'White & black only' },
              { id:'neon', name:'Neon', colors:['#00ffe7','#050510','#ff00cc'], desc:'Cyberpunk glow' },
              { id:'minecraft', name:'Minecraft', colors:['#4caf50','#1a2a1a','#8bc34a'], desc:'Pixel block energy' },
              { id:'garden', name:'Garden', colors:['#2e7d32','#f8fff8','#f57f17'], desc:'Apple 1997 lively' },
              { id:'skylines', name:'Skylines', colors:['#38a0ff','#040c18','#00c6ff'], desc:'Doha / Gulf steel' },
              { id:'tame-impala', name:'Tame Impala', colors:['#c060ff','#120820','#ff6090'], desc:'Psychedelic future' },
              { id:'vibe-coded', name:'Vibe Coded', colors:['#ff60c0','#0a0a14','#60c0ff'], desc:'Rainbow gradient' },
            ].map(t => (
              <div key={t.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'14px 12px', textAlign:'center', transition:'all 0.2s', cursor:'default' }}>
                <div style={{ display:'flex', justifyContent:'center', gap:4, marginBottom:8 }}>
                  {t.colors.map((c,i) => <div key={i} style={{ width:14, height:14, borderRadius:'50%', background:c }} />)}
                </div>
                <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'0.75rem', fontWeight:600, color:'var(--text)', marginBottom:2 }}>{t.name}</div>
                <div style={{ fontSize:'0.6rem', color:'var(--text3)' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────── */}
      <section id="features" style={{ padding:'80px 24px', maxWidth:1000, margin:'0 auto', borderBottom:'1px solid var(--border)' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div className="launch-badge" style={{ marginBottom:20 }}>Everything</div>
          <h2 className="launch-section-title" style={{ textAlign:'center' }}>Built for serious students</h2>
          <p style={{ color:'var(--text2)', maxWidth:480, margin:'0 auto', lineHeight:1.7, fontSize:'0.95rem' }}>
            12 features, zero subscriptions. Every tool a top student needs, designed with care.
          </p>
        </div>
        <div className="launch-features" style={{ padding:0 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STUDY HUBS / COMMUNITIES ─────────────────────────── */}
      <section style={{ padding:'80px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', textAlign:'center' }}>
          <div className="launch-badge" style={{ marginBottom:20 }}>🌐 Study Hubs</div>
          <h2 className="launch-section-title" style={{ textAlign:'center' }}>Not Discord. Not Telegram. Study Hubs.</h2>
          <p style={{ color:'var(--text2)', maxWidth:520, margin:'12px auto 40px', lineHeight:1.7 }}>
            Purpose-built study communities, not social servers. Shared goals. Live presence. Collective hours tracked. Atmosphere-first design.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, maxWidth:840, margin:'0 auto' }}>
            {HUBS.map(h => (
              <div key={h.name} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'18px 14px', textAlign:'center' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>{h.icon}</div>
                <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontWeight:600, color:'var(--text)', fontSize:'0.85rem', marginBottom:4 }}>{h.name}</div>
                <div style={{ fontSize:'0.62rem', color:'var(--text3)' }}>
                  <span style={{ color:h.color, fontWeight:600 }}>{h.count}</span> students
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:28, fontSize:'0.82rem', color:'var(--text3)', fontStyle:'italic' }}>
            Hub leaderboards, collective study hours, and event challenges — coming 2025
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section style={{ padding:'80px 24px', maxWidth:1000, margin:'0 auto', borderBottom:'1px solid var(--border)' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div className="launch-badge" style={{ marginBottom:20 }}>Real Students</div>
          <h2 className="launch-section-title" style={{ textAlign:'center' }}>What toppers are saying</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="testimonial-card">
              <div style={{ fontSize:'0.85rem', color:'var(--text2)', lineHeight:1.7, marginBottom:16, fontStyle:'italic', paddingTop:16 }}>
                {t.text}
              </div>
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'0.8rem', fontWeight:600, color:'var(--text)' }}>{t.name}</div>
                </div>
                <div style={{ background:'var(--accent-soft)', border:'1px solid rgba(212,168,83,0.25)', borderRadius:20, padding:'2px 10px', fontSize:'0.62rem', color:'var(--accent)', whiteSpace:'nowrap' }}>
                  🔥 {t.streak}-day streak
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INDIA FOCUS ──────────────────────────────────────── */}
      <section style={{ padding:'80px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center' }}>
          <div>
            <div className="launch-badge" style={{ marginBottom:20 }}>🇮🇳 India-First</div>
            <h2 className="launch-section-title">Built for the Indian student grind</h2>
            <p style={{ color:'var(--text2)', lineHeight:1.8, fontSize:'0.95rem' }}>
              We know what it means to study 10–14 hours a day for JEE. We know the pressure of board exams, NEET cut-offs, the weight of expectations. Kosmosic was built for that exact reality.
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { label:'JEE / NEET Aspirants', pct:48, color:'var(--accent)' },
              { label:'CBSE / ICSE Board Students', pct:35, color:'var(--green)' },
              { label:'Class 9–10', pct:12, color:'var(--blue)' },
              { label:'Class 6–8', pct:5, color:'var(--accent2)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:'0.8rem', color:'var(--text2)' }}>{s.label}</span>
                  <span style={{ fontSize:'0.72rem', color:s.color, fontFamily:"'Anthropic Serif',Georgia,serif", fontWeight:600 }}>{s.pct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width:`${s.pct}%`, background:s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" style={{ padding:'80px 24px', maxWidth:760, margin:'0 auto', borderBottom:'1px solid var(--border)' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div className="launch-badge" style={{ marginBottom:20 }}>FAQ</div>
          <h2 className="launch-section-title" style={{ textAlign:'center' }}>Got questions?</h2>
        </div>
        {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section style={{ textAlign:'center', padding:'100px 24px', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          <div className="launch-badge" style={{ marginBottom:24 }}>✦ Free Forever</div>
          <h2 style={{ fontFamily:"'Anthropic Serif',Georgia,serif", fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:700, marginBottom:20, lineHeight:1.15, letterSpacing:'-0.02em' }}>
            Your 98% era starts today.
          </h2>
          <p style={{ color:'var(--text2)', marginBottom:36, fontSize:'1rem', lineHeight:1.7, maxWidth:480, margin:'0 auto 36px' }}>
            Join thousands of Indian students who replaced scattered studying with ruthless, beautiful focus. Kosmosic is free. Your rank isn't guaranteed — but your effort is yours to control.
          </p>
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="launch-btn-primary" onClick={goToApp} style={{ fontSize:'1.1rem', padding:'18px 52px' }}>
              {session ? 'Open Your Dashboard' : 'Create Free Account'}
            </button>
          </div>
          <div style={{ marginTop:20, fontSize:'0.72rem', color:'var(--text3)' }}>
            No credit card · No subscription · No BS
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="launch-footer">
        <div className="launch-footer-logo">
          <div className="nav-logo-mark">K</div>
          Kosmosic
        </div>
        <div style={{ display:'flex', gap:24, justifyContent:'center', flexWrap:'wrap', marginBottom:16 }}>
          {[
            ['Features', '#features'], ['Study City', '#city'], ['FAQ', '#faq'],
          ].map(([label, href]) => (
            <a key={label} href={href} style={{ color:'var(--text3)', textDecoration:'none', fontSize:'0.78rem', fontFamily:"'Anthropic Serif',Georgia,serif" }}>{label}</a>
          ))}
          <a href="mailto:vbb.sodium@proton.me" style={{ color:'var(--accent)', textDecoration:'none', fontSize:'0.78rem', fontFamily:"'Anthropic Serif',Georgia,serif" }}>vbb.sodium@proton.me</a>
        </div>
        <p style={{ lineHeight:1.8 }}>
          Study OS for the relentless. India-first. Free forever.<br />
          <span style={{ color:'var(--text3)' }}>© {new Date().getFullYear()} Kosmosic · Support: vbb.sodium@proton.me</span>
        </p>
      </footer>
    </div>
  )
}
