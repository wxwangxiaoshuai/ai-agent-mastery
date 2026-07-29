/**
 * Circuit Breaker 三态转换图 —— M7 Agent Harness 工程化
 * Closed → Open → Half-Open → Closed
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const nodes: DiagramNode[] = [
  { id: 'closed', label: 'Closed\n正常', x: 5, y: 12, color: 'emerald' },
  { id: 'open', label: 'Open\n熔断', x: 38, y: 12, color: 'danger' },
  { id: 'half', label: 'Half-Open\n探测', x: 71, y: 12, color: 'amber' },
  { id: 'fail', label: '故障\n阈值触发', x: 20, y: 3, color: 'danger' },
  { id: 'timeout', label: '超时\n冷却到期', x: 55, y: 3, color: 'amber' },
  { id: 'success', label: '探测\n成功', x: 55, y: 22, color: 'emerald' },
  { id: 'refail', label: '探测\n失败', x: 20, y: 22, color: 'danger' },
]

const edges: DiagramEdge[] = [
  { from: 'closed', to: 'open', label: '故障', dashed: true },
  { from: 'fail', to: 'open', label: '触发', dashed: true },
  { from: 'open', to: 'half', label: '冷却', dashed: true },
  { from: 'timeout', to: 'half', label: '到期', dashed: true },
  { from: 'half', to: 'closed', label: '恢复', dashed: true },
  { from: 'half', to: 'open', label: '再熔断', dashed: true },
  { from: 'success', to: 'closed', dashed: true },
  { from: 'refail', to: 'open', dashed: true },
]

export function CircuitBreakerDiagram() {
  return (
    <ArchitectureDiagram
      title="Circuit Breaker 三态转换"
      description="Closed（正常）→ 故障阈值触发 → Open（熔断）→ 冷却到期 → Half-Open（探测）→ 成功则恢复 Closed，失败则回到 Open。"
      layers={[]}
      nodes={nodes}
      edges={edges}
      height={360}
    />
  )
}