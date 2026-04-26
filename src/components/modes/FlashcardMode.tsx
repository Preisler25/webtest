import { useState } from 'react'
import type { Word, PracticeDirection } from '../../types.ts'

type Props = {
  words: Word[]
  direction: PracticeDirection
  onComplete: (correct: number) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FlashcardMode({ words, direction, onComplete }: Props) {
  const [deck] = useState(() => shuffle(words))
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [done, setDone] = useState(false)

  const current = deck[idx]
  const front = direction === 'src' ? current.source : current.target
  const back = direction === 'src' ? current.target : current.source

  function advance(wasCorrect: boolean) {
    const nextCorrect = wasCorrect ? correct + 1 : correct
    setSwipeDir(wasCorrect ? 'right' : 'left')
    setTimeout(() => {
      setSwipeDir(null)
      setFlipped(false)
      if (idx + 1 >= deck.length) {
        setDone(true)
        setCorrect(nextCorrect)
      } else {
        setIdx((i) => i + 1)
        if (wasCorrect) setCorrect((c) => c + 1)
      }
    }, 320)
  }

  if (done) {
    return (
      <div className="results-screen">
        <div className="results-icon">🎉</div>
        <h3>Kész!</h3>
        <p className="results-score">{correct}/{deck.length}</p>
        <p className="muted">helyes válasz</p>
        <div className="results-bar-wrap">
          <div className="results-bar" style={{ width: `${(correct / deck.length) * 100}%` }} />
        </div>
        <button className="btn-primary" onClick={() => onComplete(correct)}>Befejezés</button>
      </div>
    )
  }

  return (
    <div className="practice-mode">
      <div className="practice-progress-bar">
        <div className="practice-progress-fill" style={{ width: `${(idx / deck.length) * 100}%` }} />
      </div>
      <p className="practice-counter muted">{idx + 1} / {deck.length}</p>

      <div
        className={`flashcard-wrapper${swipeDir ? ` swipe-${swipeDir}` : ''}`}
        onClick={() => !swipeDir && setFlipped((f) => !f)}
      >
        <div className={`flashcard${flipped ? ' flipped' : ''}`}>
          <div className="flashcard-face flashcard-front">
            <span className="card-lang-hint">{direction === 'src' ? 'forrás' : 'cél'}</span>
            <span className="card-word">{front}</span>
          </div>
          <div className="flashcard-face flashcard-back">
            <span className="card-lang-hint">{direction === 'src' ? 'cél' : 'forrás'}</span>
            <span className="card-word">{back}</span>
          </div>
        </div>
      </div>

      {!flipped ? (
        <p className="flip-hint muted">Koppints a fordítás megtekintéséhez</p>
      ) : (
        <div className="answer-buttons">
          <button className="btn-wrong" onClick={() => advance(false)}>✗ Nem tudtam</button>
          <button className="btn-correct" onClick={() => advance(true)}>✓ Tudtam</button>
        </div>
      )}
    </div>
  )
}
