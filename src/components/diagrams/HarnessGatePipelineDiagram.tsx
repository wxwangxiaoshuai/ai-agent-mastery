/**
 * Harness 门禁管道全景图 —— M17 L17-14
 */
import { DiagramShell, n, e, g } from './_shared'

const H = 64
const Y = 35

const nodes = [
  g('lane-before', '实现前门禁（Gate 0-2）', 0, 0, 780, 110, 'brand'),
  g('lane-during', '实现中门禁（Gate 3-5）', 0, 130, 780, 110, 'emerald'),
  g('lane-after', '提交前门禁（Gate 6-7）', 0, 260, 780, 110, 'amber'),
  g('lane-archive', '归档门禁（Gate 8）', 0, 390, 780, 110, 'violet'),
  n('start', '开始', 20, Y, { color: 'ink', width: 70, height: H, parentId: 'lane-before' }),
  n('g0', 'Gate 0\n探索门禁', 140, Y, { color: 'brand', height: H, parentId: 'lane-before' }),
  n('g1', 'Gate 1\n规格门禁', 320, Y, { color: 'brand', height: H, parentId: 'lane-before' }),
  n('g2', 'Gate 2\n计划门禁', 500, Y, { color: 'brand', height: H, parentId: 'lane-before' }),
  n('g3', 'Gate 3\n执行门禁', 140, Y, { color: 'emerald', height: H, parentId: 'lane-during' }),
  n('g4', 'Gate 4\nReview门禁', 320, Y, { color: 'emerald', height: H, parentId: 'lane-during' }),
  n('g5', 'Gate 5\n完成门禁', 500, Y, { color: 'emerald', height: H, parentId: 'lane-during' }),
  n('g6', 'Gate 6\nPre-commit', 140, Y, { color: 'amber', height: H, parentId: 'lane-after' }),
  n('g7', 'Gate 7\nPre-push', 320, Y, { color: 'amber', height: H, parentId: 'lane-after' }),
  n('g8', 'Gate 8\n归档检查', 140, Y, { color: 'violet', height: H, parentId: 'lane-archive' }),
  n('done', '完成', 320, Y, { color: 'ink', width: 70, height: H, parentId: 'lane-archive' }),
]

const edges = [
  e('start', 'g0'),
  e('g0', 'g1'),
  e('g1', 'g2'),
  e('g2', 'g3', { sourceHandle: 'b', targetHandle: 't' }),
  e('g3', 'g4'),
  e('g4', 'g5'),
  e('g5', 'g6', { sourceHandle: 'b', targetHandle: 't' }),
  e('g6', 'g7'),
  e('g7', 'g8', { sourceHandle: 'b', targetHandle: 't' }),
  e('g8', 'done'),
]

export function HarnessGatePipelineDiagram() {
  return (
    <DiagramShell
      title="Harness 门禁管道全景：Gate 0-8"
      description="四个阶段 9 道门禁，在 AI 产出代码的每一个关键节点自动触发检查，不通过就阻断。从探索到归档，全程质量兜底。"
      height={560}
      nodes={nodes}
      edges={edges}
    />
  )
}
