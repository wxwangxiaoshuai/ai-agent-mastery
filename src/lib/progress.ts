import type { Curriculum, Module } from '../data/types'

export const PROGRESS_STORAGE_KEY = 'ai-agent-course-progress'

export interface LastVisited {
  moduleId: number
  lessonId?: string
  projectId?: string
  at: string
}

export interface LearningProgress {
  version: 1
  completedLessons: string[]
  completedProjects: string[]
  lastVisited: LastVisited | null
  updatedAt: string
}

export interface ProgressCount {
  done: number
  total: number
  percent: number
}

export function emptyProgress(): LearningProgress {
  return {
    version: 1,
    completedLessons: [],
    completedProjects: [],
    lastVisited: null,
    updatedAt: new Date().toISOString(),
  }
}

function isValidProgress(value: unknown): value is LearningProgress {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    Array.isArray(v.completedLessons) &&
    Array.isArray(v.completedProjects) &&
    (v.lastVisited === null || typeof v.lastVisited === 'object') &&
    typeof v.updatedAt === 'string'
  )
}

export function loadProgress(): LearningProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed: unknown = JSON.parse(raw)
    if (!isValidProgress(parsed)) return emptyProgress()
    return {
      version: 1,
      completedLessons: parsed.completedLessons.filter((id): id is string => typeof id === 'string'),
      completedProjects: parsed.completedProjects.filter((id): id is string => typeof id === 'string'),
      lastVisited: parsed.lastVisited,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(progress: LearningProgress): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  } catch {
    /* ignore quota / private mode errors */
  }
}

export function isLessonDone(progress: LearningProgress, lessonId: string): boolean {
  return progress.completedLessons.includes(lessonId)
}

export function isProjectDone(progress: LearningProgress, projectId: string): boolean {
  return progress.completedProjects.includes(projectId)
}

export function moduleProgress(module: Module, progress: LearningProgress): ProgressCount {
  const lessonDone = module.lessons.filter((l) => isLessonDone(progress, l.id)).length
  const hasProject = Boolean(module.project)
  const projectDone =
    hasProject && module.project && isProjectDone(progress, module.project.id) ? 1 : 0
  const done = lessonDone + projectDone
  const total = module.lessons.length + (hasProject ? 1 : 0)
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent }
}

export function overallProgress(
  curriculum: Curriculum,
  progress: LearningProgress,
): ProgressCount {
  let done = 0
  let total = 0
  for (const mod of curriculum.modules) {
    const mp = moduleProgress(mod, progress)
    done += mp.done
    total += mp.total
  }
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent }
}

/** Lesson-only overall count (for compact header display like 12/91). */
export function lessonOverallProgress(
  curriculum: Curriculum,
  progress: LearningProgress,
): ProgressCount {
  const total = curriculum.modules.reduce((s, m) => s + m.lessons.length, 0)
  const done = progress.completedLessons.filter((id) =>
    curriculum.modules.some((m) => m.lessons.some((l) => l.id === id)),
  ).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent }
}

export function getContinuePath(progress: LearningProgress): string | null {
  const lv = progress.lastVisited
  if (!lv) return null
  if (lv.projectId) {
    return `/curriculum/${lv.moduleId}/project/${lv.projectId.toLowerCase()}`
  }
  if (lv.lessonId) {
    return `/curriculum/${lv.moduleId}/${lv.lessonId}`
  }
  return `/curriculum/${lv.moduleId}`
}

export function hasStarted(progress: LearningProgress): boolean {
  return (
    progress.completedLessons.length > 0 ||
    progress.completedProjects.length > 0 ||
    progress.lastVisited !== null
  )
}
