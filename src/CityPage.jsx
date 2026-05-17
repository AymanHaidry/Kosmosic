import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from './supabase.js'

/* ─── helpers ─── */
const hashString = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return Math.abs(h >>> 0)
}

/* ─── reduced shape catalog: best 2 per tier ─── */
const SHAPE_CATALOG = {
  1: [
    { h: 3, w: 24, floors: 1, wp: 2, roof: 'peak',  name: 'Cottage' },
    { h: 3, w: 28, floors: 1, wp: 3, roof: 'flat',  name: 'Loft' },
  ],
  2: [
    { h: 6, w: 38, floors: 2, wp: 4, roof: 'peak',  name: 'Townhouse' },
    { h: 7, w: 30, floors: 3, wp: 3, roof: 'flat',  name: 'Triplex' },
  ],
  3: [
    { h: 9, w: 38, floors: 3, wp: 4, roof: 'peak',   name: 'Clock-tower' },
    { h: 9, w: 36, floors: 4, wp: 3, roof: 'setback', name: 'Stepped' },
  ],
  4: [
    { h: 14, w: 46, floors: 6, wp: 4, roof: 'setback', name: 'Ziggurat' },
    { h: 12, w: 42, floors: 5, wp: 4, roof: 'spire',   name: 'Needle' },
  ],
  5: [
    { h: 17, w: 58, floors: 7, wp: 6, roof: 'dome',    name: 'Observatory' },
    { h: 17, w: 56, floors: 7, wp: 5, roof: 'setback', name: 'Cascade' },
  ],
  6: [
    { h: 22, w: 64, floors: 10, wp: 6, roof: 'spire', name: 'Shard' },
    { h: 20, w: 70, floors: 9,  wp: 7, roof: 'none',  name: 'Monolith' },
  ],
}

const getBuildingSpec = (hours, streak, userId = '') => {
  const tier = Math.min(6, Math.floor(Math.log2(Math.max(hours + 1, 1))))
  const catalog = SHAPE_CATALOG[tier] || SHAPE_CATALOG[1]
  const seed = hashString(userId || 'anon')
  const shape = catalog[seed % catalog.length]
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
  if (hours >= 200) return { label: 'Skyline Tower', color: 'var(--accent)' }
  if (hours >= 100) return { label: 'Penthouse', color: 'var(--accent2)' }
  if (hours >= 50)  return { label: 'High-Rise', color: 'var(--blue)' }
  if (hours >= 20)  return { label: 'Mid-Rise', color: 'var(--green)' }
  if (hours >= 5)   return { label: 'Apartment', color: 'var(--text3)' }
  return { label: 'Studio', color: 'var(--text3)' }
}

const getTier = (hours) => {
  if (hours >= 200) return 6
  if (hours >= 100) return 5
  if (hours >= 50)  return 4
  if (hours >= 20)  return 3
  if (hours >= 5)   return 2
  return 1
}

/* ─── weather helpers ─── */
const PHASES = { NIGHT: 'night', DAWN: 'dawn', DAY: 'day', EVENING: 'evening' }

function getPhase(now, sunrise, sunset) {
  const t = now.getTime(), sr = sunrise.getTime(), ss = sunset.getTime()
  const dawnLen = 30 * 60 * 1000, eveLen = 40 * 60 * 1000
  if (t < sr - dawnLen) return PHASES.NIGHT
  if (t < sr + dawnLen) return PHASES.DAWN
  if (t < ss - eveLen) return PHASES.DAY
  if (t < ss + eveLen) return PHASES.EVENING
  return PHASES.NIGHT
}

function getSkyGradient(phase, weather) {
  const w = weather
  if (w.snow) {
    if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #060a10 0%, #0c1218 60%, #111820 100%)'
    if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #1a2028 0%, #2a3540 50%, #3a4858 100%)'
    if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #1e2830 0%, #2a3845 50%, #3a4a5a 100%)'
    return 'linear-gradient(180deg, #8aa0b0 0%, #a0b8c8 40%, #c0d8e8 100%)'
  }
  if (w.rain || w.heavyRain) {
    if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #050810 0%, #0a1018 60%, #0e1620 100%)'
    if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #1a1e28 0%, #252a38 60%, #303848 100%)'
    if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #1a1a28 0%, #252038 50%, #302848 100%)'
    return 'linear-gradient(180deg, #4a5568 0%, #5a6a80 40%, #6a8098 100%)'
  }
  if (w.cloudy) {
    if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #080c14 0%, #0e1420 60%, #121a28 100%)'
    if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #2a2030 0%, #3a3048 50%, #4a4060 100%)'
    if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #2a1e28 0%, #3a2838 50%, #4a3848 100%)'
    return 'linear-gradient(180deg, #5a6880 0%, #6a8098 40%, #8aa0b8 100%)'
  }
  if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #02010a 0%, #080618 40%, #0c0b18 100%)'
  if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #1a0c2e 0%, #3a1e48 40%, #6a3a58 100%)'
  if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #1e0a28 0%, #4a1e38 30%, #8a3a28 70%, #c45a18 100%)'
  return 'linear-gradient(180deg, #0c4a8e 0%, #1e6ab0 30%, #4a9ad8 70%, #8ac8f0 100%)'
}

function getWeatherCondition(data) {
  const p = data.current.precipitation || 0
  const r = data.current.rain || 0
  const s = data.current.snowfall || 0
  const c = data.hourly?.cloud_cover?.[0] ?? 50
  if (s > 0.5) return { snow: true, rain: false, heavyRain: false, cloudy: true, label: 'Snowing' }
  if (p > 2.5) return { snow: false, rain: true, heavyRain: true, cloudy: true, label: 'Heavy Rain' }
  if (p > 0.1 || r > 0.1) return { snow: false, rain: true, heavyRain: false, cloudy: true, label: 'Rain' }
  if (c > 70) return { snow: false, rain: false, heavyRain: false, cloudy: true, label: 'Cloudy' }
  return { snow: false, rain: false, heavyRain: false, cloudy: false, label: 'Clear' }
}

