import { useMemo, useState } from 'react'
import type { Word, PracticeDirection } from '../../types.ts'

type Props = {
  words: Word[]
  direction: PracticeDirection
  onComplete: (correct: number, total?: number) => void
}

type Question = { prompt: string; answer: string; options: string[] }
type OptionState = 'normal' | 'correct' | 'wrong' | 'faded'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildQuestions(words: Word[], direction: PracticeDirection): Question[] {
  return shuffle(
    words.map((w) => {
      const prompt = direction === 'src' ? w.source : w.target
      const answer = direction === 'src' ? w.target : w.source
      const distractors = shuffle(
        words.filter((x) => x.id !== w.id).map((x) => (direction === 'src' ? x.target : x.source)),
      ).slice(0, 3)
      return { prompt, answer, options: shuffle([answer, ...distractors]) }
    }),
  )
}

export default function QuizMode({ words, direction, onComplete }: Props) {
  const questions = useMemo(() => buildQuestions(words, direction), [words, direction])
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[idx]

  function optionState(opt: string): OptionState {
    if (!selected) return 'normal'
    if (opt === q.answer) return 'correct'
    if (opt === selected) return 'wrong'
    return 'faded'
  }

  function handleSelect(opt: string) {
    if (selected) return
    setSelected(opt)
    const wasCorrect = opt === q.answer
    if (wasCorrect) setCorrect((c) => c + 1)

    setTimeout(() => {
      setSelected(null)
      if (idx + 1 >= questions.length) {
        setDone(true)
      } else {
        setIdx((i) => i + 1)
      }
    }, 1200)
  }

  if (done) {
    return (
      <div className="results-screen">
        <div className="results-icon">🏆</div>
        <h3>Kész!</h3>
        <p className="results-score">{correct}/{questions.length}</p>
        <p className="muted">helyes válasz</p>
        <div className="results-bar-wrap">
          <div className="results-bar" style={{ width: `${(correct / questions.length) * 100}%` }} />
        </div>
        <button className="btn-primary" onClick={() => onComplete(correct)}>Befejezés</button>
      </div>
    )
  }

  return (
    <div className="practice-mode">
      <div className="practice-progress-bar">
        <div className="practice-progress-fill practice-progress-fill--coral" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <p className="practice-counter muted">{idx + 1} / {questions.length}</p>

      <div className="quiz-prompt-card">
        <span className="card-lang-hint">fordítsd le</span>
        <span className="card-word">{q.prompt}</span>
      </div>

      <div className="quiz-options">
        {q.options.map((opt) => (
          <button
            key={opt}
            className={`quiz-option quiz-option--${optionState(opt)}`}
            onClick={() => handleSelect(opt)}
          >
            {optionState(opt) === 'correct' && <span>✓ </span>}
            {optionState(opt) === 'wrong' && <span>✗ </span>}
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
