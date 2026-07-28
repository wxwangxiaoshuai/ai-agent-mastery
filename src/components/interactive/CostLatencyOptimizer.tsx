import { useMemo, useState } from 'react'

/**
 * 成本 / 延迟 / 质量三角优化器。
 *
 * 教学目标：三者不可能同时最优。这里用一组可切换的工程手段，
 * 让人亲手感受"每一次省钱都在别处付出代价"。
 *
 * 注：所有数值为教学示意的量级模型，不代表任何厂商的真实定价，请以官方价目表为准。
 */

type Tier = 'small' | 'mid' | 'large'

const TIERS: { id: Tier; name: string; costPer1k: number; ttftMs: number; quality: number; note: string }[] = [
  { id: 'small', name: '小模型', costPer1k: 0.3, ttftMs: 280, quality: 62, note: '分类、抽取、路由这类窄任务够用' },
  { id: 'mid', name: '中模型', costPer1k: 3.0, ttftMs: 620, quality: 84, note: '大多数生产 Agent 的主力档位' },
  { id: 'large', name: '大模型', costPer1k: 15.0, ttftMs: 1100, quality: 95, note: '复杂推理、长链路规划才值这个价' },
]

interface Lever {
  key: string
  name: string
  desc: string
  costMul: number
  latMul: number
  qualityDelta: number
  caveat: string
}

const LEVERS: Lever[] = [
  {
    key: 'cache',
    name: 'Prompt Caching',
    desc: '把稳定的 system + 工具定义命中缓存',
    costMul: 0.55,
    latMul: 0.75,
    qualityDelta: 0,
    caveat: '前提是前缀真的稳定。任何一处动态时间戳插在前面，缓存命中率就归零。',
  },
  {
    key: 'route',
    name: '模型路由',
    desc: '先用小模型判断难度，简单请求不上大模型',
    costMul: 0.45,
    latMul: 1.12,
    qualityDelta: -3,
    caveat: '多了一跳分类，简单请求反而更慢；路由器判错时的降级代价要单独评估。',
  },
  {
    key: 'stream',
    name: '流式输出',
    desc: '首 token 就开始渲染',
    costMul: 1.0,
    latMul: 1.0,
    qualityDelta: 0,
    caveat: '不省一分钱、不减一毫秒，但把用户感知等待从"总时长"变成"首 token 时延"。感知优化的性价比之王。',
  },
  {
    key: 'batch',
    name: '离线批处理',
    desc: '非实时请求走批量接口',
    costMul: 0.5,
    latMul: 8,
    qualityDelta: 0,
    caveat: '只适用于用户不在等结果的场景。用在交互路径上就是灾难。',
  },
  {
    key: 'shrink',
    name: '上下文瘦身',
    desc: '裁掉低相关片段与冗余历史',
    costMul: 0.7,
    latMul: 0.85,
    qualityDelta: -2,
    caveat: '裁过头会丢关键证据。必须配一套回归集来量化"裁多少开始掉分"。',
  },
]

export function CostLatencyOptimizer() {
  const [tier, setTier] = useState<Tier>('mid')
  const [on, setOn] = useState<Record<string, boolean>>({ stream: true })

  const base = TIERS.find((t) => t.id === tier)!
  const active = LEVERS.filter((l) => on[l.key])

  const result = useMemo(() => {
    const cost = active.reduce((v, l) => v * l.costMul, base.costPer1k)
    const lat = active.reduce((v, l) => v * l.latMul, base.ttftMs)
    const quality = active.reduce((v, l) => v + l.qualityDelta, base.quality)
    const perceived = on.stream ? lat : lat * 3.2
    return { cost, lat, quality, perceived }
  }, [base, active, on.stream])

  const monthly = result.cost * 100 // 假设每月 10 万次请求 → 100 个千次

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">成本 / 延迟 / 质量三角</h4>
      <p className="mb-4 text-xs text-ink-500">
        数值为教学示意的量级模型，不是任何厂商的真实报价。重点看趋势与代价，不要记数字。
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTier(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              tier === t.id
                ? 'border-brand-500/40 bg-brand-500/20 text-brand-300'
                : 'border-ink-700 bg-ink-800/50 text-ink-400 hover:text-ink-200'
            }`}
            title={t.note}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="mb-4 text-[11px] text-ink-500">{base.note}</p>

      <div className="mb-4 space-y-2">
        {LEVERS.map((l) => (
          <button
            key={l.key}
            onClick={() => setOn((p) => ({ ...p, [l.key]: !p[l.key] }))}
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              on[l.key] ? 'border-brand-500/30 bg-brand-500/10' : 'border-ink-700 bg-ink-800/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-200">{l.name}</span>
              <span className="font-mono text-[10px] text-ink-500">
                成本 ×{l.costMul} · 延迟 ×{l.latMul} · 质量 {l.qualityDelta >= 0 ? '+' : ''}
                {l.qualityDelta}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-500">{l.desc}</p>
            {on[l.key] && (
              <p className="mt-1 text-[11px] text-amber-300">代价：{l.caveat}</p>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-ink-950/60 p-3 text-center">
          <p className="font-mono text-sm text-ink-100">${result.cost.toFixed(2)}</p>
          <p className="text-[10px] text-ink-500">每千次请求</p>
        </div>
        <div className="rounded-lg bg-ink-950/60 p-3 text-center">
          <p className="font-mono text-sm text-ink-100">${monthly.toFixed(0)}</p>
          <p className="text-[10px] text-ink-500">月成本（10 万次）</p>
        </div>
        <div className="rounded-lg bg-ink-950/60 p-3 text-center">
          <p className="font-mono text-sm text-ink-100">{Math.round(result.perceived)}ms</p>
          <p className="text-[10px] text-ink-500">用户感知等待</p>
        </div>
        <div className="rounded-lg bg-ink-950/60 p-3 text-center">
          <p
            className={`font-mono text-sm ${
              result.quality >= 80 ? 'text-emerald-300' : result.quality >= 65 ? 'text-amber-300' : 'text-rose-300'
            }`}
          >
            {result.quality.toFixed(0)}
          </p>
          <p className="text-[10px] text-ink-500">质量分（回归集）</p>
        </div>
      </div>

      {result.quality < 70 && (
        <p className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          质量已跌破 70。省下来的钱通常抵不过一次线上事故 —— 优化必须以回归集分数为红线，
          而不是以账单为唯一目标。
        </p>
      )}
    </div>
  )
}
