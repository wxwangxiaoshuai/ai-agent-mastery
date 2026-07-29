/**
 * 设计模式全景分类图 —— M5 L05-07 Agent 设计模式全景
 * 展示五大基础模式 + 课程模块映射
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'patterns', label: '五大基础模式', y: 2, height: 30, color: 'brand' },
  { id: 'modules', label: '课程模块映射', y: 34, height: 30, color: 'emerald' },
  { id: 'decision', label: '模式选择决策树', y: 66, height: 26, color: 'amber' },
]

const nodes: DiagramNode[] = [
  { id: 'chain', label: 'Prompt\nChaining', x: 3, y: 12, color: 'brand' },
  { id: 'route', label: 'Routing', x: 22, y: 12, color: 'brand' },
  { id: 'parallel', label: 'Parallelization', x: 41, y: 12, color: 'brand' },
  { id: 'orch', label: 'Orchestrator\n-Workers', x: 60, y: 12, color: 'brand' },
  { id: 'eval', label: 'Evaluator\n-Optimizer', x: 79, y: 12, color: 'brand' },
  { id: 'm2', label: 'M2 Prompt', x: 3, y: 44, color: 'emerald' },
  { id: 'm6', label: 'M6 工具', x: 22, y: 44, color: 'emerald' },
  { id: 'm11', label: 'M11 多Agent', x: 41, y: 44, color: 'emerald' },
  { id: 'm5', label: 'M5 Agent', x: 60, y: 44, color: 'emerald' },
  { id: 'm13', label: 'M13 评估', x: 79, y: 44, color: 'emerald' },
  { id: 'q1', label: '可预定义\n步骤？', x: 15, y: 72, color: 'amber' },
  { id: 'q2', label: '可并行？', x: 40, y: 72, color: 'amber' },
  { id: 'q3', label: '需动态\n拆任务？', x: 60, y: 72, color: 'amber' },
  { id: 'q4', label: '有质量\n门禁？', x: 80, y: 72, color: 'amber' },
]

const edges: DiagramEdge[] = [
  { from: 'chain', to: 'm2', dashed: true },
  { from: 'route', to: 'm6', dashed: true },
  { from: 'parallel', to: 'm6', dashed: true },
  { from: 'parallel', to: 'm11', dashed: true },
  { from: 'orch', to: 'm11', dashed: true },
  { from: 'eval', to: 'm5', dashed: true },
  { from: 'eval', to: 'm13', dashed: true },
  { from: 'q1', to: 'q2', label: '否' },
  { from: 'q2', to: 'q3', label: '否' },
  { from: 'q3', to: 'q4', label: '否' },
]

export function PatternMapDiagram() {
  return (
    <ArchitectureDiagram
      title="Agent 设计模式全景地图"
      description={`五大基础模式（上）→ 课程模块映射（中）→ 模式选择决策树（下）。让学习者看到“全景地图”，知道自己学过的和还没学的各在什么位置。`}
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={440}
    />
  )
}