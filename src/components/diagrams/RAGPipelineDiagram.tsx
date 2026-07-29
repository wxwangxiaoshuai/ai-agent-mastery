/**
 * RAG 数据流图 —— M4 RAG 深度实战
 */
import { DiagramShell, n, e, g } from './_shared'

const W = 800
const H_ROW = 56

const nodes = [
  g('lane-index', '索引管道（离线）', 0, 0, W, 120, 'brand'),
  g('lane-query', '检索管道（在线）', 0, 160, W, 180, 'emerald'),

  n('docs', '文档', 40, 45, { color: 'ink', caption: 'src', height: H_ROW }),
  n('chunk', '分块', 190, 45, { color: 'brand', height: H_ROW }),
  n('embed', 'Embedding', 350, 45, { color: 'brand', height: H_ROW }),
  n('store', '向量库', 540, 45, { color: 'brand', caption: 'index', height: H_ROW }),

  n('question', '问题', 40, 210, { color: 'ink', caption: 'query', height: H_ROW }),
  n('qembed', 'Query\nEmbedding', 190, 210, { color: 'emerald', height: H_ROW }),
  n('search', '检索', 360, 210, { color: 'emerald', height: H_ROW }),
  n('rerank', 'Rerank', 510, 210, { color: 'emerald', height: H_ROW }),
  n('llm', 'LLM 生成', 650, 210, { color: 'emerald', height: H_ROW }),
  n('answer', '回答', 650, 295, { color: 'ink', emphasis: 'output', height: H_ROW }),
]

const edges = [
  e('docs', 'chunk', { accent: 'brand' }),
  e('chunk', 'embed', { accent: 'brand' }),
  e('embed', 'store', { accent: 'brand' }),
  e('question', 'qembed', { accent: 'emerald' }),
  e('qembed', 'search', { accent: 'emerald' }),
  e('store', 'search', {
    label: '相似度',
    dashed: true,
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('search', 'rerank', { accent: 'emerald' }),
  e('rerank', 'llm', { accent: 'emerald' }),
  e('llm', 'answer', { label: '生成', fromSide: 's', toSide: 'n', accent: 'ink' }),
]

export function RAGPipelineDiagram() {
  return (
    <DiagramShell
      title="RAG 数据流：索引管道 + 检索管道"
      description="离线：文档 → 分块 → Embedding → 向量库。在线：问题 → Embedding → 检索 → Rerank → LLM 生成 → 回答。"
      height={400}
      nodes={nodes}
      edges={edges}
    />
  )
}
