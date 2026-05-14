import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ─── TILE GEOMETRY ────────────────────────────────────────────────────────────
const TW = 72, TH = 36
const COLS = 22, ROWS = 18
const OFFX = 0, OFFY = 80

function iso(col, row) {
  return { x: (col - row) * TW / 2 + OFFX, y: (col + row) * TH / 2 + OFFY }
}

// ─── ZONE MAP  (0=ocean 1=village 2=beach 3=forest 4=mountain 5=metro 6=exam 7=banned) ───
const ZMAP = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,7,7,7,7,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,7,7,7,7,7,7,7,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,7,4,4,4,4,7,7,7,0,5,5,5,5,0,0,0,0],
  [0,0,0,0,2,1,4,4,4,4,4,7,7,5,5,5,5,5,0,0,0,0],
  [0,0,0,2,2,1,1,4,4,4,7,7,5,5,5,5,5,0,0,0,0,0],
  [0,0,2,2,2,1,1,1,7,7,3,3,3,5,5,5,0,0,0,0,0,0],
  [0,0,2,2,1,1,1,1,1,3,3,3,3,3,5,5,0,0,0,0,0,0],
  [0,0,2,1,1,1,1,1,1,3,3,3,3,3,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,3,3,3,3,6,6,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,3,3,3,6,6,6,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,3,3,3,6,6,6,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,3,3,6,6,6,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
]

const ZONES = {
  1: { name:'Starting Village', top:'#a5d66b', left:'#8bc34a', right:'#6a9e2a' },
  2: { name:'Beachside',        top:'#ffe082', left:'#ffd54f', right:'#ffca28' },
  3: { name:'Pine Forest',      top:'#4caf50', left:'#388e3c', right:'#2e7d32' },
  4: { name:'Mountain Peak',    top:'#b0bec5', left:'#90a4ae', right:'#78909c' },
  5: { name:'Dustopian Metro',  top:'#9c27b0', left:'#7b1fa2', right:'#6a1b9a' },
  6: { name:'Exam Quarter',     top:'#ef5350', left:'#e53935', right:'#c62828' },
  7: { name:'Banned Lands',     top:'#424242', left:'#212121', right:'#1a1a1a' },
}

// ─── DETERMINISTIC HASH ──────────────────────────────────────────────────────
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

// ─── ZONE / TIER LOGIC ───────────────────────────────────────────────────────
function getZoneId(u) {
  if ((u.missed_streak || 0) >= 5) return 7
  if (u.is_exam_mode) return 6
  const h = u.total_hours || 0
  if (h >= 100 || (u.goals_hit || 0) >= 10) return 5
  if ((u.avg_score || 0) >= 85 && h >= 30) return 4
  if (h >= 30) return 3
  if (h >= 10) return 2
  return 1
}

function getTier(hours) {
  if (hours >= 200) return 6
  if (hours >= 100) return 5
  if (hours >= 50)  return 4
  if (hours >= 20)  return 3
  if (hours >= 5)   return 2
  return 1
}

function getCellForUser(uid, zid) {
  const cells = []
  for (let r = 0; r < ZMAP.length; r++)
    for (let c = 0; c < ZMAP[r].length; c++)
      if (ZMAP[r][c] === zid) cells.push([r, c])
  if (!cells.length) return [7, 5]
  return cells[hash(uid) % cells.length]
}

// ─── SEASON ───────────────────────────────────────────────────────────────────
function season(month) {
  if (month <= 1 || month === 11) return 'winter'
  if (month <= 4) return 'spring'
  if (month <= 7) return 'summer'
  return 'autumn'
}
const TREE = {
  winter: ['#eceff1','#cfd8dc','#5d4037'],
  spring: ['#f48fb1','#f8bbd0','#4e342e'],
  summer: ['#2e7d32','#43a047','#4e342e'],
  autumn: ['#e65100','#ff6f00','#3e2723'],
}
const SNOW_SEASON = { winter:true, spring:false, summer:false, autumn:false }

