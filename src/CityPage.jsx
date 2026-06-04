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
  if (hours >= 200) return { label: 'Skyline Tower', color: '#e5c07b' }
  if (hours >= 100) return { label: 'Penthouse', color: '#d19a66' }
  if (hours >= 50)  return { label: 'High-Rise', color: '#61afef' }
  if (hours >= 20)  return { label: 'Mid-Rise', color: '#98c379' }
  if (hours >= 5)   return { label: 'Apartment', color: '#abb2bf' }
  return { label: 'Studio', color: '#5c6370' }
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
    if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #04080f 0%, #0a111a 40%, #15202b 100%)'
    if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #151b24 0%, #25303d 50%, #3d4f61 100%)'
    if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #18222b 0%, #253342 50%, #3d5066 100%)'
    return 'linear-gradient(180deg, #6c869e 0%, #8ca6bd 40%, #bed4e6 100%)'
  }
  if (w.rain || w.heavyRain) {
    if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #03050a 0%, #080c14 50%, #101721 100%)'
    if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #12151e 0%, #1d2230 50%, #2a3245 100%)'
    if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #141421 0%, #1d1b30 50%, #2b2545 100%)'
    return 'linear-gradient(180deg, #384254 0%, #4a566e 40%, #62728f 100%)'
  }
  if (w.cloudy) {
    if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #050810 0%, #0d121c 60%, #151d2b 100%)'
    if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #211926 0%, #322840 50%, #463c5c 100%)'
    if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #211720 0%, #322130 50%, #463143 100%)'
    return 'linear-gradient(180deg, #4b5a73 0%, #61748f 40%, #859bb5 100%)'
  }
  if (phase === PHASES.NIGHT)   return 'linear-gradient(180deg, #010005 0%, #050312 40%, #0a091a 80%, #131230 100%)'
  if (phase === PHASES.DAWN)    return 'linear-gradient(180deg, #0f051c 0%, #2b133b 40%, #592949 80%, #ff8a66 100%)'
  if (phase === PHASES.EVENING) return 'linear-gradient(180deg, #150521 0%, #381230 30%, #782626 60%, #e05e1b 100%)'
  return 'linear-gradient(180deg, #094080 0%, #155ba1 30%, #3f8ed4 70%, #8cd2ff 100%)'
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
const GROUND_Y = ROAD_H + SIDEWALK_H

