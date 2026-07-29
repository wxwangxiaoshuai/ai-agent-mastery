/**
 * Function Calling 调用链泳道图 —— M6 工具使用
 * 含并行 tool_calls 与工具报错分支
 */
import { DiagramShell, n, e, g } from './_shared'

const H = 56
const W = 860

const nodes = [
  g('lane-user', '用户', 0, 0, W, 100, 'ink'),
  g('lane-agent', 'Agent（LLM + 推理）', 0, 120, W, 120, 'brand'),
  g('lane-tools', '工具层（可并行）', 0, 260, W, 140, 'emerald'),
  n('u1', '用户输入', 40, 35, { color: 'ink', height: H, parentId: 'lane-user' }),
  n('u2', '最终回复', 700, 35, { color: 'ink', height: H, parentId: 'lane-user' }),
  n('a1', '解析意图', 40, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('a2', '选择工具\n(可并行)', 220, 45, { color: 'brand', height: H, width: 120, parentId: 'lane-agent' }),
  n('a3', '汇总结果', 480, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('a4', '生成回答', 680, 45, { color: 'brand', height: H, parentId: 'lane-agent' }),
  n('t1', 'Tool A\n并行执行', 160, 40, { color: 'emerald', height: H, parentId: 'lane-tools' }),
  n('t2', 'Tool B\n并行执行', 360, 40, { color: 'emerald', height: H, parentId: 'lane-tools' }),
  n('terr', '工具报错\n重试/降级', 580, 55, { color: 'danger', height: H, width: 120, parentId: 'lane-tools' }),
]

const edges = [
  e('u1', 'a1', { label: '请求', fromSide: 's', toSide: 'n', accent: 'ink' }),
  e('a1', 'a2', { accent: 'brand' }),
  // Parallel fan-out
  e('a2', 't1', { label: 'parallel', dashed: true, fromSide: 's', toSide: 'n', accent: 'emerald', id: 'a2-t1' }),
  e('a2', 't2', { label: 'parallel', dashed: true, fromSide: 's', toSide: 'n', accent: 'emerald', id: 'a2-t2' }),
  e('t1', 'a3', { label: 'result', dashed: true, fromSide: 'n', toSide: 's', accent: 'emerald', id: 't1-a3' }),
  e('t2', 'a3', { label: 'result', dashed: true, fromSide: 'n', toSide: 's', accent: 'emerald', id: 't2-a3' }),
  // Error branch
  e('t1', 'terr', { label: '失败', dashed: true, accent: 'danger', id: 't1-err' }),
  e('t2', 'terr', { label: '失败', dashed: true, accent: 'danger', id: 't2-err' }),
  e('terr', 'a2', { label: '重试/换工具', dashed: true, fromSide: 'n', toSide: 'e', accent: 'danger', id: 'err-retry' }),
  e('a3', 'a2', {
    label: '继续调用',
    dashed: true,
    fromSide: 'w',
    toSide: 'e',
    accent: 'amber',
    id: 'multi-loop',
  }),
  e('a3', 'a4', { label: '足够', accent: 'brand' }),
  e('a4', 'u2', { label: '回复', fromSide: 'n', toSide: 's', accent: 'ink' }),
]

export function FunctionCallingSequence() {
  return (
    <DiagramShell
      title="Function Calling 调用链泳道图"
      description="用户输入 → 解析意图 → 选择工具（现代 API 可并行 tool_calls）→ Tool A/B 并行执行 → 汇总结果；失败则报错重试/换工具；信息足够后生成最终回答。"
      height={460}
      nodes={nodes}
      edges={edges}
    />
  )
}