// ─── DAY / NIGHT ─────────────────────────────────────────────────────────────
function tod(hour) {
  if (hour >= 6 && hour < 8)   return 'sunrise'
  if (hour >= 8 && hour < 18)  return 'day'
  if (hour >= 18 && hour < 20) return 'sunset'
  return 'night'
}
const SKY = {
  sunrise: ['#ff7043','#ffb300','#ffe082'],
  day:     ['#1565c0','#1e88e5','#64b5f6'],
  sunset:  ['#6a1b9a','#e53935','#ff8f00'],
  night:   ['#060614','#0a0a2a','#101030'],
}
const AMBIENT_COLOR = {
  sunrise: [255,200,100, 0.14],
  day:     [255,252,230, 0   ],
  sunset:  [255, 80, 20, 0.18],
  night:   [ 10, 10, 80, 0.40],
}

// ─── UTILITY COLOR ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''),16)
  return [(n>>16)&0xff,(n>>8)&0xff,n&0xff]
}
function shiftColor(hex, todKey) {
  const [r,g,b] = hexToRgb(hex)
  const [ar,ag,ab,aa] = AMBIENT_COLOR[todKey]
  return `rgba(${Math.min(255,r*(1-aa)+ar*aa)|0},${Math.min(255,g*(1-aa)+ag*aa)|0},${Math.min(255,b*(1-aa)+ab*aa)|0},1)`
}
function darkenHex(hex, amt) {
  const [r,g,b] = hexToRgb(hex)
  return `rgb(${(r*(1-amt))|0},${(g*(1-amt))|0},${(b*(1-amt))|0})`
}

// ─── BUILDING SPECS ───────────────────────────────────────────────────────────
const BSPEC = [
  null,
  // tier 1 – tiny house  (wood)
  { h:22, floors:0, top:'#c8a96e', left:'#b5956c', right:'#9a7a56', roof:true, roofColor:'#546e7a' },
  // tier 2 – small house (brick)
  { h:36, floors:1, top:'#d4b898', left:'#c4a484', right:'#a88c70', roof:true, roofColor:'#455a64' },
  // tier 3 – townhouse   (stone)
  { h:56, floors:2, top:'#9db4be', left:'#7a98a8', right:'#607888', roof:false, roofColor:'#37474f' },
  // tier 4 – apartment   (concrete)
  { h:80, floors:3, top:'#7b90a0', left:'#5a7280', right:'#3e5a6e', roof:false, roofColor:'#263238' },
  // tier 5 – tall block  (steel)
  { h:112, floors:5, top:'#5a6e84', left:'#3e5268', right:'#2a3e52', roof:false, roofColor:'#1a2a3a' },
  // tier 6 – skyscraper  (glass)
  { h:160, floors:8, top:'#3a4a60', left:'#202e42', right:'#141e2e', roof:false, roofColor:'#0d1520' },
]

function poly(ctx, pts) {
  ctx.beginPath()
  pts.forEach((p,i) => i===0 ? ctx.moveTo(p[0],p[1]) : ctx.lineTo(p[0],p[1]))
  ctx.closePath()
}

