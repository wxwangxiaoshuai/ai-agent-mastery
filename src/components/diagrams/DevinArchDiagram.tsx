/**
 * Devin 自主编程架构拆解图 —— M14 L14-03 参考架构案例拆解 II
 * 规划→执行→验证→修复 闭环，含可靠性刹车
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'plan', label: '规划层 —— 任务拆解', y: 2, height: 10, color: 'brand' },
  { id: 'execute', label: '执行层 —— 多步实现', y: 14, height: 10, color: 'emerald' },
  { id: 'verify', label: '验证层 —— 自我纠错', y: 26, height: 10, color: 'amber' },
  { id: 'reliability', label: '可靠性层 —— 刹车与恢复', y: 38, height: 8, color: 'fuchsia' },
]

const nodes: DiagramNode[] = [
  { id: 'task', label: '需求\n输入', x: 3, y: 4, color: 'ink' },
  { id: 'analyze', label: '读代码\n理解结构', x: 18, y: 4, color: 'brand' },
  { id: 'plan_steps', label: '列步骤\n拆任务', x: 33, y: 4, color: 'brand' },
  { id: 'write', label: '写代码\n多文件', x: 3, y: 16, color: 'emerald' },
  { id: 'run_cmd', label: '跑命令\n装依赖', x: 18, y: 16, color: 'emerald' },
  { id: 'browser', label: '浏览器\n查文档', x: 33, y: 16, color: 'emerald' },
  { id: 'test', label: '跑测试\n/构建', x: 3, y: 28, color: 'amber' },
  { id: 'pass', label: '通过\n继续', x: 18, y: 28, color: 'emerald' },
  { id: 'fail', label: '失败\n分析原因', x: 33, y: 28, color: 'danger' },
  { id: 'repair', label: '修复\n改代码', x: 48, y: 28, color: 'amber' },
  { id: 'checkpoint', label: 'Checkpoint\n状态持久化', x: 3, y: 40, color: 'fuchsia' },
  { id: 'rollback', label: 'Git\n回滚', x: 18, y: 40, color: 'fuchsia' },
  { id: 'limit', label: '步数上限\n防发散', x: 33, y: 40, color: 'fuchsia' },
  { id: 'hitl', label: 'HITL\n关键边界', x: 48, y: 40, color: 'fuchsia' },
  { id: 'done', label: '完成', x: 65, y: 4, color: 'emerald' },
]

const edges: DiagramEdge[] = [
  { from: 'task', to: 'analyze', label: '输入' },
  { from: 'analyze', to: 'plan_steps', label: '理解完' },
  { from: 'plan_steps', to: 'write', label: '拆解' },
  { from: 'plan_steps', to: 'run_cmd', label: '拆解' },
  { from: 'write', to: 'browser', label: '查', dashed: true },
  { from: 'run_cmd', to: 'test', label: '执行完' },
  { from: 'write', to: 'test', label: '写完' },
  { from: 'test', to: 'pass', label: '通过' },
  { from: 'test', to: 'fail', label: '失败' },
  { from: 'fail', to: 'repair', label: '分析' },
  { from: 'repair', to: 'test', label: '再测', dashed: true },
  { from: 'pass', to: 'done', label: '产出' },
  { from: 'write', to: 'checkpoint', label: '保存', dashed: true },
  { from: 'checkpoint', to: 'rollback', label: '恢复', dashed: true },
  { from: 'fail', to: 'limit', label: 'N次后', dashed: true },
  { from: 'limit', to: 'done', label: '放弃报告', dashed: true },
  { from: 'plan_steps', to: 'hitl', label: '关键', dashed: true },
  { from: 'hitl', to: 'write', label: '审后', dashed: true },
  { from: 'rollback', to: 'write', label: '回退', dashed: true },
]

export function DevinArchDiagram() {
  return (
    <ArchitectureDiagram
      title="Devin 自主编程架构拆解"
      description="需求 → 读代码理解结构 → 列步骤拆任务 → 写代码/跑命令/查文档 → 跑测试验证 → 通过则继续，失败则分析修复循环。可靠性刹车：Checkpoint 可恢复、Git 可回滚、步数上限防发散、关键操作 HITL。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={320}
    />
  )
}