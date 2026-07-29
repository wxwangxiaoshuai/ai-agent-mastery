/**
 * Supervisor 模式消息流 —— M11 多智能体
 * Supervisor 接收任务 → 拆解 → 派发 Worker → 收集结果 → 综合输出
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'sup', label: 'Supervisor 层 —— 决策与调度', y: 5, height: 7, color: 'amber' },
  { id: 'workers', label: 'Worker 层 —— 并行执行', y: 14, height: 7, color: 'brand' },
  { id: 'output', label: '综合输出层', y: 23, height: 7, color: 'emerald' },
]

const nodes: DiagramNode[] = [
  { id: 'task', label: '用户\n任务', x: 5, y: 7, color: 'ink' },
  { id: 'plan', label: '规划\n拆解', x: 25, y: 7, color: 'amber' },
  { id: 'dispatch', label: '派发\n任务', x: 45, y: 7, color: 'amber' },
  { id: 'w1', label: 'Worker\n搜索', x: 25, y: 16, color: 'brand' },
  { id: 'w2', label: 'Worker\n分析', x: 45, y: 16, color: 'brand' },
  { id: 'w3', label: 'Worker\n撰写', x: 65, y: 16, color: 'brand' },
  { id: 'collect', label: '收集\n结果', x: 45, y: 25, color: 'emerald' },
  { id: 'synthesize', label: '综合\n输出', x: 65, y: 25, color: 'emerald' },
  { id: 'loop', label: '质量\n检查', x: 85, y: 16, color: 'amber' },
]

const edges: DiagramEdge[] = [
  { from: 'task', to: 'plan', label: '输入' },
  { from: 'plan', to: 'dispatch', label: '拆解完' },
  { from: 'dispatch', to: 'w1', label: '派发' },
  { from: 'dispatch', to: 'w2', label: '派发' },
  { from: 'dispatch', to: 'w3', label: '派发' },
  { from: 'w1', to: 'collect', label: '完成' },
  { from: 'w2', to: 'collect', label: '完成' },
  { from: 'w3', to: 'collect', label: '完成' },
  { from: 'collect', to: 'synthesize', label: '汇总' },
  { from: 'synthesize', to: 'loop', label: '检查' },
  { from: 'loop', to: 'dispatch', label: '不合格\n重派', dashed: true },
]

export function SupervisorPatternDiagram() {
  return (
    <ArchitectureDiagram
      title="Supervisor 模式消息流"
      description="Supervisor 接收任务 → 拆解 → 并行派发 Worker → 收集结果 → 综合输出 → 质量检查 → 不合格则重派。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={260}
    />
  )
}