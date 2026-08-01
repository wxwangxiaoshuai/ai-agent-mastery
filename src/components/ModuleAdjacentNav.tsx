import { Link } from 'react-router-dom'
import type { Module } from '../data/types'
import { getAdjacentModules, moduleHead, navPath } from '../lib/curriculumNav'

interface ModuleAdjacentNavProps {
  moduleId: number
  /** 链到下一模块时，直接进入首节课（学习流），否则进模块概览 */
  deepLink?: boolean
  /** 侧栏用：更紧凑，不展示「从第 X 节开始」副文案 */
  compact?: boolean
}

export function ModuleAdjacentNav({
  moduleId,
  deepLink = false,
  compact = false,
}: ModuleAdjacentNavProps) {
  const { prev, next } = getAdjacentModules(moduleId)
  if (!prev && !next) return null

  const pad = compact ? 'p-3' : 'p-4'
  const titleCls = compact ? 'mt-0.5 truncate text-xs font-medium text-ink-200' : 'mt-1 text-sm font-medium text-ink-200'

  return (
    <div className="grid gap-2">
      {prev && (
        <Link to={`/curriculum/${prev.id}`} className={`card card-hover ${pad}`}>
          <div className="text-[11px] text-ink-500">← 上一模块</div>
          <div className={titleCls}>
            {prev.icon} {prev.title}
          </div>
        </Link>
      )}
      {next && (
        <Link
          to={deepLink ? navPath(moduleHead(next)) : `/curriculum/${next.id}`}
          className={`card card-hover ${pad} text-right`}
        >
          <div className="text-[11px] text-ink-500">下一模块 →</div>
          <div className={titleCls}>
            {next.icon} {next.title}
          </div>
          {deepLink && !compact && (
            <div className="mt-1 truncate text-[11px] text-ink-500">
              从「{next.lessons[0]?.title}」开始
            </div>
          )}
        </Link>
      )}
    </div>
  )
}

interface ContinueLinkProps {
  module: Module
  className?: string
}

/** 模块学完后的主 CTA：优先下一模块首节，否则回大纲 */
export function ContinueToNextModule({ module, className }: ContinueLinkProps) {
  const { next } = getAdjacentModules(module.id)
  if (!next) {
    return (
      <Link to="/curriculum" className={className ?? 'btn-primary inline-flex'}>
        全部学完 · 查看大纲
        <span aria-hidden>→</span>
      </Link>
    )
  }
  const head = moduleHead(next)
  return (
    <Link to={navPath(head)} className={className ?? 'btn-primary inline-flex'}>
      进入下一模块
      <span aria-hidden>→</span>
    </Link>
  )
}
