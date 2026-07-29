/**
 * Cursor Agent 模式架构拆解图 —— M14 L14-02 参考架构案例拆解 I
 * 三层架构：用户交互层 → Agent 推理层 → 工具执行层
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'ui', label: '用户交互层 —— 编辑器 + Diff 预览', y: 2, height: 10, color: 'brand' },
  { id: 'agent', label: 'Agent 推理层 —— Codebase 索引 + Agent Loop', y: 14, height: 10, color: 'emerald' },
  { id: 'tools', label: '工具执行层 —— 文件读写 + 命令执行 + 沙箱', y: 26, height: 10, color: 'amber' },
  { id: 'safety', label: '安全与可靠性层 —— 可回滚 + Checkpoint', y: 38, height: 8, color: 'fuchsia' },
]

const nodes: DiagramNode[] = [
  { id: 'user', label: '用户\n指令', x: 3, y: 4, color: 'ink' },
  { id: 'diff', label: 'Diff\n预览', x: 18, y: 4, color: 'brand' },
  { id: 'editor', label: '编辑器\n集成', x: 33, y: 4, color: 'brand' },
  { id: 'index', label: 'Codebase\n索引(RAG)', x: 3, y: 16, color: 'emerald' },
  { id: 'context', label: '上下文\n组装', x: 18, y: 16, color: 'emerald' },
  { id: 'loop', label: 'Agent\nLoop', x: 33, y: 16, color: 'emerald' },
  { id: 'read', label: '读文件\n/grep', x: 3, y: 28, color: 'amber' },
  { id: 'write', label: '写文件\n/编辑', x: 18, y: 28, color: 'amber' },
  { id: 'command', label: '跑命令\n/测试', x: 33, y: 28, color: 'amber' },
  { id: 'sandbox', label: '沙箱\n执行', x: 48, y: 28, color: 'amber' },
  { id: 'rollback', label: 'Git\n回滚', x: 3, y: 40, color: 'fuchsia' },
  { id: 'checkpoint', label: 'Checkpoint\n状态保存', x: 18, y: 40, color: 'fuchsia' },
  { id: 'verify', label: '验证\n循环', x: 33, y: 40, color: 'fuchsia' },
  { id: 'hitl', label: 'HITL\n审关键点', x: 48, y: 40, color: 'fuchsia' },
]

const edges: DiagramEdge[] = [
  { from: 'user', to: 'diff', label: '输入' },
  { from: 'diff', to: 'editor', label: '展示' },
  { from: 'editor', to: 'loop', label: '触发' },
  { from: 'index', to: 'context', label: '检索' },
  { from: 'context', to: 'loop', label: '注入' },
  { from: 'loop', to: 'read', label: '读' },
  { from: 'loop', to: 'write', label: '改' },
  { from: 'loop', to: 'command', label: '执行' },
  { from: 'write', to: 'sandbox', label: '隔离', dashed: true },
  { from: 'command', to: 'sandbox', label: '隔离', dashed: true },
  { from: 'read', to: 'context', label: '反馈', dashed: true },
  { from: 'sandbox', to: 'verify', label: '结果' },
  { from: 'verify', to: 'loop', label: '失败重试', dashed: true },
  { from: 'verify', to: 'diff', label: '成功', dashed: true },
  { from: 'loop', to: 'checkpoint', label: '保存', dashed: true },
  { from: 'checkpoint', to: 'rollback', label: '恢复', dashed: true },
  { from: 'rollback', to: 'context', label: '回退', dashed: true },
  { from: 'loop', to: 'hitl', label: '关键操作', dashed: true },
  { from: 'hitl', to: 'diff', label: '审后继续', dashed: true },
]

export function CursorArchDiagram() {
  return (
    <ArchitectureDiagram
      title="Cursor Agent 模式架构拆解"
      description="用户指令 → 编辑器集成 → Codebase 索引(RAG) → 上下文组装 → Agent Loop → 文件读写/命令执行 → 沙箱隔离 → 验证循环 → Diff 预览。Checkpoint 可回滚，关键操作 HITL 人审。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={320}
    />
  )
}