import { useMemo } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, UserActivity } from '../types.ts'

type Props = {
  user: User
  profile: UserProfile | null
  activity: UserActivity[]
  onSignOut: () => Promise<void>
}

function buildHeatmap(activity: UserActivity[]) {
  const lookup = new Map(activity.map((a) => [a.date, a.tasksCount]))
  const today = new Date()
  const cells: { date: string; level: number }[] = []

  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const count = lookup.get(key) ?? 0
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 7 ? 3 : 4
    cells.push({ date: key, level })
  }
  return cells
}

export default function ProfileTab({ user, profile, activity, onSignOut }: Props) {
  const displayName = profile?.displayName ?? user.email?.split('@')[0] ?? 'Tanuló'

  const streak = useMemo(() => {
    let count = 0
    const lookup = new Map(activity.map((a) => [a.date, a.tasksCount]))
    const cursor = new Date()
    for (let i = 0; i < 365; i++) {
      const key = cursor.toISOString().slice(0, 10)
      if ((lookup.get(key) ?? 0) > 0) { count++; cursor.setDate(cursor.getDate() - 1) }
      else break
    }
    return count
  }, [activity])

  const heatmapCells = useMemo(() => buildHeatmap(activity), [activity])

  const MONTH_LABELS = useMemo(() => {
    const labels: { label: string; col: number }[] = []
    let lastMonth = -1
    heatmapCells.forEach((cell, i) => {
      const month = new Date(cell.date).getMonth()
      if (month !== lastMonth) {
        labels.push({
          label: new Date(cell.date).toLocaleString('hu-HU', { month: 'short' }),
          col: Math.floor(i / 7) + 1,
        })
        lastMonth = month
      }
    })
    return labels
  }, [heatmapCells])

  return (
    <div className="tab-page">
      <header className="page-header">
        <h2>Profil</h2>
      </header>

      <div className="scroll-column">
        {/* Avatar + info */}
        <section className="glass profile-card">
          <div className="profile-avatar">{displayName[0].toUpperCase()}</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>{displayName}</p>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{profile?.email ?? user.email}</p>
          </div>
        </section>

        {/* Stats */}
        <div className="stats-row stats-row--profile">
          <div className="stat-card stat-card--coral">
            <span className="stat-card-icon">🔥</span>
            <p className="stat-number">{streak}</p>
            <p className="stat-label">napos sorozat</p>
          </div>
          <div className="stat-card stat-card--mint">
            <span className="stat-card-icon">⚡</span>
            <p className="stat-number">{profile?.tasksCompleted ?? 0}</p>
            <p className="stat-label">összes feladat</p>
          </div>
          <div className="stat-card stat-card--violet">
            <span className="stat-card-icon">📖</span>
            <p className="stat-number">{profile?.totalWords ?? 0}</p>
            <p className="stat-label">összes szó</p>
          </div>
        </div>

        {/* Activity heatmap */}
        <section className="glass heatmap-section">
          <p className="eyebrow">Aktivitás az elmúlt évben</p>
          <div className="heatmap-scroll">
            <div className="heatmap-month-labels" style={{ gridTemplateColumns: `repeat(52, 1fr)` }}>
              {MONTH_LABELS.map((m) => (
                <span
                  key={m.label + m.col}
                  className="heatmap-month"
                  style={{ gridColumn: m.col }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div className="heatmap-grid">
              {heatmapCells.map((cell) => (
                <div
                  key={cell.date}
                  className="heatmap-cell"
                  data-level={cell.level}
                  title={`${cell.date}: ${activity.find((a) => a.date === cell.date)?.tasksCount ?? 0} feladat`}
                />
              ))}
            </div>
          </div>
          <div className="heatmap-legend">
            <span className="muted" style={{ fontSize: '0.72rem' }}>Kevesebb</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <div key={l} className="heatmap-cell heatmap-cell--legend" data-level={l} />
            ))}
            <span className="muted" style={{ fontSize: '0.72rem' }}>Több</span>
          </div>
        </section>

        <button className="btn-primary" onClick={onSignOut}>Kijelentkezés</button>
      </div>
    </div>
  )
}