/* ─── single building component ─── */
function Building({ user, spec, x, isMe, onClick, studying, mode, animOffset, weather }) {
  const { height, width, floors, windowsPerFloor, level, style, roof, seed } = spec
  const pxH = height * 18
  const isDark = weather.phase === PHASES.NIGHT || weather.phase === PHASES.EVENING

  const getBuildingBg = () => {
    if (style === 'cyberpunk') return 'linear-gradient(180deg, rgba(16,14,34,0.95) 0%, rgba(24,20,50,0.9) 100%)'
    if (style === 'glass')     return 'linear-gradient(180deg, rgba(18,28,36,0.9) 0%, rgba(12,18,24,0.95) 100%)'
    if (style === 'modern')    return 'linear-gradient(180deg, rgba(28,28,30,0.95) 0%, rgba(20,20,22,0.95) 100%)'
    return 'linear-gradient(180deg, rgba(22,22,24,0.98) 0%, rgba(14,14,16,0.98) 100%)'
  }

  const getBorderColor = () => {
    if (isMe) return 'rgba(229,192,123,0.9)'
    if (style === 'cyberpunk') return 'rgba(198,120,221,0.5)'
    if (style === 'glass')     return 'rgba(97,175,239,0.4)'
    return 'rgba(255,255,255,0.1)'
  }

  const getGlow = () => {
    if (isMe && studying) return '0 0 35px rgba(229,192,123,0.5), inset 0 0 20px rgba(229,192,123,0.1)'
    if (isMe) return '0 0 25px rgba(229,192,123,0.25)'
    if (studying && mode === 'deep') return '0 0 25px rgba(97,175,239,0.3)'
    if (studying) return '0 0 20px rgba(229,192,123,0.25)'
    return '0 8px 32px rgba(0,0,0,0.4)'
  }

  const bColor = getBorderColor()

  const renderRoof = () => {
    if (!roof || roof === 'none') return null
    if (roof === 'peak') {
      return (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: `${width * 0.25}px solid transparent`,
          borderRight: `${width * 0.25}px solid transparent`,
          borderBottom: `12px solid ${bColor}`,
          opacity: 0.7,
        }} />
      )
    }
    if (roof === 'dome') {
      return (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          width: width * 0.6, height: 12,
          background: `linear-gradient(180deg, ${bColor} 0%, transparent 100%)`,
          borderRadius: '50% 50% 0 0',
        }} />
      )
    }
    if (roof === 'slant') {
      return (
        <div style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) skewX(-15deg)',
          width: width * 0.6, height: 8,
          background: bColor, opacity: 0.6,
        }} />
      )
    }
    if (roof === 'spire') {
      return (
        <div style={{
          position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 28,
          background: isMe ? '#e5c07b' : style === 'cyberpunk' ? '#c678dd' : 'rgba(255,255,255,0.4)',
          boxShadow: isMe ? '0 0 12px rgba(229,192,123,0.8)' : 'none',
        }} />
      )
    }
    if (roof === 'setback') {
      return (
        <div style={{
          position: 'absolute', top: -8, left: '10%',
          width: '80%', height: 8,
          background: bColor, opacity: 0.4,
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
        borderRadius: '4px 4px 0 0',
        boxShadow: getGlow(),
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'visible',
        zIndex: isMe ? 10 : 5,
        backdropFilter: 'blur(4px)', // Modern glassmorphism touch
      }}
      className="building-hover"
    >
      {/* Structural Mullions (Glass/Cyberpunk) */}
      {(style === 'cyberpunk' || style === 'glass') && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-evenly', pointerEvents: 'none', opacity: 0.2 }}>
           {Array.from({ length: 3 }).map((_, i) => (
             <div key={i} style={{ width: 1, height: '100%', background: '#fff' }} />
           ))}
        </div>
      )}

      {/* Roof snow cap */}
      {weather.snow && roof !== 'none' && (
        <div style={{
          position: 'absolute',
          top: roof === 'peak' ? -14 : roof === 'dome' ? -14 : -8,
          left: -2, right: -2, height: 6,
          background: 'linear-gradient(180deg, #fff 0%, #e2e8f0 100%)',
          borderRadius: roof === 'dome' ? '50% 50% 0 0' : '3px 3px 0 0',
          boxShadow: '0 2px 6px rgba(255,255,255,0.4)',
          zIndex: 2,
        }} />
      )}

      {renderRoof()}

      {/* Windows Layer */}
      <div style={{ padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 4, height: '100%', position: 'relative', zIndex: 2 }}>
        {Array.from({ length: floors }, (_, f) => (
          <div key={f} style={{ display: 'flex', gap: 4, justifyContent: 'center', flex: 1, alignItems: 'center' }}>
            {Array.from({ length: windowsPerFloor }, (_, w) => {
              const noise = Math.sin(f * 7 + w * 13 + animOffset + seed)
              const isStudyLit = studying && noise > 0.1
              const isAmbientLit = !studying && isDark && noise > 0.45 
              
              const color = isStudyLit
                ? mode === 'deep'  ? '#61afef'
                : mode === 'exam'  ? '#e06c75'
                : '#e5c07b'
                : isAmbientLit
                ? 'rgba(229, 192, 123, 0.3)'
                : 'rgba(255,255,255,0.02)'
                
              const glow = isStudyLit
                ? mode === 'deep'  ? '0 0 10px rgba(97,175,239,0.8)'
                : mode === 'exam'  ? '0 0 10px rgba(224,108,117,0.8)'
                : '0 0 10px rgba(229,192,123,0.8)'
                : isAmbientLit
                ? '0 0 5px rgba(229, 192, 123, 0.2)'
                : 'inset 0 0 2px rgba(0,0,0,0.5)'

              return (
                <div key={w} style={{
                  width: 6, height: Math.max(6, (pxH / floors) * 0.4), background: color,
                  borderRadius: 1, boxShadow: glow,
                  transition: 'background 0.8s ease, box-shadow 0.8s ease',
                }} />
              )
            })}
          </div>
        ))}
      </div>

      {/* Antenna / mast for tall buildings */}
      {height >= 12 && roof !== 'spire' && (
        <div style={{
          position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 20,
          background: isMe ? '#e5c07b' : style === 'cyberpunk' ? '#c678dd' : 'rgba(255,255,255,0.3)',
          boxShadow: isMe ? '0 0 10px rgba(229,192,123,0.8)' : 'none',
        }}>
           {/* Blinking aviation light */}
           <div style={{
             position: 'absolute', top: 0, left: -1, width: 4, height: 4, borderRadius: '50%',
             background: '#e06c75', animation: 'blink 2s infinite'
           }} />
        </div>
      )}

      {isMe && (
        <div style={{
          position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #e5c07b 0%, #d19a66 100%)', 
          borderRadius: 6, padding: '3px 8px',
          fontSize: '0.6rem', fontWeight: 800, color: '#111', whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(229,192,123,0.4)',
          letterSpacing: '0.05em',
          zIndex: 20,
        }}>YOU</div>
      )}

      {/* Internal Study Glow Gradient */}
      {studying && (
        <div style={{
          position: 'absolute', inset: 0,
          background: mode === 'deep'
            ? 'linear-gradient(0deg, rgba(97,175,239,0.08) 0%, transparent 80%)'
            : 'linear-gradient(0deg, rgba(229,192,123,0.08) 0%, transparent 80%)',
          pointerEvents: 'none', borderRadius: '3px 3px 0 0'
        }} />
      )}

      {/* Wet foundation during rain */}
      {weather.rain && (
        <div style={{
          position: 'absolute', bottom: -12, left: -6, right: -6, height: 12,
          background: 'linear-gradient(180deg, rgba(97,175,239,0.2) 0%, transparent 100%)',
          filter: 'blur(5px)',
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
      const gap = 20 // slightly wider gap for a better feel
      const lampH = Math.min(100, Math.max(60, spec.height * 8))
      layoutItems.push({ type: 'lamp', x: xCursor + gap / 2 - 2, h: lampH })
      xCursor += gap
    }
  })
  const totalWidth = xCursor + 30

  /* 7. animated cars & pedestrians (rAF, no state churn) */
  useEffect(() => {
    const W = Math.max(totalWidth, 1200)

    // Realistic car types with distinct silhouettes
    const carTypes = [
      { name: 'sedan', width: 42, height: 16, wheelOffset: [8, 32], roofY: 4, roofWidth: 22, roofX: 10 },
      { name: 'suv', width: 46, height: 20, wheelOffset: [8, 34], roofY: 2, roofWidth: 26, roofX: 10 },
      { name: 'hatchback', width: 36, height: 15, wheelOffset: [6, 26], roofY: 3, roofWidth: 18, roofX: 9 },
      { name: 'truck', width: 52, height: 22, wheelOffset: [8, 40], roofY: 0, roofWidth: 14, roofX: 4, hasBed: true },
      { name: 'sports', width: 44, height: 13, wheelOffset: [8, 34], roofY: 5, roofWidth: 18, roofX: 13, isLow: true },
      { name: 'van', width: 50, height: 22, wheelOffset: [8, 40], roofY: 0, roofWidth: 30, roofX: 10 },
      { name: 'compact', width: 32, height: 14, wheelOffset: [6, 24], roofY: 3, roofWidth: 16, roofX: 8 },
    ]

    // Realistic car colors with metallic variants
    const carColors = [
      { body: '#c0392b', roof: '#a93226', glass: '#85c1e9', glassOpacity: 0.6 },      // Red
      { body: '#2980b9', roof: '#2471a3', glass: '#aed6f1', glassOpacity: 0.55 },       // Blue
      { body: '#27ae60', roof: '#229954', glass: '#a9dfbf', glassOpacity: 0.5 },        // Green
      { body: '#f39c12', roof: '#d68910', glass: '#f9e79f', glassOpacity: 0.5 },          // Orange
      { body: '#8e44ad', roof: '#7d3c98', glass: '#d2b4de', glassOpacity: 0.5 },          // Purple
      { body: '#1abc9c', roof: '#17a589', glass: '#a3e4d7', glassOpacity: 0.55 },         // Teal
      { body: '#e74c3c', roof: '#cb4335', glass: '#f5b7b1', glassOpacity: 0.5 },         // Coral
      { body: '#34495e', roof: '#2c3e50', glass: '#85929e', glassOpacity: 0.6 },         // Dark
      { body: '#ecf0f1', roof: '#bdc3c7', glass: '#d5dbdb', glassOpacity: 0.5 },          // White
      { body: '#95a5a6', roof: '#7f8c8d', glass: '#bdc3c7', glassOpacity: 0.5 },           // Silver
      { body: '#d35400', roof: '#ba4a00', glass: '#edbb99', glassOpacity: 0.5 },          // Burnt Orange
      { body: '#c2185b', roof: '#ad1457', glass: '#f8bbd9', glassOpacity: 0.5 },         // Pink/Magenta
    ]

    // Pedestrian types with different sizes and walking styles
    const pedTypes = [
      { name: 'adult', height: 14, width: 6, headR: 3.5, stride: 1 },
      { name: 'child', height: 10, width: 4.5, headR: 2.8, stride: 0.7 },
      { name: 'tall', height: 16, width: 6.5, headR: 3.8, stride: 1.1 },
      { name: 'elderly', height: 12, width: 6, headR: 3.2, stride: 0.6 },
    ]

    const pedColors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
      '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
      '#ff5722', '#795548', '#607d8b', '#8bc34a', '#ff9800',
    ]

    // Initialize cars with varied types and realistic properties
    carData.current = Array.from({ length: 14 }, (_, i) => {
      const type = carTypes[i % carTypes.length]
      const color = carColors[i % carColors.length]
      const lane = Math.floor(Math.random() * 3) // 3 lanes
      const direction = i % 2 === 0 ? 1 : -1
      const baseSpeed = direction === 1 
        ? (1.8 + Math.random() * 2.5) // Right lane: faster
        : (1.2 + Math.random() * 2.0)  // Left lane: slightly slower

      return {
        x: Math.random() * W,
        speed: baseSpeed * direction,
        y: 6 + lane * 14 + Math.random() * 4, // Lane positioning
        type,
        color,
        direction,
        headlightOn: Math.random() > 0.3, // 70% have headlights
        taillightOn: Math.random() > 0.2,  // 80% have taillights
        blinkerState: 0,
        blinkerTimer: Math.random() * 60,
      }
    })

    // Initialize pedestrians
    pedData.current = Array.from({ length: 10 }, (_, i) => {
      const type = pedTypes[i % pedTypes.length]
      return {
        x: Math.random() * W,
        speed: (0.2 + Math.random() * 0.3) * (i % 2 === 0 ? 1 : -1),
        y: 2 + Math.random() * 5,
        type,
        color: pedColors[i % pedColors.length],
        walkCycle: Math.random() * Math.PI * 2,
        walkSpeed: 0.08 + Math.random() * 0.06,
      }
    })

    const loop = () => {
      // Update cars
      carData.current.forEach((car, i) => {
        const el = carRefs.current[i]
        if (!el) return

        car.x += car.speed
        car.blinkerTimer++
        if (car.blinkerTimer > 45) {
          car.blinkerState = car.blinkerState === 0 ? 1 : 0
          car.blinkerTimer = 0
        }

        // Wrap around
        const buffer = car.type.width + 20
        if (car.x > W + buffer) car.x = -buffer
        if (car.x < -buffer) car.x = W + buffer

        // Apply transform with subtle bounce for suspension feel
        const bounce = Math.sin(Date.now() * 0.01 + i) * 0.3
        el.style.transform = `translateX(${car.x}px) translateY(${bounce}px)`

        // Update blinkers if element supports it
        const blinkerEl = el.querySelector('.blinker')
        if (blinkerEl) {
          blinkerEl.style.opacity = car.blinkerState
        }
      })

      // Update pedestrians with walking animation
      pedData.current.forEach((ped, i) => {
        const el = pedRefs.current[i]
        if (!el) return

        ped.x += ped.speed
        ped.walkCycle += ped.walkSpeed

        const buffer = 15
        if (ped.x > W + buffer) ped.x = -buffer
        if (ped.x < -buffer) ped.x = W + buffer

        // Walking bob and leg swing
        const bob = Math.sin(ped.walkCycle * 2) * 1.5
        const legSwing = Math.sin(ped.walkCycle) * 8
        el.style.transform = `translateX(${ped.x}px) translateY(${-bob}px)`

        // Animate legs if present
        const legs = el.querySelectorAll('.ped-leg')
        legs.forEach((leg, li) => {
          const phase = li === 0 ? 0 : Math.PI
          const swing = Math.sin(ped.walkCycle + phase) * 6
          leg.style.transform = `rotate(${swing}deg)`
          leg.style.transformOrigin = 'top center'
        })
      })

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [totalWidth])

  /* derived visuals */
  const skyColor = getSkyGradient(weather.phase, weather.condition)
  const sunPos = useMemo(() => getSunPosition(time, weather.sunrise || new Date(), weather.sunset || new Date()), [time, weather.sunrise, weather.sunset])
  const moonPos = useMemo(() => getMoonPosition(time, weather.sunrise || new Date(), weather.sunset || new Date()), [time, weather.sunrise, weather.sunset])
  const liveCount = allResidents.filter(u => u.studying).length
  const showStars = (weather.phase === PHASES.NIGHT || weather.phase === PHASES.DAWN) && !weather.condition.rain && !weather.condition.heavyRain
  const isNightish = weather.phase === PHASES.NIGHT || weather.phase === PHASES.EVENING || weather.phase === PHASES.DAWN

  return (
    <div className="city-container" style={{ position: 'relative', zIndex: 2, fontFamily: "'Inter', system-ui, sans-serif", background: '#090a0f', minHeight: '100vh', overflowX: 'hidden' }}>
      
      {/* HEADER OVERLAY */}
      <div style={{ position: 'relative', zIndex: 30, padding: '60px 24px 20px', maxWidth: 1040, margin: '0 auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: 'rgba(20, 24, 32, 0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              Study Skyline
            </h1>
            <div style={{ color: '#8b949e', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(152, 195, 121, 0.1)', padding: '4px 10px', borderRadius: 12, border: '1px solid rgba(152, 195, 121, 0.2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#98c379', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span style={{ color: '#98c379', fontWeight: 600 }}>{liveCount} Live</span>
              </div>
              <span>building the city right now.</span>
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, alignSelf: 'flex-end',
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '8px 16px',
            }}>
              <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }}>
                {weather.condition.snow ? '❄️' : weather.condition.heavyRain ? '⛈️' : weather.condition.rain ? '🌧️' : weather.condition.cloudy ? '☁️' : '☀️'}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#c9d1d9', fontWeight: 500 }}>
                {weather.temp !== null ? `${Math.round(weather.temp)}°C` : '--'} · {weather.condition.label}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', justifyContent: 'flex-end' }}>
              {[
                { c: '#e5c07b', g: '0 0 8px rgba(229,192,123,0.8)', l: 'Focus' },
                { c: '#61afef', g: '0 0 8px rgba(97,175,239,0.8)', l: 'Deep Work' },
                { c: '#e06c75',  g: '0 0 8px rgba(224,108,117,0.8)', l: 'Exam' },
                { c: 'rgba(255,255,255,0.1)', g: 'none', l: 'Offline' },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: item.c, boxShadow: item.g }} />
                  <span style={{ color: '#8b949e', fontWeight: 500 }}>{item.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CITY VIEWPORT */}
      <div style={{
        width: '100%', height: 520,
        background: skyColor,
        position: 'relative', overflow: 'hidden',
        borderTop: '1px solid rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.02)',
        transition: 'background 3s ease',
        boxShadow: 'inset 0 20px 60px rgba(0,0,0,0.5)',
        marginTop: -60, // Overlap under header slightly
      }}>
        
        {/* Distant Parallax Skyline Silhouette */}
        <div style={{
          position: 'absolute', bottom: ROAD_H + SIDEWALK_H - 10, left: 0, right: 0, height: 200,
          background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'200\'%3E%3Cpath d=\'M0,200 L0,150 L20,150 L20,120 L40,120 L40,90 L60,90 L60,110 L80,110 L80,60 L120,60 L120,140 L150,140 L150,80 L180,80 L180,130 L210,130 L210,40 L250,40 L250,100 L280,100 L280,160 L320,160 L320,70 L350,70 L350,120 L380,120 L380,170 L400,170 L400,200 Z\' fill=\'rgba(0,0,0,0.15)\'/%3E%3C/svg%3E") repeat-x bottom',
          zIndex: 1, pointerEvents: 'none',
          opacity: isNightish ? 0.8 : 0.4
        }} />

        {/* Stars */}
        {showStars && Array.from({ length: 100 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23) % 55}%`,
            width: i % 4 === 0 ? 3 : 1.5,
            height: i % 4 === 0 ? 3 : 1.5,
            background: '#fff',
            borderRadius: '50%',
            opacity: 0.1 + (i % 7) * 0.1,
            boxShadow: i % 4 === 0 ? '0 0 6px rgba(255,255,255,0.8)' : 'none',
            animation: `twinkle ${2 + (i % 5)}s ease-in-out infinite`,
            animationDelay: `${(i % 7) * 0.5}s`,
          }} />
        ))}

        {/* Cloud overlay */}
        {weather.condition.cloudy && !weather.condition.rain && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)',
            pointerEvents: 'none',
            animation: 'drift 80s linear infinite',
            zIndex: 3,
          }} />
        )}

        {/* Rain */}
        {weather.condition.rain && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 25 }}>
            {Array.from({ length: weather.condition.heavyRain ? 120 : 60 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 11) % 100}%`,
                top: -20,
                width: 1.5, height: weather.condition.heavyRain ? 25 : 18,
                background: 'linear-gradient(180deg, rgba(160,180,200,0) 0%, rgba(160,180,200,0.6) 100%)',
                borderRadius: 1,
                animation: `rainfall ${0.4 + (i % 5) * 0.1}s linear infinite`,
                animationDelay: `${(i % 8) * 0.1}s`,
              }} />
            ))}
          </div>
        )}

        {/* Snow */}
        {weather.condition.snow && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 25 }}>
            {Array.from({ length: 80 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 17) % 100}%`,
                top: -10,
                width: 4 + (i % 4), height: 4 + (i % 4),
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '50%',
                boxShadow: '0 0 6px rgba(255,255,255,0.4)',
                animation: `snowfall ${2.5 + (i % 4)}s linear infinite`,
                animationDelay: `${(i % 6) * 0.4}s`,
              }} />
            ))}
          </div>
        )}

        {/* Lightning */}
        {weather.condition.heavyRain && Math.random() > 0.96 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.15)',
            pointerEvents: 'none',
            animation: 'flash 0.25s ease-out',
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
            width: 60, height: 60,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 40%, #ffffff 0%, #fff2a8 30%, #ffb347 70%, #ff7b00 100%)',
            boxShadow: '0 0 80px rgba(255,210,100,0.8), 0 0 160px rgba(255,140,0,0.4)',
            zIndex: 2,
            transition: 'left 2s linear, top 2s linear',
          }} />
        )}

        {/* Moon */}
        {moonPos && (
          <div style={{
            position: 'absolute',
            left: `${moonPos.x}%`,
            top: `${moonPos.y}%`,
            transform: 'translate(-50%, -50%)',
            width: 48, height: 48,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #fdfbf7, #d3d1c8)',
            boxShadow: 'inset -6px -6px 12px rgba(0,0,0,0.4), inset 2px 2px 8px rgba(255,255,255,0.6), 0 0 30px rgba(220,230,255,0.3)',
            zIndex: 2,
            transition: 'left 3s linear, top 3s linear',
          }}>
            {/* Detailed Craters */}
            <div style={{ position: 'absolute', top: '20%', left: '25%', width: '22%', height: '22%', borderRadius: '50%', background: 'rgba(0,0,0,0.08)', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3), 1px 1px 2px rgba(255,255,255,0.2)' }} />
            <div style={{ position: 'absolute', top: '55%', left: '45%', width: '18%', height: '18%', borderRadius: '50%', background: 'rgba(0,0,0,0.07)', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3)' }} />
            <div style={{ position: 'absolute', top: '40%', left: '65%', width: '14%', height: '14%', borderRadius: '50%', background: 'rgba(0,0,0,0.09)', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3)' }} />
            <div style={{ position: 'absolute', top: '70%', left: '25%', width: '12%', height: '12%', borderRadius: '50%', background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
        )}

        {/* Atmospheric Fog */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
          background: weather.condition.rain
            ? 'linear-gradient(0deg, rgba(8,10,15,0.98) 0%, rgba(8,10,15,0.4) 40%, transparent 100%)'
            : 'linear-gradient(0deg, rgba(12,14,20,0.95) 0%, rgba(12,14,20,0.2) 60%, transparent 100%)',
          zIndex: 4, pointerEvents: 'none',
        }} />

        {/* Scrollable city container */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: '100%', height: '100%',
          overflowX: 'auto', overflowY: 'hidden',
          scrollbarWidth: 'none', // hide scrollbar for cleaner look
        }}>
          <div style={{ position: 'relative', width: Math.max(totalWidth, 1000), height: '100%', minWidth: '100%' }}>
            
            {/* Sidewalk */}
            <div style={{
              position: 'absolute', bottom: ROAD_H, left: 0, right: 0, height: SIDEWALK_H,
              background: 'linear-gradient(180deg, #303642 0%, #1c212b 100%)',
              borderTop: '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 -2px 10px rgba(0,0,0,0.5)',
              zIndex: 15,
            }} />

            {/* Road (Wet/Reflective) */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: ROAD_H,
              background: weather.condition.rain
                ? 'linear-gradient(0deg, #07090e 0%, #11151e 100%)'
                : 'linear-gradient(0deg, #0a0c12 0%, #161a24 100%)',
              zIndex: 14,
              overflow: 'hidden'
            }}>
              {/* Rain puddles/reflections */}
              {weather.condition.rain && (
                <div style={{
                   position: 'absolute', inset: 0, 
                   background: 'radial-gradient(ellipse at 50% 50%, rgba(97,175,239,0.1) 0%, transparent 60%)',
                   backgroundSize: '200px 50px',
                   opacity: 0.5
                }}/>
              )}

              {/* Lane markings */}
              {Array.from({ length: Math.ceil(Math.max(totalWidth, 1000) / 100) }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: `${i * 100 + 30}px`,
                  width: 50, height: 3,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 2,
                  transform: 'translateY(-50%)',
                  boxShadow: '0 0 4px rgba(255,255,255,0.1)',
                }} />
              ))}
              {/* Curb edge glow */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* Street Lamps (Modern) */}
            {layoutItems.filter(it => it.type === 'lamp').map((lamp, i) => (
              <div key={`lamp-${i}`} style={{ position: 'absolute', bottom: GROUND_Y, left: lamp.x, zIndex: 6, pointerEvents: 'none' }}>
                {/* Sleek Post */}
                <div style={{ width: 4, height: lamp.h, background: 'linear-gradient(90deg, #2a303c 0%, #1c212b 100%)', margin: '0 auto', borderRadius: '2px 2px 0 0' }} />
                {/* Modern Lamp head */}
                <div style={{
                  position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                  width: 18, height: 6,
                  background: isNightish ? '#e5c07b' : '#303642',
                  borderRadius: '10px',
                  boxShadow: isNightish ? '0 0 20px rgba(229,192,123,0.8), 0 0 40px rgba(229,192,123,0.3)' : 'none',
                  transition: 'all 2s ease',
                }} />
                {/* Light cone on ground */}
                {isNightish && (
                  <div style={{
                    position: 'absolute', bottom: -GROUND_Y, left: '50%', transform: 'translateX(-50%)',
                    width: 100, height: GROUND_Y,
                    background: 'radial-gradient(ellipse at center top, rgba(229,192,123,0.15) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />
                )}
                {/* Light aura upward */}
                {isNightish && (
                  <div style={{
                    position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                    width: 80, height: 80,
                    background: 'radial-gradient(circle at center, rgba(229,192,123,0.1) 0%, transparent 60%)',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            ))}

            {/* Neon Cars (Light Streaks) */}
            {carData.current.map((_, i) => (
              <div key={`car-${i}`} ref={el => carRefs.current[i] = el} style={{
                position: 'absolute', bottom: carData.current[i]?.y || 8, left: 0,
                zIndex: 16, pointerEvents: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  {/* Cyberpunk car body */}
                  <div style={{
                    width: carData.current[i]?.width || 30, height: 6,
                    background: '#111',
                    borderRadius: '4px',
                    position: 'relative',
                    boxShadow: `0 0 8px ${carData.current[i]?.color}60`,
                    borderBottom: `2px solid ${carData.current[i]?.color}`,
                  }}>
                    {/* Headlight beam */}
                    {carData.current[i]?.speed > 0 && (
                      <div style={{
                        position: 'absolute', right: -40, top: '50%', transform: 'translateY(-50%)',
                        width: 40, height: 12,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.6) 0%, transparent 100%)',
                        borderRadius: '0 50% 50% 0',
                        filter: 'blur(3px)',
                      }} />
                    )}
                    {/* Taillight trail */}
                    {carData.current[i]?.speed > 0 && (
                      <div style={{
                        position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)',
                        width: 20, height: 4,
                        background: 'linear-gradient(-90deg, #e06c75 0%, transparent 100%)',
                        filter: 'blur(1px)',
                      }} />
                    )}
                    {/* Reverse direction */}
                    {carData.current[i]?.speed < 0 && (
                      <>
                        <div style={{
                          position: 'absolute', left: -40, top: '50%', transform: 'translateY(-50%)',
                          width: 40, height: 12,
                          background: 'linear-gradient(-90deg, rgba(255,255,255,0.6) 0%, transparent 100%)',
                          borderRadius: '50% 0 0 50%',
                          filter: 'blur(3px)',
                        }} />
                        <div style={{
                          position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)',
                          width: 20, height: 4,
                          background: 'linear-gradient(90deg, #e06c75 0%, transparent 100%)',
                          filter: 'blur(1px)',
                        }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Pedestrians (Glowing Silhouettes) */}
            {pedData.current.map((_, i) => (
              <div key={`ped-${i}`} ref={el => pedRefs.current[i] = el} style={{
                position: 'absolute', bottom: GROUND_Y + (pedData.current[i]?.y || 2), left: 0,
                zIndex: 17, pointerEvents: 'none',
              }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  animation: `walkBob 0.6s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  opacity: 0.7,
                  filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))'
                }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c9d1d9', marginBottom: 1 }} />
                  <div style={{ width: 5, height: 8, background: '#8b949e', borderRadius: 2 }} />
                  <div style={{ display: 'flex', gap: 1, marginTop: 1 }}>
                    <div style={{ width: 2, height: 5, background: '#5c6370', borderRadius: 1, animation: `legMove 0.6s ease-in-out infinite`, animationDelay: '0s' }} />
                    <div style={{ width: 2, height: 5, background: '#5c6370', borderRadius: 1, animation: `legMove 0.6s ease-in-out infinite`, animationDelay: '0.3s' }} />
                  </div>
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
                color: '#8b949e', fontSize: '1rem', fontWeight: 500, zIndex: 30, letterSpacing: '0.05em'
              }}>
                The grid is empty. Begin a session to found the city.
              </div>
            )}

            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e5c07b', fontSize: '1rem', fontWeight: 600, zIndex: 30, letterSpacing: '0.1em'
              }}>
                <span style={{ animation: 'pulse 1.5s infinite' }}>INITIALIZING SECTOR...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BELOW CITY DASHBOARD */}
      <div style={{ padding: '32px 24px 60px', maxWidth: 1040, margin: '0 auto', position: 'relative', zIndex: 30 }}>

        {/* TOP ROW: YOUR CARD + LEADERBOARD */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
          
          {/* USER CARD */}
          <div style={{
            background: 'rgba(20, 24, 32, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Your Architecture</div>
              {isStudying && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#e5c07b', fontWeight: 600, background: 'rgba(229,192,123,0.1)', padding: '4px 10px', borderRadius: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5c07b', animation: 'pulse 1s infinite' }} />
                  Illuminated
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: myRank.color, marginBottom: 4, letterSpacing: '-0.02em' }}>
                {myRank.label}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#c9d1d9', fontWeight: 500 }}>
                {myHours} hours total <span style={{ margin: '0 8px', color: '#444' }}>|</span> {S?.streak || 0} day streak 🔥
              </div>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: '#8b949e', lineHeight: 1.6, marginBottom: 24, background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: 12 }}>
              {myHours < 5 && "Your studio is quiet. Start studying to cast your light into the grid."}
              {myHours >= 5 && myHours < 20 && "Your apartment windows are starting to glow. The foundation is set."}
              {myHours >= 20 && myHours < 50 && "Your mid-rise is elevating the local skyline. Keep pushing."}
              {myHours >= 50 && myHours < 100 && "A striking high-rise. Your dedication is highly visible."}
              {myHours >= 100 && myHours < 200 && "Penthouse tier. You are a cornerstone of this metropolis."}
              {myHours >= 200 && "Skyline Tower. An architectural monolith of pure focus."}
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8b949e', marginBottom: 8, fontWeight: 500 }}>
                <span>Progress to Next Tier</span>
                <span style={{ color: '#e5c07b' }}>{Math.max(0, 50 - (myHours % 50))}h remaining</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${Math.min(100, (myHours % 50) * 2)}%`, height: '100%', background: 'linear-gradient(90deg, #d19a66 0%, #e5c07b 100%)', borderRadius: 3, boxShadow: '0 0 10px rgba(229,192,123,0.5)' }} />
              </div>
            </div>
          </div>

          {/* LEADERBOARD CARD */}
          <div style={{
            background: 'rgba(20, 24, 32, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, marginBottom: 16 }}>City Grid Leaders</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {allResidents
                .sort((a, b) => b.hours - a.hours)
                .slice(0, 5)
                .map((u, i) => {
                  const rank = getRankLabel(u.hours)
                  return (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                      background: u.isMe ? 'rgba(229,192,123,0.05)' : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${u.isMe ? 'rgba(229,192,123,0.2)' : 'rgba(255,255,255,0.03)'}`,
                      borderRadius: 12, transition: 'transform 0.2s ease',
                      cursor: 'pointer'
                    }} onClick={() => setSelectedUser(u)} className="hover-scale">
                      <div style={{ 
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i === 0 ? 'linear-gradient(135deg, #e5c07b 0%, #d19a66 100%)' : i === 1 ? 'linear-gradient(135deg, #c9d1d9 0%, #8b949e 100%)' : i === 2 ? 'linear-gradient(135deg, #d19a66 0%, #a87b51 100%)' : 'rgba(255,255,255,0.05)',
                        color: i < 3 ? '#111' : '#8b949e', fontWeight: 800, fontSize: '0.8rem'
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: u.isMe ? '#e5c07b' : '#c9d1d9', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {u.name}
                          {u.studying && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#98c379', boxShadow: '0 0 8px rgba(152,195,121,0.8)' }} />}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: rank.color, marginTop: 2 }}>{rank.label}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{u.hours}<span style={{fontSize:'0.7rem', color:'#8b949e', fontWeight:500}}>h</span></div>
                        <div style={{ fontSize: '0.75rem', color: '#d19a66', fontWeight: 600 }}>{u.streak}d 🔥</div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* LIVE ACTIVITY */}
        <div style={{
          background: 'rgba(20, 24, 32, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 24, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Active Protocols</div>
            <div style={{ fontSize: '0.75rem', color: '#5c6370', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#5c6370', animation: 'blink 2s infinite' }} />
              Live Sync
            </div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {allResidents.filter(u => u.studying).map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s ease'
              }} onClick={() => setSelectedUser(u)} className="hover-highlight">
                <div style={{ position: 'relative', width: 12, height: 12 }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 3,
                    background: u.mode === 'deep' ? '#61afef' : u.mode === 'exam' ? '#e06c75' : '#e5c07b',
                    boxShadow: u.mode === 'deep' ? '0 0 10px rgba(97,175,239,0.8)' : u.mode === 'exam' ? '0 0 10px rgba(224,108,117,0.8)' : '0 0 10px rgba(229,192,123,0.8)',
                    zIndex: 2
                  }} />
                  <div style={{
                    position: 'absolute', inset: -4, borderRadius: 6,
                    background: u.mode === 'deep' ? 'rgba(97,175,239,0.4)' : u.mode === 'exam' ? 'rgba(224,108,117,0.4)' : 'rgba(229,192,123,0.4)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    zIndex: 1
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9' }}>{u.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#8b949e', marginTop: 2 }}>{u.subject || 'Studying'}</div>
                </div>
              </div>
            ))}
            
            {allResidents.filter(u => u.studying).length === 0 && (
              <div style={{ fontSize: '0.85rem', color: '#5c6370', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, width: '100%', textAlign: 'center', fontStyle: 'italic' }}>
                Grid is currently silent. Initiate a focus session to illuminate your sector.
              </div>
            )}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{
          background: 'rgba(20, 24, 32, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 24,
        }}>
          <div style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, marginBottom: 16 }}>Evolution Roadmap</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {[
              { label: 'Studio', hours: '0–5h', color: '#5c6370' },
              { label: 'Apartment', hours: '5–20h', color: '#abb2bf' },
              { label: 'Mid-Rise', hours: '20–50h', color: '#98c379' },
              { label: 'High-Rise', hours: '50–100h', color: '#61afef' },
              { label: 'Penthouse', hours: '100–200h', color: '#d19a66' },
              { label: 'Skyline Tower', hours: '200h+', color: '#e5c07b' },
            ].map((tier, i) => (
              <div key={tier.label} style={{
                textAlign: 'center', padding: '16px',
                background: myHours >= [0, 5, 20, 50, 100, 200][i] ? `${tier.color}15` : 'rgba(0,0,0,0.2)',
                border: `1px solid ${myHours >= [0, 5, 20, 50, 100, 200][i] ? `${tier.color}40` : 'rgba(255,255,255,0.03)'}`,
                borderRadius: 14, transition: 'all 0.3s ease'
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: myHours >= [0, 5, 20, 50, 100, 200][i] ? tier.color : '#303642', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontWeight: 800, fontSize: '0.8rem', boxShadow: myHours >= [0, 5, 20, 50, 100, 200][i] ? `0 0 12px ${tier.color}80` : 'none' }}>
                  {i + 1}
                </div>
                <div style={{ fontWeight: 700, color: myHours >= [0, 5, 20, 50, 100, 200][i] ? tier.color : '#8b949e', fontSize: '0.9rem', marginBottom: 4 }}>{tier.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#5c6370', fontWeight: 500 }}>{tier.hours}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SQL Toggle */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => setShowSQL(s => !s)} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: '#8b949e', borderRadius: 20, padding: '8px 20px',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }} className="hover-button">
            {showSQL ? 'Close Schematic' : 'View Database Schematic'}
          </button>
          {showSQL && (
            <pre style={{
              marginTop: 16, background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 20, fontSize: '0.8rem', color: '#98c379',
              maxWidth: '100%', maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: "'Fira Code', monospace",
              textAlign: 'left', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
            }}>
              {SQL_SCHEMA}
            </pre>
          )}
        </div>
      </div>

      {/* MODAL */}
      {selectedUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: 20
        }} onClick={e => e.target === e.currentTarget && setSelectedUser(null)}>
          <div style={{
            background: 'rgba(20, 24, 32, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: 32, width: 400, maxWidth: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{selectedUser.name}</div>
                <div style={{ fontSize: '0.85rem', color: getRankLabel(selectedUser.hours).color, fontWeight: 600 }}>{getRankLabel(selectedUser.hours).label}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{
                background: 'rgba(255,255,255,0.05)', border: 'none', color: '#8b949e',
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s'
              }} className="hover-button">✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#e5c07b', marginBottom: 4 }}>{selectedUser.hours}</div>
                <div style={{ fontSize: '0.7rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Total Hours</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#d19a66', marginBottom: 4 }}>{selectedUser.streak}</div>
                <div style={{ fontSize: '0.7rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Day Streak</div>
              </div>
            </div>
            
            <div style={{ background: selectedUser.studying ? 'rgba(152,195,121,0.1)' : 'rgba(0,0,0,0.3)', border: `1px solid ${selectedUser.studying ? 'rgba(152,195,121,0.2)' : 'rgba(255,255,255,0.03)'}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative', width: 16, height: 16 }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 4,
                    background: selectedUser.studying
                      ? selectedUser.mode === 'deep' ? '#61afef' : selectedUser.mode === 'exam' ? '#e06c75' : '#e5c07b'
                      : 'rgba(255,255,255,0.1)',
                    boxShadow: selectedUser.studying ? `0 0 12px ${selectedUser.mode === 'deep' ? '#61afef' : selectedUser.mode === 'exam' ? '#e06c75' : '#e5c07b'}` : 'none',
                    zIndex: 2
                  }} />
                  {selectedUser.studying && (
                    <div style={{
                      position: 'absolute', inset: -6, borderRadius: 8,
                      background: selectedUser.mode === 'deep' ? 'rgba(97,175,239,0.3)' : selectedUser.mode === 'exam' ? 'rgba(224,108,117,0.3)' : 'rgba(229,192,123,0.3)',
                      animation: 'pulse 1.5s infinite',
                      zIndex: 1
                    }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: selectedUser.studying ? '#fff' : '#8b949e' }}>
                    {selectedUser.studying ? `Active Protocol: ${selectedUser.subject || 'Focus'}` : 'Status: Offline'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: selectedUser.studying ? '#98c379' : '#5c6370', marginTop: 4 }}>
                    {selectedUser.studying ? 'Sector illuminated and broadcasting' : 'Sector powered down'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-scale:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: rgba(255,255,255,0.05) !important; }
        .hover-highlight:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important; }
        .hover-button:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
        .building-hover:hover { filter: brightness(1.2); }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes rainfall {
          0% { transform: translateY(-20px) rotate(5deg); opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(520px) rotate(5deg); opacity: 0; }
        }
        @keyframes snowfall {
          0% { transform: translateY(-10px) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(520px) translateX(30px); opacity: 0; }
        }
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; background: rgba(255,255,255,0.3); }
          100% { opacity: 0; }
        }
        @keyframes drift {
          0% { transform: translateX(0) scale(1); }
          50% { transform: translateX(30px) scale(1.05); }
          100% { transform: translateX(0) scale(1); }
        }
        @keyframes walkBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes legMove {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}