function drawBuilding(ctx, sx, sy, tier, todKey, isStudying, studyMd, hasParty, seas, uid, time) {
  const sp = BSPEC[tier]
  if (!sp) return
  const bh = sp.h
  const hw = TW * 0.4
  const hd = TH * 0.4
  const fn = (c) => todKey==='night' ? darkenHex(c, 0.1) : shiftColor(c, todKey)

  // Left face
  poly(ctx, [
    [sx-hw, sy], [sx, sy+hd], [sx, sy+hd-bh], [sx-hw, sy-bh]
  ])
  ctx.fillStyle = fn(sp.left)
  ctx.fill()
  ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.stroke()

  // Right face
  poly(ctx, [
    [sx, sy+hd], [sx+hw, sy], [sx+hw, sy-bh], [sx, sy+hd-bh]
  ])
  ctx.fillStyle = fn(sp.right)
  ctx.fill(); ctx.stroke()

  // Top / roof
  poly(ctx, [
    [sx-hw, sy-bh], [sx, sy+hd-bh], [sx+hw, sy-bh], [sx, sy-hd-bh]
  ])
  ctx.fillStyle = fn(sp.top)
  ctx.fill(); ctx.stroke()

  // Peaked roof (low tiers)
  if (sp.roof) {
    const ry = sy-bh
    const rh = bh * 0.3
    // left slope
    poly(ctx, [[sx-hw,ry],[sx,ry-hd],[sx,ry+hd-rh],[sx-hw,ry]])
    ctx.fillStyle=fn(sp.roofColor); ctx.fill(); ctx.stroke()
    // right slope
    poly(ctx, [[sx,ry-hd],[sx+hw,ry],[sx+hw,ry],[sx,ry+hd-rh]])
    ctx.fillStyle=darkenHex(sp.roofColor,0.15); ctx.fill(); ctx.stroke()
    // ridge top
    poly(ctx, [[sx-hw,ry],[sx,ry-hd],[sx+hw,ry],[sx,ry-hd+hd*0.2]])
    ctx.fillStyle=darkenHex(sp.roofColor,0.25); ctx.fill()

    // chimney
    const cx=sx+hw*0.4, cy=ry-rh*0.3
    ctx.fillStyle=fn(sp.right)
    ctx.fillRect(cx-3, cy-12, 6, 12)
    ctx.fillStyle=fn(sp.left)
    ctx.fillRect(cx-4, cy-13, 8, 4)
    if (todKey==='night') {
      const sg=ctx.createRadialGradient(cx,cy-13,0,cx,cy-13,8)
      sg.addColorStop(0,'rgba(255,150,50,0.5)'); sg.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=sg; ctx.fillRect(cx-8,cy-20,16,10)
    }
  }

  // Snow on roof
  if (SNOW_SEASON[seas]) {
    poly(ctx, [[sx-hw,sy-bh],[sx,sy+hd-bh],[sx+hw,sy-bh],[sx,sy-hd-bh]])
    ctx.fillStyle='rgba(235,245,255,0.75)'; ctx.fill()
  }

  // Windows
  if (sp.floors > 0) {
    const isNight = todKey==='night'
    const winCol = isStudying ? (isNight?'#ffd54f':'rgba(255,230,100,0.6)') : (isNight?'#ffe0b2':'rgba(170,210,255,0.25)')
    const winAlpha = isNight ? 0.9 : 0.4
    const floorH = bh / (sp.floors + 1)
    for (let fl=0; fl < sp.floors; fl++) {
      const fy = sy - floorH * (fl+1)
      // left face windows (2 per floor)
      for (let w=0; w<<2; w++) {
        const t = (w+0.7)/(2+0.4)
        const wx = sx-hw + t*hw - 2
        const wy = fy - 4
        ctx.fillStyle=winCol; ctx.globalAlpha=winAlpha
        ctx.fillRect(wx,wy,5,7)
        ctx.globalAlpha=1
        if (isNight && isStudying) {
          const gl=ctx.createRadialGradient(wx+2,wy+3,0,wx+2,wy+3,10)
          gl.addColorStop(0,'rgba(255,210,80,0.35)'); gl.addColorStop(1,'rgba(0,0,0,0)')
          ctx.fillStyle=gl; ctx.globalAlpha=0.6; ctx.fillRect(wx-8,wy-6,22,18); ctx.globalAlpha=1
        }
      }
      // right face windows (2 per floor)
      for (let w=0; w<<2; w++) {
        const t = (w+0.7)/(2+0.4)
        const wx = sx + t*hw - 2
        const wy = fy - 4
        ctx.fillStyle=winCol; ctx.globalAlpha=winAlpha
        ctx.fillRect(wx,wy,5,7); ctx.globalAlpha=1
      }
    }
  }

  // Antenna for high tiers
  if (tier >= 5) {
    const ay = sy-bh-hd
    ctx.strokeStyle=fn(sp.right); ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(sx,ay); ctx.lineTo(sx,ay-20); ctx.stroke()
    if (todKey==='night') {
      ctx.beginPath(); ctx.arc(sx,ay-20,3,0,Math.PI*2)
      ctx.fillStyle=`rgba(255,${Math.sin(time*0.003)*127+128|0},0,${0.7+Math.sin(time*0.003)*0.3})`
      ctx.fill()
    }
  }

  // Studying glow ring
  if (isStudying) {
    const glowCol = studyMd==='focus' ? 'rgba(255,213,79,' : studyMd==='short' ? 'rgba(92,180,110,' : 'rgba(74,150,200,'
    const g=ctx.createRadialGradient(sx,sy-bh/2,0,sx,sy-bh/2,hw*2)
    g.addColorStop(0,glowCol+'0.28)'); g.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=g; ctx.fillRect(sx-hw*2,sy-bh-hd*2,hw*4,bh+hd*3)
  }

  // Party decorations
  if (hasParty) {
    const pcols=['#f44336','#e91e63','#9c27b0','#2196f3','#4caf50','#ffeb3b','#ff9800']
    const t2=time*0.001
    for (let i=0;i<<10;i++) {
      const ang=(i/10)*Math.PI*2+t2
      const px=sx+Math.cos(ang)*hw*1.1
      const py=sy-bh*0.5+Math.sin(ang)*hd*1.2
      ctx.beginPath(); ctx.arc(px,py,3.5,0,Math.PI*2)
      ctx.fillStyle=pcols[i%pcols.length]; ctx.fill()
    }
    // garland lines
    ctx.save(); ctx.setLineDash([4,4])
    ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=0.8
    ctx.beginPath(); ctx.moveTo(sx-hw,sy-bh+6); ctx.lineTo(sx+hw,sy-bh+6); ctx.stroke()
    ctx.restore()
    // banner stars
    const starY=sy-bh-hd-6
    for (let i=-1;i<=1;i+=1) {
      ctx.font='9px sans-serif'; ctx.fillStyle='#ffd700'
      ctx.fillText('★',sx+i*14-4,starY)
    }
  }
}

