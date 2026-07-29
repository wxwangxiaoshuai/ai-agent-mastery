/**
 * Human-in-the-Loop 中断流程 —— M10 框架编排
 */
import { DiagramShell, n, e, g } from './_shared'

const W = 800

const nodes = [
  g('lane-auto', 'Agent 自主执行区', 0, 0, W, 120, 'brand'),
  g('lane-gate', 'HITL 审批门禁', 0, 140, W, 120, 'amber'),
  g('lane-human', '人工决策区', 0, 280, W, 110, 'fuchsia'),
  g('lane-result', '执行结果', 0, 410, W, 120, 'emerald'),

  n('agent', 'Agent\n规划下一步', 50, 42, { color: 'brand', caption: 'plan' }),
  n('risk', '风险\n判断', 280, 42, { color: 'amber', caption: 'gate' }),
  n('low', '低风险\n自动放行', 520, 42, { color: 'emerald', caption: 'auto' }),

  n('pause', '暂停\n等待审核', 280, 182, { color: 'amber', caption: 'hold' }),
  n('timeout', '超时\n降级', 560, 182, { color: 'danger', caption: 'sla' }),

  n('review', '人工\n审核', 280, 318, { color: 'fuchsia', caption: 'human' }),

  n('approve', '批准\n继续', 80, 448, { color: 'emerald', caption: 'yes' }),
  n('tool', '执行\n工具', 320, 448, { color: 'brand', caption: 'exec' }),
  n('reject', '拒绝\n回退', 560, 448, { color: 'danger', caption: 'no' }),
]

const edges = [
  e('agent', 'risk', { label: '拟调用', accent: 'brand' }),
  e('risk', 'low', { label: '安全', accent: 'emerald' }),
  e('risk', 'pause', { label: '高风险', fromSide: 's', toSide: 'n', accent: 'amber' }),
  e('pause', 'review', { label: '通知', fromSide: 's', toSide: 'n', accent: 'fuchsia' }),
  e('pause', 'timeout', { label: '超时', dashed: true, accent: 'danger' }),
  e('timeout', 'reject', { label: '降级', dashed: true, fromSide: 's', toSide: 'n', accent: 'danger' }),
  e('review', 'approve', { label: '通过', fromSide: 's', toSide: 'n', accent: 'emerald' }),
  e('review', 'reject', { label: '拒绝', fromSide: 's', toSide: 'n', accent: 'danger' }),
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
      description="Agent 规划下一步 → 风险判断（工具执行前）→ 低风险自动放行并执行工具；高风险暂停等待人工审核 → 批准执行 / 拒绝回退 / 超时降级。"
      height={580}
      nodes={nodes}
      edges={edges}
    />
  )
}
