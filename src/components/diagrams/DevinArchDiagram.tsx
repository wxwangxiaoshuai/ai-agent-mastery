/**
 * Devin 自主编程架构拆解图 —— M14 L14-03
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-plan', '规划层 —— 任务拆解', 0, 0, 860, 110, 'brand'),
  g('lane-exec', '执行层 —— 多步实现', 0, 130, 860, 110, 'emerald'),
  g('lane-verify', '验证层 —— 自我纠错', 0, 260, 860, 130, 'amber'),
  g('lane-rel', '可靠性层 —— 刹车与恢复', 0, 410, 860, 110, 'fuchsia'),
  n('task', '需求\n输入', 30, 40, { color: 'ink', parentId: 'lane-plan' }),
  n('analyze', '读代码\n理解结构', 200, 40, { color: 'brand', parentId: 'lane-plan' }),
  n('plan_steps', '列步骤\n拆任务', 400, 40, { color: 'brand', parentId: 'lane-plan' }),
  n('write', '写代码\n多文件', 30, 40, { color: 'emerald', parentId: 'lane-exec' }),
  n('run_cmd', '跑命令\n装依赖', 220, 40, { color: 'emerald', parentId: 'lane-exec' }),
  n('browser', '浏览器\n查文档', 420, 40, { color: 'emerald', parentId: 'lane-exec' }),
  n('test', '跑测试\n/构建', 30, 45, { color: 'amber', parentId: 'lane-verify' }),
  n('pass', '通过\n继续', 220, 45, { color: 'emerald', parentId: 'lane-verify' }),
  n('fail', '失败\n分析原因', 400, 45, { color: 'danger', parentId: 'lane-verify' }),
  n('repair', '修复\n改代码', 600, 45, { color: 'amber', parentId: 'lane-verify' }),
  n('done', '完成', 720, 45, { color: 'emerald', parentId: 'lane-verify' }),
  n('checkpoint', 'Checkpoint\n状态持久化', 30, 40, { color: 'fuchsia', parentId: 'lane-rel' }),
  n('rollback', 'Git\n回滚', 220, 40, { color: 'fuchsia', parentId: 'lane-rel' }),
  n('limit', '步数上限\n防发散', 420, 40, { color: 'fuchsia', parentId: 'lane-rel' }),
  n('hitl', 'HITL\n关键边界', 620, 40, { color: 'fuchsia', parentId: 'lane-rel' }),
]

const edges = [
  e('task', 'analyze', { label: '输入' }),
  e('analyze', 'plan_steps', { label: '理解完' }),
  e('plan_steps', 'write', { label: '拆解', sourceHandle: 'b', targetHandle: 't' }),
  e('write', 'run_cmd', { label: '写完' }),
  e('run_cmd', 'browser', { label: '查', dashed: true }),
  e('browser', 'run_cmd', { label: '回填', dashed: true, fromSide: 'w', toSide: 'e', id: 'br-back' }),
  e('run_cmd', 'test', { label: '执行完', sourceHandle: 'b', targetHandle: 't' }),
  e('test', 'pass', { label: '通过' }),
  e('test', 'fail', { label: '失败' }),
  e('fail', 'repair', { label: '分析' }),
  e('repair', 'test', { label: '再测', dashed: true, sourceHandle: 'l', targetHandle: 'r' }),
  e('pass', 'done', { label: '产出' }),
  e('write', 'checkpoint', { label: '保存', dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('checkpoint', 'rollback', { label: '恢复', dashed: true }),
  e('fail', 'limit', { label: 'N次后', dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('plan_steps', 'hitl', { label: '关键', dashed: true, sourceHandle: 'b', targetHandle: 't' }),
]

export function DevinArchDiagram() {
  return (
    <DiagramShell
      title="Devin 自主编程架构拆解"
      description="需求 → 读代码理解结构 → 列步骤拆任务 → 写代码/跑命令/查文档 → 跑测试验证 → 通过则完成，失败则分析修复循环。可靠性刹车：Checkpoint、Git 回滚、步数上限、关键 HITL。"
      height={580}
      nodes={nodes}
      edges={edges}
    />
  )
}