// ─── TREE ─────────────────────────────────────────────────────────────────────
function drawTree(ctx, sx, sy, seas, scale=1) {
  const [l1,l2,trunk]=TREE[seas]
  const s=scale*10
  ctx.fillStyle=trunk; ctx.fillRect(sx-2*scale,sy-s*0.5,4*scale,s*0.6)
  ctx.fillStyle=l1
  poly(ctx,[[sx,sy-s*2.4],[sx-s,sy-s*1.2],[sx+s,sy-s*1.2]])
  ctx.fill()
  ctx.fillStyle=l2
  poly(ctx,[[sx,sy-s*3.0],[sx-s*0.65,sy-s*2.1],[sx+s*0.65,sy-s*2.1]])
  ctx.fill()
}

// ─── MOUNTAIN ────────────────────────────────────────────────────────────────
function drawMountain(ctx, sx, sy, seas) {
  poly(ctx,[[sx,sy-72],[sx-36,sy],[sx+36,sy]])
  ctx.fillStyle='#78909c'; ctx.fill()
  poly(ctx,[[sx-14,sy-72],[sx+14,sy-72],[sx+18,sy-50],[sx-18,sy-50]])
  ctx.fillStyle='#607d8b'; ctx.fill()
  if (SNOW_SEASON[seas]||seas==='winter') {
    poly(ctx,[[sx,sy-72],[sx-12,sy-50],[sx+12,sy-50]])
    ctx.fillStyle='rgba(240,245,255,0.85)'; ctx.fill()
  }
}