/* ─── celestial positioning ─── */
function getSunPosition(now, sunrise, sunset) {
  const t = now.getTime(), sr = sunrise.getTime(), ss = sunset.getTime()
  if (t < sr || t > ss) return null
  const progress = (t - sr) / (ss - sr)
  const x = 6 + progress * 88
  const y = 68 - 58 * Math.sin(progress * Math.PI)
  return { x, y }
}

function getMoonPosition(now, sunrise, sunset) {
  const t = now.getTime(), sr = sunrise.getTime(), ss = sunset.getTime()
  const dayLen = ss - sr
  const nightLen = 24 * 60 * 60 * 1000 - dayLen
  let prog
  if (t > ss) prog = (t - ss) / nightLen
  else if (t < sr) prog = 0.5 + (t - (ss - 24 * 60 * 60 * 1000)) / nightLen
  else return null
  const x = 6 + (prog % 1) * 88
  const y = 14 + 22 * Math.sin((prog % 1) * Math.PI)
  return { x, y }
}

/* ─── SQL SCHEMA ─── */
const SQL_SCHEMA = `create table if not exists city_profiles (
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
create policy "Readable by authenticated" on city_profiles for select using (auth.role() = 'authenticated');
create policy "Users manage own profile" on city_profiles for all using (auth.uid() = user_id);`

/* ─── constants ─── */
const ROAD_H = 52
const SIDEWALK_H = 12
const GROUND_Y = ROAD_H + SIDEWALK_H // 64

