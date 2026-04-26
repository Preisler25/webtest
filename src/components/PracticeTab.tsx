import { useState } from 'react'
import type { User } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  increment,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase.ts'
import type { Wordset, Word, PracticeMode, PracticeDirection, UserProfile } from '../types.ts'
import FlashcardMode from './modes/FlashcardMode.tsx'
import QuizMode from './modes/QuizMode.tsx'
import MatchPairsMode from './modes/MatchPairsMode.tsx'
import WriteMode from './modes/WriteMode.tsx'

type Props = {
  user: User
  profile: UserProfile | null
  wordsets: Wordset[]
  onRefresh: () => Promise<void>
}

type LeaderboardEntry = { userId: string; displayName: string; bestPercent: number }

type Stage =
  | { kind: 'library' }
  | { kind: 'selector'; wordset: Wordset; words: Word[] }
  | { kind: 'practicing'; wordset: Wordset; mode: PracticeMode; direction: PracticeDirection; words: Word[] }
  | { kind: 'results'; wordset: Wordset; words: Word[]; correct: number; leaderboard: LeaderboardEntry[] }

const MODES: { id: PracticeMode; label: string; icon: string; desc: string }[] = [
  { id: 'flashcard', label: 'Kártyák', icon: '🃏', desc: 'Lapozd át a szavakat' },
  { id: 'quiz', label: 'Kvíz', icon: '🧠', desc: '4 lehetőség közül válassz' },
  { id: 'match', label: 'Párosítás', icon: '⚡', desc: 'Kösd össze a párokat' },
  { id: 'write', label: 'Írás', icon: '✍️', desc: 'Írd le a fordítást' },
]

const LANGS: Record<string, string> = {
  hu: '🇭🇺', en: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', es: '🇪🇸',
  it: '🇮🇹', pt: '🇵🇹', pl: '🇵🇱', ro: '🇷🇴', nl: '🇳🇱',
}

function langFlag(code: string) {
  return LANGS[code.toLowerCase()] ?? code.toUpperCase()
}

