/**
 * LangGraph 状态图 —— M10 框架编排
 */
import { DiagramShell, n, e } from './_shared'

const nodes = [
  n('start', 'START', 340, 20, { color: 'emerald', width: 100, height: 48 }),
  n('node_a', 'Node A\n推理', 320, 120, { color: 'brand', width: 120, height: 64 }),
  n('cond', '条件\n判断', 320, 240, { color: 'amber', width: 120, height: 64 }),
  n('node_b', 'Node B\n工具调用', 80, 360, { color: 'fuchsia', width: 120, height: 64 }),
  n('node_c', 'Node C\n生成回答', 560, 360, { color: 'emerald', width: 120, height: 64 }),
  n('checkpoint', 'Checkpoint\n状态快照', 560, 120, { color: 'ink', width: 120, height: 64 }),
  n('end', 'END', 340, 500, { color: 'ink', width: 100, height: 48, emphasis: 'output' }),
]

const edges = [
  e('start', 'node_a', { label: '入口', sourceHandle: 'b', targetHandle: 't' }),
  e('node_a', 'cond', { label: '执行', sourceHandle: 'b', targetHandle: 't' }),
  e('cond', 'node_b', { label: '需工具', sourceHandle: 'b', targetHandle: 't' }),
  e('cond', 'node_c', { label: '无需工具', sourceHandle: 'b', targetHandle: 't' }),
  e('node_b', 'node_a', {
    label: '循环',
    dashed: true,
    fromSide: 'n',
    toSide: 'w',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('node_c', 'end', { label: '完成', sourceHandle: 'b', targetHandle: 't' }),
  e('node_a', 'checkpoint', { label: '旁路快照', dashed: true, accent: 'ink' }),
  e('node_c', 'checkpoint', {
    label: '旁路快照',
    dashed: true,
    fromSide: 'n',
    toSide: 's',
    accent: 'ink',
    id: 'c-cp',
  }),
]

export function LangGraphStateDiagram() {
  return (
    <DiagramShell
      title="LangGraph 状态图"
      description="START → 推理节点 → 条件边路由：需工具则 Node B 并循环回推理，否则 Node C → END。关键节点旁路写入 Checkpoint，支持中断恢复。"
      height={600}
      nodes={nodes}
      edges={edges}
    />
  )
}
