import { useState } from 'react'
import {
  CALIBRATED_ON,
  MODEL_TIERS,
  calibrationAgeDays,
  type ModelTier,
} from '../../data/models'

/**
 * 模型档位对照表。
 *
 * 数据全部来自 src/data/models.ts —— 全站模型标识的唯一真源。
 * 教学目标：让"按档位选型"成为默认思路，而不是记住某个具体型号。
 */

export function ModelTierTable() {
  const [active, setActive] = useState<ModelTier>('mid')
  const spec = MODEL_TIERS.find((t) => t.tier === active) ?? MODEL_TIERS[0]
  const age = calibrationAgeDays()

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">模型档位对照</h4>
      <p className="mb-4 text-xs text-ink-500">
        先选档位，再选型号。档位描述的是"这类任务该花多少钱"，比型号活得久得多。
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {MODEL_TIERS.map((t) => (
          <button
            key={t.tier}
            onClick={() => setActive(t.tier)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active === t.tier
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mb-3 space-y-2">
        <p className="text-xs text-ink-300">
          <span className="text-ink-500">适合：</span>
          {spec.useFor}
        </p>
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] text-amber-300">
          不适合：{spec.avoidFor}
        </p>
      </div>

      {spec.models.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-900/60 text-ink-500">
              <tr>
                <th className="px-3 py-2 font-medium">标识</th>
                <th className="px-3 py-2 font-medium">厂商</th>
                <th className="px-3 py-2 font-medium">类型</th>
              </tr>
            </thead>
            <tbody>
              {spec.models.map((m) => (
                <tr key={`${m.vendor}-${m.id}`} className="border-t border-ink-800">
                  <td className="px-3 py-2 font-mono text-ink-200">{m.id}</td>
                  <td className="px-3 py-2 text-ink-400">{m.vendor}</td>
                  <td className="px-3 py-2">
                    {m.snapshot ? (
                      <span className="text-emerald-300">快照 ID · 生产环境用它</span>
                    ) : (
                      <span className="text-ink-500">别名 · 可能被无声升级</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-ink-950/60 p-3 text-xs text-ink-500">
          这一档的具体型号请以厂商文档为准 —— 向量模型换代频率高，且必须建库、查询用同一个，
          课程不在这里钉死任何一个。
        </p>
      )}

      <p className="mt-3 text-[11px] text-ink-500">
        本表最后校准于 {CALIBRATED_ON}（{age} 天前）。模型迭代极快，价格与能力一律以厂商官方文档为准；
        本站只保证"这里列出的标识在校准当日是真实存在的"。
      </p>
    </div>
  )
}
