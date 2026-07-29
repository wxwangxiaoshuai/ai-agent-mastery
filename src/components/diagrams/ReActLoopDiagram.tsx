/**
 * ReAct 循环状态图 —— M5 Agent 核心架构
 * Thought → Action → Observation → Thought 闭环
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'agent', label: 'Agent 推理层', y: 2, height: 16, color: 'brand' },
  { id: 'env', label: '外部环境 / 工具', y: 20, height: 14, color: 'amber' },
]

const nodes: DiagramNode[] = [
  { id: 'thought', label: 'Thought', x: 5, y: 7, color: 'brand' },
  { id: 'action', label: 'Action', x: 38, y: 7, color: 'brand' },
  { id: 'obs', label: 'Observation', x: 71, y: 7, color: 'brand' },
  { id: 'tool', label: 'Tool\nCall', x: 38, y: 26, color: 'amber' },
  { id: 'answer', label: 'Answer', x: 88, y: 7, color: 'emerald' },
]

const edges: DiagramEdge[] = [
  { from: 'thought', to: 'action', label: '决定行动' },
  { from: 'action', to: 'tool', label: '调用', dashed: true },
  { from: 'tool', to: 'obs', label: '返回结果', dashed: true },
  { from: 'obs', to: 'thought', label: '循环' },
  { from: 'thought', to: 'answer', label: '完成' },
]

export function ReActLoopDiagram() {
  return (
    <ArchitectureDiagram
      title="ReAct 循环：Thought → Action → Observation"
      description="Agent 在思考-行动-观察的循环中自主完成任务，直到得出最终答案。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={280}
    />
  )
}