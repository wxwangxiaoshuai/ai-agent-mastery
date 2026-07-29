/**
 * OpenSpec + Superpowers 工作流全貌 —— M17 AI Coding 工程实践
 * User → OpenSpec → Superpowers → Harness → 产出
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'spec', label: 'OpenSpec 规格层 —— "做什么"', y: 2, height: 22, color: 'brand' },
  { id: 'process', label: 'Superpowers 流程层 —— "怎么做"', y: 26, height: 22, color: 'emerald' },
  { id: 'gate', label: 'Harness 门禁层 —— "谁检查"', y: 50, height: 22, color: 'amber' },
]

const nodes: DiagramNode[] = [
  { id: 'user', label: 'User', x: 3, y: 8, color: 'ink' },
  { id: 'explore', label: 'explore', x: 18, y: 8, color: 'brand' },
  { id: 'propose', label: 'propose', x: 33, y: 8, color: 'brand' },
  { id: 'apply', label: 'apply', x: 48, y: 8, color: 'brand' },
  { id: 'archive', label: 'archive', x: 63, y: 8, color: 'brand' },
  { id: 'brainstorm', label: 'brainstorming', x: 18, y: 32, color: 'emerald' },
  { id: 'plan', label: 'writing-plans', x: 33, y: 32, color: 'emerald' },
  { id: 'tdd', label: 'TDD', x: 48, y: 32, color: 'emerald' },
  { id: 'subagent', label: 'subagent-dev', x: 63, y: 32, color: 'emerald' },
  { id: 'review', label: 'code-review', x: 78, y: 32, color: 'emerald' },
  { id: 'g0', label: 'Gate\n0-2', x: 18, y: 56, color: 'amber' },
  { id: 'g3', label: 'Gate\n3-5', x: 48, y: 56, color: 'amber' },
  { id: 'g6', label: 'Gate\n6-7', x: 68, y: 56, color: 'amber' },
  { id: 'g8', label: 'Gate 8', x: 83, y: 56, color: 'amber' },
  { id: 'output', label: '产出', x: 88, y: 8, color: 'ink' },
]

const edges: DiagramEdge[] = [
  { from: 'user', to: 'explore' },
  { from: 'explore', to: 'propose' },
  { from: 'propose', to: 'apply' },
  { from: 'apply', to: 'archive' },
  { from: 'archive', to: 'output' },
  { from: 'explore', to: 'brainstorm', dashed: true },
  { from: 'propose', to: 'plan', dashed: true },
  { from: 'apply', to: 'tdd', dashed: true },
  { from: 'apply', to: 'subagent', dashed: true },
  { from: 'subagent', to: 'review', dashed: true },
  { from: 'brainstorm', to: 'g0', dashed: true },
  { from: 'plan', to: 'g0', dashed: true },
  { from: 'tdd', to: 'g3', dashed: true },
  { from: 'subagent', to: 'g3', dashed: true },
  { from: 'review', to: 'g3', dashed: true },
  { from: 'g3', to: 'g6', dashed: true },
  { from: 'g6', to: 'g8', dashed: true },
  { from: 'g8', to: 'output', dashed: true },
]

export function OpenSpecWorkflowDiagram() {
  return (
    <ArchitectureDiagram
      title="OpenSpec + Superpowers + Harness 工作流"
      description={`OpenSpec 定义"做什么"（explore→propose→apply→archive），Superpowers 指导"怎么做"（brainstorming/TDD/subagent/code-review），Harness 门禁在每个节点检查质量。`}
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={400}
    />
  )
}