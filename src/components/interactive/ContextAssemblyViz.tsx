/**
 * 上下文预算分配器 —— M3 L03-02
 * 学员独立调整 5 个槽位的 token 占比，实时看到窗口利用率变化。
 * 超过 100% → 触发裁剪警告，学员需要决定裁哪个。
 */
import { useState } from 'react'

interface Slot {
  id: string
  name: string
  color: string
  priority: number // 裁剪优先级（越小越先被裁）
  defaultPct: number
}

const SLOTS: Slot[] = [
  { id: 'system', name: 'System Prompt', color: '#3b82f6', priority: 5, defaultPct: 15 },
  { id: 'user', name: '用户输入', color: '#22c55e', priority: 4, defaultPct: 10 },
  { id: 'tools', name: '工具结果', color: '#f59e0b', priority: 3, defaultPct: 30 },
  { id: 'docs', name: '检索文档', color: '#ef4444', priority: 2, defaultPct: 25 },
  { id: 'history', name: '对话历史', color: '#8b5cf6', priority: 1, defaultPct: 20 },
]

const WINDOW_TOTAL = 128000

export function ContextAssemblyViz() {
  const [ratios, setRatios] = useState<Record<string, number>>(
    Object.fromEntries(SLOTS.map((s) => [s.id, s.defaultPct]))
  )

  const adjust = (id: string, delta: number) => {
    setRatios((prev) => {
      const current = prev[id] || 0
      const newVal = Math.max(0, Math.min(100, current + delta))
      return { ...prev, [id]: newVal }
    })
  }

  const totalPct = Object.values(ratios).reduce((a, b) => a + b, 0)
  const overBudget = totalPct > 100
  const toTokens = (pct: number) => Math.round(WINDOW_TOTAL * pct / 100)

  // 超预算时按裁剪优先级从低到高标注需要裁剪的 slot
  const needTrim = overBudget
    ? [...SLOTS].sort((a, b) => a.priority - b.priority).slice(0, 2)
    : []

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-1">📐 上下文预算分配器</h3>
      <p className="text-xs text-gray-400 mb-4">
        独立调整每个槽位的 token 占比。超过 100% 时系统会按裁剪优先级自动裁掉低优先级内容。
      </p>

      {/* 利用率���表 */}
      <div className="mb-4 p-3 bg-white rounded border">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">窗口利用率</span>
          <span className={`font-mono font-semibold ${
            overBudget ? 'text-red-600' : totalPct > 80 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {toTokens(totalPct).toLocaleString()} / {WINDOW_TOTAL.toLocaleString()} tokens ({totalPct}%)
          </span>
        </div>
        {/* 分区条：按各 slot 的比例堆叠 */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
          {SLOTS.map((s) => {
            const pct = ratios[s.id] || 0
            if (pct === 0) return null
            return (
              <div
                key={s.id}
                className="h-full transition-all duration-200"
                style={{ width: `${pct}%`, backgroundColor: s.color }}
                title={`${s.name}: ${pct}%`}
              />
            )
          })}
        </div>
        {overBudget && (
          <p className="text-xs text-red-500 mt-1">
            ⚠️ 超预算 {(totalPct - 100)}%，建议裁剪：{needTrim.map((s) => s.name).join('、')}
          </p>
        )}
      </div>

      {/* 各槽位控制器 */}
      {SLOTS.map((slot) => (
        <div key={slot.id} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slot.color }} />
              <span className="text-sm text-gray-700">{slot.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjust(slot.id, -5)}
                disabled={(ratios[slot.id] || 0) <= 0}
                className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="text-sm font-mono w-10 text-center">
                {ratios[slot.id]}%
              </span>
              <button
                onClick={() => adjust(slot.id, 5)}
                disabled={(ratios[slot.id] || 0) >= 100}
                className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
              <span className="text-xs text-gray-400">
                {toTokens(ratios[slot.id]).toLocaleString()} tokens
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            裁剪优先级 {slot.priority}/5
            {slot.priority <= 2 ? ' — 最先被裁' : slot.priority >= 4 ? ' — 最后被裁' : ''}
          </p>
        </div>
      ))}

      <button
        onClick={() => setRatios(Object.fromEntries(SLOTS.map((s) => [s.id, s.defaultPct])))}
        className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
      >
        恢复默认分配
      </button>

      <p className="text-xs text-gray-400 mt-3 border-t pt-2">
        💡 真实系统中你不需要精确到个位数的分配——重点在于理解<strong>每类内容的 token 消耗量级</strong>，
        以及<strong>裁剪优先级的含义</strong>：对话历史比检索文档先被裁，System Prompt 永不裁剪。
      </p>
    </div>
  )
}
