import { Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { curriculum } from '../data/curriculum'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { DifficultyBadge, Tag } from '../components/Badges'
import { useProgress } from '../components/ProgressProvider'

export function ProjectPage() {
  const { moduleId, projectId } = useParams<{ moduleId: string; projectId: string }>()
  const modId = Number(moduleId)

  const mod = curriculum.modules.find((m) => m.id === modId)
  const project = mod?.project

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const {
    isLessonComplete,
    isProjectComplete,
    markProjectComplete,
    unmarkProjectComplete,
    setLastVisited,
  } = useProgress()

  // Load project markdown content
  useEffect(() => {
    if (!projectId || !moduleId) return
    setLoading(true)
    const moduleNum = moduleId.padStart(2, '0')
    const fileName = projectId.toLowerCase()
    import(`../content/module-${moduleNum}/project-${fileName}.md?raw`)
      .then((m) => {
        setContent((m as any).default || '')
        setLoading(false)
      })
      .catch(() => {
        setContent('')
        setLoading(false)
      })
  }, [moduleId, projectId])

  // Record last visited
  useEffect(() => {
    if (!mod || !project) return
    setLastVisited({ moduleId: mod.id, projectId: project.id })
  }, [mod?.id, project?.id, setLastVisited])

  if (!mod || !project) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-ink-400">未找到该项目。</p>
        <Link to="/curriculum" className="btn-ghost mt-6">
          返回课程大纲
        </Link>
      </div>
    )
  }

  const done = isProjectComplete(project.id)

  return (
    <div className="container-page py-12 sm:py-16">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/curriculum" className="hover:text-ink-200">
          课程大纲
        </Link>
        <span>/</span>
        <Link to={`/curriculum/${mod.id}`} className="hover:text-ink-200">
          {mod.title}
        </Link>
        <span>/</span>
        <span className="text-ink-300">{project.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="min-w-0">
          {/* Project header */}
          <div className="card relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-6 sm:p-8">
            <div className="grid-bg absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-amber-400">{project.id}</span>
                <DifficultyBadge level={project.difficulty} />
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  实战项目
                </span>
                {done && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    已完成
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-50 sm:text-3xl">
                {project.title}
              </h1>
              <p className="mt-2 leading-relaxed text-ink-300">{project.summary}</p>
              <div className="mt-5">
                {done ? (
                  <button
                    type="button"
                    onClick={() => unmarkProjectComplete(project.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/40 px-4 py-2 text-sm text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
                  >
                    <span className="text-emerald-400">✓</span>
                    取消完成
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => markProjectComplete(project.id)}
                    className="btn-primary"
                  >
                    标记完成
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Project meta */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* Deliverables */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="mb-3 text-sm font-semibold text-ink-100">交付物</div>
              <ul className="space-y-2">
                {project.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                    <span className="mt-0.5 text-amber-400">▸</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tech stack */}
            <div className="rounded-xl border border-ink-700/50 bg-ink-900/40 p-5">
              <div className="mb-3 text-sm font-semibold text-ink-100">技术栈</div>
              <div className="flex flex-wrap gap-1.5">
                {project.stack.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
              <div className="mt-4 border-t border-ink-800 pt-4 text-xs text-ink-500">
                所属模块：{mod.icon} {mod.title}
              </div>
            </div>
          </div>

          {/* Project content */}
          <div className="mt-8">
            {loading ? (
              <div className="card p-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <p className="mt-3 text-sm text-ink-500">加载项目内容...</p>
              </div>
            ) : content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <div className="card border-amber-500/30 bg-amber-500/5 p-8 text-center">
                <p className="text-amber-300">项目内容正在编写中，敬请期待。</p>
                <p className="mt-2 text-sm text-ink-500">
                  该项目的元数据（交付物、技术栈、难度）已就绪，详细实施步骤正在逐步完善。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* Module info */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">{mod.icon}</span>
              <div>
                <div className="text-xs text-ink-500">
                  模块 {String(mod.id).padStart(2, '0')}
                </div>
                <div className="text-sm font-semibold text-ink-100">{mod.title}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <DifficultyBadge level={mod.difficulty} />
              <span className="text-xs text-ink-500">{mod.hours}h</span>
            </div>
          </div>

          {/* All lessons in module */}
          <div className="mt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              课程列表 · {mod.lessons.length} 节
            </div>
            <div className="space-y-1">
              {mod.lessons.map((l, i) => {
                const isDone = isLessonComplete(l.id)
                return (
                  <Link
                    key={l.id}
                    to={`/curriculum/${mod.id}/${l.id}`}
                    className="flex items-center gap-3 rounded-lg p-2.5 text-sm text-ink-400 transition-colors hover:bg-ink-800/50 hover:text-ink-200"
                  >
                    <span className={`font-mono text-xs ${isDone ? 'text-emerald-400' : 'text-ink-600'}`}>
                      {isDone ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-500">
                      {l.duration}m
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Back to module */}
          <Link
            to={`/curriculum/${mod.id}`}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-ink-700 bg-ink-900/40 p-3 text-sm text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-200"
          >
            ← 返回模块概览
          </Link>
        </aside>
      </div>
    </div>
  )
}
