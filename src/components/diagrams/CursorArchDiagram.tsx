/**
 * Cursor Agent 模式架构拆解图 —— M14 L14-02
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-ui', '用户交互层 —— 编辑器 + Diff 预览', 0, 0, 820, 120, 'brand'),
  g('lane-agent', 'Agent 推理层 —— Codebase 索引 + Agent Loop', 0, 140, 820, 120, 'emerald'),
  g('lane-tools', '工具执行层 —— 文件读写 + 命令 + 沙箱', 0, 280, 820, 120, 'amber'),
  g('lane-safety', '安全可靠性层 —— 可回滚 + Checkpoint', 0, 420, 820, 120, 'fuchsia'),
  n('user', '用户\n指令', 40, 45, { color: 'ink', parentId: 'lane-ui' }),
  n('editor', '编辑器\n集成', 220, 45, { color: 'brand', parentId: 'lane-ui' }),
  n('diff', 'Diff\n预览', 520, 45, { color: 'brand', parentId: 'lane-ui' }),
  n('index', 'Codebase\n索引', 40, 45, { color: 'emerald', parentId: 'lane-agent' }),
  n('context', '上下文\n组装', 250, 45, { color: 'emerald', parentId: 'lane-agent' }),
  n('loop', 'Agent\nLoop', 460, 45, { color: 'emerald', parentId: 'lane-agent' }),
  n('read', '读文件\n/grep', 40, 45, { color: 'amber', parentId: 'lane-tools' }),
  n('write', '写文件\n/编辑', 220, 45, { color: 'amber', parentId: 'lane-tools' }),
  n('command', '跑命令\n/测试', 400, 45, { color: 'amber', parentId: 'lane-tools' }),
  n('sandbox', '沙箱\n执行', 580, 45, { color: 'amber', parentId: 'lane-tools' }),
  n('rollback', 'Git\n回滚', 40, 45, { color: 'fuchsia', parentId: 'lane-safety' }),
  n('checkpoint', 'Checkpoint\n状态保存', 220, 45, { color: 'fuchsia', parentId: 'lane-safety' }),
  n('verify', '验证\n循环', 420, 45, { color: 'fuchsia', parentId: 'lane-safety' }),
  n('hitl', 'HITL\n审敏感点', 620, 45, { color: 'fuchsia', parentId: 'lane-safety' }),
]

const edges = [
  e('user', 'editor', { label: '输入' }),
  e('editor', 'loop', { label: '触发', sourceHandle: 'b', targetHandle: 't' }),
  e('editor', 'index', { label: '打开仓', dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('index', 'context', { label: '检索' }),
  e('context', 'loop', { label: '注入' }),
  e('loop', 'read', { label: '调用', sourceHandle: 'b', targetHandle: 't', id: 'loop-read' }),
  e('loop', 'write', { label: '调用', sourceHandle: 'b', targetHandle: 't', id: 'loop-write' }),
  e('loop', 'command', { label: '调用', sourceHandle: 'b', targetHandle: 't', id: 'loop-cmd' }),
  e('command', 'sandbox', { label: '隔离执行' }),
  e('read', 'verify', { label: '结果', dashed: true, sourceHandle: 'b', targetHandle: 't', id: 'read-v' }),
  e('write', 'verify', { label: '结果', dashed: true, sourceHandle: 'b', targetHandle: 't', id: 'write-v' }),
  e('sandbox', 'verify', { label: '结果', sourceHandle: 'b', targetHandle: 't' }),
  e('verify', 'diff', { label: '成功预览', dashed: true, sourceHandle: 't', targetHandle: 'b' }),
  e('verify', 'loop', {
    label: '继续/重试',
    dashed: true,
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'verify-loop',
  }),
  e('loop', 'checkpoint', { label: '保存', dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('checkpoint', 'rollback', { label: '恢复', dashed: true }),
  e('write', 'hitl', { label: '敏感写', dashed: true, sourceHandle: 'b', targetHandle: 't', id: 'w-hitl' }),
  e('command', 'hitl', { label: '敏感命令', dashed: true, sourceHandle: 'b', targetHandle: 't', id: 'c-hitl' }),
]

export function CursorArchDiagram() {
  return (
    <DiagramShell
      title="Cursor Agent 模式架构拆解"
      description="用户指令 → 编辑器集成 → Codebase 索引(RAG) → 上下文组装 → Agent Loop → 并行调用读/写/命令（沙箱）→ 验证循环 → Diff 预览或继续/重试回环。Checkpoint 可回滚，敏感操作 HITL 人审。"
      height={600}
      nodes={nodes}
      edges={edges}
    />
  )
}
