import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

/* ─── helpers ─── */
/* ─── deterministic shape picker ─── */
const hashString = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return Math.abs(h >>> 0)
}

/* ─── shape catalog per tier ─── */
// tier 1=Studio … tier 6=Skyline
const SHAPE_CATALOG = {
  1: [ // 8 studios
    { h: 3, w: 22, floors: 1, wp: 2, roof: 'peak',  name: 'Cottage' },
    { h: 3, w: 30, floors: 1, wp: 3, roof: 'flat',  name: 'Bungalow' },
    { h: 4, w: 18, floors: 2, wp: 2, roof: 'none',  name: 'Micro-tower' },
    { h: 2, w: 34, floors: 1, wp: 4, roof: 'flat',  name: 'Garage' },
    { h: 3, w: 26, floors: 1, wp: 2, roof: 'dome',  name: 'Pod' },
    { h: 4, w: 20, floors: 2, wp: 2, roof: 'slant', name: 'Shed' },
    { h: 3, w: 28, floors: 1, wp: 3, roof: 'flat',  name: 'Loft' },
    { h: 5, w: 16, floors: 2, wp: 1, roof: 'spire', name: 'Pencil-studio' },
  ],
  2: [ // 6 apartments
    { h: 5, w: 32, floors: 2, wp: 3, roof: 'flat',  name: 'Walk-up' },
    { h: 6, w: 38, floors: 2, wp: 4, roof: 'peak',  name: 'Townhouse' },
    { h: 5, w: 28, floors: 2, wp: 2, roof: 'none',  name: 'Brownstone' },
    { h: 7, w: 30, floors: 3, wp: 3, roof: 'flat',  name: 'Triplex' },
    { h: 6, w: 36, floors: 2, wp: 4, roof: 'dome',  name: 'Mansionette' },
    { h: 8, w: 26, floors: 3, wp: 2, roof: 'none',  name: 'Stacked' },
  ],
  3: [ // 5 mid-rise
    { h: 8,  w: 40, floors: 3, wp: 4, roof: 'none',   name: 'Block' },
    { h: 9,  w: 36, floors: 4, wp: 3, roof: 'setback',name: 'Stepped' },
    { h: 8,  w: 44, floors: 3, wp: 5, roof: 'none',   name: 'Wide' },
    { h: 10, w: 32, floors: 4, wp: 3, roof: 'none',   name: 'Slim' },
    { h: 9,  w: 38, floors: 3, wp: 4, roof: 'peak',   name: 'Clock-tower' },
  ],
  4: [ // 5 high-rise
    { h: 12, w: 50, floors: 5, wp: 5, roof: 'none',    name: 'Glass Box' },
    { h: 14, w: 46, floors: 6, wp: 4, roof: 'setback', name: 'Ziggurat' },
    { h: 13, w: 52, floors: 5, wp: 5, roof: 'none',    name: 'Corporate' },
    { h: 12, w: 42, floors: 5, wp: 4, roof: 'spire',   name: 'Needle' },
    { h: 15, w: 48, floors: 6, wp: 5, roof: 'none',    name: 'Tower' },
  ],
  5: [ // 5 penthouses
    { h: 16, w: 60, floors: 7, wp: 6, roof: 'none',    name: 'Terrace' },
    { h: 17, w: 56, floors: 7, wp: 5, roof: 'setback', name: 'Cascade' },
    { h: 16, w: 62, floors: 6, wp: 6, roof: 'none',    name: 'Estate' },
    { h: 18, w: 54, floors: 8, wp: 5, roof: 'spire',   name: 'Spire-top' },
    { h: 17, w: 58, floors: 7, wp: 6, roof: 'dome',    name: 'Observatory' },
  ],
  6: [ // 4 skyscrapers
    { h: 20, w: 70, floors: 9, wp: 7, roof: 'none',  name: 'Monolith' },
    { h: 22, w: 64, floors: 10, wp: 6, roof: 'spire',name: 'Shard' },
    { h: 21, w: 68, floors: 9, wp: 7, roof: 'none',  name: 'Mega-block' },
    { h: 23, w: 60, floors: 11, wp: 5, roof: 'spire',name: 'Pinnacle' },
  ],
}
const getBuildingSpec = (hours, streak, userId = '') => {
  const tier = Math.min(6, Math.floor(Math.log2(Math.max(hours + 1, 1))))
  const catalog = SHAPE_CATALOG[tier] || SHAPE_CATALOG[1]
  const seed = hashString(userId || 'anon')
  const shape = catalog[seed % catalog.length]

  // Slight growth within tier so buildings don't look cloned
  const growth = Math.min(1.25, 1 + (hours % 50) / 160)

  let style = 'default'
  if (hours >= 200) style = 'cyberpunk'
  else if (hours >= 100) style = 'glass'
  else if (hours >= 50) style = 'modern'

  return {
    height: Math.floor(shape.h * growth),
    width: Math.floor(shape.w * growth),
    floors: shape.floors,
    windowsPerFloor: shape.wp,
    level: tier,
    style,
    roof: shape.roof,
    seed,
    name: shape.name,
  }
}

