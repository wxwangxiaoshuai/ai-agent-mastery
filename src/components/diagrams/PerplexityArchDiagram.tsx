/**
 * Perplexity 搜索→推理→引用→生成架构 —— M14 L14-04
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-input', '输入理解层 —— 查询改写 + 意图判断', 0, 0, 860, 110, 'brand'),
  g('lane-search', '搜索层 —— 多源并行检索', 0, 130, 860, 110, 'emerald'),
  g('lane-process', '检索结果处理层 —— 去重 + Reranking', 0, 260, 860, 110, 'amber'),
  g('lane-gen', '生成与呈现层 —— 综合 + 引用', 0, 390, 860, 110, 'fuchsia'),
  n('query', '用户\n问题', 30, 40, { color: 'ink', parentId: 'lane-input' }),
  n('rewrite', '查询\n改写', 220, 40, { color: 'brand', parentId: 'lane-input' }),
  n('intent', '意图\n判断', 420, 40, { color: 'brand', parentId: 'lane-input' }),
  n('direct', '直接\n回答', 640, 40, { color: 'ink', parentId: 'lane-input' }),
  n('multi', '多查询\n并行', 30, 40, { color: 'emerald', parentId: 'lane-search' }),
  n('web', 'Web\n搜索', 250, 40, { color: 'emerald', parentId: 'lane-search' }),
  n('index', '自有\n索引', 470, 40, { color: 'emerald', parentId: 'lane-search' }),
  n('dedup', '去重\n过滤', 30, 40, { color: 'amber', parentId: 'lane-process' }),
  n('rerank', 'Reranking\n排序', 250, 40, { color: 'amber', parentId: 'lane-process' }),
  n('extract', '提取\n片段', 470, 40, { color: 'amber', parentId: 'lane-process' }),
  n('synthesize', '综合\n生成', 30, 40, { color: 'fuchsia', parentId: 'lane-gen' }),
  n('cite', '引用\n标注', 220, 40, { color: 'fuchsia', parentId: 'lane-gen' }),
  n('present', '答案\n呈现', 420, 40, { color: 'fuchsia', parentId: 'lane-gen' }),
  n('suggest', '追问\n建议', 640, 40, { color: 'ink', parentId: 'lane-gen' }),
]

const edges = [
  e('query', 'rewrite', { label: '输入' }),
  e('rewrite', 'intent', { label: '改写完' }),
  e('intent', 'multi', { label: '要搜', sourceHandle: 'b', targetHandle: 't' }),
  e('intent', 'direct', { label: '无需搜', dashed: true }),
  e('direct', 'present', { label: '直出', dashed: true, sourceHandle: 'b', targetHandle: 't' }),
  e('multi', 'web', { label: '并行', dashed: true, id: 'm-web' }),
  e('multi', 'index', { label: '并行', dashed: true, id: 'm-idx' }),
  e('web', 'dedup', { label: '结果', sourceHandle: 'b', targetHandle: 't', id: 'w-d' }),
  e('index', 'dedup', { label: '结果', sourceHandle: 'b', targetHandle: 't', id: 'i-d' }),
  e('dedup', 'rerank', { label: '去重完' }),
  e('rerank', 'extract', { label: '排序完' }),
  e('extract', 'synthesize', { label: '片段', sourceHandle: 'b', targetHandle: 't' }),
  e('synthesize', 'cite', { label: '生成' }),
  e('cite', 'present', { label: '标注完' }),
  e('present', 'suggest', { label: '追问' }),
]

export function PerplexityArchDiagram() {
  return (
    <DiagramShell
      title="Perplexity 搜索驱动架构"
      description="用户问题 → 查询改写 → 意图判断：需搜则多查询并行（Web + 自有索引）→ 去重 → Reranking → 提取片段 → 综合生成 → 引用标注 → 呈现 + 追问；无需搜则直接呈现。"
      height={560}
      nodes={nodes}
      edges={edges}
    />
  )
}
