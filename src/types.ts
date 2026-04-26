import type { User } from 'firebase/auth'

export type Tab = 'home' | 'wordsets' | 'practice' | 'profile'

export type UserProfile = {
  email: string
  displayName: string
  tasksCompleted: number
  totalWords: number
  createdAt?: unknown
}

export type UserActivity = {
  id: string
  date: string
  tasksCount: number
  wordsLearned: number
}

export type Wordset = {
  id: string
  userId: string
  title: string
  isPublic: boolean
  sourceLang: string
  targetLang: string
  wordCount: number
  createdAt?: unknown
}

export type Word = {
  id: string
  source: string
  target: string
  mastered: boolean
}

export type PracticeMode = 'flashcard' | 'quiz' | 'match' | 'write'
export type PracticeDirection = 'src' | 'tgt'

export type TabProps = {
  user: User
  profile: UserProfile | null
  wordsets: Wordset[]
  activity: UserActivity[]
  onRefresh: () => Promise<void>
}
