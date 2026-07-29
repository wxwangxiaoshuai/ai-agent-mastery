/**
 * Human-in-the-Loop 中断流程 —— M10 框架编排
 * Agent 执行 → 高风险动作 → 暂停 → 人工审核 → 继续/拒绝
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'auto', label: 'Agent 自主执行区', y: 10, height: 12, color: 'brand' },
  { id: 'gate', label: 'HITL 审批门禁', y: 28, height: 12, color: 'amber' },
  { id: 'human', label: '人工决策区', y: 46, height: 12, color: 'fuchsia' },
  { id: 'result', label: '执行结果', y: 64, height: 12, color: 'emerald' },
]

const nodes: DiagramNode[] = [
  { id: 'agent', label: 'Agent\n执行', x: 5, y: 13, color: 'brand' },
  { id: 'tool', label: '工具\n调用', x: 25, y: 13, color: 'brand' },
  { id: 'risk', label: '风险\n判断', x: 45, y: 13, color: 'amber' },
  { id: 'low', label: '低风险\n自动放行', x: 65, y: 13, color: 'emerald' },
  { id: 'pause', label: '暂停\n等待审核', x: 45, y: 31, color: 'amber' },
  { id: 'review', label: '人工\n审核', x: 45, y: 49, color: 'fuchsia' },
  { id: 'approve', label: '批准\n继续', x: 25, y: 67, color: 'emerald' },
  { id: 'reject', label: '拒绝\n回退', x: 65, y: 67, color: 'danger' },
  { id: 'timeout', label: '超时\n降级', x: 85, y: 49, color: 'amber' },
]

const edges: DiagramEdge[] = [
  { from: 'agent', to: 'tool', label: '调用' },
  { from: 'tool', to: 'risk', label: '结果' },
  { from: 'risk', to: 'low', label: '安全' },
  { from: 'risk', to: 'pause', label: '高风险' },
  { from: 'pause', to: 'review', label: '通知' },
  { from: 'review', to: 'approve', label: '通过' },
  { from: 'review', to: 'reject', label: '拒绝' },
  { from: 'pause', to: 'timeout', label: '超时', dashed: true },
  { from: 'timeout', to: 'reject', label: '降级', dashed: true },
  { from: 'low', to: 'tool', label: '继续', dashed: true },
  { from: 'approve', to: 'tool', label: '继续', dashed: true },
]

export function HITLFlowDiagram() {
  return (
    <ArchitectureDiagram
      title="HITL 人工介入流程"
      description="Agent 执行 → 工具调用 → 风险判断 → 低风险自动放行，高风险暂停等待人工审核 → 批准/拒绝/超时降级。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={420}
    />
  )
}