// ─── OCEAN + SKY ─────────────────────────────────────────────────────────────
function drawBackground(ctx, W, H, todKey, time) {
  const skyCols=SKY[todKey]
  const sg=ctx.createLinearGradient(0,0,0,H*0.6)
  sg.addColorStop(0,skyCols[0]); sg.addColorStop(0.6,skyCols[1]); sg.addColorStop(1,skyCols[2])
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,H)

  // ocean
  const og=ctx.createLinearGradient(0,H*0.5,0,H)
  const oa=todKey==='night'?'0.7':'0.55'
  og.addColorStop(0,`rgba(21,101,192,${oa})`); og.addColorStop(1,'rgba(13,71,161,0.85)')
  ctx.fillStyle=og; ctx.fillRect(0,H*0.5,W,H*0.5)

  // wave shimmer
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1
  for (let i=0;i<<7;i++) {
    const wy=H*0.52+i*22
    ctx.beginPath(); ctx.moveTo(0,wy)
    for (let x=0;x<W;x+=24) ctx.lineTo(x,wy+Math.sin(x*0.025+time*0.0015+i)*4)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── STARS ───────────────────────────────────────────────────────────────────
function drawStars(ctx, W, H, time) {
  for (let i=0;i<<90;i++) {
    const sx2=(hash(`sx${i}`)%1000)/1000*W
    const sy2=(hash(`sy${i}`)%600)/600*H*0.48
    const tw2=0.3+0.7*Math.abs(Math.sin(time*0.0008+i*0.9))
    ctx.globalAlpha=tw2*0.8; ctx.fillStyle='#fff'
    ctx.fillRect(sx2,sy2,1.5,1.5)
  }
  ctx.globalAlpha=1
}

// ─── CELESTIAL ───────────────────────────────────────────────────────────────
function drawCelestial(ctx, W, H, todKey, hour, time) {
  if (todKey!=='night') {
    const t=(hour-6)/14
    const cx2=W*0.08+t*W*0.84, cy2=H*0.22-Math.sin(t*Math.PI)*H*0.13
    const sg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,34)
    sg.addColorStop(0,todKey==='day'?'#fffde7':'#ffe082')
    sg.addColorStop(0.35,todKey==='day'?'#fff176':'#ffb300')
    sg.addColorStop(1,'rgba(255,200,0,0)')
    ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx2,cy2,34,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#fff9e6'; ctx.beginPath(); ctx.arc(cx2,cy2,14,0,Math.PI*2); ctx.fill()
  } else {
    const mx=W*0.82+Math.sin(time*0.0004)*5, my=H*0.1
    ctx.fillStyle='#e8eaf6'; ctx.beginPath(); ctx.arc(mx,my,16,0,Math.PI*2); ctx.fill()
    ctx.fillStyle=SKY.night[1]; ctx.beginPath(); ctx.arc(mx+8,my-4,12,0,Math.PI*2); ctx.fill()
  }
}

// ─── GROUND TILE ─────────────────────────────────────────────────────────────
function drawTile(ctx, col, row, zid, todKey) {
  if (!zid||!ZONES[zid]) return
  const {x,y}=iso(col,row)
  const z=ZONES[zid]
  const top=todKey==='night'?darkenHex(z.top,0.45):shiftColor(z.top,todKey)
  poly(ctx,[[x,y+TH/2],[x+TW/2,y],[x,y-TH/2],[x-TW/2,y]])
  ctx.fillStyle=top; ctx.fill()
  ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=0.5; ctx.stroke()
}

