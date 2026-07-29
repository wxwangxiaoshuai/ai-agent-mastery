/**
 * 增长引擎循环图 —— M19 L19-03
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-funnel', '增长漏斗 —— 用户从来到留', 0, 0, 860, 110, 'brand'),
  g('lane-metric', '数据仪表盘 —— 每周五分钟报表', 0, 130, 860, 110, 'emerald'),
  g('lane-action', '增长动作 —— 针对性优化', 0, 260, 860, 110, 'amber'),
  n('acq', '获客\n流量', 30, 40, { color: 'brand', parentId: 'lane-funnel' }),
  n('act', '激活\n首次价值', 200, 40, { color: 'brand', parentId: 'lane-funnel' }),
  n('ret', '留存\n持续使用', 370, 40, { color: 'brand', parentId: 'lane-funnel' }),
  n('rev', '付费\n转化', 540, 40, { color: 'brand', parentId: 'lane-funnel' }),
  n('ref', '传播\n推荐', 710, 40, { color: 'brand', parentId: 'lane-funnel' }),
  n('reg', '注册率', 30, 40, { color: 'emerald', parentId: 'lane-metric' }),
  n('act_rate', '激活率', 200, 40, { color: 'emerald', parentId: 'lane-metric' }),
  n('ret_rate', '次周回访', 370, 40, { color: 'emerald', parentId: 'lane-metric' }),
  n('rev_rate', '付费率', 540, 40, { color: 'emerald', parentId: 'lane-metric' }),
  n('ref_rate', '推荐率', 710, 40, { color: 'emerald', parentId: 'lane-metric' }),
  n('fix_content', '内容\n营销', 30, 40, { color: 'amber', parentId: 'lane-action' }),
  n('fix_act', '缩短到\n首次成功', 200, 40, { color: 'amber', parentId: 'lane-action' }),
  n('fix_ret', '价值\n强化', 370, 40, { color: 'amber', parentId: 'lane-action' }),
  n('fix_rev', '调整\n付费墙', 540, 40, { color: 'amber', parentId: 'lane-action' }),
  n('fix_ref', '邀请\n奖励', 710, 40, { color: 'amber', parentId: 'lane-action' }),
]

const edges = [
  e('acq', 'act', { label: '→' }),
  e('act', 'ret', { label: '→' }),
  e('ret', 'rev', { label: '→' }),
  e('rev', 'ref', { label: '→' }),
  e('ref', 'acq', {
    label: '飞轮',
    dashed: true,
    fromSide: 's',
    toSide: 's',
    curve: 'bezier',
    accent: 'brand',
    id: 'flywheel',
  }),
  e('acq', 'reg', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('act', 'act_rate', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('ret', 'ret_rate', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('rev', 'rev_rate', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('ref', 'ref_rate', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('reg', 'fix_content', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('act_rate', 'fix_act', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('ret_rate', 'fix_ret', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('rev_rate', 'fix_rev', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('ref_rate', 'fix_ref', { dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('fix_content', 'acq', { label: '改善', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'fc-acq' }),
  e('fix_act', 'act', { label: '改善', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'fa-act' }),
  e('fix_ret', 'ret', { label: '改善', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'fr-ret' }),
  e('fix_rev', 'rev', { label: '改善', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'fv-rev' }),
  e('fix_ref', 'ref', { label: '改善', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'fref-ref' }),
]

export function GrowthEngineDiagram() {
  return (
    <DiagramShell
      title="增长引擎循环：从获客到传播"
      description="获客 → 激活 → 留存 → 付费 → 传播 → 飞轮回获客。每个环节测量关键指标，低则触发针对性优化，改善后回到对应漏斗阶段。"
      height={420}
      nodes={nodes}
      edges={edges}
    />
  )
}
