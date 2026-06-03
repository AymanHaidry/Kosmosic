/* ═══════════════════════════════════════════════════════════════
INTEGRATION GUIDE — Add Demo Mode to Kosmosic
═══════════════════════════════════════════════════════════════
STEP 1: Wrap your app with DemoProvider
──────────────────────────────────────────────────────────────
In your main entry file (App.jsx or main.jsx):
import { DemoProvider } from './DemoMode.jsx'
   <DemoProvider>
     <YourApp />
   </DemoProvider>
STEP 2: Modify StudyOS.jsx to use demo data
──────────────────────────────────────────────────────────────
At the top of StudyOS, add:
import { useDemo, useDemoSession, useDemoState } from './DemoMode.jsx'
Inside StudyOS component, replace session logic:
const { isDemo } = useDemo()
const demoSession = useDemoSession()
const demoState = useDemoState()
// Use demo session if in demo mode, otherwise use real session
const effectiveSession = isDemo ? demoSession : session
const effectiveState = isDemo ? demoState : S
// Skip auth check in demo mode
if (!effectiveSession && !isDemo) return <AuthView ... />
// Use effectiveState everywhere you previously used S
// Note: updateS won't persist in demo mode (no Supabase writes)
// You may want to add a no-op updateS for demo:
const demoUpdateS = (updater) => {
// In demo mode, state changes are ephemeral
console.log('[DEMO] State update:', updater)
}
const effectiveUpdateS = isDemo ? demoUpdateS : updateS
STEP 3: Modify CityPage.jsx for demo city data
──────────────────────────────────────────────────────────────
At the top of CityPage, add:
import { useDemo, useDemoCityProfiles } from './DemoMode.jsx'
Inside CityPage component:
const { isDemo } = useDemo()
const demoProfiles = useDemoCityProfiles()
// In your fetchUsers callback, merge demo data:
const fetchUsers = useCallback(async () => {
if (isDemo) {
setUsers(demoProfiles)
setLoading(false)
return
}
// ... existing Supabase fetch code
}, [isDemo, demoProfiles])
// Skip upsert in demo mode:
const upsert = useCallback(async () => {
if (isDemo) return
// ... existing upsert code
}, [isDemo, session, ...])
STEP 4: Modify Launcher.jsx live counter (optional)
──────────────────────────────────────────────────────────────
In Launcher.jsx, the live counter can use demo data:
import { useDemo } from './DemoMode.jsx'
const { isDemo, allResidents } = useDemo()
useEffect(() => {
if (isDemo) {
setLiveCount(allResidents.filter(u => u.studying).length)
return
}
// ... existing Supabase fetch
}, [isDemo, allResidents])
STEP 5: Add demo route to your router
──────────────────────────────────────────────────────────────
In your router config, add:
{ path: '/demo', element: <Navigate to="/app?demo=1" />
Or simply share: https://kosmosic.vercel.app/app?demo=1
STEP 6: CSS for demo banner (add to your CSS)
──────────────────────────────────────────────────────────────
The demo banner uses inline styles, but you may want to add
these keyframes to your global CSS:
@keyframes pulse {
0%, 100% { opacity: 1; transform: scale(1); }
50% { opacity: 0.7; transform: scale(1.05); }
}
STEP 7: Test it
──────────────────────────────────────────────────────────────
Start your dev server
Navigate to: http://localhost:5173/app?demo=1
You should see:
The app loads without login
A gold banner at the bottom: "DEMO MODE — Synthetic Data"
6 user buttons to switch between demo personas
Realistic stats, streaks, sessions, and activity feeds
City page shows 6 buildings with varied heights
No data persists to Supabase
═══════════════════════════════════════════════════════════════
WHAT'S SYNTHETIC vs REAL
═══════════════════════════════════════════════════════════════
SYNTHETIC (generated in browser, never saved):
✓ User names, emails, avatars
✓ Streak counts, total hours, today minutes
✓ Session history, activity feed entries
✓ Subject breakdowns, study modes
✓ City building tiers, live status
✓ Calendar studied/missed days
REAL (your actual app code):
✓ All UI components and styling
✓ Timer logic and animations
✓ Theme switching
✓ Navigation and routing
✓ All interactive features
═══════════════════════════════════════════════════════════════
