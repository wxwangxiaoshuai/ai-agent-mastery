import { curriculum } from '../data/curriculum'
import type { Module, Lesson, Project } from '../data/types'

export type NavTarget =
  | { kind: 'lesson'; module: Module; lesson: Lesson }
  | { kind: 'project'; module: Module; project: Project }
  | { kind: 'module'; module: Module }

export function getAdjacentModules(moduleId: number): {
  prev: Module | null
  next: Module | null
  index: number
} {
  const index = curriculum.modules.findIndex((m) => m.id === moduleId)
  if (index === -1) return { prev: null, next: null, index: -1 }
  return {
    prev: index > 0 ? curriculum.modules[index - 1] : null,
    next: index < curriculum.modules.length - 1 ? curriculum.modules[index + 1] : null,
    index,
  }
}

export function navPath(target: NavTarget): string {
  switch (target.kind) {
    case 'lesson':
      return `/curriculum/${target.module.id}/${target.lesson.id}`
    case 'project':
      return `/curriculum/${target.module.id}/project/${target.project.id.toLowerCase()}`
    case 'module':
      return `/curriculum/${target.module.id}`
  }
}

/** 模块内学习链的末项：有项目则项目，否则最后一节课 */
export function moduleTail(module: Module): NavTarget {
  if (module.project) {
    return { kind: 'project', module, project: module.project }
  }
  const last = module.lessons[module.lessons.length - 1]
  return { kind: 'lesson', module, lesson: last }
}

/** 模块学习链的首项：第一节课 */
export function moduleHead(module: Module): NavTarget {
  return { kind: 'lesson', module, lesson: module.lessons[0] }
}

/**
 * 课节两侧导航：同模块内相邻课；首节可回到上一模块末项；
 * 末节可前进到本模块项目或下一模块首节。
 */
export function getLessonNeighbors(
  module: Module,
  lessonIndex: number,
): { prev: NavTarget | null; next: NavTarget | null } {
  const { prev: prevMod, next: nextMod } = getAdjacentModules(module.id)

  let prev: NavTarget | null = null
  if (lessonIndex > 0) {
    prev = { kind: 'lesson', module, lesson: module.lessons[lessonIndex - 1] }
  } else if (prevMod) {
    prev = moduleTail(prevMod)
  }

  let next: NavTarget | null = null
  if (lessonIndex < module.lessons.length - 1) {
    next = { kind: 'lesson', module, lesson: module.lessons[lessonIndex + 1] }
  } else if (module.project) {
    next = { kind: 'project', module, project: module.project }
  } else if (nextMod) {
    next = moduleHead(nextMod)
  }

  return { prev, next }
}

/** 项目页两侧：上一节为本模块最后一课；下一节为下一模块首节 */
export function getProjectNeighbors(module: Module): {
  prev: NavTarget | null
  next: NavTarget | null
} {
  const { next: nextMod } = getAdjacentModules(module.id)
  const lastLesson = module.lessons[module.lessons.length - 1]
  return {
    prev: lastLesson
      ? { kind: 'lesson', module, lesson: lastLesson }
      : null,
    next: nextMod ? moduleHead(nextMod) : null,
  }
}

export function navTitle(target: NavTarget): string {
  switch (target.kind) {
    case 'lesson':
      return target.lesson.title
    case 'project':
      return target.project.title
    case 'module':
      return target.module.title
  }
}

/** 跨模块时显示模块前缀，同模块内不重复 */
export function navEyebrow(
  target: NavTarget,
  currentModuleId: number,
  direction: 'prev' | 'next',
): string {
  const cross = target.module.id !== currentModuleId
  if (target.kind === 'project') {
    return direction === 'next' ? '下一站 · 实战项目' : '上一站 · 实战项目'
  }
  if (cross) {
    return direction === 'next'
      ? `下一模块 · M${String(target.module.id).padStart(2, '0')}`
      : `上一模块 · M${String(target.module.id).padStart(2, '0')}`
  }
  return direction === 'next' ? '下一节' : '上一节'
}
