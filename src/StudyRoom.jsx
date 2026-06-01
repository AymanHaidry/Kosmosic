import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, Users, Clock, Compass, Activity, Award, 
  Send, Smile, Image, Paperclip, MessageSquare, 
  Moon, Coffee, BookOpen, Rocket, CloudRain, 
  VolumeX, ShieldAlert, ChevronRight, CheckCircle, Info
} from 'lucide-react';

export default function StudyRoom() {
  // --- CORE STATES ---
  const [roomMotto, setRoomMotto] = useState("Boards in 12 days. No excuses.");
  const [currentTheme, setCurrentTheme] = useState({ id: '2am', name: '2AM Grind', icon: Moon, bgClass: 'bg-gradient-to-br from-[#050508] via-[#0b0c16] to-[#030305]', gridColor: 'rgba(99,102,241,0.04)' });
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  
  // --- STATE FOR MOCK SIMULATION ---
  const [members, setMembers] = useState([
    { id: 1, name: 'Ayman', subject: 'Physics', task: 'Chapter 9', timer: '24:51', streak: 17, isStudying: true, lastSeenSubject: 'Physics', timeWorked: '1h 42m', todayMinutes: 201 },
    { id: 2, name: 'Sarah', subject: 'Chemistry', task: 'Organic Compounds', timer: '45:12', streak: 32, isStudying: true, lastSeenSubject: 'Chemistry', timeWorked: '2h 57m', todayMinutes: 177 },
    { id: 3, name: 'Ali', subject: 'Mathematics', task: 'Calculus Props', timer: '12:04', streak: 100, isStudying: true, lastSeenSubject: 'Mathematics', timeWorked: '2h 18m', todayMinutes: 138 },
    { id: 4, name: 'Rahul', subject: 'Computer Sci', task: 'Array Trees', timer: '08:45', streak: 5, isStudying: true, lastSeenSubject: 'Computer Sci', timeWorked: '0h 45m', todayMinutes: 45 },
    { id: 5, name: 'Emma', subject: 'Break', task: 'Hydrating', timer: '04:15', streak: 12, isStudying: false, lastSeenSubject: 'English Lit', timeWorked: '1h 15m', todayMinutes: 75 }
  ]);

  const [activities, setActivities] = useState([
    { id: 1, text: 'Ayman started Focus Session', time: 'Just now', type: 'start' },
    { id: 2, text: 'Ali reached 100-day streak', time: '2m ago', type: 'streak' },
    { id: 3, text: 'Sarah completed Deep Work', time: '5m ago', type: 'complete' }
  ]);

  const [messages, setMessages] = useState([
    { id: 1, sender: 'Ali', text: 'Stuck on this integrations problem, locking in.', time: '8:44 PM', type: 'text' },
    { id: 2, sender: 'Sarah', text: 'Let’s crush tonight’s targets guys.', time: '8:46 PM', type: 'text' }
  ]);

  // --- THEMES CONFIG ---
  const roomThemes = [
    { id: '2am', name: '2AM Grind', icon: Moon, bgClass: 'bg-gradient-to-br from-[#040406] via-[#090a14] to-[#020203]', gridColor: 'rgba(99,102,241,0.03)' },
    { id: 'cafe', name: 'Cafe', icon: Coffee, bgClass: 'bg-gradient-to-br from-[#0c0a09] via-[#1c1917] to-[#0c0a09]', gridColor: 'rgba(217,119,6,0.03)' },
    { id: 'library', name: 'Library', icon: BookOpen, bgClass: 'bg-gradient-to-br from-[#020806] via-[#061f14] to-[#010503]', gridColor: 'rgba(16,185,129,0.03)' },
    { id: 'mission', name: 'Mission Control', icon: Rocket, bgClass: 'bg-gradient-to-br from-[#020d1a] via-[#05162e] to-[#010712]', gridColor: 'rgba(14,165,233,0.04)' },
    { id: 'rain', name: 'Rain', icon: CloudRain, bgClass: 'bg-gradient-to-br from-[#0b0f19] via-[#1e293b] to-[#0f172a]', gridColor: 'rgba(148,163,184,0.03)' }
  ];

  // --- DERIVED METRICS ---
  const activeStudyingCount = members.filter(m => m.isStudying).length;
  const onBreakCount = members.filter(m => !m.isStudying).length;
  const focusLevel = Math.round((activeStudyingCount / members.length) * 100);
  const totalStudyHours = 18;
  const targetStudyHours = 50;

  // Check if killer feature trigger conditions are met (105% Locked In Silence Mode)
  const isSharedSilence = activeStudyingCount === members.length;

  // --- HANDLERS ---
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: 'Ayman', text: messageText, time: '8:52 PM', type: 'text' }]);
    setMessageText("");
  };

  const triggerMockFileShare = () => {
    setMessages([...messages, { 
      id: Date.now(), 
      sender: 'Ayman', 
      text: 'shared reference_notes_ch9.pdf (2.4 MB)', 
      time: '8:52 PM', 
      type: 'file',
      fileName: 'reference_notes_ch9.pdf' 
    }]);
  };

  const triggerMockGifShare = () => {
    setMessages([...messages, { 
      id: Date.now(), 
      sender: 'Ayman', 
      text: 'https://media.giphy.com/v1/gifs/code-matrix-neon', 
      time: '8:52 PM', 
      type: 'gif',
      gifUrl: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3N5Y2FmaXFrbW50bGl5dTh0dm83dWZ3dWswZzd3bWF5cWFwYnd6MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ov9jV52CQ91stvCcM/giphy.gif'
    }]);
  };

  const addEmoji = (emoji) => {
    setMessageText(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  return (
    <div className={`min-h-screen w-full font-sans text-slate-100 transition-all duration-1000 overflow-x-hidden relative ${currentTheme.bgClass}`}>
      
      {/* Premium Tech Grid Layer */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-1000" 
        style={{
          backgroundImage: `linear-gradient(${currentTheme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${currentTheme.gridColor} 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Ambient Moving Glow Filter (Calms down dynamically in Shared Silence Deep Focus Mode) */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[140px] pointer-events-none mix-blend-screen transition-all duration-1000 opacity-20 bg-indigo-500 ${isSharedSilence ? 'scale-75 opacity-10 duration-[3000ms]' : 'animate-pulse'}`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full blur-[140px] pointer-events-none mix-blend-screen transition-all duration-1000 opacity-20 bg-emerald-500 ${isSharedSilence ? 'scale-75 opacity-5 duration-[3000ms]' : ''}`} />

      {/* CORE WINDOW CONTAINER */}
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 relative z-10 flex flex-col gap-6 min-h-screen">
        
        {/* UPPER STATUS HEADER SECTION */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-[#090b11]/40 border border-white/[0.06] backdrop-blur-xl rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          
          {/* Brand/Motto Meta */}
          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Kosmosic Studio
              </h1>
              <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                v2.0
              </span>
            </div>
            {/* Feature 9: Room Motto (Editable or Viewable) */}
            <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
              <span className="text-indigo-400/70">“</span>
              <input 
                type="text" 
                value={roomMotto} 
                onChange={(e) => setRoomMotto(e.target.value)}
                className="bg-transparent border-none p-0 focus:ring-0 text-slate-300 w-full truncate focus:border-b focus:border-slate-700 font-mono text-xs"
                placeholder="Set room motto..."
              />
            </div>
          </div>

          {/* Feature 1: Study Heat Display */}
          <div className="lg:col-span-5 bg-black/30 border border-white/[0.04] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Flame className={`w-3.5 h-3.5 text-orange-500 ${focusLevel > 50 ? 'animate-bounce' : ''}`} /> 
                Room Focus Level
              </span>
              <span className={`font-bold ${focusLevel === 100 ? 'text-orange-400' : 'text-slate-200'}`}>
                {focusLevel}%
              </span>
            </div>
            
            {/* Custom high-end focus level bar layout */}
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/[0.05] p-[1px]">
              <div 
                className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${
                  focusLevel === 100 ? 'from-amber-500 via-orange-500 to-red-500' : 'from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${focusLevel}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono mt-0.5">
              <div className="flex gap-3 text-slate-400">
                <span><strong className="text-emerald-400">{activeStudyingCount}</strong> studying</span>
                <span><strong className="text-amber-400">{onBreakCount}</strong> on break</span>
              </div>
              {focusLevel === 100 && (
                <span className="text-orange-500 font-black tracking-widest text-[10px] bg-orange-500/10 px-1.5 py-0.2 rounded border border-orange-500/30 animate-pulse">
                  🔥 LOCKED IN
                </span>
              )}
            </div>
          </div>

          {/* Feature 4: Ambient Room Themes Switcher Grid */}
          <div className="lg:col-span-3 flex flex-col gap-1.5">
            <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase flex items-center gap-1">
              <Compass className="w-3 h-3 text-slate-400" /> Room Atmosphere
            </span>
            <div className="flex flex-wrap gap-1.5">
              {roomThemes.map((theme) => {
                const IconComponent = theme.icon;
                const isSelected = currentTheme.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setCurrentTheme(theme)}
                    title={theme.name}
                    className={`p-2 rounded-lg border transition-all duration-300 flex items-center justify-center relative group ${
                      isSelected 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                        : 'bg-black/20 border-white/[0.05] text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-[10px] font-mono bg-black text-slate-200 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-white/10 shadow-xl">
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* KILLER FEATURE BANNER OVERLAY: Shared Silence / Deep Focus Mode */}
        {isSharedSilence && (
          <div className="w-full bg-indigo-950/20 border border-indigo-500/30 backdrop-blur-2xl rounded-xl p-4 flex items-center justify-between transition-all duration-1000 animate-fade-in shadow-[inset_0_1px_20px_rgba(99,102,241,0.1)]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Moon className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold tracking-wide text-indigo-300">🌙 Deep Focus Mode Active</h3>
                <p className="text-xs text-slate-400">All members are currently focused. Chat interface matches room acoustics.</p>
              </div>
            </div>
            <div className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded">
              ENVIRONMENT CALM
            </div>
          </div>
        )}

        {/* MAIN WORKSPACE SPLIT GRID */}
        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start flex-grow">
          
          {/* LEFT COLUMN: DESK VIEW AND CONTROLS (8 COLS) */}
          <div className="xl:col-span-8 flex flex-col gap-6 h-full justify-between">
            
            {/* DESKS SECTION */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <h2 className="text-xs font-mono tracking-widest text-slate-400 uppercase">Active Working Desks</h2>
                </div>
                <span className="text-[11px] font-mono text-slate-500">Hover desks to inspect historical track</span>
              </div>

              {/* Feature 3: Redesigned Desk View Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {members.map((member) => (
                  <div 
                    key={member.id}
                    className={`relative group bg-[#0d0f17]/60 border backdrop-blur-md rounded-xl p-4 transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-lg ${
                      member.isStudying 
                        ? 'border-white/[0.06] hover:border-indigo-500/40 hover:shadow-[0_4px_24px_rgba(99,102,241,0.08)]' 
                        : 'border-amber-500/20 bg-amber-950/5'
                    } ${isSharedSilence ? 'opacity-90 grayscale-[20%] hover:grayscale-0' : ''}`}
                  >
                    {/* Background Subtle Wave Ring for active focus status */}
                    {member.isStudying && (
                      <span className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-all" />
                    )}

                    {/* Desk Layout Structure */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                          {member.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {member.isStudying ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          ) : (
                            <span className="text-[10px] font-mono tracking-tight text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">BREAK</span>
                          )}
                        </div>
                      </div>

                      {/* Display Primary Subject details directly */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-300 truncate">
                          {member.subject}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-slate-600" /> {member.task}
                        </div>
                      </div>
                    </div>

                    {/* Footer Row inside desk card */}
                    <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 font-bold tracking-tight bg-black/20 px-2 py-0.5 rounded border border-white/[0.03]">
                        {member.timer}
                      </span>
                      <span className="text-orange-400 font-medium flex items-center gap-0.5">
                        🔥 {member.streak} days
                      </span>
                    </div>

                    {/* Feature 7: "Last Seen Working" Custom Tooltip Overlay on Hover */}
                    <div className="absolute inset-0 bg-[#090a10] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between z-20 border border-indigo-500/30 rounded-xl">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono tracking-widest text-indigo-400 uppercase block">Activity Profile</span>
                        <div>
                          <div className="text-[11px] text-slate-400 font-mono">Currently Focused On:</div>
                          <div className="text-xs font-bold text-slate-200">{member.lastSeenSubject}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400 font-mono">Continuous Session:</div>
                          <div className="text-xs font-bold text-slate-200">{member.timeWorked}</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/[0.05] text-[10px] font-mono text-slate-500 flex justify-between">
                        <span>Today: {Math.floor(member.todayMinutes / 60)}h {member.todayMinutes % 60}m</span>
                        <span className="text-indigo-400 flex items-center gap-0.5">Active <ChevronRight className="w-2 h-2" /></span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Feature 5: Group Goal Metric Platform Card */}
            <div className="bg-[#090b11]/40 border border-white/[0.06] backdrop-blur-xl rounded-xl p-5 shadow-md mt-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-mono tracking-widest text-slate-400 uppercase">Room Target Tracker</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Collective operational hours for the current sprint</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-white">
                    {totalStudyHours} <span className="text-slate-500">/</span> {targetStudyHours} study hours
                  </span>
                </div>
              </div>

              {/* Progress Track Layout */}
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-white/[0.05] p-[1px] mb-2">
                <div 
                  className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                  style={{ width: `${(totalStudyHours / targetStudyHours) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Progress: {Math.round((totalStudyHours / targetStudyHours) * 100)}%</span>
                {totalStudyHours >= targetStudyHours ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle className="w-3 h-3" /> 🎉 Goal Reached
                  </span>
                ) : (
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider">Remaining: {targetStudyHours - totalStudyHours} hrs</span>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: INTERACTIVE PANELS AND LIVE FEED & CHAT (4 COLS) */}
          <div className="xl:col-span-4 flex flex-col gap-6 h-full">
            
            {/* Feature 8: Mini Leaderboard Card Component */}
            <div className="bg-[#090b11]/40 border border-white/[0.06] backdrop-blur-xl rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-3 border-b border-white/[0.04] pb-2">
                <span className="text-xs font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-400" /> Today's Focus
                </span>
                <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                  Daily Reset
                </span>
              </div>
              <div className="space-y-2">
                {/* Dynamically sorting the mock telemetry values */}
                {[...members].sort((a,b) => b.todayMinutes - a.todayMinutes).slice(0,3).map((leader, index) => (
                  <div key={leader.id} className="flex items-center justify-between text-xs font-mono bg-black/20 px-3 py-2 rounded-lg border border-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : 'text-amber-700'}`}>
                        {index + 1}.
                      </span>
                      <span className="text-slate-300 font-medium">{leader.name}</span>
                    </div>
                    <span className="text-slate-400 font-bold">
                      {Math.floor(leader.todayMinutes / 60)}h {leader.todayMinutes % 60}m
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature 2: Live Activity Feed (In place of single metric chat) */}
            <div className="bg-[#090b11]/40 border border-white/[0.06] backdrop-blur-xl rounded-xl p-4 shadow-md flex flex-col gap-2.5 max-h-[190px] overflow-y-auto">
              <span className="text-xs font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Live Activity Feed
              </span>
              <div className="space-y-2">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-[11px] font-mono bg-white/[0.01] p-2 rounded border border-white/[0.03]">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        act.type === 'start' ? 'bg-indigo-400' : act.type === 'streak' ? 'bg-orange-400' : 'bg-emerald-400'
                      }`} />
                      <span>{act.text}</span>
                    </div>
                    <span className="text-slate-500 text-[10px]">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* INTEGRATED RECONFIGURED CHAT COMPONENT (Fades/Calms in Shared Silence Mode) */}
            <div className={`bg-[#090b11]/40 border border-white/[0.06] backdrop-blur-xl rounded-xl shadow-xl flex flex-col flex-grow min-h-[360px] transition-all duration-1000 ${
              isSharedSilence ? 'border-indigo-500/10 shadow-none' : ''
            }`}>
              
              {/* Chat Header Header */}
              <div className="p-3 border-b border-white/[0.05] flex items-center justify-between bg-black/20 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-mono tracking-wider text-slate-300">Room Chat Stream</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              {/* Chat Output Message Canvas */}
              <div className={`flex-grow p-4 overflow-y-auto space-y-3 transition-opacity duration-1000 ${
                isSharedSilence ? 'opacity-40' : 'opacity-100'
              }`}>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.sender === 'Ayman' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                      <span className="font-bold text-slate-400">{msg.sender}</span>
                      <span>{msg.time}</span>
                    </div>

                    {/* Standard Text Formatting */}
                    {msg.type === 'text' && (
                      <div className={`text-xs px-3 py-2 rounded-xl max-w-[85%] font-mono break-words ${
                        msg.sender === 'Ayman' 
                          ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' 
                          : 'bg-white/5 border border-white/[0.05] text-slate-300'
                      }`}>
                        {msg.text}
                      </div>
                    )}

                    {/* Custom File Sharing UI Wrapper */}
                    {msg.type === 'file' && (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded-xl text-xs font-mono max-w-[85%]">
                        <Paperclip className="w-4 h-4 shrink-0" />
                        <div className="truncate">
                          <span className="underline block truncate cursor-pointer">{msg.fileName}</span>
                          <span className="text-[9px] text-emerald-500/60 block">Click to download asset</span>
                        </div>
                      </div>
                    )}

                    {/* Custom Embedded GIF/Image Wrapper */}
                    {msg.type === 'gif' && (
                      <div className="border border-white/10 rounded-xl overflow-hidden max-w-[85%] bg-black/40 p-1">
                        <img src={msg.gifUrl} alt="shared animation gif" className="rounded-lg w-full object-cover max-h-[140px]" />
                        <span className="text-[9px] text-slate-500 font-mono p-1 block truncate">{msg.text}</span>
                      </div>
                    )}

                  </div>
                ))}
              </div>

              {/* CHAT INPUT AND CORE INTERACTION BAR */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.05] bg-black/20 rounded-b-xl flex flex-col gap-2 relative">
                
                {/* Emoji Tooltip Modal Wrapper */}
                {isEmojiPickerOpen && (
                  <div className="absolute bottom-full left-2 mb-2 bg-[#0c0e17] border border-white/10 rounded-lg p-2 grid grid-cols-5 gap-1.5 shadow-2xl z-50 backdrop-blur-xl">
                    {['🔥', '📚', '⚡', '🌙', '☕', '👑', '💯', '🎯', '🚀', '🧠'].map(emoji => (
                      <button 
                        key={emoji} 
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded text-sm transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Main Entry Field Row */}
                <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-2 py-1 focus-within:border-indigo-500/50 transition-colors">
                  <input 
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={isSharedSilence ? "Deep Focus Mode active..." : "Broadcast to room..."}
                    className="bg-transparent border-none focus:ring-0 text-xs text-slate-200 placeholder-slate-500 flex-grow py-1.5 font-mono"
                  />
                  
                  {/* Action Capability Buttons */}
                  <div className="flex items-center gap-0.5 text-slate-400">
                    <button 
                      type="button" 
                      onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                      className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="Add Emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={triggerMockGifShare}
                      className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="Share Giphy Asset"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={triggerMockFileShare}
                      className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="Share Document File"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dispatch Trigger Bar */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
                  <span>Press enter to stream message</span>
                  <button 
                    type="submit"
                    className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
                  >
                    SEND <Send className="w-3 h-3" />
                  </button>
                </div>

              </form>

            </div>

          </div>
        </main>

      </div>
    </div>
  );
}