// ─── INFO PANEL ───────────────────────────────────────────────────────────────
function InfoPanel({users,myZone,myTier,hovered,todKey,seas}) {
  const TOD_L={day:'Day ☀️',night:'Night 🌙',sunrise:'Sunrise 🌅',sunset:'Sunset 🌇'}
  const SEAS_L={winter:'❄️ Winter',spring:'🌸 Spring',summer:'☀️ Summer',autumn:'🍂 Autumn'}
  return (
    <div style={{position:'absolute',top:12,right:12,width:210,background:'rgba(8,8,20,0.9)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,padding:'12px 14px',color:'#fff',fontSize:'0.72rem',fontFamily:"'Anthropic Serif',Georgia,serif",zIndex:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:9}}>
        <span style={{color:'#d4a853',fontWeight:600,fontSize:'0.78rem'}}>City</span>
        <span style={{color:'rgba(255,255,255,0.4)',fontSize:'0.65rem'}}>{TOD_L[todKey]}</span>
      </div>
      <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.65rem',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.1em'}}>{SEAS_L[seas]}</div>

      {hovered ? (
        <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(212,168,83,0.3)',borderRadius:9,padding:'9px 10px',marginBottom:9}}>
          <div style={{color:'#ffd54f',fontWeight:600,marginBottom:5}}>{hovered.display_name}</div>
          <div style={{color:'rgba(255,255,255,0.55)',lineHeight:1.9}}>
            🏘 {ZONES[hovered.zone]?.name}<br/>
            ⏱ {(hovered.total_hours||0).toFixed(1)}h<br/>
            🔥 {hovered.streak||0} day streak<br/>
            📅 {hovered.studied_days||0} days<br/>
            {hovered.is_studying&&<span style={{color:'#69f0ae'}}>● Studying now</span>}
            {(hovered.goals_hit||0)>=5&&<> · <span style={{color:'#ff8a65'}}>🎉 Goal crusher</span></>}
          </div>
        </div>
      ) : (
        <div style={{marginBottom:9,padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          <span style={{color:'rgba(255,255,255,0.45)'}}>Hover a building to inspect</span>
        </div>
      )}

      <div style={{marginBottom:9,paddingBottom:9,borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{color:'rgba(255,255,255,0.35)',fontSize:'0.6rem',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>Your plot</div>
        <div style={{color:'rgba(255,255,255,0.65)',lineHeight:1.8}}>
          Zone: <span style={{color:'#d4a853'}}>{ZONES[myZone]?.name}</span><br/>
          Tier: <span style={{color:'#d4a853'}}>T{myTier}</span>
        </div>
      </div>

      <div style={{marginBottom:9,paddingBottom:9,borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{color:'rgba(255,255,255,0.35)',fontSize:'0.6rem',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>Studying now</div>
        {users.filter(u=>u.is_studying).length===0
          ? <div style={{color:'rgba(255,255,255,0.25)',fontStyle:'italic'}}>Nobody online</div>
          : users.filter(u=>u.is_studying).slice(0,5).map(u=>(
              <div key={u.user_id} style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                <span style={{width:5,height:5,background:'#69f0ae',borderRadius:'50%',display:'inline-block',boxShadow:'0 0 5px #69f0ae'}}/>
                <span style={{color:'rgba(255,255,255,0.6)'}}>{u.display_name}</span>
              </div>
            ))
        }
      </div>

      {Object.entries(ZONES).map(([k,z])=>(
        <div key={k} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
          <span style={{width:9,height:9,borderRadius:2,background:z.top,flexShrink:0,display:'inline-block'}}/>
          <span style={{color:'rgba(255,255,255,0.4)',fontSize:'0.6rem'}}>{z.name}</span>
        </div>
      ))}
    </div>
  )
}

// ─── SQL SCHEMA STRING ────────────────────────────────────────────────────────
const SQL = `-- Run in Supabase SQL Editor (once)

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
  zone          int     default 1,
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

-- Auto-update updated_at
create or replace function update_city_ts()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger city_profiles_ts
  before update on city_profiles
  for each row execute procedure update_city_ts();`

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function CityPage({ S, session, isStudying, studyMode }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const usersRef  = useRef([])

  const [users, setUsers] = useState([])
  const [hovered, setHovered] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSQL, setShowSQL] = useState(false)

  const now   = new Date()
  const hour  = now.getHours()
  const month = now.getMonth()
  const todKey  = tod(hour)
  const seas  = season(month)

  const myHours   = (S.totalMinutes || 0) / 60
  const myZoneId  = getZoneId({
    total_hours: myHours,
    streak: S.streak || 0,
    goals_hit: (S.sessions || []).length,
    avg_score: S.targetPct || 0,
    missed_streak: (S.missedDays || []).length,
    is_exam_mode: studyMode === 'exam'
  })
  const myTier    = getTier(myHours)
  const myParty   = (S.sessions || []).length >= 5

  // ── upsert own profile ────────────────────────────────────────────────────
  const upsert = useCallback(async () => {
    if (!session) return
    const payload = {
      user_id: session.user.id,
      display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Anonymous',
      total_hours: myHours,
      streak: S.streak || 0,
      studied_days: (S.studiedDays || []).length,
      goals_hit: (S.sessions || []).length,
      avg_score: S.targetPct || 80,
      is_studying: isStudying,
      study_mode: studyMode || 'focus',
      missed_streak: (S.missedDays || []).length,
      is_exam_mode: studyMode === 'exam',
      zone: myZoneId,
      building_tier: myTier,
      last_active: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await supabase.from('city_profiles').upsert(payload, { onConflict: 'user_id' })
  }, [session, myHours, S.streak, S.studiedDays, S.sessions, S.targetPct, S.missedDays, isStudying, studyMode, myZoneId, myTier])

  // run upsert whenever the memoized function changes (i.e. whenever any input changes)
  useEffect(() => { upsert() }, [upsert])

  // heartbeat while studying so last_active stays fresh and the 10-min timeout doesn't expire
  useEffect(() => {
    if (!isStudying) return
    const id = setInterval(() => upsert(), 30000)
    return () => clearInterval(id)
  }, [isStudying, upsert])

  // ── fetch all ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('city_profiles').select('*')
    if (error) {
      console.error('city fetch error', error)
      return
    }
    if (data) {
      const mapped = data.map(u => ({ ...u, zone: getZoneId(u) }))
      setUsers(mapped)
      usersRef.current = mapped   // keep canvas loop in sync immediately
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
    const ch = supabase.channel('city-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'city_profiles' }, fetchUsers)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchUsers])

  // fallback polling every 10s in case realtime drops
  useEffect(() => {
    const id = setInterval(fetchUsers, 10000)
    return () => clearInterval(id)
  }, [fetchUsers])

  // keep ref in sync without restarting render loop
  useEffect(() => { usersRef.current = users }, [users])

  // ── render loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      const p = canvas.parentElement
      if (!p) return
      canvas.width  = p.clientWidth
      canvas.height = p.clientHeight || 540
    }
    resize()
    window.addEventListener('resize', resize)

    const render = (time) => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // sky + ocean
      drawBackground(ctx, W, H, todKey, time)
      if (todKey === 'night' || todKey === 'sunset') drawStars(ctx, W, H, time)
      drawCelestial(ctx, W, H, todKey, hour, time)

      ctx.save()
      ctx.translate(W / 2, 0)

      // collect user -> cell map
      const ucells = {}
      usersRef.current.forEach(u => {
        const [r, c] = getCellForUser(u.user_id, u.zone)
        ucells[`${r}_${c}`] = u
      })

      // painter order
      const order = []
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) order.push([r, c])
      order.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))

      // ground tiles
      for (const [r, c] of order) {
        const zid = ZMAP[r]?.[c] || 0
        if (zid > 0) drawTile(ctx, c, r, zid, todKey)
      }

      // decorative mountains
      const mtCells = order.filter(([r, c]) => ZMAP[r]?.[c] === 4 && hash(`m${r}${c}`) % 4 === 0 && !ucells[`${r}_${c}`])
      for (const [r, c] of mtCells.slice(0, 5)) {
        const { x, y } = iso(c, r); drawMountain(ctx, x, y - TH / 2, seas)
      }

      // decorative trees (forest + mountain zones)
      const treeCells = order.filter(([r, c]) => {
        const z = ZMAP[r]?.[c] || 0
        return (z === 3 || z === 4) && !ucells[`${r}_${c}`] && hash(`t${r}${c}`) % 3 !== 0
      })
      for (const [r, c] of treeCells) {
        const { x, y } = iso(c, r)
        drawTree(ctx, x, y - TH / 2, seas, 0.55 + ((hash(`ts${r}${c}`) % 5) * 0.1))
      }

      // buildings
      for (const [r, c] of order) {
        const u = ucells[`${r}_${c}`]
        if (!u) continue
        const { x, y } = iso(c, r)
        // 10-min stale guard: if updated_at is old, treat as not studying
        const lastUpdate = new Date(u.updated_at || 0).getTime()
        const fresh = Date.now() - lastUpdate < 600000
        const uStudying = u.is_studying && fresh
        const hasParty = (u.goals_hit || 0) >= 5
        drawBuilding(ctx, x, y - TH / 2, u.building_tier || 1, todKey, uStudying, u.study_mode, hasParty, seas, u.user_id, time)
      }

      // ambient colour overlay
      const [ar, ag, ab, aa] = AMBIENT_COLOR[todKey]
      if (aa > 0) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${aa})`
        ctx.fillRect(-W, -60, W * 3, H * 3)
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [todKey, seas, hour])

  // ── hover detection (inverse iso) ─────────────────────────────────────────
  const onMouseMove = useCallback(e => {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left - canvas.width / 2
    const my = e.clientY - rect.top
    const col = Math.round((mx / (TW / 2) + my / (TH / 2)) / 2)
    const row = Math.round((my / (TH / 2) - mx / (TW / 2)) / 2)
    const ucells = {}
    usersRef.current.forEach(u => {
      const [r, c] = getCellForUser(u.user_id, u.zone)
      ucells[`${r}_${c}`] = u
    })
    setHovered(ucells[`${row}_${col}`] || null)
  }, [])

  return (
    <div className="page active" style={{ padding: 0, maxWidth: '100%', margin: 0 }}>
      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#060614' }}>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 20, background: 'rgba(6,6,20,0.8)', color: '#d4a853', fontFamily: "'Anthropic Serif',Georgia,serif" }}>
            Loading city…
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseMove={onMouseMove} onMouseLeave={() => setHovered(null)} />

        <InfoPanel users={users} myZone={myZoneId} myTier={myTier} hovered={hovered} todKey={todKey} seas={seas} />

        {/* badges */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
          <div style={{ background: 'rgba(8,8,20,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '4px 12px', color: 'rgba(255,255,255,0.65)', fontSize: '0.7rem', fontFamily: "'Anthropic Serif',Georgia,serif" }}>
            {({ winter: '❄️ Winter', spring: '🌸 Spring', summer: '☀️ Summer', autumn: '🍂 Autumn' })[seas]} · {({ day: 'Day ☀️', night: 'Night 🌙', sunrise: 'Sunrise 🌅', sunset: 'Sunset 🌇' })[todKey]}
          </div>
          <div style={{ background: 'rgba(8,8,20,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '3px 12px', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontFamily: "'Anthropic Serif',Georgia,serif" }}>
            {users.length} resident{users.length !== 1 ? 's' : ''} · {users.filter(u => u.is_studying).length} studying
          </div>
        </div>

        {/* SQL button */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10 }}>
          <button onClick={() => setShowSQL(s => !s)} style={{ background: 'rgba(8,8,20,0.88)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)', borderRadius: 8, padding: '5px 12px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: "'Anthropic Serif',Georgia,serif" }}>
            {showSQL ? 'Hide' : '📋 Supabase Schema'}
          </button>
          {showSQL && (
            <pre style={{ marginTop: 8, background: 'rgba(6,6,20,0.97)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: 14, fontSize: '0.62rem', color: '#a5d6a7', maxWidth: 480, maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {SQL}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
