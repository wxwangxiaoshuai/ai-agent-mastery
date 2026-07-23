import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { useProgress } from './ProgressProvider'
import { curriculum } from '../data/curriculum'
import { lessonOverallProgress } from '../lib/progress'

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/curriculum', label: '课程大纲', end: false },
  { to: '/roadmap', label: '学习路线', end: false },
  { to: '/projects', label: '实战项目', end: false },
]

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-700/30 transition-transform group-hover:scale-105">
        <span className="text-lg">🤖</span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-ink-50">AI Agent 大师之路</span>
        <span className="text-[11px] text-ink-400">Mastery Path</span>
      </span>
    </Link>
  )
}

export function Layout() {
  const location = useLocation()
  const { progress } = useProgress()
  const overall = lessonOverallProgress(curriculum, progress)

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-ink-50'
                      : 'text-ink-400 hover:text-ink-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span
              className="hidden font-mono text-xs text-ink-400 sm:inline"
              title="学习进度（课节）"
            >
              {overall.done}/{overall.total}
            </span>
            <ThemeToggle />
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-50 sm:flex"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.49-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-800/80 bg-ink-950/60">
        <div className="container-page flex flex-col items-center justify-between gap-4 py-8 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-ink-400">
            AI Agent 大师之路 · 一套从零到架构师的实战课程
          </p>
          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span>7 阶段 · 16 模块 · 91 节课 · 16 实战项目</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
