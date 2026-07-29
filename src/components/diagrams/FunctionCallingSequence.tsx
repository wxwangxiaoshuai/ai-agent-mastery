/**
 * Function Calling 调用链时序图 —— M6 工具使用
 * 含多轮 tool 回环
 */
import { DiagramShell, n, e, g } from './_shared'

const H = 56

const nodes = [
  g('lane-user', '用户', 0, 0, 780, 100, 'ink'),
  g('lane-agent', 'Agent（LLM + 推理）', 0, 120, 780, 120, 'brand'),
  g('lane-tools', '工具层', 0, 260, 780, 110, 'emerald'),
  n('u1', '用户输入', 40, 35, { color: 'ink', height: H, parentId: 'lane-user' }),
  n('u2', '最终回复', 620, 35, { color: 'ink', height: H, parentId: 'lane-user' }),
  n('a1', '解析意图', 40, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('a2', '选择工具', 230, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('a3', '解析结果', 420, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('a4', '生成回答', 610, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('t1', 'Tool A\n执行', 230, 40, { color: 'emerald', height: H, parentId: 'lane-tools' }),
  n('t2', 'Tool B\n执行', 420, 40, { color: 'emerald', height: H, parentId: 'lane-tools' }),
]

const edges = [
  e('u1', 'a1', { label: '请求', sourceHandle: 'b', targetHandle: 't', accent: 'ink' }),
  e('a1', 'a2', { accent: 'brand' }),
  e('a2', 't1', { label: 'call', dashed: true, sourceHandle: 'b', targetHandle: 't', accent: 'emerald' }),
  e('t1', 'a3', { label: 'result', dashed: true, sourceHandle: 't', targetHandle: 'b', accent: 'emerald' }),
  e('a3', 'a2', {
    label: '继续调用',
    dashed: true,
    sourceHandle: 'l',
    targetHandle: 'r',
    accent: 'amber',
    id: 'multi-loop',
  }),
  e('a2', 't2', {
    label: 'call',
    dashed: true,
    sourceHandle: 'b',
    targetHandle: 't',
    accent: 'emerald',
    id: 'a2-t2',
  }),
  e('t2', 'a3', {
    label: 'result',
    dashed: true,
    sourceHandle: 't',
    targetHandle: 'b',
    accent: 'emerald',
    id: 't2-a3',
  }),
  e('a3', 'a4', { label: '足够', accent: 'brand' }),
  e('a4', 'u2', { label: '回复', sourceHandle: 't', targetHandle: 'b', accent: 'ink' }),
]

export function FunctionCallingSequence() {
  return (
    <DiagramShell
      title="Function Calling 调用链"
      description="用户输入 → Agent 解析意图 → 选择工具 → 工具执行 → 解析结果 → 可能继续调用下一工具 → 信息足够后生成最终回答。"
      height={420}
      nodes={nodes}
      edges={edges}
    />
  )
}
