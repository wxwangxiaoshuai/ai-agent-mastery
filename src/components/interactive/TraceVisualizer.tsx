/**
 * Trace 调用链可视化 —— M13 L13-05 可观测
 * 展示一次 Agent 调用的 trace 展开树：LLM→Tool→LLM 的层级关系和时间分布
 */
import { useState } from 'react'

interface SpanNode {
  id: string
  name: string
  type: 'llm' | 'tool' | 'agent'
  duration: number
  children?: SpanNode[]
  metadata?: string
}

const TRACE: SpanNode = {
  id: 'root',
  name: 'Agent.run()',
  type: 'agent',
  duration: 3420,
  children: [
    {
      id: 'llm1',
      name: 'LLM: 推理 → 决定调 search_web',
      type: 'llm',
      duration: 1200,
      metadata: 'tokens: 350 in / 80 out',
    },
    {
      id: 'tool1',
      name: 'Tool: search_web("ReAct Agent")',
      type: 'tool',
      duration: 850,
      metadata: 'status: 200, 3 results',
    },
    {
      id: 'llm2',
      name: 'LLM: 推理 → 决定调 execute_code',
      type: 'llm',
      duration: 980,
      metadata: 'tokens: 420 in / 120 out',
    },
    {
      id: 'tool2',
      name: 'Tool: execute_code("print(2+2)")',
      type: 'tool',
      duration: 120,
      metadata: 'exit_code: 0, stdout: 4',
    },
    {
      id: 'llm3',
      name: 'LLM: 推理 → 生成最终答案',
      type: 'llm',
      duration: 270,
      metadata: 'tokens: 300 in / 150 out',
    },
  ],
}

const COLORS = { llm: '#3b82f6', tool: '#f59e0b', agent: '#8b5cf6' }
const LABELS = { llm: 'LLM', tool: 'Tool', agent: 'Agent' }

export function TraceVisualizer() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']))

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const renderNode = (node: SpanNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const pct = Math.round(node.duration / TRACE.duration * 100)
    const barWidth = Math.max(pct, 2)

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-1 cursor-pointer hover:bg-white rounded px-1"
          style={{ marginLeft: depth * 20 }}
          onClick={() => toggle(node.id)}
        >
          <span className="text-xs text-gray-300 w-4">
            {hasChildren ? (isExpanded ? '▼' : '▶') : '·'}
          </span>
          <span
            className="text-[10px] px-1 py-0.5 rounded text-white font-medium"
            style={{ backgroundColor: COLORS[node.type] }}
          >
            {LABELS[node.type]}
          </span>
          <span className="text-xs text-gray-600 flex-1 truncate">{node.name}</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${barWidth}%`, backgroundColor: COLORS[node.type] }}
              />
            </div>
            <span className="text-[10px] text-gray-400 w-10 text-right">{node.duration}ms</span>
            <span className="text-[10px] text-gray-300 w-8 text-right">{pct}%</span>
          </div>
        </div>

        {isExpanded && node.metadata && (
          <div style={{ marginLeft: (depth + 1) * 20 }} className="text-[10px] text-gray-400 py-0.5">
            {node.metadata}
          </div>
        )}

        {isExpanded && hasChildren && node.children!.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50 font-mono">
      <h3 className="font-semibold text-gray-700 mb-1">🔍 Trace 调用链</h3>
      <p className="text-xs text-gray-400 mb-3">
        一次简单问答的完整 trace：Agent → LLM 推理 → 工具调用 → LLM 再推理 → 工具调用 → 最终答案。
        展开每个节点看元数据。点击展开/折叠。
      </p>

      <div className="divide-y divide-gray-100">
        {renderNode(TRACE)}
      </div>

      <div className="mt-3 pt-2 border-t flex flex-wrap gap-2 text-[10px] text-gray-400">
        <span>总计: {TRACE.duration}ms</span>
        <span>· LLM 调用: 3 次</span>
        <span>· 工具调用: 2 次</span>
        <span>· 总 token: 1420</span>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        💡 Trace 的价值：运行后你首先看的是<strong>时间占比</strong>——如果 LLM 推理占了 95%，
        优化工具响应没用；如果工具调用了 10 次才得到答案，说明你的 prompt 或 tools 设计有问题。
      </p>
    </div>
  )
}
