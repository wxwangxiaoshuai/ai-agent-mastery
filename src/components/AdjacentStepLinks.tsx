import { Link } from 'react-router-dom'
import type { NavTarget } from '../lib/curriculumNav'
import { navEyebrow, navPath, navTitle } from '../lib/curriculumNav'

interface AdjacentStepLinksProps {
  currentModuleId: number
  prev: NavTarget | null
  next: NavTarget | null
  /** 下一节尚未完成时显示「跳过 ·」前缀 */
  nextSkipHint?: boolean
}

export function AdjacentStepLinks({
  currentModuleId,
  prev,
  next,
  nextSkipHint = false,
}: AdjacentStepLinksProps) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      {prev ? (
        <Link
          to={navPath(prev)}
          className="group flex min-w-0 max-w-[48%] items-center gap-2 text-sm text-ink-400 transition-colors hover:text-brand-400"
        >
          <span className="shrink-0 text-lg">←</span>
          <div className="min-w-0">
            <div className="text-[11px] text-ink-500">
              {navEyebrow(prev, currentModuleId, 'prev')}
            </div>
            <div className="truncate font-medium text-ink-200 group-hover:text-brand-300">
              {navTitle(prev)}
            </div>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          to={navPath(next)}
          className="group flex min-w-0 max-w-[48%] items-center gap-2 text-right text-sm text-ink-400 transition-colors hover:text-brand-400"
        >
          <div className="min-w-0">
            <div className="text-[11px] text-ink-500">
              {nextSkipHint ? '跳过 · ' : ''}
              {navEyebrow(next, currentModuleId, 'next')}
            </div>
            <div className="truncate font-medium text-ink-200 group-hover:text-brand-300">
              {navTitle(next)}
            </div>
          </div>
          <span className="shrink-0 text-lg">→</span>
        </Link>
      ) : (
        <Link
          to="/curriculum"
          className="text-sm text-ink-400 transition-colors hover:text-brand-400"
        >
          返回课程大纲 →
        </Link>
      )}
    </div>
  )
}
