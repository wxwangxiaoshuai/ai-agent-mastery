/**
 * ReAct 循环状态图 —— M5 Agent 核心架构
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-agent', 'Agent 推理层', 0, 0, 740, 130, 'brand'),
  g('lane-env', '外部环境 / 工具', 0, 160, 740, 120, 'amber'),
  n('thought', 'Thought', 50, 48, { color: 'brand', caption: 'reason' }),
  n('action', 'Action', 240, 48, { color: 'brand', caption: 'act' }),
  n('obs', 'Observation', 430, 48, { color: 'brand', caption: 'observe' }),
  n('answer', 'Answer', 620, 48, { color: 'emerald', emphasis: 'output', caption: 'done' }),
  n('tool', 'Tool Call', 240, 195, { color: 'amber', caption: 'env' }),
]

const edges = [
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
]

export function ReActLoopDiagram() {
  return (
    <DiagramShell
      title="ReAct 循环：Thought → Action → Observation"
      description="Agent 在思考-行动-观察的循环中自主完成任务，直到得出最终答案。"
      height={340}
      nodes={nodes}
      edges={edges}
    />
  )
}
