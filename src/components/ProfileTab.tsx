import { useMemo } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, UserActivity } from '../types.ts'

type Props = {
  user: User
  profile: UserProfile | null
  activity: UserActivity[]
  onSignOut: () => Promise<void>
}

const DAY_HEADERS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']

function buildMonthCells(activity: UserActivity[]) {
  const lookup = new Map(activity.map((a) => [a.date, a.tasksCount]))
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const offset = (firstDow + 6) % 7 // Monday-first
  const todayKey = now.toISOString().slice(0, 10)

  const cells: { date: string | null; level: number; day: number | null; isToday: boolean }[] = []

  for (let i = 0; i < offset; i++) cells.push({ date: null, level: 0, day: null, isToday: false })

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const count = lookup.get(dateStr) ?? 0
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 7 ? 3 : 4
    cells.push({ date: dateStr, level, day: d, isToday: dateStr === todayKey })
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

  const monthCells = useMemo(() => buildMonthCells(activity), [activity])

  const monthLabel = new Date().toLocaleString('hu-HU', { month: 'long', year: 'numeric' })

  return (
    <div className="tab-page">
      <header className="page-header">
        <h2>Profil</h2>
      </header>

      <div className="scroll-column">
        <section className="glass profile-card">
          <div className="profile-avatar">{displayName[0].toUpperCase()}</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>{displayName}</p>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{profile?.email ?? user.email}</p>
          </div>
        </section>

        <div className="stats-row">
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

        <section className="glass">
          <div className="section-head">
            <p className="eyebrow">Aktivitás</p>
            <span className="muted" style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{monthLabel}</span>
          </div>

          <div className="month-calendar">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="month-day-header">{d}</div>
            ))}
            {monthCells.map((cell, i) => (
              <div
                key={i}
                className={`month-cell${cell.isToday ? ' month-cell--today' : ''}${cell.date === null ? ' month-cell--empty' : ''}`}
                data-level={cell.date ? cell.level : undefined}
                title={cell.date ? `${cell.date}: ${activity.find((a) => a.date === cell.date)?.tasksCount ?? 0} feladat` : undefined}
              >
                {cell.day !== null && <span className="month-cell-day">{cell.day}</span>}
              </div>
            ))}
          </div>

          <div className="heatmap-legend">
            <span className="muted" style={{ fontSize: '0.72rem' }}>Kevesebb</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <div key={l} className="month-legend-dot" data-level={l} />
            ))}
            <span className="muted" style={{ fontSize: '0.72rem' }}>Több</span>
          </div>
        </section>

        <button className="btn-primary" onClick={onSignOut}>Kijelentkezés</button>
      </div>
    </div>
  )
}
