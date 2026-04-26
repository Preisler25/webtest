import { useCallback, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import './App.css'
import { auth, db, firebaseConfigError } from './firebase.ts'
import type { Tab, UserProfile, UserActivity, Wordset } from './types.ts'
import HomeTab from './components/HomeTab.tsx'
import WordsetsTab from './components/WordsetsTab.tsx'
import PracticeTab from './components/PracticeTab.tsx'
import ProfileTab from './components/ProfileTab.tsx'

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Főoldal', icon: '⌂' },
  { id: 'wordsets', label: 'Szókészletek', icon: '📚' },
  { id: 'practice', label: 'Gyakorlás', icon: '⚡' },
  { id: 'profile', label: 'Profil', icon: '◎' },
]

function App() {
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('home')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rePassword, setRePassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [hasAccount, setHasAccount] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activity, setActivity] = useState<UserActivity[]>([])
  const [wordsets, setWordsets] = useState<Wordset[]>([])

  const loadDashboard = useCallback(async (uid: string) => {
    try {
      const profileSnap = await getDoc(doc(db, 'users', uid))
      if (profileSnap.exists()) setProfile(profileSnap.data() as UserProfile)

      const wordsetSnap = await getDocs(
        query(collection(db, 'wordsets'), where('userId', '==', uid), orderBy('createdAt', 'desc')),
      )
      setWordsets(
        wordsetSnap.docs.map((s) => ({ id: s.id, ...(s.data() as Omit<Wordset, 'id'>) })),
      )

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 365)
      const actSnap = await getDocs(
        query(
          collection(db, 'userActivity', uid, 'days'),
          where('date', '>=', cutoff.toISOString().slice(0, 10)),
        ),
      )
      setActivity(
        actSnap.docs
          .map((s) => ({ id: s.id, ...(s.data() as Omit<UserActivity, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date)),
      )
    } catch (err) {
      console.error('[loadDashboard]', err)
    }
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
      setAuthError('')
      if (!nextUser) {
        setProfile(null)
        setActivity([])
        setWordsets([])
        return
      }
      await loadDashboard(nextUser.uid)
    })
  }, [loadDashboard])

  async function handleAuth() {
    setAuthLoading(true)
    setAuthError('')
    try {
      if (hasAccount) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } else {
        if (password !== rePassword) throw new Error('A jelszavak nem egyeznek')
        if (!displayName.trim()) throw new Error('Add meg a neved')
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await setDoc(doc(db, 'users', result.user.uid), {
          email: email.trim(),
          displayName: displayName.trim(),
          tasksCompleted: 0,
          totalWords: 0,
          createdAt: serverTimestamp(),
        })
      }
      setEmail('')
      setPassword('')
      setRePassword('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Auth hiba')
    } finally {
      setAuthLoading(false)
    }
  }

  if (firebaseConfigError) {
    return (
      <main className="app-shell">
        <section className="screen auth-screen">
          <header className="hero-head">
            <div>
              <p className="eyebrow">FluencyPilot</p>
              <h1>Konfiguráció szükséges</h1>
            </div>
            <div className="orb" aria-hidden="true" />
          </header>
          <div className="card">
            <p className="muted">Firebase kulcsok hiányoznak. Telepítsd a VITE_FIREBASE_* változókat.</p>
          </div>
        </section>
      </main>
    )
  }

  if (!authReady) {
    return <main className="app-shell loading">Betöltés...</main>
  }

  return (
    <main className="app-shell">
      {!user ? (
        <section className="screen auth-screen">
          <header className="hero-head">
            <div>
              <p className="eyebrow">FluencyPilot</p>
              <h1>{hasAccount ? 'Üdv vissza!' : 'Csatlakozz'}</h1>
              <p className="muted">
                {hasAccount ? 'Folytatjuk ahol abbahagytad.' : 'Kezdd el a napi tanulást ma.'}
              </p>
            </div>
            <div className="orb" aria-hidden="true" />
          </header>

          <div className="card">
            {!hasAccount && (
              <label>
                Név
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Add meg a neved"
                />
              </label>
            )}
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="te@email.com"
              />
            </label>
            <label>
              Jelszó
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={hasAccount ? 'current-password' : 'new-password'}
                placeholder="••••••••"
              />
            </label>
            {!hasAccount && (
              <label>
                Jelszó megerősítése
                <input
                  value={rePassword}
                  onChange={(e) => setRePassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>
            )}
          </div>

          {authError && <p className="error-banner">{authError}</p>}

          <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>
            {authLoading ? 'Folyamatban...' : hasAccount ? 'Bejelentkezés' : 'Fiók létrehozása'}
          </button>
          <button className="btn-ghost" onClick={() => setHasAccount((p) => !p)}>
            {hasAccount ? 'Még nincs fiókod? Regisztrálj' : 'Van már fiókod? Lépj be'}
          </button>
        </section>
      ) : (
        <section className="app-screen">
          <nav className="app-nav">
            <span className="nav-brand">FluencyPilot</span>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="main-content">
            {tab === 'home' && (
              <HomeTab
                user={user}
                profile={profile}
                activity={activity}
                wordsets={wordsets}
                onRefresh={() => loadDashboard(user.uid)}
                onNavigate={setTab}
              />
            )}
            {tab === 'wordsets' && (
              <WordsetsTab
                user={user}
                wordsets={wordsets}
                onRefresh={() => loadDashboard(user.uid)}
              />
            )}
            {tab === 'practice' && (
              <PracticeTab
                user={user}
                wordsets={wordsets}
                onRefresh={() => loadDashboard(user.uid)}
              />
            )}
            {tab === 'profile' && (
              <ProfileTab
                user={user}
                profile={profile}
                activity={activity}
                onSignOut={async () => {
                  await signOut(auth)
                  setTab('home')
                }}
              />
            )}
          </div>
        </section>
      )}
    </main>
  )
}

export default App
