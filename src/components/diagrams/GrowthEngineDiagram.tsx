/**
 * 增长引擎循环图 —— M19 L19-03 数据驱动增长
 * 获客 → 激活 → 留存 → 付费 → 传播 → 回到获客（飞轮）
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'funnel', label: '增长漏斗 —— 用户从来到留', y: 2, height: 18, color: 'brand' },
  { id: 'metric', label: '数据仪表盘 —— 每周五分钟报表', y: 22, height: 18, color: 'emerald' },
  { id: 'action', label: '增长动作 —— 针对性优化', y: 42, height: 14, color: 'amber' },
]

const nodes: DiagramNode[] = [
  { id: 'acq', label: '获客\n流量', x: 3, y: 8, color: 'brand' },
  { id: 'act', label: '激活\n首次价值', x: 22, y: 8, color: 'brand' },
  { id: 'ret', label: '留存\n持续使用', x: 41, y: 8, color: 'brand' },
  { id: 'rev', label: '付费\n转化', x: 60, y: 8, color: 'brand' },
  { id: 'ref', label: '传播\n推荐', x: 79, y: 8, color: 'brand' },
  { id: 'reg', label: '注册率', x: 3, y: 28, color: 'emerald' },
  { id: 'act_rate', label: '激活率', x: 22, y: 28, color: 'emerald' },
  { id: 'ret_rate', label: '次周回访', x: 41, y: 28, color: 'emerald' },
  { id: 'rev_rate', label: '付费率', x: 60, y: 28, color: 'emerald' },
  { id: 'cohort', label: '队列\n分析', x: 79, y: 28, color: 'emerald' },
  { id: 'fix_act', label: '缩短到\n首次成功', x: 12, y: 48, color: 'amber' },
  { id: 'fix_ret', label: '价值\n强化', x: 41, y: 48, color: 'amber' },
  { id: 'fix_rev', label: '调整\n付费墙', x: 60, y: 48, color: 'amber' },
  { id: 'fix_content', label: '内容\n营销', x: 3, y: 48, color: 'amber' },
]

const edges: DiagramEdge[] = [
  { from: 'acq', to: 'act', label: '注册' },
  { from: 'act', to: 'ret', label: '激活' },
  { from: 'ret', to: 'rev', label: '付费' },
  { from: 'rev', to: 'ref', label: '口碑' },
  { from: 'ref', to: 'acq', label: '飞轮', dashed: true },
  { from: 'acq', to: 'reg', label: '测量', dashed: true },
  { from: 'act', to: 'act_rate', label: '测量', dashed: true },
  { from: 'ret', to: 'ret_rate', label: '测量', dashed: true },
  { from: 'rev', to: 'rev_rate', label: '测量', dashed: true },
  { from: 'ret_rate', to: 'cohort', label: '队列', dashed: true },
  { from: 'reg', to: 'fix_content', label: '低→优化', dashed: true },
  { from: 'act_rate', to: 'fix_act', label: '低→优化', dashed: true },
  { from: 'ret_rate', to: 'fix_ret', label: '低→优化', dashed: true },
  { from: 'rev_rate', to: 'fix_rev', label: '低→优化', dashed: true },
  { from: 'fix_content', to: 'acq', label: '改善', dashed: true },
  { from: 'fix_act', to: 'act', label: '改善', dashed: true },
  { from: 'fix_ret', to: 'ret', label: '改善', dashed: true },
  { from: 'fix_rev', to: 'rev', label: '改善', dashed: true },
]

export function GrowthEngineDiagram() {
  return (
    <ArchitectureDiagram
      title="增长引擎循环：从获客到传播"
      description="获客 → 激活 → 留存 → 付费 → 传播 → 回到获客（飞轮）。每个环节测量关键指标，低则触发针对性优化，改善后回到主干。核心洞察：留存进入复利公式，提留存 10pp 的效果常超过流量翻倍。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={360}
    />
  )
}