/* ─── single building component ─── */
function Building({ user, spec, x, isMe, onClick, studying, mode, animOffset, weather }) {
  const { height, width, floors, windowsPerFloor, level, style, roof, seed } = spec
  const pxH = height * 18
  const isDark = weather.phase === PHASES.NIGHT || weather.phase === PHASES.EVENING

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

  const renderRoof = () => {
    if (!roof || roof === 'none') return null
    if (roof === 'peak') {
      return (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: `${width * 0.2}px solid transparent`,
          borderRight: `${width * 0.2}px solid transparent`,
          borderBottom: `10px solid ${bColor}`,
          opacity: 0.6,
        }} />
      )
    }
    if (roof === 'dome') {
      return (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          width: width * 0.55, height: 10,
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
          position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 22,
          background: isMe ? '#d4a853' : style === 'cyberpunk' ? 'rgba(100,80,255,0.8)' : 'rgba(255,251,240,0.3)',
          boxShadow: isMe ? '0 0 8px rgba(212,168,83,0.6)' : 'none',
        }} />
      )
    }
    if (roof === 'setback') {
      return (
        <div style={{
          position: 'absolute', top: -6, left: '10%',
          width: '80%', height: 6,
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
        position: 'absolute', bottom: GROUND_Y, left: x,
        width, height: pxH,
        background: getBuildingBg(),
        border: `1px solid ${bColor}`,
        borderBottom: 'none',
        borderRadius: '3px 3px 0 0',
        boxShadow: getGlow(),
        cursor: 'pointer',
        transition: 'box-shadow 0.5s ease',
        overflow: 'visible',
        zIndex: isMe ? 10 : 5,
      }}
    >
      {/* Roof snow cap */}
      {weather.snow && roof !== 'none' && (
        <div style={{
          position: 'absolute',
          top: roof === 'peak' ? -12 : roof === 'dome' ? -12 : -6,
          left: -2, right: -2, height: 5,
          background: 'rgba(240,248,255,0.95)',
          borderRadius: roof === 'dome' ? '50% 50% 0 0' : '3px 3px 0 0',
          zIndex: 2,
        }} />
      )}

      {style === 'cyberpunk' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: '30%', width: 1, height: '100%', background: 'rgba(100,80,255,0.15)' }} />
          <div style={{ position: 'absolute', top: 0, left: '60%', width: 1, height: '100%', background: 'rgba(100,80,255,0.1)' }} />
        </>
      )}
      {style === 'glass' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(80,160,200,0.05) 50%, transparent 100%)' }} />
      )}

      {renderRoof()}

      {/* Windows */}
      <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
        {Array.from({ length: floors }, (_, f) => (
          <div key={f} style={{ display: 'flex', gap: 3, justifyContent: 'center', flex: 1, alignItems: 'center' }}>
            {Array.from({ length: windowsPerFloor }, (_, w) => {
              const noise = Math.sin(f * 7 + w * 13 + animOffset + seed)
              const isStudyLit = studying && noise > 0.1
              const isAmbientLit = !studying && isDark && noise > 0.35
              const color = isStudyLit
                ? mode === 'deep'  ? 'rgba(80,120,255,0.9)'
                : mode === 'exam'  ? 'rgba(220,80,80,0.9)'
                : 'rgba(255,215,80,0.9)'
                : isAmbientLit
                ? 'rgba(255,160,60,0.45)'
                : 'rgba(255,255,255,0.04)'
              const glow = isStudyLit
                ? mode === 'deep'  ? '0 0 6px rgba(80,120,255,0.8)'
                : mode === 'exam'  ? '0 0 6px rgba(220,80,80,0.8)'
                : '0 0 6px rgba(255,215,80,0.7)'
                : isAmbientLit
                ? '0 0 4px rgba(255,140,40,0.4)'
                : 'none'
              return (
                <div key={w} style={{
                  width: 6, height: 7, background: color,
                  borderRadius: 1, boxShadow: glow,
                  transition: 'background 1.2s ease, box-shadow 1.2s ease',
                }} />
              )
            })}
          </div>
        ))}
      </div>

      {/* Antenna / mast for tall buildings */}
      {height >= 12 && roof !== 'spire' && (
        <div style={{
          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 16,
          background: isMe ? '#d4a853' : style === 'cyberpunk' ? 'rgba(100,80,255,0.8)' : 'rgba(255,251,240,0.2)',
          boxShadow: isMe ? '0 0 8px rgba(212,168,83,0.6)' : 'none',
        }} />
      )}

      {isMe && (
        <div style={{
          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          background: '#d4a853', borderRadius: 4, padding: '2px 6px',
          fontSize: '0.55rem', fontWeight: 700, color: '#000', whiteSpace: 'nowrap',
          fontFamily: "'Anthropic Serif',Georgia,serif",
          zIndex: 20,
        }}>YOU</div>
      )}

      {studying && (
        <div style={{
          position: 'absolute', inset: 0,
          background: mode === 'deep'
            ? 'linear-gradient(0deg, rgba(80,120,255,0.04) 0%, transparent 60%)'
            : 'linear-gradient(0deg, rgba(255,215,80,0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Wet foundation during rain */}
      {weather.rain && (
        <div style={{
          position: 'absolute', bottom: -10, left: -4, right: -4, height: 10,
          background: 'linear-gradient(180deg, rgba(80,120,160,0.2) 0%, transparent 100%)',
          filter: 'blur(4px)',
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

  /* weather state */
  const [weather, setWeather] = useState({
    data: null,
    phase: PHASES.NIGHT,
    condition: { snow: false, rain: false, heavyRain: false, cloudy: false, label: 'Clear' },
    temp: null,
    sunrise: null,
    sunset: null,
    loc: { lat: 51.5074, lon: -0.1278, name: 'London' },
  })

  /* animated entities (refs to avoid re-renders) */
  const carRefs = useRef([])
  const carData = useRef([])
  const pedRefs = useRef([])
  const pedData = useRef([])
  const rafRef = useRef()

  const myHours = Math.floor((S?.totalMinutes || 0) / 60)
  const mySpec = getBuildingSpec(myHours, S?.streak || 0, session?.user?.id)
  const myName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'You'
  const myRank = getRankLabel(myHours)

  const STALE_MS = 600000

  /* 1. geolocation */
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWeather(prev => ({
          ...prev,
          loc: { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Local' },
        }))
      },
      () => { /* fallback London */ }
    )
  }, [])

  /* 2. fetch weather */
  const fetchWeather = useCallback(async () => {
    const { lat, lon } = weather.loc
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('current', 'temperature_2m,is_day,precipitation,rain,showers,snowfall')
    url.searchParams.set('hourly', 'temperature_2m,cloud_cover')
    url.searchParams.set('daily', 'sunrise,sunset')
    url.searchParams.set('timezone', 'auto')
    try {
      const res = await fetch(url.toString())
      const json = await res.json()
      if (!json.current) return
      const now = new Date()
      const sunrise = json.daily?.sunrise?.[0] ? new Date(json.daily.sunrise[0]) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0)
      const sunset = json.daily?.sunset?.[0] ? new Date(json.daily.sunset[0]) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0)
      const phase = getPhase(now, sunrise, sunset)
      const condition = getWeatherCondition({ current: json.current, hourly: { cloud_cover: json.hourly?.cloud_cover } })
      setWeather(prev => ({
        ...prev,
        data: json,
        phase,
        condition,
        temp: json.current.temperature_2m,
        sunrise,
        sunset,
      }))
    } catch (e) {
      console.error('weather fetch error', e)
    }
  }, [weather.loc])

  useEffect(() => {
    fetchWeather()
    const id = setInterval(fetchWeather, 600000)
    return () => clearInterval(id)
  }, [fetchWeather])

  /* 3. clock + flicker */
  useEffect(() => {
    const id = setInterval(() => {
      setAnimOffset(o => o + 0.3)
      setTime(new Date())
    }, 800)
    return () => clearInterval(id)
  }, [])

  /* 4. upsert profile */
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
  useEffect(() => {
    if (!isStudying) return
    const id = setInterval(upsert, 30000)
    return () => clearInterval(id)
  }, [isStudying, upsert])

  /* 5. fetch users */
  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('city_profiles').select('*')
    if (error) { console.error('city fetch error:', error); setLoading(false); return }
    if (data) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
    const ch = supabase.channel('city-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'city_profiles' }, fetchUsers)
      .subscribe()
    const poll = setInterval(fetchUsers, 10000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [fetchUsers])

  /* 6. layout with lamps */
  const allResidents = users.map(u => ({
    id: u.user_id,
    name: u.display_name || 'Anonymous',
    hours: Math.floor(u.total_hours || 0),
    streak: u.streak || 0,
    studying: u.is_studying && (Date.now() - new Date(u.updated_at || 0).getTime() < STALE_MS),
    mode: u.study_mode,
    subject: u.study_mode === 'exam' ? 'Exam' : u.study_mode === 'deep' ? 'Deep Work' : 'Focus',
    isMe: u.user_id === session?.user?.id,
  }))

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

  const layoutItems = []
  let xCursor = 30
  displayOrder.forEach((user, idx) => {
    const spec = getBuildingSpec(user.hours, user.streak, user.id)
    layoutItems.push({ type: 'building', user, spec, x: xCursor })
    xCursor += spec.width
    if (idx < displayOrder.length - 1) {
      const gap = 16
      const lampH = Math.min(100, Math.max(60, spec.height * 8))
      layoutItems.push({ type: 'lamp', x: xCursor + gap / 2 - 2, h: lampH })
      xCursor += gap
    }
  })
  const totalWidth = xCursor + 30

  /* 7. animated cars & pedestrians (rAF, no state churn) */
useEffect(() => {
    const W = Math.max(totalWidth, 1200)
    const LANE_TOP = 8
    const LANE_BOT = 38
    const SIDEWALK_Y = 4

    const CAR_TYPES = [
      { type: 'sedan', w: 34, h: 13, cabinW: 0.55, cabinH: 0.5, wheelR: 3, color: '#8e2b2b', window: '#1a2a3a' },
      { type: 'suv', w: 38, h: 16, cabinW: 0.5, cabinH: 0.55, wheelR: 3.5, color: '#1e3a5f', window: '#152535' },
      { type: 'hatch', w: 30, h: 12, cabinW: 0.65, cabinH: 0.48, wheelR: 2.8, color: '#2d5a3d', window: '#1a2a2a' },
      { type: 'bus', w: 72, h: 20, cabinW: 0.85, cabinH: 0.6, wheelR: 4, color: '#c4a035', window: '#0f1a25' },
      { type: 'sports', w: 40, h: 11, cabinW: 0.4, cabinH: 0.4, wheelR: 3, color: '#a83232', window: '#050a10' },
      { type: 'van', w: 44, h: 17, cabinW: 0.45, cabinH: 0.55, wheelR: 3.2, color: '#4a5568', window: '#1e2530' },
      { type: 'taxi', w: 34, h: 13, cabinW: 0.55, cabinH: 0.5, wheelR: 3, color: '#d4a853', window: '#1a2a3a' },
    ]

    const carCount = 9
    carData.current = Array.from({ length: carCount }, (_, i) => {
      const tpl = CAR_TYPES[i % CAR_TYPES.length]
      const dir = i % 2 === 0 ? 1 : -1
      const lane = dir === 1 ? LANE_BOT : LANE_TOP
      return {
        x: Math.random() * W,
        speed: (dir === 1 ? 0.9 : 1.3) + Math.random() * 0.7,
        dir,
        y: lane,
        ...tpl,
        headlightOn: isNightish || weather.condition.rain || weather.condition.heavyRain,
      }
    })

    pedData.current = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * W,
      speed: (0.2 + Math.random() * 0.25) * (i % 2 === 0 ? 1 : -1),
      y: SIDEWALK_Y + Math.random() * 6,
      bobOffset: Math.random() * Math.PI * 2,
      stride: 0.5 + Math.random() * 0.3,
      shirt: `hsl(${(i * 55 + 20) % 360}, 55%, ${35 + (i % 3) * 10}%)`,
      pants: `hsl(${(i * 40 + 180) % 360}, 30%, 25%)`,
      skin: ['#e8c4a0','#d4a574','#c4926a','#8d5524','#f5d0b0'][i % 5],
    }))

    const loop = () => {
      const now = performance.now()
      carData.current.forEach((car, i) => {
        const el = carRefs.current[i]
        if (!el) return
        car.x += car.speed * car.dir
        if (car.dir > 0 && car.x > W + 100) car.x = -car.w - 20
        if (car.dir < 0 && car.x < -car.w - 20) car.x = W + 100
        el.style.transform = `translateX(${car.x}px)`
      })
      pedData.current.forEach((ped, i) => {
        const el = pedRefs.current[i]
        if (!el) return
        ped.x += ped.speed
        if (ped.speed > 0 && ped.x > W + 20) ped.x = -16
        if (ped.speed < 0 && ped.x < -16) ped.x = W + 20
        const bob = Math.sin(now * 0.008 + ped.bobOffset) * 2
        el.style.transform = `translateX(${ped.x}px) translateY(${-bob}px)`
      })
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [totalWidth, isNightish, weather.condition.rain, weather.condition.heavyRain])

  /* derived visuals */
  const skyColor = getSkyGradient(weather.phase, weather.condition)
  const sunPos = useMemo(() => getSunPosition(time, weather.sunrise || new Date(), weather.sunset || new Date()), [time, weather.sunrise, weather.sunset])
  const moonPos = useMemo(() => getMoonPosition(time, weather.sunrise || new Date(), weather.sunset || new Date()), [time, weather.sunrise, weather.sunset])
  const liveCount = allResidents.filter(u => u.studying).length
  const showStars = (weather.phase === PHASES.NIGHT || weather.phase === PHASES.DAWN) && !weather.condition.rain && !weather.condition.heavyRain
  const isNightish = weather.phase === PHASES.NIGHT || weather.phase === PHASES.EVENING || weather.phase === PHASES.DAWN

  return (
    <div style={{ position: 'relative', zIndex: 2, fontFamily: "'Anthropic Serif',Georgia,serif" }}>
      {/* HEADER */}
      <div style={{ padding: '80px 24px 0', maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Study City</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>
              {liveCount} studying live right now
              <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ color: 'var(--green)' }}>Live</span>
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '6px 12px', marginBottom: 6,
            }}>
              <span style={{ fontSize: '0.85rem' }}>
                {weather.condition.snow ? '❄️' : weather.condition.heavyRain ? '⛈️' : weather.condition.rain ? '🌧️' : weather.condition.cloudy ? '☁️' : '☀️'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>
                {weather.temp !== null ? `${Math.round(weather.temp)}°C` : '--'} · {weather.condition.label} · {weather.phase}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem', justifyContent: 'flex-end' }}>
              {[
                { c: 'rgba(255,215,80,0.9)', g: '0 0 6px rgba(255,215,80,0.7)', l: 'Focus' },
                { c: 'rgba(80,120,255,0.9)', g: '0 0 6px rgba(80,120,255,0.8)', l: 'Deep Work' },
                { c: 'rgba(220,80,80,0.9)',  g: '0 0 6px rgba(220,80,80,0.8)', l: 'Exam' },
                { c: 'rgba(255,255,255,0.06)', g: 'none', l: 'Offline' },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 1, background: item.c, boxShadow: item.g }} />
                  <span style={{ color: 'var(--text3)' }}>{item.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CITY VIEWPORT */}
      <div style={{
        width: '100%', height: 460,
        background: skyColor,
        position: 'relative', overflow: 'hidden',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        transition: 'background 2s ease',
      }}>
        {/* Stars */}
        {showStars && Array.from({ length: 70 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23) % 45}%`,
            width: i % 5 === 0 ? 2 : 1,
            height: i % 5 === 0 ? 2 : 1,
            background: '#fff',
            borderRadius: '50%',
            opacity: 0.25 + (i % 7) * 0.1,
            animation: `twinkle ${2 + (i % 5)}s ease-in-out infinite`,
            animationDelay: `${(i % 7) * 0.5}s`,
          }} />
        ))}

        {/* Cloud overlay */}
        {weather.condition.cloudy && !weather.condition.rain && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(255,255,255,0.04) 0%, transparent 50%)',
            pointerEvents: 'none',
            animation: 'drift 60s linear infinite',
          }} />
        )}

        {/* Rain */}
        {weather.condition.rain && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 25 }}>
            {Array.from({ length: weather.condition.heavyRain ? 90 : 45 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 13) % 100}%`,
                top: -10,
                width: 1, height: weather.condition.heavyRain ? 16 : 12,
                background: 'rgba(160,180,200,0.45)',
                borderRadius: 1,
                animation: `rainfall ${0.5 + (i % 5) * 0.12}s linear infinite`,
                animationDelay: `${(i % 8) * 0.1}s`,
              }} />
            ))}
          </div>
        )}

        {/* Snow */}
        {weather.condition.snow && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 25 }}>
            {Array.from({ length: 55 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 19) % 100}%`,
                top: -6,
                width: 3 + (i % 3), height: 3 + (i % 3),
                background: 'rgba(230,240,255,0.8)',
                borderRadius: '50%',
                animation: `snowfall ${2 + (i % 4)}s linear infinite`,
                animationDelay: `${(i % 6) * 0.3}s`,
              }} />
            ))}
          </div>
        )}

        {/* Lightning */}
        {weather.condition.heavyRain && Math.random() > 0.97 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.1)',
            pointerEvents: 'none',
            animation: 'flash 0.2s ease-out',
            zIndex: 24,
          }} />
        )}

        {/* Sun */}
        {sunPos && (
          <div style={{
            position: 'absolute',
            left: `${sunPos.x}%`,
            top: `${sunPos.y}%`,
            transform: 'translate(-50%, -50%)',
            width: 44, height: 44,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #fffce6 10%, #ffd700 50%, #ff8c00 100%)',
            boxShadow: '0 0 50px rgba(255,200,50,0.5), 0 0 100px rgba(255,140,0,0.25)',
            zIndex: 4,
            transition: 'left 2s linear, top 2s linear',
          }}>
            {/* Sun rays */}
            <div style={{
              position: 'absolute', inset: -10,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,220,100,0.08) 10deg, transparent 20deg, transparent 40deg, rgba(255,220,100,0.06) 50deg, transparent 60deg, transparent 80deg, rgba(255,220,100,0.08) 90deg, transparent 100deg, transparent 120deg, rgba(255,220,100,0.05) 130deg, transparent 140deg, transparent 160deg, rgba(255,220,100,0.06) 170deg, transparent 180deg, transparent 200deg, rgba(255,220,100,0.05) 210deg, transparent 220deg, transparent 240deg, rgba(255,220,100,0.08) 250deg, transparent 260deg, transparent 280deg, rgba(255,220,100,0.06) 290deg, transparent 300deg, transparent 320deg, rgba(255,220,100,0.05) 330deg, transparent 340deg, transparent 360deg)',
              animation: 'spin 20s linear infinite',
            }} />
          </div>
        )}

        {/* Moon */}
        {moonPos && (
          <div style={{
            position: 'absolute',
            left: `${moonPos.x}%`,
            top: `${moonPos.y}%`,
            transform: 'translate(-50%, -50%)',
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #f0e6d2, #c4b896)',
            boxShadow: 'inset -3px -3px 6px rgba(0,0,0,0.25), inset 2px 2px 4px rgba(255,255,255,0.15), 0 0 18px rgba(200,200,220,0.15)',
            zIndex: 4,
            transition: 'left 3s linear, top 3s linear',
          }}>
            {/* Craters */}
            <div style={{ position: 'absolute', top: '22%', left: '28%', width: '18%', height: '18%', borderRadius: '50%', background: 'rgba(0,0,0,0.07)', boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.2)' }} />
            <div style={{ position: 'absolute', top: '52%', left: '48%', width: '14%', height: '14%', borderRadius: '50%', background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.2)' }} />
            <div style={{ position: 'absolute', top: '38%', left: '62%', width: '10%', height: '10%', borderRadius: '50%', background: 'rgba(0,0,0,0.08)', boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.2)' }} />
            <div style={{ position: 'absolute', top: '65%', left: '25%', width: '12%', height: '12%', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.15)' }} />
          </div>
        )}

        {/* Fog */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
          background: weather.condition.rain
            ? 'linear-gradient(0deg, rgba(12,11,9,0.95) 0%, transparent 100%)'
            : 'linear-gradient(0deg, rgba(12,11,9,0.85) 0%, transparent 100%)',
          zIndex: 20, pointerEvents: 'none',
        }} />

        {/* Scrollable city */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: '100%', height: '100%',
          overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{ position: 'relative', width: Math.max(totalWidth, 900), height: '100%', minWidth: '100%' }}>
            
            {/* Sidewalk */}
            <div style={{
              position: 'absolute', bottom: ROAD_H, left: 0, right: 0, height: SIDEWALK_H,
              background: 'linear-gradient(0deg, #2a2a2a 0%, #333 100%)',
              borderTop: '2px solid #3d3d3d',
              zIndex: 15,
            }} />

            {/* Road */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: ROAD_H,
              background: weather.condition.rain
                ? 'linear-gradient(0deg, #0c0e12 0%, #14161c 100%)'
                : 'linear-gradient(0deg, #0e0f12 0%, #181a1f 100%)',
              zIndex: 14,
            }}>
              {/* Lane markings */}
              {Array.from({ length: Math.ceil(Math.max(totalWidth, 900) / 80) }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: `${i * 80 + 20}px`,
                  width: 40, height: 2,
                  background: 'rgba(255,255,255,0.15)',
                  transform: 'translateY(-50%)',
                }} />
              ))}
              {/* Curb */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.08)' }} />
            </div>

                        {/* Street Lamps */}
            {layoutItems.filter(it => it.type === 'lamp').map((lamp, i) => (
              <div key={`lamp-${i}`} style={{ position: 'absolute', bottom: GROUND_Y, left: lamp.x, zIndex: 6, pointerEvents: 'none' }}>
                {/* Post */}
                <div style={{ 
                  width: 3, height: lamp.h, 
                  background: 'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)', 
                  margin: '0 auto', borderRadius: 1,
                  position: 'relative',
                }}>
                  {/* Post detail rings */}
                  <div style={{ position: 'absolute', top: '20%', left: -1, right: -1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', top: '60%', left: -1, right: -1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>
                
                {/* Lamp arm */}
                <div style={{
                  position: 'absolute', top: 2, left: '50%',
                  width: 10, height: 3,
                  background: '#2a2a2a',
                  transform: 'translateX(-50%)',
                  borderRadius: '0 2px 0 0',
                }} />
                
                {/* Lamp housing */}
                <div style={{
                  position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                  width: 14, height: 10,
                  background: isNightish 
                    ? 'linear-gradient(180deg, #4a4a3a 0%, #3a3a2a 100%)' 
                    : '#2a2a2a',
                  borderRadius: '6px 6px 2px 2px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {/* Bulb glow */}
                  <div style={{
                    position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                    width: 8, height: 5,
                    background: isNightish ? '#fff8dc' : '#333',
                    borderRadius: '0 0 3px 3px',
                    boxShadow: isNightish 
                      ? '0 0 20px rgba(255,248,220,0.9), 0 0 50px rgba(255,235,150,0.5), 0 0 100px rgba(255,220,100,0.2), inset 0 0 6px rgba(255,250,200,0.8)' 
                      : 'none',
                    transition: 'all 1.2s ease',
                  }} />
                </div>
                
                {/* Ambient glow halo */}
                {isNightish && (
                  <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    width: 40, height: 40,
                    background: 'radial-gradient(circle, rgba(255,248,220,0.15) 0%, rgba(255,235,150,0.05) 40%, transparent 70%)',
                    pointerEvents: 'none',
                    borderRadius: '50%',
                  }} />
                )}
                
                {/* Light cone on ground */}
                {isNightish && (
                  <div style={{
                    position: 'absolute', bottom: -GROUND_Y, left: '50%', transform: 'translateX(-50%)',
                    width: 90, height: GROUND_Y,
                    background: 'radial-gradient(ellipse at center top, rgba(255,248,220,0.18) 0%, rgba(255,235,150,0.06) 50%, transparent 75%)',
                    pointerEvents: 'none',
                    zIndex: -1,
                  }} />
                )}
                
                {/* Light cone upward (atmospheric) */}
                {isNightish && (
                  <div style={{
                    position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                    width: 60, height: lamp.h,
                    background: 'radial-gradient(ellipse at center bottom, rgba(255,248,220,0.08) 0%, transparent 60%)',
                    pointerEvents: 'none',
                  }} />
                )}
                
                {/* Moths (only at night) */}
                {isNightish && (
                  <>
                    <div style={{
                      position: 'absolute', top: -8, left: '50%',
                      width: 1.5, height: 1.5, borderRadius: '50%',
                      background: 'rgba(255,255,200,0.6)',
                      boxShadow: '0 0 3px rgba(255,255,200,0.8)',
                      animation: `mothFlutter ${1.5 + (i % 3) * 0.4}s ease-in-out infinite`,
                      animationDelay: `${(i % 4) * 0.3}s`,
                    }} />
                    <div style={{
                      position: 'absolute', top: -6, left: '55%',
                      width: 1, height: 1, borderRadius: '50%',
                      background: 'rgba(255,255,200,0.4)',
                      animation: `mothFlutter ${2 + (i % 2) * 0.5}s ease-in-out infinite`,
                      animationDelay: `${(i % 3) * 0.5}s`,
                    }} />
                  </>
                )}
              </div>
            ))}

                        {/* Cars */}
                        {/* Cars */}
            {carData.current.map((car, i) => {
              const isRight = car.dir > 0
              const hl = car.headlightOn
              return (
                <div key={`car-${i}`} ref={el => carRefs.current[i] = el} style={{
                  position: 'absolute', bottom: car.y, left: 0,
                  zIndex: 16, pointerEvents: 'none',
                }}>
                  <div style={{ position: 'relative', width: car.w, height: car.h }}>
                    {/* Headlight beams */}
                    {hl && isRight && (
                      <div style={{
                        position: 'absolute', right: -90, top: 2,
                        width: 90, height: car.h - 4,
                        background: 'linear-gradient(90deg, rgba(255,250,220,0.35) 0%, rgba(255,250,220,0.08) 60%, transparent 100%)',
                        clipPath: 'polygon(0 20%, 100% 0, 100% 100%, 0 80%)',
                        filter: 'blur(3px)',
                        zIndex: -1,
                      }} />
                    )}
                    {hl && !isRight && (
                      <div style={{
                        position: 'absolute', left: -90, top: 2,
                        width: 90, height: car.h - 4,
                        background: 'linear-gradient(270deg, rgba(255,250,220,0.35) 0%, rgba(255,250,220,0.08) 60%, transparent 100%)',
                        clipPath: 'polygon(100% 20%, 0 0, 0 100%, 100% 80%)',
                        filter: 'blur(3px)',
                        zIndex: -1,
                      }} />
                    )}
                    
                    {/* Headlight glows */}
                    {hl && isRight && (
                      <div style={{
                        position: 'absolute', right: -2, top: 3,
                        width: 6, height: 4, borderRadius: '0 50% 50% 0',
                        background: 'rgba(255,250,200,0.9)',
                        boxShadow: '0 0 10px rgba(255,250,200,0.8), 0 0 20px rgba(255,250,200,0.4)',
                      }} />
                    )}
                    {hl && !isRight && (
                      <div style={{
                        position: 'absolute', left: -2, top: 3,
                        width: 6, height: 4, borderRadius: '50% 0 0 50%',
                        background: 'rgba(255,250,200,0.9)',
                        boxShadow: '0 0 10px rgba(255,250,200,0.8), 0 0 20px rgba(255,250,200,0.4)',
                      }} />
                    )}

                    {/* Taillight glows */}
                    {!isRight && (
                      <div style={{
                        position: 'absolute', right: -1, top: 3,
                        width: 4, height: 5, borderRadius: '0 2px 2px 0',
                        background: 'rgba(220,50,50,0.85)',
                        boxShadow: '0 0 8px rgba(220,50,50,0.7), 0 0 14px rgba(220,50,50,0.3)',
                      }} />
                    )}
                    {isRight && (
                      <div style={{
                        position: 'absolute', left: -1, top: 3,
                        width: 4, height: 5, borderRadius: '2px 0 0 2px',
                        background: 'rgba(220,50,50,0.85)',
                        boxShadow: '0 0 8px rgba(220,50,50,0.7), 0 0 14px rgba(220,50,50,0.3)',
                      }} />
                    )}

                    {/* Chassis shadow */}
                    <div style={{
                      position: 'absolute', bottom: -2, left: 2, right: 2, height: 3,
                      background: 'rgba(0,0,0,0.5)', borderRadius: '50%', filter: 'blur(2px)',
                    }} />

                    {/* Main body */}
                    <div style={{
                      position: 'absolute', bottom: car.wheelR, left: 0, right: 0, height: car.h - car.wheelR,
                      background: car.color,
                      borderRadius: isRight ? '6px 4px 2px 2px' : '4px 6px 2px 2px',
                      overflow: 'hidden',
                    }}>
                      {/* Cabin / windows */}
                      <div style={{
                        position: 'absolute',
                        top: 1,
                        left: isRight ? `${(1 - car.cabinW) * 100}%` : '5%',
                        width: `${car.cabinW * 100}%`,
                        height: `${car.cabinH * 100}%`,
                        background: car.window,
                        borderRadius: isRight ? '4px 2px 0 0' : '2px 4px 0 0',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        {/* Window glint */}
                        <div style={{
                          position: 'absolute', top: 0, left: '20%', width: '30%', height: '100%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                        }} />
                      </div>
                      {/* Door line */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: '25%', width: 1, height: '60%',
                        background: 'rgba(0,0,0,0.25)',
                      }} />
                      <div style={{
                        position: 'absolute', bottom: 0, left: '65%', width: 1, height: '60%',
                        background: 'rgba(0,0,0,0.25)',
                      }} />
                      {/* Bumper detail */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: isRight ? 'auto' : 0, right: isRight ? 0 : 'auto',
                        width: '15%', height: 3,
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: isRight ? '0 0 2px 0' : '0 0 0 2px',
                      }} />
                    </div>

                    {/* Wheels */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: car.w * 0.18,
                      width: car.wheelR * 2, height: car.wheelR * 2,
                      background: '#0c0c0c', borderRadius: '50%',
                      border: '2px solid #1a1a1a', boxSizing: 'border-box',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 2, borderRadius: '50%',
                        border: '1px dashed rgba(80,80,80,0.5)',
                      }} />
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 0, right: car.w * 0.18,
                      width: car.wheelR * 2, height: car.wheelR * 2,
                      background: '#0c0c0c', borderRadius: '50%',
                      border: '2px solid #1a1a1a', boxSizing: 'border-box',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 2, borderRadius: '50%',
                        border: '1px dashed rgba(80,80,80,0.5)',
                      }} />
                    </div>
                  </div>
                </div>
              )
            })}

                        {/* Pedestrians */}
            {pedData.current.map((ped, i) => (
              <div key={`ped-${i}`} ref={el => pedRefs.current[i] = el} style={{
                position: 'absolute', bottom: GROUND_Y + ped.y, left: 0,
                zIndex: 17, pointerEvents: 'none',
              }}>
                <div style={{ position: 'relative', width: 10, height: 22 }}>
                  {/* Shadow */}
                  <div style={{
                    position: 'absolute', bottom: -1, left: -2,
                    width: 14, height: 3, background: 'rgba(0,0,0,0.35)',
                    borderRadius: '50%', filter: 'blur(1px)',
                  }} />
                  
                  {/* Head */}
                  <div style={{
                    position: 'absolute', top: 0, left: 2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: ped.skin,
                    zIndex: 2,
                  }}>
                    {/* Hair */}
                    <div style={{
                      position: 'absolute', top: -1, left: -1, right: -1, height: 3,
                      background: `hsl(${(i * 47) % 360}, 25%, ${15 + (i % 4) * 8}%)`,
                      borderRadius: '50% 50% 0 0',
                    }} />
                  </div>
                  
                  {/* Neck */}
                  <div style={{
                    position: 'absolute', top: 5, left: 3.5,
                    width: 2, height: 2, background: ped.skin, zIndex: 1,
                  }} />
                  
                  {/* Torso */}
                  <div style={{
                    position: 'absolute', top: 7, left: 1,
                    width: 8, height: 8, borderRadius: '2px 2px 1px 1px',
                    background: ped.shirt, zIndex: 1,
                  }}>
                    {/* Shirt detail */}
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      width: 1, height: '100%', background: 'rgba(0,0,0,0.15)',
                    }} />
                  </div>
                  
                  {/* Arms (swinging) */}
                  <div style={{
                    position: 'absolute', top: 8, left: -1,
                    width: 2.5, height: 7, borderRadius: 1,
                    background: ped.shirt,
                    transformOrigin: 'top center',
                    transform: `rotate(${Math.sin(performance.now() * 0.01 + ped.bobOffset) * 20}deg)`,
                  }} />
                  <div style={{
                    position: 'absolute', top: 8, right: -1,
                    width: 2.5, height: 7, borderRadius: 1,
                    background: ped.shirt,
                    transformOrigin: 'top center',
                    transform: `rotate(${-Math.sin(performance.now() * 0.01 + ped.bobOffset) * 20}deg)`,
                  }} />
                  
                  {/* Legs (walking) */}
                  <div style={{
                    position: 'absolute', top: 14, left: 1.5,
                    width: 3, height: 8, borderRadius: '0 0 1px 1px',
                    background: ped.pants,
                    transformOrigin: 'top center',
                    transform: `rotate(${Math.sin(performance.now() * 0.012 + ped.bobOffset) * 15}deg)`,
                  }} />
                  <div style={{
                    position: 'absolute', top: 14, right: 1.5,
                    width: 3, height: 8, borderRadius: '0 0 1px 1px',
                    background: ped.pants,
                    transformOrigin: 'top center',
                    transform: `rotate(${-Math.sin(performance.now() * 0.012 + ped.bobOffset) * 15}deg)`,
                  }} />
                </div>
              </div>
            ))}

            {/* Buildings */}
            {layoutItems.filter(it => it.type === 'building').map(({ user, spec, x }) => (
              <Building
                key={user.id}
                user={user}
                spec={spec}
                x={x}
                isMe={user.isMe}
                studying={user.studying}
                mode={user.mode}
                animOffset={animOffset}
                weather={{ ...weather.condition, phase: weather.phase }}
                onClick={() => setSelectedUser(user)}
              />
            ))}

            {layoutItems.length === 0 && !loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text3)', fontSize: '0.9rem', zIndex: 30,
              }}>
                No residents yet. Start studying to found the city.
              </div>
            )}

            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', fontSize: '0.9rem', zIndex: 30,
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
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Your Building</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: myRank.color, marginBottom: 2 }}>
                  {myRank.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{myHours}h studied · {S?.streak || 0} day streak</div>
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
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Next Level</div>
              <div style={{ width: '100%', height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (myHours % 50) * 2)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: 4 }}>
                {Math.max(0, 50 - (myHours % 50))}h until next upgrade
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>City Leaderboard</div>
            {allResidents
              .sort((a, b) => b.hours - a.hours)
              .slice(0, 5)
              .map((u, i) => {
                const rank = getRankLabel(u.hours)
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--text2)' : i === 2 ? 'var(--accent2)' : 'var(--text3)', width: 16 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: u.isMe ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name}
                        {u.studying && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: rank.color }}>{rank.label}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{u.hours}h</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text3)' }}>🔥 {u.streak}d</div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* LIVE ACTIVITY */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 16, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Activity</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>Real-time · updates every 10s</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allResidents.filter(u => u.studying).map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
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
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)' }}>{u.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{u.subject || 'Studying'}</div>
                </div>
              </div>
            ))}
            {allResidents.filter(u => u.studying).length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', padding: '8px 0' }}>
                Nobody is studying right now. Start a focus session to light up your windows →
              </div>
            )}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 16,
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>How Your Building Evolves</div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { label: 'Studio', hours: '0–5h', color: 'var(--text3)' },
              { label: 'Apartment', hours: '5–20h', color: 'var(--text3)' },
              { label: 'Mid-Rise', hours: '20–50h', color: 'var(--green)' },
              { label: 'High-Rise', hours: '50–100h', color: 'var(--blue)' },
              { label: 'Penthouse', hours: '100–200h', color: 'var(--accent2)' },
              { label: 'Skyline Tower', hours: '200h+', color: 'var(--accent)' },
            ].map((tier, i) => (
              <div key={tier.label} style={{
                flex: '0 0 auto', textAlign: 'center', padding: '12px 16px',
                background: myHours >= [0, 5, 20, 50, 100, 200][i] ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1px solid ${myHours >= [0, 5, 20, 50, 100, 200][i] ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10,
              }}>
                <div style={{ fontWeight: 700, color: tier.color, fontSize: '0.82rem', marginBottom: 2 }}>{tier.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{tier.hours}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SQL Toggle */}
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowSQL(s => !s)} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text3)', borderRadius: 8, padding: '6px 12px',
            fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Anthropic Serif',Georgia,serif",
          }}>
            {showSQL ? 'Hide Supabase Schema' : 'Show Supabase Schema'}
          </button>
          {showSQL && (
            <pre style={{
              marginTop: 8, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 14, fontSize: '0.62rem', color: 'var(--green)',
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
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 16, padding: 24, width: 360, maxWidth: '90vw',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{selectedUser.name}</div>
              <button onClick={() => setSelectedUser(null)} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                fontSize: '1.2rem', cursor: 'pointer',
              }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)' }}>{selectedUser.hours}h</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Study</div>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--green)' }}>🔥{selectedUser.streak}d</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streak</div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
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
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
                @keyframes mothFlutter {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          25% { transform: translate(4px, -3px) scale(1.2); opacity: 1; }
          50% { transform: translate(-2px, -6px) scale(0.9); opacity: 0.4; }
          75% { transform: translate(3px, -2px) scale(1.1); opacity: 0.8; }
        }
        
        @keyframes rainfall {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(460px); opacity: 0; }
        }
        @keyframes snowfall {
          0% { transform: translateY(-6px) translateX(0); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: translateY(460px) translateX(20px); opacity: 0; }
        }
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes drift {
          0% { transform: translateX(0); }
          50% { transform: translateX(20px); }
          100% { transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes walkBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes legMove {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}
