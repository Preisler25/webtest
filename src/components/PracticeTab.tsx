import { useState } from 'react'
import type { User } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase.ts'
import type { Wordset, Word, PracticeMode, PracticeDirection } from '../types.ts'
import FlashcardMode from './modes/FlashcardMode.tsx'
import QuizMode from './modes/QuizMode.tsx'
import MatchPairsMode from './modes/MatchPairsMode.tsx'
import WriteMode from './modes/WriteMode.tsx'

type Props = {
  user: User
  wordsets: Wordset[]
  onRefresh: () => Promise<void>
}

type Stage =
  | { kind: 'library' }
  | { kind: 'selector'; wordset: Wordset }
  | { kind: 'practicing'; wordset: Wordset; mode: PracticeMode; direction: PracticeDirection; words: Word[] }

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

export default function PracticeTab({ user, wordsets, onRefresh }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'library' })
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState<string>('all')
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
      if (words.length < 2) {
        alert('Legalább 2 szó kell a gyakorláshoz.')
        return
      }
      setStage({ kind: 'selector', wordset })
    } catch (err) {
      console.error(err)
    } finally {
      setWordsLoading(false)
    }
  }

  async function startPractice(
    wordset: Wordset,
    mode: PracticeMode,
    direction: PracticeDirection,
  ) {
    setWordsLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'wordsets', wordset.id, 'words'), orderBy('source')),
      )
      const words = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Word, 'id'>) }))
      setStage({ kind: 'practicing', wordset, mode, direction, words })
    } catch (err) {
      console.error(err)
    } finally {
      setWordsLoading(false)
    }
  }

  async function handleComplete(correct: number, wordset: Wordset) {
    const today = new Date().toISOString().slice(0, 10)
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
      await onRefresh()
    } catch (err) {
      console.error('[handleComplete]', err)
    }
    setStage({ kind: 'selector', wordset })
  }

  // ── Library ──────────────────────────────────────────────
  if (stage.kind === 'library') {
    return (
      <div className="tab-page">
        <header className="page-header">
          <h2>Gyakorlás</h2>
        </header>
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
              {filtered.map((ws) => (
                <li key={ws.id}>
                  <button className="wordset-card-btn full" onClick={() => selectWordset(ws)}>
                    <div className="wordset-card-info">
                      <strong>{ws.title}</strong>
                      <span className="lang-badge">{langFlag(ws.sourceLang)} {ws.sourceLang.toUpperCase()} → {langFlag(ws.targetLang)} {ws.targetLang.toUpperCase()}</span>
                    </div>
                    <div className="wordset-card-meta">
                      <span>{ws.wordCount} szó</span>
                      <span className="chevron">›</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // ── Selector ──────────────────────────────────────────────
  if (stage.kind === 'selector') {
    const { wordset } = stage
    return (
      <div className="tab-page">
        <header className="page-header">
          <button className="btn-ghost back-btn" onClick={() => setStage({ kind: 'library' })}>← Vissza</button>
          <h3>{wordset.title}</h3>
        </header>
        <div className="scroll-column">
          <section className="card">
            <p className="eyebrow">Irány</p>
            <div className="direction-row">
              {(['src', 'tgt'] as PracticeDirection[]).map((dir) => (
                <DirectionCard
                  key={dir}
                  direction={dir}
                  wordset={wordset}
                  onSelect={(mode) => startPractice(wordset, mode, dir)}
                  wordsLoading={wordsLoading}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  // ── Practicing ──────────────────────────────────────────────
  const { wordset, mode, direction, words } = stage

  const modeProps = {
    words,
    direction,
    onComplete: (correct: number) => handleComplete(correct, wordset),
  }

  return (
    <div className="tab-page practice-active">
      <header className="page-header">
        <button className="btn-ghost back-btn" onClick={() => setStage({ kind: 'selector', wordset })}>
          ← {wordset.title}
        </button>
        <span className="practice-mode-badge">{MODES.find((m) => m.id === mode)?.icon} {MODES.find((m) => m.id === mode)?.label}</span>
      </header>
      {mode === 'flashcard' && <FlashcardMode {...modeProps} />}
      {mode === 'quiz' && <QuizMode {...modeProps} />}
      {mode === 'match' && <MatchPairsMode {...modeProps} />}
      {mode === 'write' && <WriteMode {...modeProps} />}
    </div>
  )
}

function DirectionCard({
  direction,
  wordset,
  onSelect,
  wordsLoading,
}: {
  direction: PracticeDirection
  wordset: Wordset
  onSelect: (mode: PracticeMode) => void
  wordsLoading: boolean
}) {
  const from = direction === 'src' ? wordset.sourceLang : wordset.targetLang
  const to = direction === 'src' ? wordset.targetLang : wordset.sourceLang

  return (
    <div className="direction-block">
      <div className="direction-label">
        <span className="lang-badge">{langFlag(from)} {from.toUpperCase()} → {langFlag(to)} {to.toUpperCase()}</span>
      </div>
      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="mode-card"
            onClick={() => onSelect(m.id)}
            disabled={wordsLoading}
          >
            <span className="mode-icon">{m.icon}</span>
            <span className="mode-label">{m.label}</span>
            <span className="mode-desc muted">{m.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
