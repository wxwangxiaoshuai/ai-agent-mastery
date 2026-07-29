/**
 * Circuit Breaker 三态转换图 —— M7 Agent Harness 工程化
 */
import { DiagramShell, n, e, ann } from './_shared'

const H = 64

const nodes = [
  n('closed', 'Closed\n正常', 80, 150, { color: 'emerald', width: 120, height: H, caption: 'state' }),
  n('open', 'Open\n熔断', 340, 150, { color: 'danger', width: 120, height: H, caption: 'state' }),
  n('half', 'Half-Open\n探测', 600, 150, { color: 'amber', width: 120, height: H, caption: 'state' }),
  ann('p1', '故障阈值超限 → Open', 80, 60),
  ann('p2', 'Half-Open：并发探测限额（如 1）', 480, 60),
  ann('p3', '连续成功 N 次（如 3）→ Closed', 480, 260),
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
    label: '连续成功≥N',
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
      description="Closed → 故障频率超阈值 → Open → 冷却超时 → Half-Open（限制并发探测数）→ 连续成功 N 次恢复 Closed，否则回 Open。"
      height={340}
      nodes={nodes}
      edges={edges}
    />
  )
}
