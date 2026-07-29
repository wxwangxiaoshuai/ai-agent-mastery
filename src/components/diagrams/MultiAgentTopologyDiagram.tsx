/**
 * 四种多 Agent 拓扑静态对比图 —— M11 多智能体
 * 链式、星型、网状、层级 四合一对比
 */
import { ArchitectureDiagram, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const nodes: DiagramNode[] = [
  // 链式 (y: 6-8)
  { id: 'c1', label: 'A', x: 5, y: 6, color: 'brand' },
  { id: 'c2', label: 'B', x: 20, y: 6, color: 'brand' },
  { id: 'c3', label: 'C', x: 35, y: 6, color: 'brand' },
  // 星型 (y: 13-18)
  { id: 's_center', label: 'Hub', x: 20, y: 18, color: 'amber' },
  { id: 's1', label: 'A', x: 5, y: 13, color: 'brand' },
  { id: 's2', label: 'B', x: 20, y: 13, color: 'brand' },
  { id: 's3', label: 'C', x: 35, y: 13, color: 'brand' },
  // 网状 (y: 22-26)
  { id: 'm1', label: 'A', x: 5, y: 24, color: 'fuchsia' },
  { id: 'm2', label: 'B', x: 20, y: 22, color: 'fuchsia' },
  { id: 'm3', label: 'C', x: 35, y: 24, color: 'fuchsia' },
  { id: 'm4', label: 'D', x: 20, y: 26, color: 'fuchsia' },
  // 层级 (y: 30-34)
  { id: 'h_top', label: 'Supervisor', x: 20, y: 30, color: 'emerald' },
  { id: 'h_a', label: 'Worker A', x: 5, y: 34, color: 'brand' },
  { id: 'h_b', label: 'Worker B', x: 20, y: 34, color: 'brand' },
  { id: 'h_c', label: 'Worker C', x: 35, y: 34, color: 'brand' },
]

const edges: DiagramEdge[] = [
  // 链式
  { from: 'c1', to: 'c2', label: '→' },
  { from: 'c2', to: 'c3', label: '→' },
  // 星型
  { from: 's_center', to: 's1', label: '↔', dashed: true },
  { from: 's_center', to: 's2', label: '↔', dashed: true },
  { from: 's_center', to: 's3', label: '↔', dashed: true },
  // 网状
  { from: 'm1', to: 'm2', label: '↔', dashed: true },
  { from: 'm2', to: 'm3', label: '↔', dashed: true },
  { from: 'm3', to: 'm4', label: '↔', dashed: true },
  { from: 'm4', to: 'm1', label: '↔', dashed: true },
  { from: 'm1', to: 'm3', label: '↔', dashed: true },
  // 层级
  { from: 'h_top', to: 'h_a', label: '派发' },
  { from: 'h_top', to: 'h_b', label: '派发' },
  { from: 'h_top', to: 'h_c', label: '派发' },
  { from: 'h_a', to: 'h_top', label: '汇报', dashed: true },
  { from: 'h_b', to: 'h_top', label: '汇报', dashed: true },
  { from: 'h_c', to: 'h_top', label: '汇报', dashed: true },
]

export function MultiAgentTopologyDiagram() {
  return (
    <ArchitectureDiagram
      title="四种多 Agent 拓扑对比"
      description="链式（顺序传递）→ 星型（中心 Hub 调度）→ 网状（全连接对等）→ 层级（Supervisor → Workers）。横轴从左到右：协调成本递增。"
      layers={[]}
      nodes={nodes}
      edges={edges}
      height={520}
    />
  )
}