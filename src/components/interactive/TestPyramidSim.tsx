/**
 * 测试金字塔配比模拟器 —— M13 L13-07 Agent 测试金字塔
 * 拖动滑块调整各层比例 → 实时计算总测试量和预估成本
 */
import { useState } from 'react'

interface LayerData {
  id: string
  name: string
  description: string
  examples: string
  unitCost: number // 单例耗时（秒）
}

const LAYERS: LayerData[] = [
  {
    id: 'unit',
    name: '单元测试（底层）',
    description: '纯函数、工具方法、状态机转换 —— 不调 LLM',
    examples: 'TokenCounter.count(), 状态转换逻辑, 数据清洗函数',
    unitCost: 0.01,
  },
  {
    id: 'integration',
    name: '集成测试（中层）',
    description: 'Tool + API 连线、Retriever + 向量库 —— 调真实 SDK 但不调 LLM',
    examples: 'RAG 检索→重排管线, MCP Server 连通性, DB 查询正确性',
    unitCost: 0.5,
  },
  {
    id: 'e2e',
    name: '端到端测试（顶层）',
    description: '完整 Agent 交互 —— 调真实 LLM，最贵最慢',
    examples: '用户问→Agent 推理→调工具→返回结果, 多轮对话完整性',
    unitCost: 3.0,
  },
]

export function TestPyramidSim() {
  const [counts, setCounts] = useState<Record<string, number>>({
    unit: 40,
    integration: 15,
    e2e: 5,
  })

  const adjust = (id: string, delta: number) => {
    const next = Math.max(0, (counts[id] || 0) + delta)
    setCounts((prev) => ({ ...prev, [id]: next }))
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const time = LAYERS.reduce((sum, l) => sum + (counts[l.id] || 0) * l.unitCost, 0)

  const getPct = (id: string) =>
    total > 0 ? Math.round((counts[id] || 0) / total * 100) : 0

  const colors = { unit: 'bg-green-500', integration: 'bg-yellow-500', e2e: 'bg-red-500' }

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-3">🔺 测试金字塔配比器</h3>
      <p className="text-xs text-gray-400 mb-3">
        Agent 测试和传统程序不同——E2E 调一次 LLM 就是几秒钟和几毛钱。
        调滑块看配比变化如何影响总成本和时间。
      </p>

      {/* 各层控制 */}
      <div className="space-y-3 mb-4">
        {LAYERS.map((layer) => (
          <div key={layer.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600">{layer.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjust(layer.id, -1)}
                  className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300"
                >
                  −
                </button>
                <span className="text-sm font-mono w-8 text-center">{counts[layer.id]}</span>
                <button
                  onClick={() => adjust(layer.id, 1)}
                  className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300"
                >
                  +
                </button>
                <span className="text-xs text-gray-400 ml-1">
                  ({getPct(layer.id)}%)
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[layer.id]} transition-all duration-200`}
                style={{ width: `${getPct(layer.id)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{layer.description}</p>
          </div>
        ))}
      </div>

      {/* 汇总 */}
      <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
        <div>
          <span className="text-gray-400">总用例数</span>
          <div className="text-lg font-mono font-semibold text-gray-700">{total}</div>
        </div>
        <div>
          <span className="text-gray-400">预估耗时</span>
          <div className={`text-lg font-mono font-semibold ${
            time > 60 ? 'text-red-600' : time > 20 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {time.toFixed(1)}s
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        💡 Agent 项目的健康金字塔：单元 60-80% / 集成 15-30% / E2E 5-10%。
        E2E 过多 = CI 慢且贵。单元过少 = 重构没底气。
      </p>
    </div>
  )
}
