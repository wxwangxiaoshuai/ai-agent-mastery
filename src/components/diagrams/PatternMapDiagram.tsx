/**
 * 设计模式全景分类图 —— M5 L05-07
 *
 * 列对齐布局（避免跨层乱线）：
 *   上：模式结果（内嵌模块标签）
 *   下：决策问题
 *   「是」短箭头向上落到同列模式；「否」向右进入下一问
 */
import { DiagramShell, n, e, g, ann } from './_shared'

const COL = [40, 210, 380, 550, 720] as const
const Y_PATTERN = 48
const Y_QUESTION = 230
const H_PATTERN = 72
const H_QUESTION = 64
const W = 900

const nodes = [
  g('lane-patterns', '结果：五大模式 + 课程模块', 0, 0, W, 150, 'brand'),
  g('lane-decision', '决策：从左到右追问 · 是↑选中 · 否→继续', 0, 180, W, 220, 'amber'),

  n('chain', 'Prompt\nChaining', COL[0], Y_PATTERN, {
    color: 'brand',
    caption: 'M2 Prompt',
    width: 130,
    height: H_PATTERN,
  }),
  n('route', 'Routing', COL[1], Y_PATTERN, {
    color: 'brand',
    caption: 'M6 工具',
    width: 130,
    height: H_PATTERN,
  }),
  n('parallel', 'Parallelization', COL[2], Y_PATTERN, {
    color: 'brand',
    caption: 'M6 · M11',
    width: 130,
    height: H_PATTERN,
  }),
  n('orch', 'Orchestrator\n-Workers', COL[3], Y_PATTERN, {
    color: 'brand',
    caption: 'M5 · M11',
    width: 130,
    height: H_PATTERN,
  }),
  n('eval', 'Evaluator\n-Optimizer', COL[4], Y_PATTERN, {
    color: 'brand',
    caption: 'M13 评估',
    width: 130,
    height: H_PATTERN,
  }),

  n('q1', '可预定义\n步骤？', COL[0], Y_QUESTION, {
    color: 'amber',
    width: 110,
    height: H_QUESTION,
  }),
  n('q2', '输入类型\n差异大？', COL[1], Y_QUESTION, {
    color: 'amber',
    width: 110,
    height: H_QUESTION,
  }),
  n('q3', '可并行？', COL[2], Y_QUESTION, {
    color: 'amber',
    width: 110,
    height: H_QUESTION,
  }),
  n('q4', '需动态\n拆任务？', COL[3], Y_QUESTION, {
    color: 'amber',
    width: 110,
    height: H_QUESTION,
  }),
  n('q5', '有质量\n门禁？', COL[4], Y_QUESTION, {
    color: 'amber',
    width: 110,
    height: H_QUESTION,
  }),

  n('fallback', '默认 →\nParallel', COL[4], 320, {
    color: 'emerald',
    size: 'sm',
    width: 110,
    height: 52,
    caption: 'fallback',
  }),

  ann('hint', '阅读方向：从左下第一个问题开始', 40, 340),
]

const edges = [
  // 是 → 同列向上（短距、有箭头、有颜色）
  e('q1', 'chain', {
    label: '是',
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'q1-yes',
  }),
  e('q2', 'route', {
    label: '是',
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'q2-yes',
  }),
  e('q3', 'parallel', {
    label: '是',
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'q3-yes',
  }),
  e('q4', 'orch', {
    label: '是',
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'q4-yes',
  }),
  e('q5', 'eval', {
    label: '是',
    fromSide: 'n',
    toSide: 's',
    accent: 'emerald',
    id: 'q5-yes',
  }),

  // 否 → 下一问（向右）
  e('q1', 'q2', { label: '否', accent: 'amber', id: 'q1-no' }),
  e('q2', 'q3', { label: '否', accent: 'amber', id: 'q2-no' }),
  e('q3', 'q4', { label: '否', accent: 'amber', id: 'q3-no' }),
  e('q4', 'q5', { label: '否', accent: 'amber', id: 'q4-no' }),
  e('q5', 'fallback', {
    label: '否',
    fromSide: 's',
    toSide: 'n',
    dashed: true,
    accent: 'ink',
    id: 'q5-no',
  }),
]

export function PatternMapDiagram() {
  return (
    <DiagramShell
      title="Agent 设计模式全景地图"
      description="从左到右回答决策问题：「是」向上选中该列模式（节点上已标注对应课程模块）；「否」进入下一问；全部为否则默认 Parallelization。"
      height={460}
      nodes={nodes}
      edges={edges}
      fitViewPadding={0.08}
    />
  )
}
