/**
 * HITL 人工介入流程 —— M10 框架编排
 * LangGraph 规范动作：approve / edit / reject
 */
import { DiagramShell, n, e, g } from './_shared'

const W = 860

const nodes = [
  g('lane-auto', 'Agent 自主执行区', 0, 0, W, 120, 'brand'),
  g('lane-gate', 'HITL 审批门禁', 0, 140, W, 120, 'amber'),
  g('lane-human', '人工决策区（approve / edit / reject）', 0, 280, W, 110, 'fuchsia'),
  g('lane-result', '执行结果', 0, 410, W, 120, 'emerald'),

  n('agent', 'Agent\n规划下一步', 50, 42, { color: 'brand', caption: 'plan' }),
  n('risk', '风险\n判断', 280, 42, { color: 'amber', caption: 'gate' }),
  n('low', '低风险\n自动放行', 560, 42, { color: 'emerald', caption: 'auto' }),

  n('pause', '暂停\n等待审核', 280, 182, { color: 'amber', caption: 'hold' }),
  n('timeout', '超时\n降级', 600, 182, { color: 'danger', caption: 'sla' }),

  n('review', '人工\n审核', 280, 318, { color: 'fuchsia', caption: 'human' }),
  n('edit', '改后批准\nedit', 520, 318, { color: 'amber', caption: 'edit' }),

  n('approve', '批准\n继续', 60, 448, { color: 'emerald', caption: 'yes' }),
  n('tool', '执行\n工具', 300, 448, { color: 'brand', caption: 'exec' }),
  n('reject', '拒绝\n回退', 560, 448, { color: 'danger', caption: 'no' }),
]

const edges = [
  e('agent', 'risk', { label: '拟调用', accent: 'brand' }),
  e('risk', 'low', { label: '安全', accent: 'emerald' }),
  e('risk', 'pause', { label: '高风险', fromSide: 's', toSide: 'n', accent: 'amber' }),
  e('pause', 'review', { label: '通知', fromSide: 's', toSide: 'n', accent: 'fuchsia' }),
  e('pause', 'timeout', { label: '超时', dashed: true, accent: 'danger' }),
  e('timeout', 'reject', { label: '降级', dashed: true, fromSide: 's', toSide: 'n', accent: 'danger' }),
  e('review', 'approve', { label: 'approve', fromSide: 's', toSide: 'n', accent: 'emerald' }),
  e('review', 'edit', { label: 'edit', accent: 'amber' }),
  e('edit', 'tool', { label: '改参后执行', fromSide: 's', toSide: 'n', accent: 'amber', id: 'edit-tool' }),
  e('review', 'reject', { label: 'reject', fromSide: 's', toSide: 'n', accent: 'danger' }),
  e('approve', 'tool', { label: '执行', accent: 'brand' }),
  e('low', 'tool', {
    label: '直接执行',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'emerald',
  }),
  e('tool', 'agent', {
    label: '结果回环',
    dashed: true,
    fromSide: 'w',
    toSide: 'w',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('reject', 'agent', {
    label: '回退重规划',
    dashed: true,
    fromSide: 'w',
    toSide: 's',
    curve: 'bezier',
    accent: 'danger',
    id: 'reject-back',
  }),
]

export function HITLFlowDiagram() {
  return (
    <DiagramShell
      title="HITL 人工介入流程"
      description="Agent 规划 → 风险判断 → 低风险自动放行；高风险暂停等人审。人审三动作：approve 批准 / edit 改参后执行 / reject 拒绝回退；超时则降级。"
      height={580}
      nodes={nodes}
      edges={edges}
    />
  )
}
