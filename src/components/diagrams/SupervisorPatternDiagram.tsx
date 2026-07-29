/**
 * Supervisor 模式消息流 —— M11 多智能体
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-sup', 'Supervisor 层 —— 决策与调度', 0, 0, 780, 110, 'amber'),
  g('lane-workers', 'Worker 层 —— 并行执行', 0, 130, 780, 110, 'brand'),
  g('lane-output', '综合输出层', 0, 260, 780, 140, 'emerald'),
  n('task', '用户\n任务', 20, 40, { color: 'ink', parentId: 'lane-sup' }),
  n('plan', '规划\n拆解', 200, 40, { color: 'amber', parentId: 'lane-sup' }),
  n('dispatch', '派发\n任务', 400, 40, { color: 'amber', parentId: 'lane-sup' }),
  n('w1', 'Worker\n搜索', 120, 40, { color: 'brand', parentId: 'lane-workers' }),
  n('w2', 'Worker\n分析', 320, 40, { color: 'brand', parentId: 'lane-workers' }),
  n('w3', 'Worker\n撰写', 520, 40, { color: 'brand', parentId: 'lane-workers' }),
  n('collect', '收集\n结果', 80, 40, { color: 'emerald', parentId: 'lane-output' }),
  n('quality', '质量\n检查', 260, 40, { color: 'amber', parentId: 'lane-output' }),
  n('synthesize', '综合\n输出', 440, 40, { color: 'emerald', parentId: 'lane-output' }),
  n('user_out', '用户\n可见回复', 620, 40, { color: 'ink', parentId: 'lane-output' }),
]

const edges = [
  e('task', 'plan', { label: '输入' }),
  e('plan', 'dispatch', { label: '拆解完' }),
  e('dispatch', 'w1', { label: '派发', sourceHandle: 'b', targetHandle: 't', id: 'd-w1' }),
  e('dispatch', 'w2', { label: '派发', sourceHandle: 'b', targetHandle: 't', id: 'd-w2' }),
  e('dispatch', 'w3', { label: '派发', sourceHandle: 'b', targetHandle: 't', id: 'd-w3' }),
  e('w1', 'collect', { label: '完成', sourceHandle: 'b', targetHandle: 't', id: 'w1-c' }),
  e('w2', 'collect', { label: '完成', sourceHandle: 'b', targetHandle: 't', id: 'w2-c' }),
  e('w3', 'collect', { label: '完成', sourceHandle: 'b', targetHandle: 't', id: 'w3-c' }),
  e('collect', 'quality', { label: '汇总' }),
  e('quality', 'synthesize', { label: '合格' }),
  e('quality', 'dispatch', { label: '不合格重派', dashed: true, sourceHandle: 't', targetHandle: 'b' }),
  e('synthesize', 'user_out', { label: '回复用户', accent: 'emerald', id: 'out-user' }),
]

export function SupervisorPatternDiagram() {
  return (
    <DiagramShell
      title="Supervisor 模式消息流"
      description="Supervisor 接收任务 → 拆解 → 并行派发 Worker → 收集结果 → 质量检查 → 合格则综合输出并回复用户；不合格则重派。"
      height={460}
      nodes={nodes}
      edges={edges}
    />
  )
}
