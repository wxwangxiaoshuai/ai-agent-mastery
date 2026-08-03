import { useMemo, useState } from 'react'

/**
 * 增长漏斗模拟 —— L20-03 用。
 *
 * 独立开发者最容易犯的错：拼命往漏斗顶部灌流量，而底部漏得像筛子。
 * 这个组件把五级漏斗和月留存放在一起，让学习者亲手验证一件反直觉的事——
 * 把留存从 60% 提到 75%，比把流量翻倍更能改变 12 个月后的规模。
 */

interface Stage {
  key: string
  name: string
  desc: string
  /** 该环节掉队的典型原因 */
  leak: string
}

const STAGES: Stage[] = [
  { key: 'visit', name: '访问', desc: '看到落地页', leak: '来错了人：渠道和产品不匹配' },
  { key: 'signup', name: '注册', desc: '留下账号', leak: '价值没说清，或注册门槛太高' },
  { key: 'activate', name: '激活', desc: '完成第一次有价值的操作', leak: '空态没引导，用户不知道先做什么' },
  { key: 'pay', name: '付费', desc: '完成第一笔支付', leak: '免费额度太慷慨，没有付费的理由' },
]

export function GrowthFunnelSim() {
  const [visits, setVisits] = useState(2000)
  const [rates, setRates] = useState<number[]>([12, 40, 15]) // 访问→注册→激活→付费
  const [retention, setRetention] = useState(75) // 月留存 %
  const [arpu, setArpu] = useState(19)

  const counts = useMemo(() => {
    const out = [visits]
    for (const r of rates) out.push(Math.round(out[out.length - 1] * (r / 100)))
    return out
  }, [visits, rates])

  const newPaid = counts[counts.length - 1]

  /** 稳态用户数 = 月新增 / 月流失率；留存 100% 时无稳态 */
  const churn = (100 - retention) / 100
  const steady = churn > 0 ? newPaid / churn : Infinity

  const twelveMonth = useMemo(() => {
    let n = 0
    for (let i = 0; i < 12; i++) n = n * (retention / 100) + newPaid
    return Math.round(n)
  }, [newPaid, retention])

  function setRate(i: number, v: number) {
    setRates((prev) => prev.map((x, j) => (j === i ? v : x)))
  }

  const max = counts[0] || 1

  return (
    <div className="card p-5">
      <h4 className="mb-3 text-sm font-semibold text-ink-100">增长漏斗模拟</h4>
      <p className="mb-4 text-xs leading-relaxed text-ink-400">
        先看漏斗每一级漏掉多少，再看留存怎么决定 12 个月后的规模。
      </p>

      <div className="mb-4 space-y-2">
        {STAGES.map((s, i) => {
          const n = counts[i]
          const pct = (n / max) * 100
          const drop = i > 0 ? counts[i - 1] - n : 0
          return (
            <div key={s.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-ink-300">
                  {s.name}
                  <span className="ml-2 text-ink-500">{s.desc}</span>
                </span>
                <span className="font-medium text-ink-200">{n.toLocaleString()}</span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded bg-ink-800/50">
                <div
                  className="h-full bg-gradient-to-r from-brand-500/70 to-brand-400/40"
                  style={{ width: `${Math.max(pct, 0.5)}%` }}
                />
              </div>
              {i > 0 && (
                <div className="mt-1 text-[11px] text-ink-500">
                  这一级漏掉 {drop.toLocaleString()} 人 —— {s.leak}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Slider label="月访问量" value={visits} min={100} max={20000} step={100} unit="" onChange={setVisits} />
        <Slider label="月留存率" value={retention} min={50} max={98} step={1} unit=" %" onChange={setRetention} />
        {rates.map((r, i) => (
          <Slider
            key={i}
            label={`${STAGES[i].name} → ${STAGES[i + 1].name}`}
            value={r}
            min={1}
            max={90}
            step={1}
            unit=" %"
            onChange={(v) => setRate(i, v)}
          />
        ))}
        <Slider label="每用户月付费" value={arpu} min={0} max={99} step={1} unit=" $" onChange={setArpu} />
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <Box k="月新增付费" v={newPaid.toLocaleString()} />
        <Box
          k="12 个月后在册"
          v={twelveMonth.toLocaleString()}
          hint={`稳态上限 ${Number.isFinite(steady) ? Math.round(steady).toLocaleString() : '∞'}`}
        />
        <Box k="第 12 月 MRR" v={`$${(twelveMonth * arpu).toLocaleString()}`} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        试一件事：把月访问量翻倍，记下 12 个月的数字；再把它调回去，改成把留存提高 10 个百分点。
        对大多数参数组合，<strong className="text-ink-300">留存那一次的收益更大，而且它是复利的</strong>——
        流量停了就没了，留存改善会一直生效。所以先补漏，再灌水。
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

function Box({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-800/40 p-3">
      <div className="text-ink-400">{k}</div>
      <div className="mt-1 text-lg font-semibold text-brand-300">{v}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-500">{hint}</div>}
    </div>
  )
}
