/**
 * Context 组装流程图 —— M3 上下文工程
 * 静态底座 → 动态注入 → 优先级排序 → Token 预算 → 输出
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'static', label: '静态底座', y: 2, height: 22, color: 'brand' },
  { id: 'dynamic', label: '动态注入', y: 26, height: 22, color: 'emerald' },
  { id: 'assemble', label: '组装与输出', y: 50, height: 22, color: 'amber' },
]

const nodes: DiagramNode[] = [
  { id: 'sys', label: 'System\nPrompt', x: 3, y: 8, color: 'brand' },
  { id: 'rules', label: '项目约定', x: 22, y: 8, color: 'brand' },
  { id: 'tools', label: '工具定义', x: 41, y: 8, color: 'brand' },
  { id: 'history', label: '对话历史', x: 3, y: 32, color: 'emerald' },
  { id: 'rag', label: 'RAG 检索', x: 22, y: 32, color: 'emerald' },
  { id: 'user', label: '用户输入', x: 41, y: 32, color: 'emerald' },
  { id: 'priority', label: '优先级\n排序', x: 10, y: 56, color: 'amber' },
  { id: 'budget', label: 'Token\n预算', x: 30, y: 56, color: 'amber' },
  { id: 'output', label: '最终\nContext', x: 50, y: 56, color: 'ink' },
]

const edges: DiagramEdge[] = [
  { from: 'sys', to: 'priority' },
  { from: 'rules', to: 'priority' },
  { from: 'tools', to: 'priority' },
  { from: 'history', to: 'priority' },
  { from: 'rag', to: 'priority' },
  { from: 'user', to: 'priority' },
  { from: 'priority', to: 'budget' },
  { from: 'budget', to: 'output' },
]

export function ContextAssemblyDiagram() {
  return (
    <ArchitectureDiagram
      title="Context 组装流程"
      description="静态底座（System Prompt / 约定 / 工具定义）→ 动态注入（历史 / RAG / 用户输入）→ 优先级排序 → Token 预算裁剪 → 最终 Context。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={380}
    />
  )
}