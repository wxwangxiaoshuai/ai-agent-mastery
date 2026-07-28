import { useMemo, useState } from 'react'

/**
 * Token 预算分配器。
 *
 * 教学目标：把"上下文窗口是一笔要分配的预算"这件事变成可拖动的实感 ——
 * 尤其是让人看到，输出预留不够时，模型会在句子中间被截断。
 */

const WINDOWS = [
  { name: '32K', size: 32_000 },
  { name: '128K', size: 128_000 },
  { name: '200K', size: 200_000 },
  { name: '1M', size: 1_000_000 },
]

interface Slot {
  key: string
  name: string
  desc: string
  color: string
  /** 占窗口的百分比 */
  pct: number
  /** 是否可压缩：不可压缩的部分优先保障 */
  hard: boolean
}

const INITIAL: Slot[] = [
  { key: 'system', name: 'System Prompt', desc: '角色、规则、输出格式约定', color: 'bg-brand-500', pct: 3, hard: true },
  { key: 'tools', name: '工具定义', desc: 'Function schema，工具越多涨得越快', color: 'bg-cyan-500', pct: 6, hard: true },
  { key: 'fewshot', name: 'Few-shot 示例', desc: '示例质量比数量重要', color: 'bg-emerald-500', pct: 8, hard: false },
  { key: 'rag', name: 'RAG 检索片段', desc: '最容易失控的一块', color: 'bg-amber-500', pct: 35, hard: false },
  { key: 'history', name: '对话历史', desc: '随轮次单调增长，必须有压缩策略', color: 'bg-fuchsia-500', pct: 25, hard: false },
  { key: 'output', name: '输出预留', desc: '留不够会导致回答被硬截断', color: 'bg-rose-500', pct: 10, hard: true },
]

export function TokenBudgetPlanner() {
  const [windowSize, setWindowSize] = useState(WINDOWS[1].size)
  const [slots, setSlots] = useState<Slot[]>(INITIAL)

  const used = useMemo(() => slots.reduce((s, x) => s + x.pct, 0), [slots])
  const free = 100 - used
  const overflow = used > 100

  const setPct = (key: string, pct: number) =>
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, pct } : s)))

  const outputTokens = Math.round((windowSize * (slots.find((s) => s.key === 'output')?.pct ?? 0)) / 100)

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">Token 预算分配器</h4>
      <p className="mb-4 text-xs text-ink-500">
        拖动各部分占比，观察预算是否超支。真实项目里这张表应该写进配置，而不是散落在代码各处。
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.name}
            onClick={() => setWindowSize(w.size)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              windowSize === w.size
                ? 'border-brand-500/30 bg-brand-500/20 text-brand-300'
                : 'border-ink-700 bg-ink-800/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            {w.name} 窗口
          </button>
        ))}
      </div>

      <div className="mb-1 flex h-7 w-full overflow-hidden rounded-lg bg-ink-950/60">
        {slots.map((s) => (
          <div
            key={s.key}
            className={`${s.color} transition-all`}
            style={{ width: `${Math.min(s.pct, 100)}%` }}
            title={`${s.name} ${s.pct}%`}
          />
        ))}
        {free > 0 && <div className="flex-1 bg-ink-800/40" />}
      </div>
      <div className="mb-4 flex justify-between text-xs">
        <span className={overflow ? 'text-rose-400' : 'text-ink-500'}>
          已分配 {used}%（约 {Math.round((windowSize * used) / 100).toLocaleString()} tokens）
        </span>
        <span className="text-ink-500">剩余 {free}%</span>
      </div>

      {overflow && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          预算超支 {used - 100}%。真实系统里这不会报错，而是静默截断 —— 通常先丢掉最前面的对话历史，
          于是 Agent 会"忘记"你三轮之前说过的话。务必在组装阶段就做硬性裁剪。
        </div>
      )}

      <div className="space-y-3">
        {slots.map((s) => (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.color}`} />
                <span className="font-medium text-ink-200">{s.name}</span>
                {s.hard && (
                  <span className="rounded border border-ink-700 px-1 text-[10px] text-ink-500">不可压缩</span>
                )}
              </span>
              <span className="font-mono text-ink-400">
                {s.pct}% · {Math.round((windowSize * s.pct) / 100).toLocaleString()} tok
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              value={s.pct}
              onChange={(e) => setPct(s.key, Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <p className="text-[11px] text-ink-500">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-ink-950/60 p-3 text-xs text-ink-400">
        输出预留 <span className="font-mono text-ink-200">{outputTokens.toLocaleString()}</span> tokens
        {outputTokens < 1000 ? (
          <span className="text-rose-400">
            {' '}
            —— 少于 1000，稍长的回答就会被截断在句子中间。
          </span>
        ) : (
          <span> —— 够写约 {Math.round(outputTokens / 1.6).toLocaleString()} 个汉字。</span>
        )}
      </div>
    </div>
  )
}
