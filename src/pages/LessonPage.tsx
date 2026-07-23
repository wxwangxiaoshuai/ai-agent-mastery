import { Link, useParams } from 'react-router-dom'
import { curriculum } from '../data/curriculum'
import type { Module, Lesson } from '../data/types'
import { DifficultyBadge, LessonTypeBadge, Tag } from '../components/Badges'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { useProgress } from '../components/ProgressProvider'
import { useState, useEffect } from 'react'

function findLesson(moduleId: number, lessonId: string): { module: Module; lesson: Lesson; index: number } | null {
  const mod = curriculum.modules.find((m) => m.id === moduleId)
  if (!mod) return null
  const idx = mod.lessons.findIndex((l) => l.id === lessonId)
  if (idx === -1) return null
  return { module: mod, lesson: mod.lessons[idx], index: idx }
}

function getAdjacentLessons(module: Module, index: number) {
  const prev = index > 0 ? module.lessons[index - 1] : null
  const next = index < module.lessons.length - 1 ? module.lessons[index + 1] : null
  return { prev, next }
}

export function LessonPage() {
  const { moduleId, lessonId } = useParams<{ moduleId: string; lessonId: string }>()
  const modId = Number(moduleId)
  const result = findLesson(modId, lessonId || '')

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const {
    isLessonComplete,
    markLessonComplete,
    unmarkLessonComplete,
    setLastVisited,
  } = useProgress()

  // Load markdown content
  useEffect(() => {
    if (!lessonId || !moduleId) return
    setLoading(true)
    const moduleNum = moduleId.padStart(2, '0')
    const fileName = lessonId.toLowerCase().replace(/-/g, '-')
    import(`../content/module-${moduleNum}/lesson-${fileName}.md?raw`)
      .then((m) => {
        setContent((m as any).default || '')
        setLoading(false)
      })
      .catch(() => {
        setContent('')
        setLoading(false)
      })
  }, [moduleId, lessonId])

  // Record last visited (do not auto-complete)
  useEffect(() => {
    if (!result) return
    setLastVisited({ moduleId: result.module.id, lessonId: result.lesson.id })
  }, [result?.module.id, result?.lesson.id, setLastVisited])

  if (!result) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-ink-400">未找到该课程。</p>
        <Link to="/curriculum" className="btn-ghost mt-6">
          返回课程大纲
        </Link>
      </div>
    )
  }

  const { module, lesson, index } = result
  const { prev, next } = getAdjacentLessons(module, index)
  const done = isLessonComplete(lesson.id)

  return (
    <div className="container-page py-12 sm:py-16">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/curriculum" className="hover:text-ink-200">
          课程大纲
        </Link>
        <span>/</span>
        <Link to={`/curriculum/${module.id}`} className="hover:text-ink-200">
          {module.title}
        </Link>
        <span>/</span>
        <span className="text-ink-300">{lesson.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="min-w-0">
          {/* Lesson header */}
          <div className="card relative overflow-hidden p-6 sm:p-8">
            <div className="grid-bg absolute inset-0 opacity-30" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-ink-500">{lesson.id}</span>
                <LessonTypeBadge type={lesson.type} />
                <span className="text-xs text-ink-500">{lesson.duration} 分钟</span>
                {done && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    已完成
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-50 sm:text-3xl">
                {lesson.title}
              </h1>
              <p className="mt-2 text-ink-400">{lesson.summary}</p>
              <div className="mt-5">
                {done ? (
                  <button
                    type="button"
                    onClick={() => unmarkLessonComplete(lesson.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/40 px-4 py-2 text-sm text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
                  >
                    <span className="text-emerald-400">✓</span>
                    取消完成
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => markLessonComplete(lesson.id)}
                    className="btn-primary"
                  >
                    标记完成
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Objectives */}
          <div className="mt-6 rounded-xl border border-brand-500/20 bg-brand-500/5 p-5">
            <div className="mb-3 text-sm font-semibold text-ink-100">学习目标</div>
            <ul className="space-y-2">
              {lesson.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                  <span className="mt-0.5 text-brand-400">✓</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {lesson.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>

          {/* Lesson content */}
          <div className="mt-8">
            {loading ? (
              <div className="card p-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <p className="mt-3 text-sm text-ink-500">加载课程内容...</p>
              </div>
            ) : content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <div className="card border-amber-500/30 bg-amber-500/5 p-8 text-center">
                <p className="text-amber-300">课程内容正在编写中，敬请期待。</p>
                <p className="mt-2 text-sm text-ink-500">
                  该课程的内容框架已就绪，详细教学内容正在逐步完善。
                </p>
              </div>
            )}
          </div>

          {/* Prev / Next */}
          <div className="mt-10 flex items-center justify-between border-t border-ink-800 pt-6">
            {prev ? (
              <Link
                to={`/curriculum/${module.id}/${prev.id}`}
                className="group flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-brand-400"
              >
                <span className="text-lg">←</span>
                <div>
                  <div className="text-[11px] text-ink-500">上一节</div>
                  <div className="font-medium text-ink-200 group-hover:text-brand-300">
                    {prev.title}
                  </div>
                </div>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                to={`/curriculum/${module.id}/${next.id}`}
                className="group flex items-center gap-2 text-right text-sm text-ink-400 transition-colors hover:text-brand-400"
              >
                <div>
                  <div className="text-[11px] text-ink-500">下一节</div>
                  <div className="font-medium text-ink-200 group-hover:text-brand-300">
                    {next.title}
                  </div>
                </div>
                <span className="text-lg">→</span>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* Module info */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">{module.icon}</span>
              <div>
                <div className="text-xs text-ink-500">
                  模块 {String(module.id).padStart(2, '0')}
                </div>
                <div className="text-sm font-semibold text-ink-100">{module.title}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <DifficultyBadge level={module.difficulty} />
              <span className="text-xs text-ink-500">{module.hours}h</span>
            </div>
          </div>

          {/* Lesson navigation */}
          <div className="mt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              课程列表 · {module.lessons.length} 节
            </div>
            <div className="space-y-1">
              {module.lessons.map((l, i) => {
                const isActive = l.id === lesson.id
                const isDone = isLessonComplete(l.id)
                return (
                  <Link
                    key={l.id}
                    to={`/curriculum/${module.id}/${l.id}`}
                    className={`flex items-center gap-3 rounded-lg p-2.5 text-sm transition-colors ${
                      isActive
                        ? 'border border-brand-500/30 bg-brand-500/10 text-brand-300'
                        : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200'
                    }`}
                  >
                    <span
                      className={`font-mono text-xs ${
                        isDone
                          ? 'text-emerald-400'
                          : isActive
                            ? 'text-brand-400'
                            : 'text-ink-600'
                      }`}
                    >
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
            to={`/curriculum/${module.id}`}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-ink-700 bg-ink-900/40 p-3 text-sm text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-200"
          >
            ← 返回模块概览
          </Link>
        </aside>
      </div>
    </div>
  )
}