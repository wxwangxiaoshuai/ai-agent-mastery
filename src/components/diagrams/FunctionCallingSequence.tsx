/**
 * Function Calling 调用链时序图 —— M6 工具使用
 * User → Agent → Tool → Agent → User
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'user', label: '用户', y: 2, height: 18, color: 'ink' },
  { id: 'agent', label: 'Agent（LLM + 推理）', y: 22, height: 18, color: 'brand' },
  { id: 'tools', label: '工具层', y: 42, height: 18, color: 'emerald' },
]

const nodes: DiagramNode[] = [
  { id: 'u1', label: '用户输入', x: 3, y: 8, color: 'ink' },
  { id: 'a1', label: '解析意图', x: 3, y: 28, color: 'brand' },
  { id: 'a2', label: '选择工具', x: 22, y: 28, color: 'brand' },
  { id: 'a3', label: '解析结果', x: 41, y: 28, color: 'brand' },
  { id: 'a4', label: '生成回答', x: 60, y: 28, color: 'brand' },
  { id: 't1', label: 'Tool A\n执行', x: 22, y: 48, color: 'emerald' },
  { id: 't2', label: 'Tool B\n执行', x: 41, y: 48, color: 'emerald' },
  { id: 'u2', label: '最终回复', x: 80, y: 8, color: 'ink' },
]

const edges: DiagramEdge[] = [
  { from: 'u1', to: 'a1' },
  { from: 'a1', to: 'a2' },
  { from: 'a2', to: 't1', label: 'call', dashed: true },
  { from: 't1', to: 'a3', label: 'result', dashed: true },
  { from: 'a3', to: 'a2', label: '继续？' },
  { from: 'a2', to: 't2', label: 'call', dashed: true },
  { from: 't2', to: 'a3', label: 'result', dashed: true },
  { from: 'a3', to: 'a4' },
  { from: 'a4', to: 'u2' },
]

export function FunctionCallingSequence() {
  return (
    <ArchitectureDiagram
      title="Function Calling 调用链"
      description="用户输入 → Agent 解析意图 → 选择工具 → 工具执行 → 解析结果 → 可能继续调用 → 生成最终回答。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={360}
    />
  )
}