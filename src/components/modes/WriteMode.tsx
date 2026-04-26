import { useEffect, useRef, useState } from 'react'
import type { Word, PracticeDirection } from '../../types.ts'

type Props = {
  words: Word[]
  direction: PracticeDirection
  onComplete: (correct: number) => void
}

type AnswerState = 'asking' | 'correct' | 'wrong'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function WriteMode({ words, direction, onComplete }: Props) {
  const [queue, setQueue] = useState<Word[]>(() => shuffle(words))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [answerState, setAnswerState] = useState<AnswerState>('asking')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [mastered, setMastered] = useState(0)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (answerState === 'asking') inputRef.current?.focus()
  }, [answerState, idx])

  const current = queue[idx]
  const prompt = direction === 'src' ? current.source : current.target
  const answer = direction === 'src' ? current.target : current.source
  const total = words.length

  function handleSubmit() {
    if (answerState !== 'asking' || !input.trim()) return

    if (input.trim().toLowerCase() === answer.toLowerCase()) {
      setAnswerState('correct')
      setMastered((m) => m + 1)
      setInput('')
      setTimeout(() => {
        setAnswerState('asking')
        if (idx + 1 >= queue.length) {
          setDone(true)
        } else {
          setIdx((i) => i + 1)
        }
      }, 900)
    } else {
      setAnswerState('wrong')
      setCorrectAnswer(answer)
      setQueue((q) => [...q, q[idx]])
      setInput('')
      setTimeout(() => {
        setAnswerState('asking')
        setIdx((i) => i + 1)
      }, 1500)
    }
  }

  if (done) {
    return (
      <div className="results-screen">
        <div className="results-icon">✍️</div>
        <h3>Kész!</h3>
        <p className="results-score">{mastered}/{total}</p>
        <p className="muted">elsajátított szó</p>
        <div className="results-bar-wrap">
          <div className="results-bar results-bar--amber" style={{ width: `${(mastered / total) * 100}%` }} />
        </div>
        <button className="btn-primary" onClick={() => onComplete(mastered)}>Befejezés</button>
      </div>
    )
  }

  return (
    <div className="practice-mode">
      <div className="practice-progress-bar">
        <div className="practice-progress-fill practice-progress-fill--amber" style={{ width: `${(mastered / total) * 100}%` }} />
      </div>
      <p className="practice-counter muted">{mastered} / {total} elsajátítva</p>

      <div className="quiz-prompt-card">
        <span className="card-lang-hint">írd le</span>
        <span className="card-word">{prompt}</span>
      </div>

      {answerState === 'correct' && (
        <div className="feedback-banner feedback-banner--correct">✓ Helyes!</div>
      )}
      {answerState === 'wrong' && (
        <div className="feedback-banner feedback-banner--wrong">
          ✗ Helytelen — a helyes válasz: <strong>{correctAnswer}</strong>
        </div>
      )}

      <div className="write-area">
        <input
          ref={inputRef}
          className="write-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="Írd be a fordítást..."
          disabled={answerState !== 'asking'}
        />
        <button className="btn-primary" onClick={handleSubmit} disabled={answerState !== 'asking'}>
          Ellenőrzés
        </button>
      </div>
    </div>
  )
}