const getRankLabel = (hours) => {
  if (hours >= 200) return { label: 'Skyline Tower', color: '#d4a853' }
  if (hours >= 100) return { label: 'Penthouse', color: '#c9956a' }
  if (hours >= 50)  return { label: 'High-Rise', color: '#4a7a9b' }
  if (hours >= 20)  return { label: 'Mid-Rise', color: '#5c8c6e' }
  if (hours >= 5)   return { label: 'Apartment', color: '#7a7468' }
  return { label: 'Studio', color: '#5a5248' }
}

const getTier = (hours) => {
  if (hours >= 200) return 6
  if (hours >= 100) return 5
  if (hours >= 50)  return 4
  if (hours >= 20)  return 3
  if (hours >= 5)   return 2
  return 1
}

/* ─── SQL SCHEMA (run once in Supabase SQL Editor) ─── */
const SQL_SCHEMA = `-- Run in Supabase SQL Editor (once)

create table if not exists city_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  total_hours   float   default 0,
  streak        int     default 0,
  studied_days  int     default 0,
  goals_hit     int     default 0,
  avg_score     float   default 0,
  is_studying   boolean default false,
  study_mode    text    default 'focus',
  missed_streak int     default 0,
  is_exam_mode  boolean default false,
  building_tier int     default 1,
  last_active   timestamptz,
  updated_at    timestamptz default now()
);

alter table city_profiles enable row level security;

create policy "Readable by authenticated"
  on city_profiles for select
  using (auth.role() = 'authenticated');

create policy "Users manage own profile"
  on city_profiles for all
  using (auth.uid() = user_id);

create or replace function update_city_ts()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger city_profiles_ts
  before update on city_profiles
  for each row execute procedure update_city_ts();`

