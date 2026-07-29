/**
 * Perplexity 搜索→推理→引用→生成架构 —— M14 L14-04 参考架构案例拆解 III
 * 搜索驱动流水线：查询改写 → 多源并行搜索 → Reranking → 综合生成 → 引用溯源
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'input', label: '输入理解层 —— 查询改写 + 意图判断', y: 2, height: 10, color: 'brand' },
  { id: 'search', label: '搜索层 —— 多源并行检索', y: 14, height: 10, color: 'emerald' },
  { id: 'process', label: '检索结果处理层 —— 去重 + Reranking', y: 26, height: 10, color: 'amber' },
  { id: 'generate', label: '生成与呈现层 —— 综合 + 引用', y: 38, height: 10, color: 'fuchsia' },
]

const nodes: DiagramNode[] = [
  { id: 'query', label: '用户\n问题', x: 3, y: 4, color: 'ink' },
  { id: 'rewrite', label: '查询\n改写', x: 18, y: 4, color: 'brand' },
  { id: 'intent', label: '意图\n判断', x: 33, y: 4, color: 'brand' },
  { id: 'web', label: 'Web\n搜索', x: 3, y: 16, color: 'emerald' },
  { id: 'index', label: '自有\n索引', x: 18, y: 16, color: 'emerald' },
  { id: 'multi', label: '多查询\n并行', x: 33, y: 16, color: 'emerald' },
  { id: 'dedup', label: '去重\n过滤', x: 3, y: 28, color: 'amber' },
  { id: 'rerank', label: 'Reranking\n排序', x: 18, y: 28, color: 'amber' },
  { id: 'extract', label: '提取\n片段', x: 33, y: 28, color: 'amber' },
  { id: 'synthesize', label: '综合\n生成', x: 3, y: 40, color: 'fuchsia' },
  { id: 'cite', label: '引用\n标注', x: 18, y: 40, color: 'fuchsia' },
  { id: 'present', label: '答案\n呈现', x: 33, y: 40, color: 'fuchsia' },
  { id: 'suggest', label: '追问\n建议', x: 48, y: 40, color: 'ink' },
]

const edges: DiagramEdge[] = [
  { from: 'query', to: 'rewrite', label: '输入' },
  { from: 'rewrite', to: 'intent', label: '改写完' },
  { from: 'intent', to: 'multi', label: '要搜' },
  { from: 'multi', to: 'web', label: '并行', dashed: true },
  { from: 'multi', to: 'index', label: '并行', dashed: true },
  { from: 'web', to: 'dedup', label: '结果' },
  { from: 'index', to: 'dedup', label: '结果' },
  { from: 'dedup', to: 'rerank', label: '去重完' },
  { from: 'rerank', to: 'extract', label: '排序完' },
  { from: 'extract', to: 'synthesize', label: '片段' },
  { from: 'synthesize', to: 'cite', label: '生成' },
  { from: 'cite', to: 'present', label: '标注完' },
  { from: 'present', to: 'suggest', label: '追问' },
]

export function PerplexityArchDiagram() {
  return (
    <ArchitectureDiagram
      title="Perplexity 搜索驱动架构"
      description="用户问题 → 查询改写 → 意图判断 → 多查询并行搜索（Web + 自有索引）→ 去重 → Reranking → 提取片段 → 综合生成 → 引用标注 → 答案呈现 + 追问建议。搜索是核心主线，模型是综合器而非知识库。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={320}
    />
  )
}