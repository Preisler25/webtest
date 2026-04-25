import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import './App.css'
import { auth, db } from './firebase.ts'

type Tab = 'home' | 'practice' | 'profile'

type UserProfile = {
  email: string
  displayName: string
  tasksCompleted: number
  totalWords: number
  createdAt?: unknown
}

type UserActivity = {
  id: string
  date: string
  tasksCount: number
  wordsLearned: number
}

type Wordset = {
  id: string
  userId: string
  title: string
  isPublic: boolean
  sourceLang: string
  targetLang: string
  wordCount: number
  createdAt?: unknown
}

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
  const [dataLoading, setDataLoading] = useState(false)
  const [opMessage, setOpMessage] = useState('')

  const [wordsetTitle, setWordsetTitle] = useState('')
  const [sourceLang, setSourceLang] = useState('hu')
  const [targetLang, setTargetLang] = useState('en')
  const [isPublic, setIsPublic] = useState(false)

  const [selectedWordsetId, setSelectedWordsetId] = useState('')
  const [sourceWord, setSourceWord] = useState('')
  const [targetWord, setTargetWord] = useState('')

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Jó reggelt'
    if (hour >= 12 && hour < 18) return 'Jó napot'
    if (hour >= 18 && hour < 22) return 'Jó estét'
    return 'Jó éjt'
  }, [])

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayActivity = activity.find((day) => day.date === todayKey)
  const dailyGoal = 5
  const goalDone = todayActivity?.tasksCount ?? 0
  const goalProgress = Math.min(goalDone / dailyGoal, 1)

  const streak = useMemo(() => {
    let streakCount = 0
    const lookup = new Map(activity.map((item) => [item.date, item.tasksCount]))
    const cursor = new Date()

    for (let i = 0; i < 365; i += 1) {
      const key = cursor.toISOString().slice(0, 10)
      if ((lookup.get(key) ?? 0) > 0) {
        streakCount += 1
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }

    return streakCount
  }, [activity])

  const loadDashboard = useCallback(async (uid: string) => {
    setDataLoading(true)
    setOpMessage('')

    try {
      const profileRef = doc(db, 'users', uid)
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as UserProfile)
      }

      const wordsetsQuery = query(
        collection(db, 'wordsets'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
      )
      const wordsetSnap = await getDocs(wordsetsQuery)
      const mappedWordsets = wordsetSnap.docs.map((snapshot) => ({
        id: snapshot.id,
        ...(snapshot.data() as Omit<Wordset, 'id'>),
      }))
      setWordsets(mappedWordsets)

      const dayAgo = new Date()
      dayAgo.setDate(dayAgo.getDate() - 365)
      const activityQuery = query(
        collection(db, 'userActivity', uid, 'days'),
        where('date', '>=', dayAgo.toISOString().slice(0, 10)),
      )
      const activitySnap = await getDocs(activityQuery)
      const mappedActivity = activitySnap.docs
        .map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as Omit<UserActivity, 'id'>),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))

      setActivity(mappedActivity)

      setSelectedWordsetId((prev) => prev || mappedWordsets[0]?.id || '')
    } catch (error) {
      setOpMessage(
        error instanceof Error ? error.message : 'Nem sikerult betolteni az adatokat.',
      )
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
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

    return unsubscribe
  }, [loadDashboard])

  async function handleAuth() {
    setAuthLoading(true)
    setAuthError('')

    try {
      if (hasAccount) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } else {
        if (password !== rePassword) {
          throw new Error('A jelszavak nem egyeznek')
        }
        if (!displayName.trim()) {
          throw new Error('Add meg a neved')
        }

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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Auth hiba')
    } finally {
      setAuthLoading(false)
    }
  }

  async function createWordset() {
    if (!user) return
    if (!wordsetTitle.trim()) {
      setOpMessage('Adj nevet a szokeszletnek.')
      return
    }

    try {
      await addDoc(collection(db, 'wordsets'), {
        userId: user.uid,
        title: wordsetTitle.trim(),
        isPublic,
        sourceLang: sourceLang.trim().toLowerCase(),
        targetLang: targetLang.trim().toLowerCase(),
        wordCount: 0,
        createdAt: serverTimestamp(),
      })

      setWordsetTitle('')
      setOpMessage('Szokeszlet letrehozva.')
      await loadDashboard(user.uid)
    } catch (error) {
      setOpMessage(error instanceof Error ? error.message : 'Nem sikerult a letrehozas.')
    }
  }

  async function addWordToWordset() {
    if (!user || !selectedWordsetId) return
    if (!sourceWord.trim() || !targetWord.trim()) {
      setOpMessage('Told ki mindket szo mezojet.')
      return
    }

    try {
      await addDoc(collection(db, 'wordsets', selectedWordsetId, 'words'), {
        source: sourceWord.trim(),
        target: targetWord.trim(),
        mastered: false,
      })

      await updateDoc(doc(db, 'wordsets', selectedWordsetId), {
        wordCount: increment(1),
      })

      await updateDoc(doc(db, 'users', user.uid), {
        totalWords: increment(1),
      })

      setSourceWord('')
      setTargetWord('')
      setOpMessage('Szo hozzaadva.')
      await loadDashboard(user.uid)
    } catch (error) {
      setOpMessage(error instanceof Error ? error.message : 'Nem sikerult a szo mentese.')
    }
  }

  async function recordPractice() {
    if (!user) return

    try {
      const todayRef = doc(db, 'userActivity', user.uid, 'days', todayKey)
      const todaySnap = await getDoc(todayRef)

      if (todaySnap.exists()) {
        await updateDoc(todayRef, {
          tasksCount: increment(1),
          wordsLearned: increment(3),
        })
      } else {
        await setDoc(todayRef, {
          date: todayKey,
          tasksCount: 1,
          wordsLearned: 3,
        })
      }

      await updateDoc(doc(db, 'users', user.uid), {
        tasksCompleted: increment(1),
      })

      setOpMessage('Gyakorlas rogzitve.')
      await loadDashboard(user.uid)
    } catch (error) {
      setOpMessage(error instanceof Error ? error.message : 'Nem sikerult a gyakorlas mentese.')
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    setTab('home')
  }

  if (!authReady) {
    return <main className="app-shell loading">Betoltes...</main>
  }

  return (
    <main className="app-shell">
      {!user ? (
        <section className="screen auth-screen">
          <header className="hero-head">
            <div>
              <p className="eyebrow">FluencyPilot</p>
              <h1>{hasAccount ? 'Udv vissza!' : 'Csatlakozz'}</h1>
              <p className="muted">
                {hasAccount ? 'Folytatjuk ahol abbahagytad.' : 'Kezdd el a napi tanulast ma.'}
              </p>
            </div>
            <div className="orb" aria-hidden="true" />
          </header>

          <div className="card">
            {!hasAccount && (
              <label>
                Nev
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Add meg a neved"
                />
              </label>
            )}

            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="te@email.com"
              />
            </label>

            <label>
              Jelszo
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={hasAccount ? 'current-password' : 'new-password'}
                placeholder="••••••••"
              />
            </label>

            {!hasAccount && (
              <label>
                Jelszo megerositese
                <input
                  value={rePassword}
                  onChange={(event) => setRePassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>
            )}
          </div>

          {authError && <p className="error-banner">{authError}</p>}

          <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>
            {authLoading
              ? 'Folyamatban...'
              : hasAccount
                ? 'Bejelentkezes'
                : 'Fiok letrehozasa'}
          </button>

          <button className="btn-ghost" onClick={() => setHasAccount((prev) => !prev)}>
            {hasAccount ? 'Meg nincs fiokod? Regisztralj' : 'Van mar fiokod? Lepj be'}
          </button>
        </section>
      ) : (
        <section className="screen app-screen">
          <header className="topbar">
            <div>
              <p className="eyebrow">{greeting}</p>
              <h2>{profile?.displayName ?? user.email?.split('@')[0] ?? 'Tanulo'}</h2>
            </div>
            <div className="avatar">{(profile?.displayName?.[0] ?? '?').toUpperCase()}</div>
          </header>

          {tab === 'home' && (
            <div className="scroll-column">
              <section className="two-up">
                <article className="glass">
                  <p className="stat">{streak}</p>
                  <p className="muted">napos sorozat</p>
                </article>
                <article className="glass">
                  <p className="stat">
                    {goalDone}/{dailyGoal}
                  </p>
                  <p className="muted">napi cel</p>
                  <div className="progress">
                    <span style={{ width: `${goalProgress * 100}%` }} />
                  </div>
                </article>
              </section>

              <section className="glass cta-row">
                <div>
                  <p className="eyebrow">Mai gyakorlas</p>
                  <p className="muted">Rogzits egy sikeres gyakorlasi kort</p>
                </div>
                <button className="btn-secondary" onClick={recordPractice}>
                  +1 gyakorlas
                </button>
              </section>

              <section className="glass">
                <p className="eyebrow">Mai statok</p>
                <p className="muted">{todayActivity?.wordsLearned ?? 0} uj szo</p>
                <p className="muted">{todayActivity?.tasksCount ?? 0} feladat</p>
              </section>

              <section className="glass">
                <p className="eyebrow">Szokeszletek</p>
                {wordsets.length === 0 ? (
                  <p className="muted">Meg nincs sajat keszleted.</p>
                ) : (
                  <ul className="wordset-list">
                    {wordsets.map((set) => (
                      <li key={set.id}>
                        <strong>{set.title}</strong>
                        <span>
                          {set.wordCount} szo · {set.sourceLang.toUpperCase()} →{' '}
                          {set.targetLang.toUpperCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'practice' && (
            <div className="scroll-column">
              <section className="card">
                <p className="eyebrow">Uj szokeszlet</p>
                <label>
                  Cime
                  <input
                    value={wordsetTitle}
                    onChange={(event) => setWordsetTitle(event.target.value)}
                    placeholder="Pl. Mindennapi kifejezesek"
                  />
                </label>
                <div className="inline-inputs">
                  <label>
                    Forras
                    <input
                      value={sourceLang}
                      onChange={(event) => setSourceLang(event.target.value)}
                    />
                  </label>
                  <label>
                    Cel
                    <input
                      value={targetLang}
                      onChange={(event) => setTargetLang(event.target.value)}
                    />
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                  />
                  Nyilvanos szokeszlet
                </label>
                <button className="btn-primary" onClick={createWordset}>
                  Letrehozas
                </button>
              </section>

              <section className="card">
                <p className="eyebrow">Szo hozzaadasa</p>
                <label>
                  Szokeszlet
                  <select
                    value={selectedWordsetId}
                    onChange={(event) => setSelectedWordsetId(event.target.value)}
                  >
                    <option value="">Valassz egy szokeszletet</option>
                    {wordsets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Forras szo
                  <input
                    value={sourceWord}
                    onChange={(event) => setSourceWord(event.target.value)}
                    placeholder="Szia"
                  />
                </label>
                <label>
                  Cel szo
                  <input
                    value={targetWord}
                    onChange={(event) => setTargetWord(event.target.value)}
                    placeholder="Hello"
                  />
                </label>
                <button className="btn-secondary" onClick={addWordToWordset}>
                  Hozzaadas
                </button>
              </section>
            </div>
          )}

          {tab === 'profile' && (
            <div className="scroll-column">
              <section className="glass">
                <p className="eyebrow">Profil</p>
                <p className="muted">{profile?.displayName}</p>
                <p className="muted">{profile?.email ?? user.email}</p>
              </section>

              <section className="two-up">
                <article className="glass">
                  <p className="stat">{profile?.tasksCompleted ?? 0}</p>
                  <p className="muted">osszes feladat</p>
                </article>
                <article className="glass">
                  <p className="stat">{profile?.totalWords ?? 0}</p>
                  <p className="muted">osszes szo</p>
                </article>
              </section>

              <button className="btn-primary" onClick={handleSignOut}>
                Kijelentkezes
              </button>
            </div>
          )}

          {(dataLoading || opMessage) && (
            <footer className="status-line">
              {dataLoading ? 'Frissites...' : opMessage}
            </footer>
          )}

          <nav className="bottom-nav" aria-label="Fo navigacio">
            <button
              className={tab === 'home' ? 'active' : ''}
              onClick={() => setTab('home')}
            >
              Fooldal
            </button>
            <button
              className={tab === 'practice' ? 'active' : ''}
              onClick={() => setTab('practice')}
            >
              Gyakorlas
            </button>
            <button
              className={tab === 'profile' ? 'active' : ''}
              onClick={() => setTab('profile')}
            >
              Profil
            </button>
          </nav>
        </section>
      )}
    </main>
  )
}

export default App
