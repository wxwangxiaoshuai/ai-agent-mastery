/**
 * OpenSpec + Superpowers 工作流全貌 —— M17 AI Coding 工程实践
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-spec', 'OpenSpec 规格层 —— "做什么"', 0, 0, 900, 110, 'brand'),
  g('lane-process', 'Superpowers 流程层 —— "怎么做"', 0, 130, 900, 110, 'emerald'),
  g('lane-gate', 'Harness 门禁层 —— "谁检查"', 0, 260, 900, 120, 'amber'),
  n('user', 'User', 20, 40, { color: 'ink', width: 96, height: 48, parentId: 'lane-spec' }),
  n('explore', 'explore', 140, 40, { color: 'brand', width: 110, height: 48, parentId: 'lane-spec' }),
  n('propose', 'propose', 300, 40, { color: 'brand', width: 110, height: 48, parentId: 'lane-spec' }),
  n('apply', 'apply', 460, 40, { color: 'brand', width: 110, height: 48, parentId: 'lane-spec' }),
  n('archive', 'archive', 620, 40, { color: 'brand', width: 110, height: 48, parentId: 'lane-spec' }),
  n('output', '产出', 780, 40, { color: 'ink', width: 96, height: 48, parentId: 'lane-spec' }),
  n('brainstorm', 'brainstorming', 140, 40, { color: 'emerald', width: 110, height: 48, parentId: 'lane-process' }),
  n('plan', 'writing-plans', 300, 40, { color: 'emerald', width: 110, height: 48, parentId: 'lane-process' }),
  n('tdd', 'TDD', 460, 40, { color: 'emerald', width: 110, height: 48, parentId: 'lane-process' }),
  n('review', 'code-review', 620, 40, { color: 'emerald', width: 110, height: 48, parentId: 'lane-process' }),
  n('g0', 'Gate 0-3', 140, 45, { color: 'amber', width: 110, height: 48, parentId: 'lane-gate' }),
  n('g3', 'Gate 4-6', 460, 45, { color: 'amber', width: 110, height: 48, parentId: 'lane-gate' }),
  n('g6', 'Gate 7-8', 620, 45, { color: 'amber', width: 110, height: 48, parentId: 'lane-gate' }),
]

const edges = [
  e('user', 'explore'),
  e('explore', 'propose'),
  e('propose', 'apply'),
  e('apply', 'archive'),
  e('archive', 'output'),
  e('explore', 'brainstorm', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('propose', 'plan', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('apply', 'tdd', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('tdd', 'review', { dashed: true }),
  e('brainstorm', 'g0', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('g0', 'propose', { label: '通过→规格', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'g0-rejoin' }),
  e('plan', 'apply', {
    label: '计划通过→实现',
    dashed: true,
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'plan-apply',
  }),
  e('review', 'g3', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('g3', 'g6', { dashed: true }),
  e('g6', 'archive', { label: '归档前', dashed: true, sourceHandle: 't', targetHandle: 'b' }),
]

export function OpenSpecWorkflowDiagram() {
  return (
    <DiagramShell
      title="OpenSpec + Superpowers + Harness 工作流"
      description={`OpenSpec 定义"做什么"（explore→propose→apply→archive），Superpowers 指导"怎么做"（brainstorming / writing-plans / TDD / code-review），Harness 门禁在关键节点检查质量并汇回主线。`}
      height={440}
      nodes={nodes}
      edges={edges}
    />
  )
}
