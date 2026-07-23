import { Link, useParams } from 'react-router-dom'
import { curriculum } from '../data/curriculum'
import { DifficultyBadge, LessonTypeBadge, Tag } from '../components/Badges'
import { useProgress } from '../components/ProgressProvider'
import { moduleProgress } from '../lib/progress'

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const module = curriculum.modules.find((m) => m.id === Number(moduleId))
  const { progress, isLessonComplete, isProjectComplete } = useProgress()

  if (!module) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-ink-400">未找到该模块。</p>
        <Link to="/curriculum" className="btn-ghost mt-6">
          返回课程大纲
        </Link>
      </div>
    )
  }

  const idx = curriculum.modules.findIndex((m) => m.id === module.id)
  const prev = idx > 0 ? curriculum.modules[idx - 1] : null
  const next = idx < curriculum.modules.length - 1 ? curriculum.modules[idx + 1] : null

  const totalMin = module.lessons.reduce((s, l) => s + l.duration, 0)
  const mp = moduleProgress(module, progress)

  return (
    <div className="container-page py-12 sm:py-16">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/curriculum" className="hover:text-ink-200">
          课程大纲
        </Link>
        <span>/</span>
        <span className="text-ink-300">{module.title}</span>
      </nav>

      {/* Header */}
      <div className="card relative overflow-hidden p-8 sm:p-10">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-4xl">{module.icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              模块 {String(module.id).padStart(2, '0')}
            </span>
            <DifficultyBadge level={module.difficulty} />
            <span className="chip border border-ink-700 text-ink-300">
              ⏱ {module.hours}h · {totalMin}m 课程
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-50 sm:text-4xl">
            {module.title}
          </h1>
          <p className="mt-2 text-lg text-ink-300">{module.subtitle}</p>
          <p className="mt-5 max-w-3xl leading-relaxed text-ink-400">
            {module.description}
          </p>
          <div className="mt-6 max-w-md">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-ink-400">学习进度</span>
              <span className="font-mono text-ink-200">
                已完成 {mp.done}/{mp.total} · {mp.percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${mp.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Lessons */}
        <div>
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-ink-50">
            <span className="text-brand-400">●</span> 课程内容
            <span className="text-sm font-normal text-ink-500">
              （{module.lessons.length} 节）
            </span>
          </h2>
          <div className="space-y-4">
            {module.lessons.map((lesson, i) => {
              const lessonDone = isLessonComplete(lesson.id)
              return (
              <Link
                to={`/curriculum/${module.id}/${lesson.id}`}
                key={lesson.id}
                className="card card-hover p-5"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${
                      lessonDone
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-brand-500/15 text-brand-300'
                    }`}
                  >
                    {lessonDone ? '✓' : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-ink-500">
                        {lesson.id}
                      </span>
                      <LessonTypeBadge type={lesson.type} />
                      <span className="text-xs text-ink-500">{lesson.duration} 分钟</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-ink-50">
                      {lesson.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-400">{lesson.summary}</p>

                    {/* Objectives */}
                    <div className="mt-3 rounded-lg bg-ink-900/60 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                        学习目标
                      </div>
                      <ul className="space-y-1">
                        {lesson.objectives.map((obj, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-xs text-ink-300"
                          >
                            <span className="mt-0.5 text-emerald-400">✓</span>
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {lesson.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        </div>

        {/* Sidebar: Project */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {module.project ? (
            <Link
              to={`/curriculum/${module.id}/project/${module.project.id.toLowerCase()}`}
              className="card card-hover block border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-6"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <h3 className="text-base font-bold text-ink-50">本模块实战项目</h3>
                {isProjectComplete(module.project.id) && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    ✓ 已完成
                  </span>
                )}
                <span className="ml-auto text-xs text-amber-400">查看详情 →</span>
              </div>
              <h4 className="text-lg font-bold text-amber-300">
                {module.project.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                {module.project.summary}
              </p>

              <div className="mt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  交付物
                </div>
                <ul className="space-y-1.5">
                  {module.project.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-ink-300">
                      <span className="mt-0.5 text-amber-400">▸</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  技术栈
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {module.project.stack.map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-ink-800 pt-4">
                <span className="text-xs text-ink-500">项目难度</span>
                <DifficultyBadge level={module.project.difficulty} />
              </div>
            </Link>
          ) : (
            <div className="card p-6 text-sm text-ink-500">本模块无独立项目。</div>
          )}

          {/* Prev / Next */}
          <div className="mt-4 grid gap-3">
            {prev && (
              <Link
                to={`/curriculum/${prev.id}`}
                className="card card-hover p-4"
              >
                <div className="text-[11px] text-ink-500">← 上一模块</div>
                <div className="mt-1 text-sm font-medium text-ink-200">
                  {prev.icon} {prev.title}
                </div>
              </Link>
            )}
            {next && (
              <Link
                to={`/curriculum/${next.id}`}
                className="card card-hover p-4 text-right"
              >
                <div className="text-[11px] text-ink-500">下一模块 →</div>
                <div className="mt-1 text-sm font-medium text-ink-200">
                  {next.icon} {next.title}
                </div>
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
