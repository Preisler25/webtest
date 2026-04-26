import { useEffect, useRef, useState } from 'react'
import type { Word, PracticeDirection } from '../../types.ts'

type Props = {
  words: Word[]
  direction: PracticeDirection
  onComplete: (correct: number, total: number) => void
}

type Phase = 'setup' | 'practicing' | 'done'
type AnswerState = 'asking' | 'correct' | 'wrong'

type WordEntry = { word: Word; remaining: number }

const REP_OPTIONS = [1, 2, 3, 5, 10]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function WriteMode({ words, direction, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [repetitions, setRepetitions] = useState(3)

  const [pool, setPool] = useState<WordEntry[]>([])
  const [current, setCurrent] = useState<WordEntry | null>(null)
  const [input, setInput] = useState('')
  const [answerState, setAnswerState] = useState<AnswerState>('asking')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [wordsCompleted, setWordsCompleted] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase === 'practicing' && answerState === 'asking') inputRef.current?.focus()
  }, [phase, answerState, current])

  function startPractice() {
    const initial: WordEntry[] = words.map((w) => ({ word: w, remaining: repetitions }))
    setPool(initial)
    setCurrent(pickRandom(initial))
    setPhase('practicing')
    setInput('')
    setAnswerState('asking')
    setTotalCorrect(0)
    setTotalAnswered(0)
    setWordsCompleted(0)
  }

  function handleSubmit() {
    if (!current || answerState !== 'asking' || !input.trim()) return

    const answer = direction === 'src' ? current.word.target : current.word.source
    const isCorrect = input.trim().toLowerCase() === answer.toLowerCase()

    setTotalAnswered((n) => n + 1)
    setInput('')

    if (isCorrect) {
      setTotalCorrect((n) => n + 1)
      setAnswerState('correct')

      const newPool = pool.map((e) =>
        e.word.id === current.word.id ? { ...e, remaining: e.remaining - 1 } : e,
      )
      const completed = newPool.filter((e) => e.remaining === 0).length
      setWordsCompleted(completed)
      setPool(newPool)

      const active = newPool.filter((e) => e.remaining > 0)
      setTimeout(() => {
        setAnswerState('asking')
        if (active.length === 0) {
          setPhase('done')
        } else {
          setCurrent(pickRandom(active))
        }
      }, 900)
    } else {
      setAnswerState('wrong')
      setCorrectAnswer(answer)

      // Increase required count for this word by 1
      const newPool = pool.map((e) =>
        e.word.id === current.word.id ? { ...e, remaining: e.remaining + 1 } : e,
      )
      setPool(newPool)

      setTimeout(() => {
        setAnswerState('asking')
        setCurrent(pickRandom(newPool.filter((e) => e.remaining > 0)))
      }, 1500)
    }
  }

  // ── Setup ────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="practice-mode">
        <div className="write-setup">
          <div className="results-icon">✍️</div>
          <h3>Írás mód</h3>
          <p className="muted">Hányszor szeretnéd gyakorolni az egyes szavakat?</p>

          <div className="rep-selector">
            {REP_OPTIONS.map((n) => (
              <button
                key={n}
                className={`rep-btn${repetitions === n ? ' rep-btn--active' : ''}`}
                onClick={() => setRepetitions(n)}
              >
                {n}×
              </button>
            ))}
          </div>

          <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
            {words.length} szó × {repetitions} = minimum {words.length * repetitions} kérdés
            <br />
            <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>
              Rossz válasz esetén az adott szó +1 kört kap
            </span>
          </p>

          <button className="btn-primary" style={{ width: '100%' }} onClick={startPractice}>
            Kezdés
          </button>
        </div>
      </div>
    )
  }

  // ── Done ─────────────────────────────────────────────────
  if (phase === 'done') {
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
    return (
      <div className="results-screen">
        <div className="results-icon">✍️</div>
        <h3>Kész!</h3>
        <p className="results-score">{accuracy}%</p>
        <p className="muted">{totalCorrect}/{totalAnswered} helyes válasz</p>
        <div className="results-bar-wrap">
          <div className="results-bar results-bar--amber" style={{ width: `${accuracy}%` }} />
        </div>
        <button className="btn-primary" onClick={() => onComplete(totalCorrect, totalAnswered)}>
          Befejezés
        </button>
      </div>
    )
  }

  // ── Practicing ───────────────────────────────────────────
  const prompt = current ? (direction === 'src' ? current.word.source : current.word.target) : ''

  return (
    <div className="practice-mode">
      <div className="practice-progress-bar">
        <div
          className="practice-progress-fill practice-progress-fill--amber"
          style={{ width: `${(wordsCompleted / words.length) * 100}%` }}
        />
      </div>
      <p className="practice-counter muted">{wordsCompleted} / {words.length} szó kész</p>

      <div className="quiz-prompt-card">
        <span className="card-lang-hint">írd le</span>
        <span className="card-word">{prompt}</span>
        {current && (
          <span className="word-remaining-badge">
            {current.remaining}× maradt
          </span>
        )}
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