/* ─── single building component ─── */
function Building({ user, spec, x, isMe, onClick, studying, mode, animOffset }) {
  const { height, width, floors, windowsPerFloor, level, style, roof, seed } = spec
  const pxH = height * 18

  const getBuildingBg = () => {
    if (style === 'cyberpunk') return 'linear-gradient(180deg, #0a0818 0%, #12102a 100%)'
    if (style === 'glass')     return 'linear-gradient(180deg, #0d1a1f 0%, #111820 100%)'
    if (style === 'modern')    return 'linear-gradient(180deg, #141414 0%, #1a1a1a 100%)'
    return 'linear-gradient(180deg, #111 0%, #1a1915 100%)'
  }

  const getBorderColor = () => {
    if (isMe) return 'rgba(212,168,83,0.8)'
    if (style === 'cyberpunk') return 'rgba(100,80,255,0.4)'
    if (style === 'glass')     return 'rgba(80,160,200,0.3)'
    return 'rgba(255,251,240,0.12)'
  }

  const getGlow = () => {
    if (isMe && studying) return '0 0 30px rgba(212,168,83,0.4), 0 0 60px rgba(212,168,83,0.15)'
    if (isMe) return '0 0 20px rgba(212,168,83,0.2)'
    if (studying && mode === 'deep') return '0 0 20px rgba(80,120,255,0.25)'
    if (studying) return '0 0 16px rgba(255,220,80,0.2)'
    return 'none'
  }

  const bColor = getBorderColor()

  /* ── roof renderer ── */
  const renderRoof = () => {
    if (!roof || roof === 'none') return null
    if (roof === 'peak') {
      return (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: `${width * 0.18}px solid transparent`,
          borderRight: `${width * 0.18}px solid transparent`,
          borderBottom: `10px solid ${bColor}`,
          opacity: 0.6,
        }} />
      )
    }
    if (roof === 'dome') {
      return (
        <div style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
          width: width * 0.5, height: 8,
          background: bColor, opacity: 0.5,
          borderRadius: '50% 50% 0 0',
        }} />
      )
    }
    if (roof === 'slant') {
      return (
        <div style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%) skewX(-12deg)',
          width: width * 0.55, height: 6,
          background: bColor, opacity: 0.5,
        }} />
      )
    }
    if (roof === 'spire') {
      return (
        <div style={{
          position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 20,
          background: isMe ? '#d4a853' : style === 'cyberpunk' ? 'rgba(100,80,255,0.8)' : 'rgba(255,251,240,0.3)',
          boxShadow: isMe ? '0 0 8px rgba(212,168,83,0.6)' : 'none',
        }} />
      )
    }
    if (roof === 'setback') {
      return (
        <div style={{
          position: 'absolute', top: -4, left: '10%',
          width: '80%', height: 4,
          background: bColor, opacity: 0.35,
          borderRadius: '2px 2px 0 0',
        }} />
      )
    }
    return null
  }

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', bottom: 40, left: x,
        width, height: pxH,
        background: getBuildingBg(),
        border: `1px solid ${bColor}`,
        borderBottom: 'none',
        borderRadius: '3px 3px 0 0',
        boxShadow: getGlow(),
        cursor: 'pointer',
        transition: 'box-shadow 0.5s ease',
        overflow: 'hidden',
        zIndex: isMe ? 10 : 5,
      }}
    >
      {style === 'cyberpunk' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: '30%', width: 1, height: '100%', background: 'rgba(100,80,255,0.15)' }} />
          <div style={{ position: 'absolute', top: 0, left: '60%', width: 1, height: '100%', background: 'rgba(100,80,255,0.1)' }} />
        </>
      )}
      {style === 'glass' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(80,160,200,0.05) 50%, transparent 100%)' }} />
      )}

      {/* Roof */}
      {renderRoof()}

      {/* Windows */}
      <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
        {Array.from({ length: floors }, (_, f) => (
          <div key={f} style={{ display: 'flex', gap: 3, justifyContent: 'center', flex: 1, alignItems: 'center' }}>
            {Array.from({ length: windowsPerFloor }, (_, w) => {
              // each building gets its own flicker phase via seed
              const isLit = studying && Math.sin(f * 7 + w * 13 + animOffset + seed) > 0.1
              const color = isLit
                ? mode === 'deep'  ? 'rgba(80,120,255,0.9)'
                : mode === 'exam'  ? 'rgba(220,80,80,0.9)'
                : 'rgba(255,215,80,0.9)'
                : 'rgba(255,255,255,0.04)'
              const glow = isLit
                ? mode === 'deep'  ? '0 0 6px rgba(80,120,255,0.8)'
                : mode === 'exam'  ? '0 0 6px rgba(220,80,80,0.8)'
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

      {/* Spire (tiers 5-6 only, but skip if roof already has spire) */}
      {height >= 12 && roof !== 'spire' && (
        <div style={{
          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 16,
          background: isMe ? '#d4a853' : style === 'cyberpunk' ? 'rgba(100,80,255,0.8)' : 'rgba(255,251,240,0.2)',
          boxShadow: isMe ? '0 0 8px rgba(212,168,83,0.6)' : 'none',
        }} />
      )}

      {/* YOU label */}
      {isMe && (
        <div style={{
          position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
          background: '#d4a853', borderRadius: 4, padding: '2px 6px',
          fontSize: '0.55rem', fontWeight: 700, color: '#000', whiteSpace: 'nowrap',
          fontFamily: "'Anthropic Serif',Georgia,serif",
        }}>YOU</div>
      )}

      {/* Study overlay */}
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

/* ─── main page ─── */
export default function CityPage({ S, session, isStudying, studyMode }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [animOffset, setAnimOffset] = useState(0)
  const [time, setTime] = useState(new Date())
  const [showSQL, setShowSQL] = useState(false)

  const myHours = Math.floor((S?.totalMinutes || 0) / 60)
  const mySpec = getBuildingSpec(myHours, S?.streak || 0, session?.user?.id)
  const myName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'You'
  const myRank = getRankLabel(myHours)

  const isNight = time.getHours() >= 20 || time.getHours() < 7
  const STALE_MS = 600000 // 10 minutes

  /* 1. window flicker + clock */
  useEffect(() => {
    const id = setInterval(() => {
      setAnimOffset(o => o + 0.3)
      setTime(new Date())
    }, 800)
    return () => clearInterval(id)
  }, [])

  /* 2. upsert my profile */
  const upsert = useCallback(async () => {
    if (!session?.user?.id) return
    const payload = {
      user_id: session.user.id,
      display_name: myName,
      total_hours: myHours,
      streak: S?.streak || 0,
      studied_days: (S?.studiedDays || []).length,
      goals_hit: (S?.sessions || []).length,
      avg_score: S?.targetPct || 80,
      is_studying: !!isStudying,
      study_mode: studyMode || 'focus',
      missed_streak: (S?.missedDays || []).length,
      is_exam_mode: studyMode === 'exam',
      building_tier: getTier(myHours),
      last_active: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('city_profiles').upsert(payload, { onConflict: 'user_id' })
    if (error) console.error('city upsert error:', error)
  }, [session, myName, myHours, S, isStudying, studyMode])

  useEffect(() => { upsert() }, [upsert])

  /* heartbeat while studying */
  useEffect(() => {
    if (!isStudying) return
    const id = setInterval(upsert, 30000)
    return () => clearInterval(id)
  }, [isStudying, upsert])

  /* 3. fetch all users — realtime + 10s stale check */
  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('city_profiles').select('*')
    if (error) {
      console.error('city fetch error:', error)
      setLoading(false)
      return
    }
    if (data) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
    const ch = supabase.channel('city-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'city_profiles' }, fetchUsers)
      .subscribe()
    // Poll every 10s to re-fetch updated_at timestamps and catch stale sessions
    const poll = setInterval(fetchUsers, 10000)
    return () => {
      supabase.removeChannel(ch)
      clearInterval(poll)
    }
  }, [fetchUsers])

  /* 4. build layout */
  const allResidents = users.map(u => ({
    id: u.user_id,
    name: u.display_name || 'Anonymous',
    hours: Math.floor(u.total_hours || 0),
    streak: u.streak || 0,
    // Stale guard: if updated_at is older than 10 min, treat as not studying
    studying: u.is_studying && (Date.now() - new Date(u.updated_at || 0).getTime() < STALE_MS),
    mode: u.study_mode,
    subject: u.study_mode === 'exam' ? 'Exam' : u.study_mode === 'deep' ? 'Deep Work' : 'Focus',
    isMe: u.user_id === session?.user?.id,
  }))

  // ensure "me" exists even if DB row hasn't synced yet
  const meIndex = allResidents.findIndex(r => r.isMe)
  if (meIndex === -1 && session?.user?.id) {
    allResidents.push({
      id: session.user.id,
      name: myName,
      hours: myHours,
      streak: S?.streak || 0,
      studying: !!isStudying,
      mode: studyMode || 'focus',
      subject: studyMode === 'exam' ? 'Exam' : 'Focus',
      isMe: true,
    })
  }

  // sort by hours desc, but keep "me" roughly in the middle visually
  const sorted = [...allResidents].sort((a, b) => b.hours - a.hours)
  const meId = session?.user?.id
  const meInSorted = sorted.findIndex(u => u.id === meId)
  let displayOrder = sorted
  if (meInSorted > -1) {
    const meItem = sorted[meInSorted]
    const withoutMe = sorted.filter(u => u.id !== meId)
    const mid = Math.floor(withoutMe.length / 2)
    displayOrder = [...withoutMe.slice(0, mid), meItem, ...withoutMe.slice(mid)]
  }

  // calculate x positions
  const buildingData = []
  let xCursor = 20
  displayOrder.forEach(user => {
    const spec = getBuildingSpec(user.hours, user.streak, user.id)
    buildingData.push({ user, spec, x: xCursor })
    xCursor += spec.width + 8
  })
  const totalWidth = xCursor + 20

  const skyColor = isNight
    ? 'linear-gradient(180deg, #02010a 0%, #080615 40%, #0c0b18 100%)'
    : 'linear-gradient(180deg, #0c1a2e 0%, #0f2340 40%, #0c0b18 100%)'

  const liveCount = allResidents.filter(u => u.studying).length

  return (
    <div style={{ position: 'relative', zIndex: 2, fontFamily: "'Anthropic Serif',Georgia,serif" }}>
      {/* HEADER */}
      <div style={{ padding: '80px 24px 0', maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>Study City</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
              {liveCount} studying live right now
              <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5c8c6e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ color: '#5c8c6e' }}>Live</span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(255,215,80,0.9)', boxShadow: '0 0 6px rgba(255,215,80,0.7)' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Focus</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(80,120,255,0.9)', boxShadow: '0 0 6px rgba(80,120,255,0.8)' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Deep Work</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(220,80,80,0.9)', boxShadow: '0 0 6px rgba(220,80,80,0.8)' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Exam</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Offline</span>
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

        {/* Moon / Sun */}
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

        {/* Fog */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(0deg, rgba(12,11,9,0.8) 0%, transparent 100%)',
          zIndex: 20, pointerEvents: 'none',
        }} />

        {/* Scrollable city */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: '100%', height: '100%',
          overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{ position: 'relative', width: Math.max(totalWidth, 900), height: '100%', minWidth: '100%' }}>
            {/* Ground */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
              background: 'linear-gradient(0deg, #090808 0%, #111010 100%)',
              borderTop: '1px solid rgba(212,168,83,0.12)',
              zIndex: 15,
            }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: `${i * 100 + 40}px`,
                  width: 40, height: 2, background: 'rgba(255,251,240,0.06)',
                  transform: 'translateY(-50%)',
                }} />
              ))}
            </div>

            {/* Buildings */}
            {buildingData.map(({ user, spec, x }) => (
              <Building
                key={user.id}
                user={user}
                spec={spec}
                x={x}
                isMe={user.isMe}
                studying={user.studying}
                mode={user.mode}
                animOffset={animOffset}
                onClick={() => setSelectedUser(user)}
              />
            ))}

            {/* Empty state */}
            {buildingData.length === 0 && !loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', zIndex: 30,
              }}>
                No residents yet. Start studying to found the city.
              </div>
            )}

            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#d4a853', fontSize: '0.9rem', zIndex: 30,
              }}>
                Loading city…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BELOW CITY */}
      <div style={{ padding: '16px 24px 40px', maxWidth: 920, margin: '0 auto' }}>

        {/* YOUR CARD + LEADERBOARD */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Your Building</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: myRank.color, marginBottom: 2 }}>
                  {myRank.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{myHours}h studied · {S?.streak || 0} day streak</div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              {myHours < 5 && "Your studio is quiet. Start studying to light it up."}
              {myHours >= 5 && myHours < 20 && "Your apartment windows are starting to glow. Keep going."}
              {myHours >= 20 && myHours < 50 && "Your mid-rise is rising. The city is noticing."}
              {myHours >= 50 && myHours < 100 && "Your high-rise towers above most. Neighbors look up."}
              {myHours >= 100 && myHours < 200 && "Penthouse life. You're becoming a local legend."}
              {myHours >= 200 && "Skyline Tower. You're the most recognizable building in the city."}
            </div>
            {isStudying && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#d4a853' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4a853', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                Your windows are glowing right now
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Next Level</div>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (myHours % 50) * 2)}%`, height: '100%', background: '#d4a853', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                {Math.max(0, 50 - (myHours % 50))}h until next upgrade
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>City Leaderboard</div>
            {allResidents
              .sort((a, b) => b.hours - a.hours)
              .slice(0, 5)
              .map((u, i) => {
                const rank = getRankLabel(u.hours)
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: i === 0 ? '#d4a853' : i === 1 ? '#aaa' : i === 2 ? '#c9956a' : 'rgba(255,255,255,0.3)', width: 16 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: u.isMe ? '#d4a853' : '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name}
                        {u.studying && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#5c8c6e', display: 'inline-block' }} />}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: rank.color }}>{rank.label}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{u.hours}h</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>🔥 {u.streak}d</div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* LIVE ACTIVITY */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 16, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Activity</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Real-time · updates every 10s</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allResidents.filter(u => u.studying).map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, cursor: 'pointer',
              }} onClick={() => setSelectedUser(u)}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: u.mode === 'deep' ? 'rgba(80,120,255,0.9)' : u.mode === 'exam' ? 'rgba(220,80,80,0.9)' : 'rgba(255,215,80,0.9)',
                  boxShadow: u.mode === 'deep' ? '0 0 6px rgba(80,120,255,0.8)' : u.mode === 'exam' ? '0 0 6px rgba(220,80,80,0.8)' : '0 0 6px rgba(255,215,80,0.7)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#fff' }}>{u.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{u.subject || 'Studying'}</div>
                </div>
              </div>
            ))}
            {allResidents.filter(u => u.studying).length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>
                Nobody is studying right now. Start a focus session to light up your windows →
              </div>
            )}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 16,
        }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>How Your Building Evolves</div>
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
                background: myHours >= [0, 5, 20, 50, 100, 200][i] ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${myHours >= [0, 5, 20, 50, 100, 200][i] ? tier.color + '50' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10,
              }}>
                <div style={{ fontWeight: 700, color: tier.color, fontSize: '0.82rem', marginBottom: 2 }}>{tier.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{tier.hours}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SQL Toggle */}
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowSQL(s => !s)} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 12px',
            fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Anthropic Serif',Georgia,serif",
          }}>
            {showSQL ? 'Hide Supabase Schema' : 'Show Supabase Schema'}
          </button>
          {showSQL && (
            <pre style={{
              marginTop: 8, background: 'rgba(6,6,20,0.97)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 14, fontSize: '0.62rem', color: '#a5d6a7',
              maxWidth: '100%', maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace',
            }}>
              {SQL_SCHEMA}
            </pre>
          )}
        </div>
      </div>

      {/* MODAL */}
      {selectedUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(6px)',
        }} onClick={e => e.target === e.currentTarget && setSelectedUser(null)}>
          <div style={{
            background: '#0c0b18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: 24, width: 360, maxWidth: '90vw',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{selectedUser.name}</div>
              <button onClick={() => setSelectedUser(null)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                fontSize: '1.2rem', cursor: 'pointer',
              }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#d4a853' }}>{selectedUser.hours}h</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Study</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#5c8c6e' }}>🔥{selectedUser.streak}d</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streak</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
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
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#fff' }}>
                    {selectedUser.studying ? `Studying ${selectedUser.subject || 'right now'}` : 'Offline'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                    {selectedUser.studying ? 'Window is glowing' : 'Window is dark'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
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
}
