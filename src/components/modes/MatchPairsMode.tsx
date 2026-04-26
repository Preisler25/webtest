import { useEffect, useState } from 'react'
import type { Word, PracticeDirection } from '../../types.ts'

type Props = {
  words: Word[]
  direction: PracticeDirection
  onComplete: (correct: number) => void
}

type CellState = 'normal' | 'selected' | 'matched' | 'wrong'
type MatchItem = { wordId: string; text: string; state: CellState }

const BATCH = 6

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildBatch(batch: Word[], direction: PracticeDirection) {
  const left: MatchItem[] = batch.map((w) => ({
    wordId: w.id,
    text: direction === 'src' ? w.source : w.target,
    state: 'normal',
  }))
  const right: MatchItem[] = shuffle(
    batch.map((w) => ({
      wordId: w.id,
      text: direction === 'src' ? w.target : w.source,
      state: 'normal' as CellState,
    })),
  )
  return { left, right }
}

export default function MatchPairsMode({ words, direction, onComplete }: Props) {
  const [shuffled] = useState(() => shuffle(words))
  const [batchStart, setBatchStart] = useState(0)
  const [left, setLeft] = useState<MatchItem[]>([])
  const [right, setRight] = useState<MatchItem[]>([])
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const batch = shuffled.slice(batchStart, batchStart + BATCH)
    const { left: l, right: r } = buildBatch(batch, direction)
    setLeft(l)
    setRight(r)
    setSelectedLeftId(null)
  }, [batchStart, shuffled, direction])

  function handleLeft(wordId: string) {
    if (left.find((i) => i.wordId === wordId)?.state === 'matched') return
    setSelectedLeftId((prev) => (prev === wordId ? null : wordId))
    setLeft((l) =>
      l.map((i) =>
        i.wordId === wordId
          ? { ...i, state: 'selected' }
          : i.state === 'selected'
            ? { ...i, state: 'normal' }
            : i,
      ),
    )
  }

  function handleRight(wordId: string) {
    if (!selectedLeftId) return
    const rightItem = right.find((i) => i.wordId === wordId)
    if (!rightItem || rightItem.state === 'matched') return

    const isMatch = wordId === selectedLeftId

    if (isMatch) {
      const nextCorrect = totalCorrect + 1
      setTotalCorrect(nextCorrect)
      setLeft((l) => l.map((i) => (i.wordId === selectedLeftId ? { ...i, state: 'matched' } : i)))
      setRight((r) => r.map((i) => (i.wordId === wordId ? { ...i, state: 'matched' } : i)))
      setSelectedLeftId(null)

      const allMatched = left.every((i) => i.wordId === selectedLeftId || i.state === 'matched')
      if (allMatched) {
        setTimeout(() => {
          const nextStart = batchStart + BATCH
          if (nextStart >= shuffled.length) {
            setDone(true)
          } else {
            setBatchStart(nextStart)
          }
        }, 500)
      }
    } else {
      setLeft((l) => l.map((i) => (i.wordId === selectedLeftId ? { ...i, state: 'wrong' } : i)))
      setRight((r) => r.map((i) => (i.wordId === wordId ? { ...i, state: 'wrong' } : i)))
      setTimeout(() => {
        setLeft((l) =>
          l.map((i) => (i.state === 'wrong' ? { ...i, state: 'normal' } : i)),
        )
        setRight((r) =>
          r.map((i) => (i.state === 'wrong' ? { ...i, state: 'normal' } : i)),
        )
        setSelectedLeftId(null)
      }, 700)
    }
  }

  if (done) {
    return (
      <div className="results-screen">
        <div className="results-icon">⚡</div>
        <h3>Kész!</h3>
        <p className="results-score">{totalCorrect}/{shuffled.length}</p>
        <p className="muted">egyeztetett pár</p>
        <div className="results-bar-wrap">
          <div className="results-bar results-bar--violet" style={{ width: `${(totalCorrect / shuffled.length) * 100}%` }} />
        </div>
        <button className="btn-primary" onClick={() => onComplete(totalCorrect)}>Befejezés</button>
      </div>
    )
  }

  const batchEnd = Math.min(batchStart + BATCH, shuffled.length)

  return (
    <div className="practice-mode">
      <div className="practice-progress-bar">
        <div className="practice-progress-fill practice-progress-fill--violet" style={{ width: `${(batchStart / shuffled.length) * 100}%` }} />
      </div>
      <p className="practice-counter muted">{batchStart + 1}–{batchEnd} / {shuffled.length}</p>

      <div className="match-grid">
        <div className="match-col">
          {left.map((item) => (
            <button
              key={item.wordId}
              className={`match-cell match-cell--${item.state}`}
              onClick={() => handleLeft(item.wordId)}
            >
              {item.text}
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((item) => (
            <button
              key={item.wordId}
              className={`match-cell match-cell--${item.state}`}
              onClick={() => handleRight(item.wordId)}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
