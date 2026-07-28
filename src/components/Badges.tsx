import type { Difficulty, LessonType } from '../data/types'

const difficultyStyles: Record<Difficulty, string> = {
  入门: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  进阶: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  高级: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  专家: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

const typeStyles: Record<LessonType, string> = {
  理论: 'bg-ink-700/50 text-ink-200 border-ink-600/50',
  实战: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  复盘: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
}

const typeIcon: Record<LessonType, string> = {
  理论: '📖',
  实战: '⚙️',
  复盘: '🔍',
}

export function DifficultyBadge({ level }: { level: Difficulty }) {
  return (
    <span className={`chip border ${difficultyStyles[level]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
    </span>
  )
}

export function LessonTypeBadge({ type }: { type: LessonType }) {
  return (
    <span className={`chip border ${typeStyles[type]}`}>
      <span>{typeIcon[type]}</span>
      {type}
    </span>
  )
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-ink-800/80 px-2 py-0.5 font-mono text-[11px] text-ink-300">
      {children}
    </span>
  )
}
