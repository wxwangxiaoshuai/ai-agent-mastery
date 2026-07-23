import { Link } from 'react-router-dom'
import { curriculum, totalLessons, totalHours, totalProjects } from '../data/curriculum'
import { DifficultyBadge } from '../components/Badges'
import { useProgress } from '../components/ProgressProvider'
import {
  getContinuePath,
  hasStarted,
  lessonOverallProgress,
} from '../lib/progress'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="gradient-text text-3xl font-extrabold sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs text-ink-400 sm:text-sm">{label}</div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string
  title: string
  desc: string
}) {
  return (
    <div className="card card-hover p-6">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-xl">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-ink-50">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-400">{desc}</p>
    </div>
  )
}

export function HomePage() {
  const firstModule = curriculum.modules[0]
  const lastModule = curriculum.modules[curriculum.modules.length - 1]
  const { progress } = useProgress()
  const started = hasStarted(progress)
  const continuePath = getContinuePath(progress)
  const overall = lessonOverallProgress(curriculum, progress)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="container-page relative py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-300 animate-fade-up">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              2026 全新升级 · 跟上 Agent 时代
            </div>
            <h1 className="animate-fade-up text-4xl font-extrabold tracking-tight text-ink-50 sm:text-6xl lg:text-7xl">
              从<span className="gradient-text"> Prompt </span>到
              <br className="hidden sm:block" />
              <span className="gradient-text">生产级 Agent 平台</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base leading-relaxed text-ink-300 sm:text-lg [animation-delay:0.1s]">
              一套为开发者设计的、从零到架构师的 AI Agent 开发实战课程。
              从大模型基础出发，经过 Prompt 工程、Agent 架构、工具与记忆、多智能体，
              最终掌握架构设计、生产部署与运维，构建可评估、可观测、可信赖的 Agent 系统。
            </p>
            {started && (
              <p className="mt-4 animate-fade-up text-sm text-ink-400 [animation-delay:0.15s]">
                学习进度 {overall.done}/{overall.total} 节 · {overall.percent}%
              </p>
            )}
            <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row [animation-delay:0.2s]">
              {started && continuePath ? (
                <>
                  <Link to={continuePath} className="btn-primary">
                    继续学习
                    <span aria-hidden>→</span>
                  </Link>
                  <Link to="/curriculum" className="btn-ghost">
                    查看课程大纲
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/curriculum" className="btn-primary">
                    查看课程大纲
                    <span aria-hidden>→</span>
                  </Link>
                  <Link to="/roadmap" className="btn-ghost">
                    <span aria-hidden>🗺️</span>
                    学习路线图
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={`${curriculum.modules.length}`} label="核心模块" />
            <Stat value={`${totalLessons}+`} label="节精讲课" />
            <Stat value={`${totalHours}h`} label="学习时长" />
            <Stat value={`${totalProjects}`} label="实战项目" />
          </div>
        </div>
      </section>

      {/* Why this course */}
      <section className="border-t border-ink-800/60 py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <span className="section-eyebrow">为什么是这门课</span>
            <h2 className="section-title">不是科普，是工程</h2>
            <p className="mt-4 text-ink-400">
              市面上的 Agent 内容要么太浅（讲概念），要么太碎（拼 API）。这门课把「原理」和「工程」焊在一起，
              每一节都能落地为代码，每一阶段都产出可运行的项目。
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon="🪜"
              title="自底向上，循序渐进"
              desc="从 Token 与采样参数讲起，到 ReAct 内核、工具编排、多智能体，每一章都建立在前一章之上，不会突然跳跃。"
            />
            <FeatureCard
              icon="🛠️"
              title="每个模块都有实战项目"
              desc="16 个由浅入深的实战项目，从 CLI 助手到生产级多 Agent 平台，学完即有可交付的代表作。"
            />
            <FeatureCard
              icon="🔗"
              title="拥抱真实工具链"
              desc="LangGraph、MCP、Claude/OpenAI API、向量数据库——用业界正在使用的工具，而不是过时玩具。"
            />
            <FeatureCard
              icon="📊"
              title="工程素养贯穿始终"
              desc="不止「能跑」，更要「可评估、可观测、可信赖」。评测、tracing、安全加固是独立的一章。"
            />
            <FeatureCard
              icon="🌐"
              title="覆盖前沿范式"
              desc="Computer Use、A2A 协议、多 Agent 拓扑——课程内容跟随 2025/2026 的最新进展。"
            />
            <FeatureCard
              icon="🧭"
              title="决策导向，反过度工程"
              desc="每个高级技巧都配「何时不该用」的复盘。Agent 不是银弹，你会学到克制与权衡。"
            />
          </div>
        </div>
      </section>

      {/* Journey preview */}
      <section className="border-t border-ink-800/60 py-20">
        <div className="container-page">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="section-eyebrow">学习之旅</span>
              <h2 className="section-title">
                从写下第一行 LLM 调用，
                <br />
                到交付生产级 Agent
              </h2>
              <p className="mt-4 text-ink-400">
                课程分七个阶段：<span className="text-emerald-300">筑基</span>、
                <span className="text-cyan-300">上下文与知识</span>、
                <span className="text-brand-300">Agent 核心</span>、
                <span className="text-violet-300">记忆执行与编排</span>、
                <span className="text-fuchsia-300">多智能体与多模态</span>、
                <span className="text-amber-300">质量保障</span>、
                <span className="text-rose-300">架构设计与生产落地</span>。
                起点是你能调通 API，终点是你能独立设计并部署一个生产级 Agent 系统。
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: '🧱', text: '阶段一·筑基', detail: '理解 LLM 本质，调通第一个应用' },
                  { icon: '⚙️', text: '阶段二·上下文与知识', detail: '上下文工程，RAG 知识库' },
                  { icon: '🔁', text: '阶段三·Agent 核心', detail: '手写 Agent 内核，工具/MCP，Harness 工程化' },
                  { icon: '🧠', text: '阶段四·记忆执行与编排', detail: '记忆系统，代码沙箱，框架编排' },
                  { icon: '👥', text: '阶段五·多智能体与多模态', detail: 'Agent 团队协作，视觉/语音/视频' },
                  { icon: '📊', text: '阶段六·质量保障', detail: '评估，护栏，测试，可观测性，安全' },
                  { icon: '🏛️', text: '阶段七·架构设计与生产落地', detail: '架构决策，案例拆解，生产运维，毕业设计' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-700 bg-ink-900 text-lg">
                      {s.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-50">{s.text}</div>
                      <div className="text-xs text-ink-400">{s.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Link
                to={`/curriculum/${firstModule.id}`}
                className="card card-hover block p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    起点
                  </span>
                  <DifficultyBadge level={firstModule.difficulty} />
                </div>
                <div className="mb-2 text-2xl">{firstModule.icon}</div>
                <h3 className="text-lg font-bold text-ink-50">
                  模块 {firstModule.id} · {firstModule.title}
                </h3>
                <p className="mt-2 text-sm text-ink-400">{firstModule.subtitle}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-400">
                  从这里开始 <span aria-hidden>→</span>
                </div>
              </Link>

              <div className="flex items-center justify-center text-ink-600">
                <div className="h-8 w-px bg-gradient-to-b from-transparent to-ink-700" />
                <span className="px-3 text-xs">14 个模块在后</span>
                <div className="h-8 w-px bg-gradient-to-t from-transparent to-ink-700" />
              </div>

              <Link
                to={`/curriculum/${lastModule.id}`}
                className="card card-hover block bg-gradient-to-br from-amber-500/10 to-transparent p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    终点 · 毕业设计
                  </span>
                  <DifficultyBadge level={lastModule.difficulty} />
                </div>
                <div className="mb-2 text-2xl">{lastModule.icon}</div>
                <h3 className="text-lg font-bold text-ink-50">
                  模块 {lastModule.id} · {lastModule.title}
                </h3>
                <p className="mt-2 text-sm text-ink-400">{lastModule.subtitle}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-400">
                  目标在此 <span aria-hidden>→</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ink-800/60 py-20">
        <div className="container-page">
          <div className="card relative overflow-hidden bg-gradient-to-br from-brand-600/20 via-ink-900 to-ink-900 p-10 text-center sm:p-16">
            <div className="grid-bg absolute inset-0 opacity-30" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-ink-50 sm:text-4xl">
                准备好成为 Agent 架构师了吗？
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-ink-300">
                课程大纲已就绪。完整内容正陆续上线，先从第一模块开启你的 Agent 大师之路。
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {started && continuePath ? (
                  <Link to={continuePath} className="btn-primary">
                    继续学习
                  </Link>
                ) : (
                  <Link to="/curriculum" className="btn-primary">
                    浏览完整大纲
                  </Link>
                )}
                <Link to="/projects" className="btn-ghost">
                  查看实战项目
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