export default function PracticeTab({ user, profile, wordsets, onRefresh }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'library' })
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState<string>('all')
  const [direction, setDirection] = useState<PracticeDirection>('src')
  const [wordsLoading, setWordsLoading] = useState(false)

  const allLangs = [...new Set(wordsets.flatMap((ws) => [ws.sourceLang, ws.targetLang]))]

  const filtered = wordsets.filter((ws) => {
    const matchSearch = ws.title.toLowerCase().includes(search.toLowerCase())
    const matchLang =
      langFilter === 'all' || ws.sourceLang === langFilter || ws.targetLang === langFilter
    return matchSearch && matchLang
  })

  async function selectWordset(wordset: Wordset) {
    setWordsLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'wordsets', wordset.id, 'words'), orderBy('source')),
      )
      const words = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Word, 'id'>) }))
      if (words.length < 2) { alert('Legalább 2 szó kell a gyakorláshoz.'); return }
      setStage({ kind: 'selector', wordset, words })
    } catch (err) {
      console.error(err)
    } finally {
      setWordsLoading(false)
    }
  }

  function startPractice(wordset: Wordset, words: Word[], mode: PracticeMode) {
    setStage({ kind: 'practicing', wordset, mode, direction, words })
  }

  async function handleComplete(correct: number, wordset: Wordset, words: Word[], total?: number) {
    const today = new Date().toISOString().slice(0, 10)
    const denominator = total ?? words.length
    const percent = Math.round((correct / denominator) * 100)
    const displayName = profile?.displayName ?? user.email?.split('@')[0] ?? 'Tanuló'

    try {
      await setDoc(
        doc(db, 'userActivity', user.uid, 'days', today),
        { date: today, tasksCount: increment(1), wordsLearned: increment(correct) },
        { merge: true },
      )
      await updateDoc(doc(db, 'users', user.uid), {
        tasksCompleted: increment(1),
        totalWords: increment(correct),
      })

      // Save best score to leaderboard
      const entryRef = doc(db, 'leaderboard', wordset.id, 'entries', user.uid)
      const existing = await getDoc(entryRef)
      if (!existing.exists() || (existing.data().bestPercent ?? 0) < percent) {
        await setDoc(entryRef, { userId: user.uid, displayName, bestPercent: percent })
      }

      // Fetch leaderboard
      const lbSnap = await getDocs(collection(db, 'leaderboard', wordset.id, 'entries'))
      const leaderboard: LeaderboardEntry[] = lbSnap.docs
        .map((d) => d.data() as LeaderboardEntry)
        .sort((a, b) => b.bestPercent - a.bestPercent)

      await onRefresh()
      setStage({ kind: 'results', wordset, words, correct, leaderboard })
    } catch (err) {
      console.error('[handleComplete]', err)
      setStage({ kind: 'selector', wordset, words })
    }
  }

  // ── Library ───────────────────────────────────────────────
  if (stage.kind === 'library') {
    return (
      <div className="tab-page">
        <header className="page-header"><h2>Gyakorlás</h2></header>
        <div className="scroll-column">
          <div className="search-row">
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍  Keresés..."
            />
          </div>

          {allLangs.length > 0 && (
            <div className="lang-filter-row">
              <button
                className={`lang-chip${langFilter === 'all' ? ' lang-chip--active' : ''}`}
                onClick={() => setLangFilter('all')}
              >
                Összes
              </button>
              {allLangs.map((l) => (
                <button
                  key={l}
                  className={`lang-chip${langFilter === l ? ' lang-chip--active' : ''}`}
                  onClick={() => setLangFilter(l)}
                >
                  {langFlag(l)} {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {wordsLoading && <p className="muted" style={{ textAlign: 'center' }}>Betöltés...</p>}

          {filtered.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
              {search || langFilter !== 'all' ? 'Nincs találat.' : 'Még nincs szókészleted.'}
            </p>
          ) : (
            <ul className="wordset-cards">
              {filtered.map((ws) => {
                const isOwn = ws.userId === user.uid
                return (
                <li key={ws.id}>
                  <button className="wordset-card-btn full" onClick={() => selectWordset(ws)}>
                    <div className="wordset-card-info">
                      <strong>{ws.title}</strong>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="lang-badge">
                          {langFlag(ws.sourceLang)} {ws.sourceLang.toUpperCase()} → {langFlag(ws.targetLang)} {ws.targetLang.toUpperCase()}
                        </span>
                        {!isOwn && <span className="community-badge">👥 Közösségi</span>}
                      </div>
                    </div>
                    <div className="wordset-card-meta">
                      <span>{ws.wordCount} szó</span>
                      <span className="chevron">›</span>
                    </div>
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // ── Selector ──────────────────────────────────────────────
  if (stage.kind === 'selector') {
    const { wordset, words } = stage
    const from = direction === 'src' ? wordset.sourceLang : wordset.targetLang
    const to = direction === 'src' ? wordset.targetLang : wordset.sourceLang

    return (
      <div className="tab-page">
        <header className="page-header">
          <button className="btn-ghost back-btn" onClick={() => setStage({ kind: 'library' })}>← Vissza</button>
          <h3>{wordset.title}</h3>
        </header>
        <div className="scroll-column">
          <section className="card">
            <p className="eyebrow">Irány</p>
            <div className="direction-radios">
              {(['src', 'tgt'] as PracticeDirection[]).map((dir) => {
                const f = dir === 'src' ? wordset.sourceLang : wordset.targetLang
                const t = dir === 'src' ? wordset.targetLang : wordset.sourceLang
                return (
                  <label key={dir} className={`direction-radio${direction === dir ? ' direction-radio--active' : ''}`}>
                    <input
                      type="radio"
                      name="direction"
                      value={dir}
                      checked={direction === dir}
                      onChange={() => setDirection(dir)}
                    />
                    <span>{langFlag(f)} {f.toUpperCase()} → {langFlag(t)} {t.toUpperCase()}</span>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="card">
            <p className="eyebrow">Mód — {langFlag(from)} {from.toUpperCase()} → {langFlag(to)} {to.toUpperCase()}</p>
            <div className="mode-grid">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className="mode-card"
                  onClick={() => startPractice(wordset, words, m.id)}
                  disabled={wordsLoading}
                >
                  <span className="mode-icon">{m.icon}</span>
                  <span className="mode-label">{m.label}</span>
                  <span className="mode-desc muted">{m.desc}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────
  if (stage.kind === 'results') {
    const { wordset, words, correct, leaderboard } = stage
    const percent = Math.round((correct / words.length) * 100)

    return (
      <div className="tab-page">
        <header className="page-header">
          <button className="btn-ghost back-btn" onClick={() => setStage({ kind: 'selector', wordset, words })}>
            ← Vissza
          </button>
          <h3>{wordset.title}</h3>
        </header>
        <div className="scroll-column">
          <div className="results-screen results-screen--inline">
            <div className="results-icon">🎉</div>
            <p className="results-score">{percent}%</p>
            <p className="muted">{correct}/{words.length} helyes válasz</p>
            <div className="results-bar-wrap" style={{ width: '100%' }}>
              <div className="results-bar" style={{ width: `${percent}%` }} />
            </div>
          </div>

          {leaderboard.length > 0 && (
            <section className="glass">
              <p className="eyebrow">🏆 Ranglista</p>
              <ul className="leaderboard-list">
                {leaderboard.map((entry, i) => (
                  <li
                    key={entry.userId}
                    className={`leaderboard-item${entry.userId === user.uid ? ' leaderboard-item--me' : ''}`}
                  >
                    <span className="lb-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="lb-name">{entry.displayName}</span>
                    <span className="lb-percent">{entry.bestPercent}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button className="btn-primary" onClick={() => setStage({ kind: 'selector', wordset, words })}>
            Újra próbálom
          </button>
          <button className="btn-ghost" onClick={() => setStage({ kind: 'library' })}>
            Szókészlet választó
          </button>
        </div>
      </div>
    )
  }

  // ── Practicing ────────────────────────────────────────────
  const { wordset, mode, words } = stage

  const modeProps = {
    words,
    direction: stage.direction,
    onComplete: (correct: number, total?: number) => handleComplete(correct, wordset, words, total),
  }

  return (
    <div className="tab-page practice-active">
      <header className="page-header">
        <button className="btn-ghost back-btn" onClick={() => setStage({ kind: 'selector', wordset, words })}>
          ← {wordset.title}
        </button>
        <span className="practice-mode-badge">
          {MODES.find((m) => m.id === mode)?.icon} {MODES.find((m) => m.id === mode)?.label}
        </span>
      </header>
      {mode === 'flashcard' && <FlashcardMode {...modeProps} />}
      {mode === 'quiz' && <QuizMode {...modeProps} />}
      {mode === 'match' && <MatchPairsMode {...modeProps} />}
      {mode === 'write' && <WriteMode {...modeProps} />}
    </div>
  )
}
