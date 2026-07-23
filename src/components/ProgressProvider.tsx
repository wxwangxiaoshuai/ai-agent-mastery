import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  type LastVisited,
  type LearningProgress,
} from '../lib/progress'

interface ProgressContextValue {
  progress: LearningProgress
  markLessonComplete: (id: string) => void
  unmarkLessonComplete: (id: string) => void
  markProjectComplete: (id: string) => void
  unmarkProjectComplete: (id: string) => void
  setLastVisited: (visit: Omit<LastVisited, 'at'>) => void
  resetProgress: () => void
  isLessonComplete: (id: string) => boolean
  isProjectComplete: (id: string) => boolean
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

function persist(next: LearningProgress): LearningProgress {
  const stamped = { ...next, updatedAt: new Date().toISOString() }
  saveProgress(stamped)
  return stamped
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<LearningProgress>(() => loadProgress())

  const markLessonComplete = useCallback((id: string) => {
    setProgress((prev) => {
      if (prev.completedLessons.includes(id)) return prev
      return persist({
        ...prev,
        completedLessons: [...prev.completedLessons, id],
      })
    })
  }, [])

  const unmarkLessonComplete = useCallback((id: string) => {
    setProgress((prev) => {
      if (!prev.completedLessons.includes(id)) return prev
      return persist({
        ...prev,
        completedLessons: prev.completedLessons.filter((x) => x !== id),
      })
    })
  }, [])

  const markProjectComplete = useCallback((id: string) => {
    setProgress((prev) => {
      if (prev.completedProjects.includes(id)) return prev
      return persist({
        ...prev,
        completedProjects: [...prev.completedProjects, id],
      })
    })
  }, [])

  const unmarkProjectComplete = useCallback((id: string) => {
    setProgress((prev) => {
      if (!prev.completedProjects.includes(id)) return prev
      return persist({
        ...prev,
        completedProjects: prev.completedProjects.filter((x) => x !== id),
      })
    })
  }, [])

  const setLastVisited = useCallback((visit: Omit<LastVisited, 'at'>) => {
    setProgress((prev) =>
      persist({
        ...prev,
        lastVisited: { ...visit, at: new Date().toISOString() },
      }),
    )
  }, [])

  const resetProgress = useCallback(() => {
    const next = emptyProgress()
    saveProgress(next)
    setProgress(next)
  }, [])

  const isLessonComplete = useCallback(
    (id: string) => progress.completedLessons.includes(id),
    [progress.completedLessons],
  )

  const isProjectComplete = useCallback(
    (id: string) => progress.completedProjects.includes(id),
    [progress.completedProjects],
  )

  return (
    <ProgressContext.Provider
      value={{
        progress,
        markLessonComplete,
        unmarkLessonComplete,
        markProjectComplete,
        unmarkProjectComplete,
        setLastVisited,
        resetProgress,
        isLessonComplete,
        isProjectComplete,
      }}
    >
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) {
    throw new Error('useProgress must be used within a ProgressProvider')
  }
  return ctx
}
