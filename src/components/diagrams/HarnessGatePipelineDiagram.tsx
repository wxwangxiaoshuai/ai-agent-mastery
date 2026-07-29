/**
 * Harness 门禁管道全景图 —— M17 L17-14 Harness 质量门禁
 * Gate 0-8 的完整流程，展示门禁在 OpenSpec + Superpowers 工作流中的位置
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'before', label: '实现前门禁（Gate 0-2）', y: 2, height: 12, color: 'brand' },
  { id: 'during', label: '实现中门禁（Gate 3-5）', y: 16, height: 12, color: 'emerald' },
  { id: 'after', label: '提交前门禁（Gate 6-7）', y: 30, height: 12, color: 'amber' },
  { id: 'archive', label: '归档门禁（Gate 8）', y: 44, height: 10, color: 'violet' },
]

const nodes: DiagramNode[] = [
  { id: 'g0', label: 'Gate 0\n探索门禁', x: 3, y: 5, color: 'brand' },
  { id: 'g1', label: 'Gate 1\n规格门禁', x: 18, y: 5, color: 'brand' },
  { id: 'g2', label: 'Gate 2\n计划门禁', x: 33, y: 5, color: 'brand' },
  { id: 'g3', label: 'Gate 3\n执行门禁', x: 3, y: 19, color: 'emerald' },
  { id: 'g4', label: 'Gate 4\nReview门禁', x: 18, y: 19, color: 'emerald' },
  { id: 'g5', label: 'Gate 5\n完成门禁', x: 33, y: 19, color: 'emerald' },
  { id: 'g6', label: 'Gate 6\nPre-commit', x: 3, y: 33, color: 'amber' },
  { id: 'g7', label: 'Gate 7\nPre-push', x: 18, y: 33, color: 'amber' },
  { id: 'g8', label: 'Gate 8\n归档检查', x: 3, y: 46, color: 'violet' },
  { id: 'start', label: '开始', x: 3, y: 1, width: 10, height: 4, color: 'ink' },
  { id: 'done', label: '完成', x: 3, y: 52, width: 10, height: 4, color: 'ink' },
]

const edges: DiagramEdge[] = [
  { from: 'start', to: 'g0' },
  { from: 'g0', to: 'g1' },
  { from: 'g1', to: 'g2' },
  { from: 'g2', to: 'g3' },
  { from: 'g3', to: 'g4' },
  { from: 'g4', to: 'g5' },
  { from: 'g5', to: 'g6' },
  { from: 'g6', to: 'g7' },
  { from: 'g7', to: 'g8' },
  { from: 'g8', to: 'done' },
]

export function HarnessGatePipelineDiagram() {
  return (
    <ArchitectureDiagram
      title="Harness 门禁管道全景：Gate 0-8"
      description="四个阶段 9 道门禁，在 AI 产出代码的每一个关键节点自动触发检查，不通过就阻断。从探索到归档，全程质量兜底。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={320}
    />
  )
}