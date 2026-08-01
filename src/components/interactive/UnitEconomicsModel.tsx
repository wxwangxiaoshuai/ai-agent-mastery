import { useMemo, useState } from 'react'

/**
 * 单位经济模型 —— L18-05 用。
 *
 * 独立开发者最常见的死法不是没人用，是"用的人越多亏得越多"。
 * 这个组件把订阅价、用量、token 成本、免费额度四个旋钮放在一起，
 * 让学习者亲手把毛利率拧成负数，看清楚是哪个旋钮先崩的。
 *
 * 注意：所有价格都是用于教学的量级示意，不是任何厂商的报价，
 * 真实定价请以你实际接入的服务商账单为准。
 */

interface Tier {
  key: string
  name: string
  /** 每千次调用的推理成本（美元，量级示意） */
  inferPerK: number
  note: string
}

const TIERS: Tier[] = [
  { key: 'nano', name: '小模型', inferPerK: 0.4, note: '够用就好的分类、抽取、改写' },
  { key: 'mid', name: '中档模型', inferPerK: 4.0, note: '主力对话与推理' },
  { key: 'large', name: '旗舰模型', inferPerK: 18.0, note: '复杂推理与长文' },
]

const FIXED_PER_USER = 0.15 // 存储 + 带宽 + 第三方，量级示意

export function UnitEconomicsModel() {
  const [price, setPrice] = useState(19) // 月订阅价（美元）
  const [callsPerUser, setCallsPerUser] = useState(300) // 每用户每月调用次数
  const [tierKey, setTierKey] = useState('mid')
  const [freeRatio, setFreeRatio] = useState(80) // 免费用户占比 %
  const [freeQuota, setFreeQuota] = useState(50) // 免费用户每月调用上限

  const tier = TIERS.find((t) => t.key === tierKey)!

  const m = useMemo(() => {
    const paidCost = (callsPerUser / 1000) * tier.inferPerK + FIXED_PER_USER
    const paidMargin = price - paidCost
    const paidRate = price > 0 ? (paidMargin / price) * 100 : 0

    // 每 100 个用户里，freeRatio 个是免费用户
    const freeUsers = freeRatio
    const paidUsers = 100 - freeRatio
    const freeCost = freeUsers * ((freeQuota / 1000) * tier.inferPerK + FIXED_PER_USER)
    const revenue = paidUsers * price
    const cost = paidUsers * paidCost + freeCost
    const blendedMargin = revenue - cost
    const blendedRate = revenue > 0 ? (blendedMargin / revenue) * 100 : 0

    return { paidCost, paidMargin, paidRate, freeCost, revenue, cost, blendedMargin, blendedRate }
  }, [price, callsPerUser, tier, freeRatio, freeQuota])

  const healthy = m.blendedRate >= 60
  const warning = m.blendedRate >= 20 && m.blendedRate < 60
  const tone = healthy ? 'text-emerald-300' : warning ? 'text-amber-300' : 'text-danger-300'

  return (
    <div className="card p-5">
      <h4 className="mb-3 text-sm font-semibold text-ink-100">单位经济模型</h4>
      <p className="mb-4 text-xs leading-relaxed text-ink-400">
        按每 100 个注册用户计算。拧动旋钮，看毛利率什么时候翻负。
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Slider label="月订阅价" value={price} min={0} max={99} step={1} unit=" $" onChange={setPrice} />
        <Slider
          label="付费用户月调用"
          value={callsPerUser}
          min={10}
          max={3000}
          step={10}
          unit=" 次"
          onChange={setCallsPerUser}
        />
        <Slider
          label="免费用户占比"
          value={freeRatio}
          min={0}
          max={99}
          step={1}
          unit=" %"
          onChange={setFreeRatio}
        />
        <Slider
          label="免费额度上限"
          value={freeQuota}
          min={0}
          max={1000}
          step={10}
          unit=" 次/月"
          onChange={setFreeQuota}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTierKey(t.key)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              tierKey === t.key
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {t.name}
          </button>
        ))}
        <span className="self-center text-xs text-ink-500">{tier.note}</span>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <Row k="单个付费用户成本" v={`$${m.paidCost.toFixed(2)} / 月`} />
        <Row k="单个付费用户毛利" v={`$${m.paidMargin.toFixed(2)}（${m.paidRate.toFixed(0)}%）`} />
        <Row k="免费用户总成本" v={`$${m.freeCost.toFixed(2)} / 月`} />
        <Row k="100 人总收入" v={`$${m.revenue.toFixed(0)} / 月`} />
      </div>

      <div className="mt-4 rounded-lg border border-ink-700 bg-ink-800/40 p-3">
        <div className="text-xs text-ink-400">100 个用户的混合毛利率</div>
        <div className={`mt-1 text-2xl font-semibold ${tone}`}>
          {m.blendedRate.toFixed(1)}%
        </div>
        <div className="mt-1 text-xs text-ink-400">
          月毛利 ${m.blendedMargin.toFixed(0)} ｜ 月成本 ${m.cost.toFixed(0)}
        </div>
        {m.blendedRate < 0 && (
          <div className="mt-2 rounded bg-danger-500/15 px-2 py-1 text-xs text-danger-300">
            这个组合下每多来 100 个用户，你每月多亏 ${Math.abs(m.blendedMargin).toFixed(0)}。
            增长在这里是加速破产，不是成功。
          </div>
        )}
        {m.blendedRate >= 0 && m.blendedRate < 20 && (
          <div className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
            毛利率低于 20%，意味着一次模型涨价或一个重度用户就能把你打穿。
          </div>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        三个最常被低估的地方：免费额度是<strong className="text-ink-300">按人×次</strong>累加的、
        重度用户的调用量是平均值的 10 倍以上、以及模型档位一升整条曲线就平移。
        以上数字为教学量级示意，请用你自己的真实账单重算一遍。
      </p>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 flex justify-between text-ink-400">
        <span>{label}</span>
        <span className="font-medium text-ink-200">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </label>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between rounded border border-ink-700 bg-ink-800/30 px-2 py-1.5">
      <span className="text-ink-400">{k}</span>
      <span className="font-medium text-ink-200">{v}</span>
    </div>
  )
}
