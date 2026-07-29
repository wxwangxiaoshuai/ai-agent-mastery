/**
 * 四种多 Agent 拓扑静态对比图 —— M11 多智能体
 * 自上而下按协调成本递增：链式 → 星型 → 层级 → 网状
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-chain', '链式 —— 顺序传递 · 成本最低', 0, 0, 720, 100, 'brand'),
  g('lane-star', '星型 —— 中心 Hub 调度', 0, 120, 720, 120, 'amber'),
  g('lane-hier', '层级 —— Supervisor → Workers · O(n)', 0, 260, 720, 140, 'emerald'),
  g('lane-mesh', '网状 —— 全连接对等 · O(n²) 最高', 0, 420, 720, 150, 'fuchsia'),

  n('c1', 'A', 60, 40, { color: 'brand', size: 'sm', width: 68, parentId: 'lane-chain' }),
  n('c2', 'B', 220, 40, { color: 'brand', size: 'sm', width: 68, parentId: 'lane-chain' }),
  n('c3', 'C', 380, 40, { color: 'brand', size: 'sm', width: 68, parentId: 'lane-chain' }),

  n('s1', 'A', 60, 45, { color: 'brand', size: 'sm', width: 68, parentId: 'lane-star' }),
  n('s_center', 'Hub', 280, 45, { color: 'amber', size: 'sm', width: 72, parentId: 'lane-star' }),
  n('s2', 'B', 480, 30, { color: 'brand', size: 'sm', width: 68, parentId: 'lane-star' }),
  n('s3', 'C', 480, 75, { color: 'brand', size: 'sm', width: 68, parentId: 'lane-star' }),

  n('h_top', 'Supervisor', 260, 35, { color: 'emerald', width: 110, parentId: 'lane-hier' }),
  n('h_a', 'Worker A', 60, 90, { color: 'brand', width: 96, parentId: 'lane-hier' }),
  n('h_b', 'Worker B', 260, 90, { color: 'brand', width: 96, parentId: 'lane-hier' }),
  n('h_c', 'Worker C', 460, 90, { color: 'brand', width: 96, parentId: 'lane-hier' }),

  n('m1', 'A', 80, 40, { color: 'fuchsia', size: 'sm', width: 68, parentId: 'lane-mesh' }),
  n('m2', 'B', 280, 30, { color: 'fuchsia', size: 'sm', width: 68, parentId: 'lane-mesh' }),
  n('m3', 'C', 480, 40, { color: 'fuchsia', size: 'sm', width: 68, parentId: 'lane-mesh' }),
  n('m4', 'D', 280, 95, { color: 'fuchsia', size: 'sm', width: 68, parentId: 'lane-mesh' }),
]

const edges = [
  e('c1', 'c2'),
  e('c2', 'c3'),
  e('s_center', 's1', { label: '调度', dashed: true }),
  e('s_center', 's2', { label: '调度', dashed: true, id: 'hub-s2' }),
  e('s_center', 's3', { label: '调度', dashed: true, id: 'hub-s3' }),
  e('h_top', 'h_a', { label: '派发', fromSide: 's', toSide: 'n', id: 'h-a' }),
  e('h_top', 'h_b', { label: '派发', fromSide: 's', toSide: 'n', id: 'h-b' }),
  e('h_top', 'h_c', { label: '派发', fromSide: 's', toSide: 'n', id: 'h-c' }),
  e('h_a', 'h_top', { label: '汇报', dashed: true, fromSide: 'n', toSide: 's', id: 'ha-up' }),
  e('h_b', 'h_top', { label: '汇报', dashed: true, fromSide: 'n', toSide: 's', id: 'hb-up' }),
  e('h_c', 'h_top', { label: '汇报', dashed: true, fromSide: 'n', toSide: 's', id: 'hc-up' }),
  // Mesh: peer links — undirected (no arrow)
  e('m1', 'm2', { dashed: true, undirected: true, id: 'm1-m2' }),
  e('m1', 'm3', { dashed: true, undirected: true, id: 'm1-m3' }),
  e('m1', 'm4', { dashed: true, undirected: true, id: 'm1-m4' }),
  e('m2', 'm3', { dashed: true, undirected: true, id: 'm2-m3' }),
  e('m2', 'm4', { dashed: true, undirected: true, id: 'm2-m4' }),
  e('m3', 'm4', { dashed: true, undirected: true, id: 'm3-m4' }),
]

export function MultiAgentTopologyDiagram() {
  return (
    <DiagramShell
      title="四种多 Agent 拓扑对比"
      description="自上而下按协调成本递增：链式（顺序）→ 星型（Hub）→ 层级（Supervisor，O(n)）→ 网状（全连接对等，O(n²)）。网状连线为无向对等边。"
      height={640}
      nodes={nodes}
      edges={edges}
    />
  )
}
