import { useState } from 'react'

/**
 * 图状态机执行轨迹演示（LangGraph 心智模型）。
 *
 * 教学目标：让人看清"状态在节点之间流动、条件边决定是否回环"这件事，
 * 尤其是回环带来的重复成本 —— 这正是必须设最大迭代次数的原因。
 */

interface Frame {
  node: string
  label: string
  /** 该步之后的状态快照 */
  state: Record<string, string>
  edge: string
  kind: 'normal' | 'loop' | 'end'
}

const TRACE: Frame[] = [
  {
    node: 'plan',
    label: '规划节点',
    state: { question: 'LangGraph 适合哪类场景？', plan: '① 查官方定位 ② 查反面案例', findings: '[]', loops: '0' },
    edge: 'plan → search（无条件边）',
    kind: 'normal',
  },
  {
    node: 'search',
    label: '检索节点',
    state: { question: '…', plan: '…', findings: '["官方定位：可控编排"]', loops: '1' },
    edge: 'search → reflect（无条件边）',
    kind: 'normal',
  },
  {
    node: 'reflect',
    label: '反思节点',
    state: { question: '…', plan: '…', findings: '["官方定位：可控编排"]', verdict: '证据不足：缺反面案例', loops: '1' },
    edge: 'reflect → search（条件边：verdict != "充分" 且 loops < 3）',
    kind: 'loop',
  },
  {
    node: 'search',
    label: '检索节点（第 2 次）',
    state: { question: '…', plan: '…', findings: '[官方定位, 反面案例: 简单链路上是过度设计]', loops: '2' },
    edge: 'search → reflect',
    kind: 'loop',
  },
  {
    node: 'reflect',
    label: '反思节点（第 2 次）',
    state: { question: '…', findings: '[…2 条]', verdict: '充分', loops: '2' },
    edge: 'reflect → answer（条件边：verdict == "充分"）',
    kind: 'normal',
  },
  {
    node: 'answer',
    label: '作答节点',
    state: { answer: '需要显式分支/回环/人工介入的长流程适合；线性两三步的任务用它是过度设计。', loops: '2' },
    edge: 'answer → END',
    kind: 'end',
  },
]

const NODES = ['plan', 'search', 'reflect', 'answer']

export function GraphStateMachine() {
  const [i, setI] = useState(0)
  const f = TRACE[i]
  const loopCount = TRACE.slice(0, i + 1).filter((x) => x.kind === 'loop' && x.node === 'search').length

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">图状态机执行轨迹</h4>
      <p className="mb-4 text-xs text-ink-500">
        一步步走完一次 plan → search → reflect ⟲ → answer。注意 reflect 的条件边把流程拉回了 search。
      </p>

      <div className="mb-4 flex items-center justify-between gap-1">
        {NODES.map((n, idx) => (
          <div key={n} className="flex flex-1 items-center">
            <div
              className={`flex-1 rounded-lg border px-2 py-2 text-center text-[11px] font-medium transition-all ${
                f.node === n
                  ? 'border-brand-500/50 bg-brand-500/20 text-brand-200'
                  : 'border-ink-700 bg-ink-800/40 text-ink-500'
              }`}
            >
              {n}
            </div>
            {idx < NODES.length - 1 && <span className="px-1 text-ink-600">→</span>}
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TRACE.map((t, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={`h-7 w-7 rounded-md border text-[11px] transition-colors ${
              idx === i
                ? 'border-brand-500/40 bg-brand-500/20 text-brand-300'
                : t.kind === 'loop'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-ink-700 bg-ink-800/40 text-ink-500'
            }`}
            title={t.label}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-ink-700 bg-ink-950/60 p-3">
        <p className="mb-2 text-xs font-semibold text-ink-200">
          第 {i + 1} 步 · {f.label}
        </p>
        <p className="mb-2 text-[11px] text-ink-500">出边：{f.edge}</p>
        <pre className="whitespace-pre-wrap font-mono text-[11px] text-ink-300">
{`state = {
${Object.entries(f.state)
  .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
  .join(',\n')}
}`}
        </pre>
      </div>

      {loopCount > 0 && (
        <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] text-amber-300">
          已回环 {loopCount} 次。每回环一次就重跑一遍检索与反思，成本与延迟同步翻倍 ——
          所以条件边一定要带 <span className="font-mono">loops &lt; N</span> 这样的硬上限，
          否则一个判断不稳的 reflect 节点就能烧掉你整月预算。
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setI((x) => Math.max(0, x - 1))}
          disabled={i === 0}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 disabled:opacity-40"
        >
          上一步
        </button>
        <button
          onClick={() => setI((x) => Math.min(TRACE.length - 1, x + 1))}
          disabled={i === TRACE.length - 1}
          className="rounded-lg border border-brand-500/30 bg-brand-500/20 px-3 py-1.5 text-xs text-brand-300 disabled:opacity-40"
        >
          下一步
        </button>
        <button
          onClick={() => setI(0)}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400"
        >
          重置
        </button>
      </div>
    </div>
  )
}
