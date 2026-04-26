import { useMemo } from 'react'
import type { User } from 'firebase/auth'
import type { Tab, UserProfile, UserActivity, Wordset } from '../types.ts'

type Props = {
  user: User
  profile: UserProfile | null
  activity: UserActivity[]
  wordsets: Wordset[]
  onRefresh: () => Promise<void>
  onNavigate: (tab: Tab) => void
}

const DAILY_GOAL = 5

export default function HomeTab({ user, profile, activity, wordsets, onNavigate }: Props) {
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return 'Jó reggelt'
    if (h >= 12 && h < 18) return 'Jó napot'
    if (h >= 18 && h < 22) return 'Jó estét'
    return 'Jó éjt'
  }, [])

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayActivity = activity.find((d) => d.date === todayKey)
  const goalDone = todayActivity?.tasksCount ?? 0
  const goalProgress = Math.min(goalDone / DAILY_GOAL, 1)

  const streak = useMemo(() => {
    let count = 0
    const lookup = new Map(activity.map((a) => [a.date, a.tasksCount]))
    const cursor = new Date()
    for (let i = 0; i < 365; i++) {
      const key = cursor.toISOString().slice(0, 10)
      if ((lookup.get(key) ?? 0) > 0) {
        count++
        cursor.setDate(cursor.getDate() - 1)
      } else break
    }
    return count
  }, [activity])

  const displayName = profile?.displayName ?? user.email?.split('@')[0] ?? 'Tanuló'

  return (
    <div className="tab-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h2>{displayName}</h2>
        </div>
        <div className="avatar">{displayName[0].toUpperCase()}</div>
      </header>

      <div className="scroll-column">
        {/* Gamified stats row */}
        <div className="stats-row">
          <div className="stat-card stat-card--coral">
            <span className="stat-card-icon">🔥</span>
            <p className="stat-number">{streak}</p>
            <p className="stat-label">napos sorozat</p>
          </div>

          <div className="stat-card stat-card--mint">
            <span className="stat-card-icon">🎯</span>
            <p className="stat-number">{goalDone}<span className="stat-denom">/{DAILY_GOAL}</span></p>
            <p className="stat-label">napi cél</p>
            <div className="stat-progress">
              <span style={{ width: `${goalProgress * 100}%` }} />
            </div>
          </div>

          <div className="stat-card stat-card--violet">
            <span className="stat-card-icon">📖</span>
            <p className="stat-number">{profile?.totalWords ?? 0}</p>
            <p className="stat-label">összes szó</p>
          </div>
        </div>

        {/* Today's recap */}
        <section className="glass">
          <p className="eyebrow">Mai statisztikák</p>
          <div className="recap-row">
            <div className="recap-item">
              <span className="recap-icon">⚡</span>
              <span className="recap-value">{todayActivity?.tasksCount ?? 0}</span>
              <span className="muted">feladat</span>
            </div>
            <div className="recap-divider" />
            <div className="recap-item">
              <span className="recap-icon">✨</span>
              <span className="recap-value">{todayActivity?.wordsLearned ?? 0}</span>
              <span className="muted">új szó</span>
            </div>
            <div className="recap-divider" />
            <div className="recap-item">
              <span className="recap-icon">🏆</span>
              <span className="recap-value">{profile?.tasksCompleted ?? 0}</span>
              <span className="muted">összes feladat</span>
            </div>
          </div>
        </section>

        {/* Level / XP bar */}
        <section className="glass level-card">
          <div className="level-header">
            <span className="level-badge">Lvl {Math.floor((profile?.tasksCompleted ?? 0) / 10) + 1}</span>
            <span className="muted">{(profile?.tasksCompleted ?? 0) % 10}/10 XP</span>
          </div>
          <div className="progress">
            <span style={{ width: `${(((profile?.tasksCompleted ?? 0) % 10) / 10) * 100}%`, background: 'linear-gradient(90deg, #9b8cff, #ff7a59)' }} />
          </div>
          <p className="muted" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
            Még {10 - ((profile?.tasksCompleted ?? 0) % 10)} feladat a következő szintig
          </p>
        </section>

        {/* Wordsets quick access */}
        <section className="glass">
          <div className="section-head">
            <p className="eyebrow">Szókészleteid</p>
            <button className="btn-link" onClick={() => onNavigate('wordsets')}>Összes →</button>
          </div>
          {wordsets.length === 0 ? (
            <div className="empty-nudge">
              <span>📚</span>
              <p className="muted">Még nincs szókészleted.</p>
              <button className="btn-secondary" onClick={() => onNavigate('wordsets')}>Létrehozás</button>
            </div>
          ) : (
            <ul className="wordset-list">
              {wordsets.slice(0, 3).map((ws) => (
                <li key={ws.id} onClick={() => onNavigate('practice')} style={{ cursor: 'pointer' }}>
                  <strong>{ws.title}</strong>
                  <span>{ws.wordCount} szó · {ws.sourceLang.toUpperCase()} → {ws.targetLang.toUpperCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Practice CTA */}
        <section className="cta-banner">
          <div className="cta-banner-text">
            <span className="cta-emoji">⚡</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Kezdj el gyakorolni!</p>
              <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>Válassz egy szókészletet és haladj a céljaid felé</p>
            </div>
          </div>
          <button className="btn-primary" onClick={() => onNavigate('practice')}>Gyakorlás</button>
        </section>
      </div>
    </div>
  )
}
