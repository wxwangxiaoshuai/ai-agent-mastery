/**
 * Harness 门禁管道全景图 —— M17 L17-14
 * 对齐正文三级防线：Pre-commit (0-3) / CI (4-6) / 归档前 (7-8)
 */
import { DiagramShell, n, e, g } from './_shared'

const H = 64
const Y = 35
const W = 820

const nodes = [
  g('lane-precommit', '第一级 · Pre-commit（Gate 0-3）', 0, 0, W, 110, 'brand'),
  g('lane-ci', '第二级 · Pre-push / CI（Gate 4-6）', 0, 130, W, 110, 'emerald'),
  g('lane-archive', '第三级 · 归档前（Gate 7-8）', 0, 260, W, 110, 'violet'),

  n('start', '开始', 16, Y, { color: 'ink', width: 64, height: H, parentId: 'lane-precommit' }),
  n('g0', 'Gate 0\n类型检查', 100, Y, { color: 'brand', width: 120, height: H, parentId: 'lane-precommit' }),
  n('g1', 'Gate 1\nLint', 250, Y, { color: 'brand', width: 110, height: H, parentId: 'lane-precommit' }),
  n('g2', 'Gate 2\n课程校验', 390, Y, { color: 'brand', width: 120, height: H, parentId: 'lane-precommit' }),
  n('g3', 'Gate 3\n安全扫描', 540, Y, { color: 'brand', width: 120, height: H, parentId: 'lane-precommit' }),

  n('g4', 'Gate 4\n测试', 100, Y, { color: 'emerald', width: 120, height: H, parentId: 'lane-ci' }),
  n('g5', 'Gate 5\n构建', 280, Y, { color: 'emerald', width: 120, height: H, parentId: 'lane-ci' }),
  n('g6', 'Gate 6\nE2E 冒烟', 460, Y, { color: 'emerald', width: 130, height: H, parentId: 'lane-ci' }),

  n('g7', 'Gate 7\n人工确认', 100, Y, { color: 'violet', width: 130, height: H, parentId: 'lane-archive' }),
  n('g8', 'Gate 8\n产物完整性', 300, Y, { color: 'violet', width: 140, height: H, parentId: 'lane-archive' }),
  n('done', '完成', 500, Y, { color: 'ink', width: 64, height: H, parentId: 'lane-archive' }),
]

const edges = [
  e('start', 'g0'),
  e('g0', 'g1'),
  e('g1', 'g2'),
  e('g2', 'g3'),
  e('g3', 'g4', { fromSide: 's', toSide: 'n' }),
  e('g4', 'g5'),
  e('g5', 'g6'),
  e('g6', 'g7', { fromSide: 's', toSide: 'n' }),
  e('g7', 'g8'),
  e('g8', 'done'),
]

export function HarnessGatePipelineDiagram() {
  return (
    <DiagramShell
      title="Harness 门禁管道全景：三级防线 · Gate 0-8"
      description="三级防线、九道门禁：Pre-commit（类型/Lint/课程校验/安全）→ CI（测试/构建/E2E）→ 归档前（人工确认/产物完整性）。不通过就阻断。"
      height={430}
      nodes={nodes}
      edges={edges}
    />
  )
}
