import { Link } from 'react-router-dom'
import { curriculum, stages } from '../data/curriculum'
import { DifficultyBadge } from '../components/Badges'

export function RoadmapPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow">学习路线图</span>
        <h1 className="section-title">你的成长路径</h1>
        <p className="mt-4 text-ink-400">
          一条从「调通第一个 API」到「部署生产级多 Agent 系统」的完整路径。
          沿着这条路走，每一站都有明确的能力跃迁。
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-3xl">
        {/* Vertical timeline */}
        <div className="relative">
          {/* center line */}
          <div className="absolute left-6 top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500 via-brand-500 to-amber-500 sm:left-8" />

          <div className="space-y-12">
            {stages.map((stage, si) => {
              const stageModules = curriculum.modules.filter(
                (m) => m.id >= stage.range[0] && m.id <= stage.range[1],
              )
              return (
                <div key={stage.id} className="relative">
                  {/* stage marker */}
                  <div className="mb-6 flex items-center gap-4">
                    <div
                      className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br ${stage.color} text-lg font-bold text-white shadow-lg sm:h-16 sm:w-16 sm:text-xl`}
                    >
                      {si + 1}
                    </div>
                    <div>
                      <h2 className={`bg-gradient-to-r ${stage.color} bg-clip-text text-2xl font-bold text-transparent`}>
                        {stage.name}
                      </h2>
                      <p className="text-sm text-ink-400">
                        阶段 {si + 1} · 模块 {stage.range[0]}–{stage.range[1]}
                      </p>
                    </div>
                  </div>

                  {/* modules in stage */}
                  <div className="ml-2 space-y-3 border-l-2 border-transparent pl-16 sm:pl-24">
                    {stageModules.map((m) => (
                      <Link
                        key={m.id}
                        to={`/curriculum/${m.id}`}
                        className="card card-hover group flex items-center gap-4 p-4"
                      >
                        <span className="text-2xl">{m.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-ink-500">
                              M{String(m.id).padStart(2, '0')}
                            </span>
                            <span className="font-semibold text-ink-50">{m.title}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-ink-400">
                            {m.subtitle}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-500">
                            <span>📚 {m.lessons.length} 节课</span>
                            <span>·</span>
                            <span>⏱ {m.hours}h</span>
                            {m.project && (
                              <>
                                <span>·</span>
                                <span className="text-amber-400/80">🎯 含项目</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <DifficultyBadge level={m.difficulty} />
                          <span className="text-ink-600 transition-colors group-hover:text-brand-400">
                            →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* End marker */}
        <div className="mt-12 flex justify-center">
          <div className="card bg-gradient-to-br from-amber-500/10 to-transparent p-8 text-center">
            <div className="text-4xl">🏆</div>
            <h3 className="mt-3 text-xl font-bold text-ink-50">毕业 · Agent 开发专家</h3>
            <p className="mt-2 max-w-md text-sm text-ink-400">
              完成全部 20 个模块与毕业设计后，你将具备独立设计、开发、部署生产级 Agent 系统的全栈能力。
            </p>
            <Link to="/projects" className="btn-primary mt-5">
              查看毕业设计要求
            </Link>
          </div>
        </div>
      </div>

      {/* Quick-start paths */}
      <div className="mx-auto mt-16 max-w-3xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">不知道该从哪里开始？</span>
          <h2 className="section-title">选择你的起点</h2>
          <p className="mt-4 text-ink-400">
            不同背景的学习者有不同的最优路径。对照下面的描述，找到最适合你的入口。
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            {
              label: '完全没接触过 LLM',
              icon: '🌱',
              start: 'M1',
              desc: '从 Token 是什么开始，一步步建立对 LLM 的工程化认知。这是最长但最扎实的路径。',
              path: '/curriculum/1',
            },
            {
              label: '会用 ChatGPT 但没写过 Agent',
              icon: '🔧',
              start: 'M2',
              desc: '你已经知道 LLM 能干什么，直接学 Prompt 工程和结构化输出，把"聊天"变成"工程"。',
              path: '/curriculum/2',
            },
            {
              label: '已经写过 ReAct Agent',
              icon: '⚡',
              start: 'M7',
              desc: '你过了"调通第一个 Agent"的阶段，现在需要让它可靠——Harness 工程化、熔断、降级。',
              path: '/curriculum/7',
            },
            {
              label: '在做独立产品，需要变现',
              icon: '🚀',
              start: 'M17',
              desc: '技术不是你的瓶颈，选品、定价、增长才是。从 M17/M18 AI Coding 提效开始，直达 M19/M20 商业化。',
              path: '/curriculum/17',
            },
          ].map((p) => (
            <Link
              key={p.path}
              to={p.path}
              className="card card-hover group p-5"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-50">{p.label}</span>
                    <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">
                      {p.start}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
                    {p.desc}
                  </p>
                  <span className="mt-2 inline-block text-xs text-ink-500 transition-colors group-hover:text-brand-400">
                    从 {p.start} 开始 →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
