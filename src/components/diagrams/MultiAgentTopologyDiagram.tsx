/**
 * 四种多 Agent 拓扑静态对比图 —— M11 多智能体
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-chain', '链式 —— 顺序传递', 0, 0, 720, 100, 'brand'),
  g('lane-star', '星型 —— 中心 Hub 调度', 0, 120, 720, 120, 'amber'),
  g('lane-mesh', '网状 —— 全连接对等', 0, 260, 720, 150, 'fuchsia'),
  g('lane-hier', '层级 —— Supervisor → Workers', 0, 430, 720, 140, 'emerald'),
  n('c1', 'A', 60, 40, { color: 'brand', size: 'sm', width: 56, parentId: 'lane-chain' }),
  n('c2', 'B', 220, 40, { color: 'brand', size: 'sm', width: 56, parentId: 'lane-chain' }),
  n('c3', 'C', 380, 40, { color: 'brand', size: 'sm', width: 56, parentId: 'lane-chain' }),
  n('s1', 'A', 60, 45, { color: 'brand', size: 'sm', width: 56, parentId: 'lane-star' }),
  n('s_center', 'Hub', 280, 45, { color: 'amber', size: 'sm', width: 64, parentId: 'lane-star' }),
  n('s2', 'B', 480, 30, { color: 'brand', size: 'sm', width: 56, parentId: 'lane-star' }),
  n('s3', 'C', 480, 75, { color: 'brand', size: 'sm', width: 56, parentId: 'lane-star' }),
  n('m1', 'A', 80, 40, { color: 'fuchsia', size: 'sm', width: 56, parentId: 'lane-mesh' }),
  n('m2', 'B', 280, 30, { color: 'fuchsia', size: 'sm', width: 56, parentId: 'lane-mesh' }),
  n('m3', 'C', 480, 40, { color: 'fuchsia', size: 'sm', width: 56, parentId: 'lane-mesh' }),
  n('m4', 'D', 280, 95, { color: 'fuchsia', size: 'sm', width: 56, parentId: 'lane-mesh' }),
  n('h_top', 'Supervisor', 260, 35, { color: 'emerald', width: 110, parentId: 'lane-hier' }),
  n('h_a', 'Worker A', 60, 90, { color: 'brand', width: 90, parentId: 'lane-hier' }),
  n('h_b', 'Worker B', 260, 90, { color: 'brand', width: 90, parentId: 'lane-hier' }),
  n('h_c', 'Worker C', 460, 90, { color: 'brand', width: 90, parentId: 'lane-hier' }),
]

const edges = [
  e('c1', 'c2'),
  e('c2', 'c3'),
  e('s_center', 's1', { label: '调度', dashed: true }),
  e('s_center', 's2', { label: '调度', dashed: true, id: 'hub-s2' }),
  e('s_center', 's3', { label: '调度', dashed: true, id: 'hub-s3' }),
  e('m1', 'm2', { dashed: true, id: 'm1-m2' }),
  e('m1', 'm3', { dashed: true, id: 'm1-m3' }),
  e('m1', 'm4', { dashed: true, id: 'm1-m4' }),
  e('m2', 'm3', { dashed: true, id: 'm2-m3' }),
  e('m2', 'm4', { dashed: true, id: 'm2-m4' }),
  e('m3', 'm4', { dashed: true, id: 'm3-m4' }),
  e('h_top', 'h_a', { label: '派发', sourceHandle: 'b', targetHandle: 't', id: 'h-a' }),
  e('h_top', 'h_b', { label: '派发', sourceHandle: 'b', targetHandle: 't', id: 'h-b' }),
  e('h_top', 'h_c', { label: '派发', sourceHandle: 'b', targetHandle: 't', id: 'h-c' }),
  e('h_a', 'h_top', { label: '汇报', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'ha-up' }),
  e('h_b', 'h_top', { label: '汇报', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'hb-up' }),
  e('h_c', 'h_top', { label: '汇报', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'hc-up' }),
]

export function MultiAgentTopologyDiagram() {
  return (
    <DiagramShell
      title="四种多 Agent 拓扑对比"
      description="链式（顺序传递）→ 星型（中心 Hub 调度）→ 网状（全连接对等）→ 层级（Supervisor → Workers）。自上而下：协调成本递增。"
      height={640}
      nodes={nodes}
      edges={edges}
    />
  )
}
