/**
 * 增长引擎循环图 —— M19 L19-03
 * 漏斗 → 指标 → 问题诊断 → 优化动作 → 回灌漏斗
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-funnel', '增长漏斗 —— 用户从来到留', 0, 0, 860, 100, 'brand'),
  g('lane-metric', '数据指标 —— 每周五分钟报表', 0, 115, 860, 100, 'emerald'),
  g('lane-diag', '问题诊断 —— 定位漏损环节', 0, 230, 860, 100, 'danger'),
  g('lane-action', '增长动作 —— 针对性优化', 0, 345, 860, 100, 'amber'),
  n('acq', '获客\n流量', 30, 35, { color: 'brand', parentId: 'lane-funnel' }),
  n('act', '激活\n首次价值', 200, 35, { color: 'brand', parentId: 'lane-funnel' }),
  n('ret', '留存\n持续使用', 370, 35, { color: 'brand', parentId: 'lane-funnel' }),
  n('rev', '付费\n转化', 540, 35, { color: 'brand', parentId: 'lane-funnel' }),
  n('ref', '传播\n推荐', 710, 35, { color: 'brand', parentId: 'lane-funnel' }),
  n('reg', '注册率', 30, 35, { color: 'emerald', parentId: 'lane-metric' }),
  n('act_rate', '激活率', 200, 35, { color: 'emerald', parentId: 'lane-metric' }),
  n('ret_rate', '次周回访', 370, 35, { color: 'emerald', parentId: 'lane-metric' }),
  n('rev_rate', '付费率', 540, 35, { color: 'emerald', parentId: 'lane-metric' }),
  n('ref_rate', '推荐率', 710, 35, { color: 'emerald', parentId: 'lane-metric' }),
  n('d_acq', '获客\n质量差？', 30, 35, { color: 'danger', parentId: 'lane-diag' }),
  n('d_act', '激活\n漏损？', 200, 35, { color: 'danger', parentId: 'lane-diag' }),
  n('d_ret', '留存\n流失？', 370, 35, { color: 'danger', parentId: 'lane-diag' }),
  n('d_rev', '付费\n卡点？', 540, 35, { color: 'danger', parentId: 'lane-diag' }),
  n('d_ref', '传播\n无动力？', 710, 35, { color: 'danger', parentId: 'lane-diag' }),
  n('fix_content', '内容\n营销', 30, 35, { color: 'amber', parentId: 'lane-action' }),
  n('fix_act', '缩短到\n首次成功', 200, 35, { color: 'amber', parentId: 'lane-action' }),
  n('fix_ret', '价值\n强化', 370, 35, { color: 'amber', parentId: 'lane-action' }),
  n('fix_rev', '调整\n付费墙', 540, 35, { color: 'amber', parentId: 'lane-action' }),
  n('fix_ref', '邀请\n奖励', 710, 35, { color: 'amber', parentId: 'lane-action' }),
]

const edges = [
  e('acq', 'act'),
  e('act', 'ret'),
  e('ret', 'rev'),
  e('rev', 'ref'),
  e('ref', 'acq', {
    label: '飞轮',
    dashed: true,
    fromSide: 's',
    toSide: 's',
    curve: 'bezier',
    accent: 'brand',
    id: 'flywheel',
  }),
  e('acq', 'reg', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('act', 'act_rate', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('ret', 'ret_rate', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('rev', 'rev_rate', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('ref', 'ref_rate', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('reg', 'd_acq', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('act_rate', 'd_act', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('ret_rate', 'd_ret', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('rev_rate', 'd_rev', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('ref_rate', 'd_ref', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('d_acq', 'fix_content', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('d_act', 'fix_act', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('d_ret', 'fix_ret', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('d_rev', 'fix_rev', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('d_ref', 'fix_ref', { dashed: true, fromSide: 's', toSide: 'n' }),
  e('fix_content', 'acq', { label: '改善', dashed: true, fromSide: 'n', toSide: 's', id: 'fc-acq' }),
  e('fix_act', 'act', { label: '改善', dashed: true, fromSide: 'n', toSide: 's', id: 'fa-act' }),
  e('fix_ret', 'ret', { label: '改善', dashed: true, fromSide: 'n', toSide: 's', id: 'fr-ret' }),
  e('fix_rev', 'rev', { label: '改善', dashed: true, fromSide: 'n', toSide: 's', id: 'fv-rev' }),
  e('fix_ref', 'ref', { label: '改善', dashed: true, fromSide: 'n', toSide: 's', id: 'fref-ref' }),
]

export function GrowthEngineDiagram() {
  return (
    <DiagramShell
      title="增长引擎循环：从获客到传播"
      description="获客 → 激活 → 留存 → 付费 → 传播 → 飞轮回获客。每环测量指标 → 诊断问题 → 针对性优化，改善后回到对应漏斗阶段。"
      height={510}
      nodes={nodes}
      edges={edges}
    />
  )
}
