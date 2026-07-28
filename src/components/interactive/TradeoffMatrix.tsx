import { useMemo, useState } from 'react'

/**
 * 架构 Trade-off 加权决策矩阵。
 *
 * 教学目标：架构决策的价值不在于选出哪个方案，而在于把权重写下来 ——
 * 权重是可争论、可复盘的，"我觉得"不是。
 */

interface Criterion {
  key: string
  name: string
  hint: string
  weight: number
}

const INITIAL_CRITERIA: Criterion[] = [
  { key: 'control', name: '可控性', hint: '能否精确规定执行路径、在哪些点插入人工审核', weight: 5 },
  { key: 'speed', name: '开发速度', hint: '从零到能演示需要多久', weight: 3 },
  { key: 'cost', name: '推理成本', hint: '单次任务的 token 花费', weight: 4 },
  { key: 'debug', name: '可调试性', hint: '线上出错时能否复现并定位到具体一步', weight: 5 },
  { key: 'ceiling', name: '能力上限', hint: '面对开放式、无法预先枚举的任务表现如何', weight: 3 },
]

interface Option {
  key: string
  name: string
  desc: string
  scores: Record<string, number>
  when: string
}

const OPTIONS: Option[] = [
  {
    key: 'workflow',
    name: '确定性工作流',
    desc: '固定 DAG，LLM 只在节点内做单点判断',
    scores: { control: 5, speed: 5, cost: 5, debug: 5, ceiling: 1 },
    when: '任务路径可穷举、错误代价高、需要审计。绝大多数"AI 功能"其实属于这一类，别一上来就上 Agent。',
  },
  {
    key: 'single',
    name: '单 Agent + 工具',
    desc: 'ReAct 循环，一个模型带一组工具',
    scores: { control: 3, speed: 4, cost: 3, debug: 3, ceiling: 4 },
    when: '任务开放但边界清晰、工具数量在十几个以内。性价比最高的默认选择。',
  },
  {
    key: 'multi',
    name: '多 Agent 协作',
    desc: '多个专职 Agent + 调度层',
    scores: { control: 2, speed: 2, cost: 1, debug: 1, ceiling: 5 },
    when: '任务确实可分解为需要不同上下文的子任务，且你已经有单 Agent 版本做基线。没有基线就上多 Agent 是典型的过早优化。',
  },
]

export function TradeoffMatrix() {
  const [criteria, setCriteria] = useState(INITIAL_CRITERIA)

  const results = useMemo(() => {
    const total = criteria.reduce((s, c) => s + c.weight, 0) || 1
    return OPTIONS.map((o) => ({
      ...o,
      score: criteria.reduce((s, c) => s + c.weight * o.scores[c.key], 0) / total,
    })).sort((a, b) => b.score - a.score)
  }, [criteria])

  const max = results[0]?.score ?? 1

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">架构 Trade-off 决策矩阵</h4>
      <p className="mb-4 text-xs text-ink-500">
        调整各项权重，看排名怎么变。把这张表连同权重理由一起写进 ADR，就是一份合格的架构决策记录。
      </p>

      <div className="mb-5 space-y-3">
        {criteria.map((c) => (
          <div key={c.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-200">{c.name}</span>
              <span className="font-mono text-ink-400">权重 {c.weight}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              value={c.weight}
              onChange={(e) =>
                setCriteria((prev) =>
                  prev.map((x) => (x.key === c.key ? { ...x, weight: Number(e.target.value) } : x)),
                )
              }
              className="w-full accent-brand-500"
            />
            <p className="text-[11px] text-ink-500">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {results.map((r, i) => (
          <div
            key={r.key}
            className={`rounded-lg border p-3 ${
              i === 0 ? 'border-brand-500/40 bg-brand-500/10' : 'border-ink-700 bg-ink-900/40'
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-100">
                {i === 0 && <span className="mr-1 text-brand-300">▸</span>}
                {r.name}
              </span>
              <span className="font-mono text-xs text-ink-300">{r.score.toFixed(2)} / 5</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className={i === 0 ? 'h-full bg-brand-500' : 'h-full bg-ink-600'}
                style={{ width: `${(r.score / (max || 1)) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-ink-500">{r.desc}</p>
            <p className="mt-1 text-[11px] text-ink-400">
              <span className="text-ink-500">何时选它：</span>
              {r.when}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-ink-500">
        提醒：把所有权重都调到 5，等于没有权重 —— 这张表就退化成了打分表。
        真正的架构决策来自于承认"我愿意为 A 牺牲 B"。
      </p>
    </div>
  )
}
