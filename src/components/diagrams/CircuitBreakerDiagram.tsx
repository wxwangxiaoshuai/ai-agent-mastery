/**
 * Circuit Breaker 三态转换图 —— M7 Agent Harness 工程化
 */
import { DiagramShell, n, e } from './_shared'

const H = 64

const nodes = [
  n('closed', 'Closed\n正常', 80, 150, { color: 'emerald', width: 120, height: H, caption: 'state' }),
  n('open', 'Open\n熔断', 340, 150, { color: 'danger', width: 120, height: H, caption: 'state' }),
  n('half', 'Half-Open\n探测', 600, 150, { color: 'amber', width: 120, height: H, caption: 'state' }),
]

const edges = [
  e('closed', 'open', { label: '故障频率超阈值', accent: 'danger' }),
  e('open', 'half', {
    label: '冷却超时',
    fromSide: 's',
    toSide: 's',
    curve: 'bezier',
    accent: 'amber',
    id: 'open-half',
  }),
  e('half', 'closed', {
    label: '探测成功',
    fromSide: 's',
    toSide: 's',
    curve: 'bezier',
    accent: 'emerald',
    id: 'half-ok',
  }),
  e('half', 'open', {
    label: '探测失败',
    fromSide: 'n',
    toSide: 'n',
    curve: 'bezier',
    accent: 'danger',
    id: 'half-fail',
  }),
]

export function CircuitBreakerDiagram() {
  return (
    <DiagramShell
      title="Circuit Breaker 三态转换"
      description="Closed（正常）→ 故障频率超阈值 → Open（熔断）→ 冷却超时 → Half-Open（探测）→ 成功则恢复 Closed，失败则回到 Open。"
      height={340}
      nodes={nodes}
      edges={edges}
    />
  )
}
