/**
 * LangGraph 状态图 —— M10 框架编排
 * 节点、条件边、循环、Checkpoint
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const nodes: DiagramNode[] = [
  { id: 'start', label: 'START', x: 50, y: 5, color: 'emerald' },
  { id: 'node_a', label: 'Node A\n推理', x: 50, y: 18, color: 'brand' },
  { id: 'cond', label: '条件\n判断', x: 50, y: 33, color: 'amber' },
  { id: 'node_b', label: 'Node B\n工具调用', x: 25, y: 48, color: 'fuchsia' },
  { id: 'node_c', label: 'Node C\n生成回答', x: 75, y: 48, color: 'emerald' },
  { id: 'checkpoint', label: 'Checkpoint\n状态快照', x: 85, y: 18, color: 'ink' },
  { id: 'end', label: 'END', x: 50, y: 63, color: 'danger' },
]

const edges: DiagramEdge[] = [
  { from: 'start', to: 'node_a', label: '入口' },
  { from: 'node_a', to: 'cond', label: '执行' },
  { from: 'cond', to: 'node_b', label: '需工具' },
  { from: 'cond', to: 'node_c', label: '无需工具' },
  { from: 'node_b', to: 'node_a', label: '循环' },
  { from: 'node_c', to: 'end', label: '完成' },
  { from: 'node_a', to: 'checkpoint', label: '保存', dashed: true },
  { from: 'checkpoint', to: 'node_a', label: '恢复', dashed: true },
]

export function LangGraphStateDiagram() {
  return (
    <ArchitectureDiagram
      title="LangGraph 状态图"
      description="节点 → 条件边路由 → 循环回 Node A 或走向 END。Checkpoint 在每一步保存状态，支持中断恢复。"
      layers={[]}
      nodes={nodes}
      edges={edges}
      height={380}
    />
  )
}