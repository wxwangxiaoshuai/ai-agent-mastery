/**
 * ReAct 循环状态图 —— M5 Agent 核心架构
 */
import { DiagramShell, n, e, g, ann } from './_shared'

const nodes = [
  g('lane-agent', 'Agent 推理层', 0, 0, 780, 140, 'brand'),
  g('lane-env', '外部环境 / 工具', 0, 170, 780, 120, 'amber'),
  n('user', '用户\n输入', 20, 50, { color: 'ink', caption: 'start', width: 96 }),
  n('thought', 'Thought', 160, 50, { color: 'brand', caption: 'reason' }),
  n('action', 'Action', 340, 50, { color: 'brand', caption: 'act' }),
  n('obs', 'Observation', 520, 50, { color: 'brand', caption: 'observe' }),
  n('answer', 'Answer', 680, 50, { color: 'emerald', emphasis: 'output', caption: 'done' }),
  n('tool', 'Tool Call', 340, 205, { color: 'amber', caption: 'env' }),
  n('max', 'max-steps\n强制停止', 680, 205, { color: 'danger', width: 120, caption: 'limit' }),
  ann('hint', '入口：用户输入 · 终止：得出 Answer 或触达 max-steps', 20, 310),
]

const edges = [
  e('user', 'thought', { label: '开始', accent: 'ink' }),
  e('thought', 'action', { label: '决定行动', accent: 'brand' }),
  e('action', 'tool', {
    label: '调用',
    dashed: true,
    fromSide: 's',
    toSide: 'n',
    accent: 'amber',
  }),
  e('tool', 'obs', {
    label: '返回',
    dashed: true,
    fromSide: 'e',
    toSide: 's',
    curve: 'bezier',
    accent: 'amber',
  }),
  e('obs', 'thought', {
    label: '循环',
    fromSide: 'w',
    toSide: 'w',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('thought', 'answer', {
    label: '完成',
    fromSide: 'n',
    toSide: 'n',
    curve: 'bezier',
    accent: 'emerald',
    id: 'thought-answer',
  }),
  e('obs', 'max', { label: '步数耗尽', dashed: true, accent: 'danger', id: 'obs-max' }),
  e('max', 'answer', { label: '强制收束', dashed: true, fromSide: 'n', toSide: 's', accent: 'danger', id: 'max-ans' }),
]

export function ReActLoopDiagram() {
  return (
    <DiagramShell
      title="ReAct 循环：Thought → Action → Observation"
      description="用户输入进入 Thought → Action → Tool → Observation 循环；得出最终答案，或触达 max-steps 强制停止并收束为 Answer。"
      height={380}
      nodes={nodes}
      edges={edges}
    />
  )
}
