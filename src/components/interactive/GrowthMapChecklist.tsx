import { useMemo, useState } from 'react'

/**
 * 架构师能力自评地图。
 *
 * 教学目标：把"学完了"变成可核对的能力清单，并让人看到哪一维是自己的短板。
 */

interface Dim {
  key: string
  name: string
  color: string
  items: string[]
}

const DIMS: Dim[] = [
  {
    key: 'found',
    name: '模型与上下文',
    color: 'bg-emerald-500',
    items: [
      '能解释 token、上下文窗口与注意力成本之间的关系',
      '能为一个具体场景排出 token 预算表并说明取舍',
      '能设计 prompt caching 的前缀结构并估算命中率',
      '能判断一个任务该不该用 RAG，以及用哪种分块策略',
    ],
  },
  {
    key: 'core',
    name: 'Agent 核心',
    color: 'bg-brand-500',
    items: [
      '能手写一个不依赖框架的 ReAct 循环',
      '能设计一组模型不会误调用的工具 schema',
      '能实现分层记忆并处理记忆冲突',
      '能说清什么任务不该用 Agent',
    ],
  },
  {
    key: 'eng',
    name: '工程与编排',
    color: 'bg-cyan-500',
    items: [
      '能用图状态机表达带回环与人工介入的流程',
      '能给 Agent 加上重试、超时、降级与幂等',
      '能搭起代码沙箱并说明其逃逸面',
      '能判断某个框架抽象在何时开始成为负担',
    ],
  },
  {
    key: 'quality',
    name: '质量与安全',
    color: 'bg-amber-500',
    items: [
      '能建一套带回归集的自动评测流水线',
      '能用 trace 定位一次线上失败的具体环节',
      '能设计分层护栏并解释每层挡住什么',
      '能对间接 prompt 注入给出可落地的防御方案',
    ],
  },
  {
    key: 'prod',
    name: '架构与生产',
    color: 'bg-fuchsia-500',
    items: [
      '能写出一份带权重与取舍理由的 ADR',
      '能拆解一个真实产品的 Agent 架构并指出其取舍',
      '能设计网关、队列、缓存、限流的生产拓扑',
      '能定义 SLO 并据此设计告警与灰度方案',
    ],
  },
]

const TOTAL = DIMS.reduce((s, d) => s + d.items.length, 0)

export function GrowthMapChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setDone((p) => ({ ...p, [id]: !p[id] }))

  const perDim = useMemo(
    () =>
      DIMS.map((d) => ({
        ...d,
        n: d.items.filter((_, i) => done[`${d.key}-${i}`]).length,
      })),
    [done],
  )
  const total = perDim.reduce((s, d) => s + d.n, 0)
  const pct = Math.round((total / TOTAL) * 100)
  const weakest = [...perDim].sort((a, b) => a.n / a.items.length - b.n / b.items.length)[0]

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">架构师能力自评地图</h4>
      <p className="mb-4 text-xs text-ink-500">
        标准只有一个：能不能给别人讲清楚并动手做出来。勾选前先诚实地问自己这一句。
      </p>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-ink-300">
          {total}/{TOTAL} · {pct}%
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {perDim.map((d) => (
          <span
            key={d.key}
            className="flex items-center gap-1.5 rounded-lg bg-ink-950/60 px-2.5 py-1 text-[11px] text-ink-400"
          >
            <span className={`inline-block h-2 w-2 rounded-sm ${d.color}`} />
            {d.name} {d.n}/{d.items.length}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {DIMS.map((d) => (
          <div key={d.key}>
            <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-ink-200">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${d.color}`} />
              {d.name}
            </p>
            <div className="space-y-1">
              {d.items.map((item, i) => {
                const id = `${d.key}-${i}`
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[11px] transition-colors ${
                      done[id]
                        ? 'interactive-selected interactive-focus'
                        : 'interactive-chip interactive-focus'
                    }`}
                  >
                    <span className="mt-px shrink-0">{done[id] ? '☑' : '☐'}</span>
                    <span>{item}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {total > 0 && total < TOTAL && weakest && (
        <p className="mt-4 rounded-lg border border-brand-500/25 bg-brand-500/10 p-3 text-[11px] text-ink-100">
          当前最薄弱的一维是「{weakest.name}」（{weakest.n}/{weakest.items.length}）。
          与其把已经会的再练一遍，不如挑这一维里最难的一条，做一个能跑起来的最小实现。
        </p>
      )}
      {total === TOTAL && (
        <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-300">
          全部勾满了。下一步不是再学一个框架，而是找一个真实用户、真实预算、真实故障的项目 ——
          架构判断力只在有代价的决策里长出来。
        </p>
      )}
    </div>
  )
}
