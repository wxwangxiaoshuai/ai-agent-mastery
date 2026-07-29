/**
 * RAG 数据流图 —— M4 RAG 深度实战
 * 索引管道（左）+ 检索管道（右）
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'index', label: '索引管道（离线）', y: 2, height: 38, color: 'brand' },
  { id: 'query', label: '检索管道（在线）', y: 43, height: 38, color: 'emerald' },
]

const nodes: DiagramNode[] = [
  { id: 'docs', label: '文档', x: 3, y: 10, color: 'ink' },
  { id: 'chunk', label: '分块', x: 20, y: 10, color: 'brand' },
  { id: 'embed', label: 'Embedding', x: 37, y: 10, color: 'brand' },
  { id: 'store', label: '向量库', x: 54, y: 10, color: 'brand' },
  { id: 'question', label: '问题', x: 3, y: 55, color: 'ink' },
  { id: 'qembed', label: 'Query\nEmbedding', x: 20, y: 55, color: 'emerald' },
  { id: 'search', label: '检索', x: 37, y: 55, color: 'emerald' },
  { id: 'rerank', label: 'Rerank', x: 54, y: 55, color: 'emerald' },
  { id: 'llm', label: 'LLM 生成', x: 71, y: 55, color: 'emerald' },
  { id: 'answer', label: '回答', x: 88, y: 55, color: 'ink' },
]

const edges: DiagramEdge[] = [
  { from: 'docs', to: 'chunk' },
  { from: 'chunk', to: 'embed' },
  { from: 'embed', to: 'store' },
  { from: 'question', to: 'qembed' },
  { from: 'qembed', to: 'search' },
  { from: 'store', to: 'search', label: '相似度', dashed: true },
  { from: 'search', to: 'rerank' },
  { from: 'rerank', to: 'llm' },
  { from: 'llm', to: 'answer' },
]

export function RAGPipelineDiagram() {
  return (
    <ArchitectureDiagram
      title="RAG 数据流：索引管道 + 检索管道"
      description="离线：文档 → 分块 → Embedding → 向量库。在线：问题 → Embedding → 检索 → Rerank → LLM 生成 → 回答。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={380}
    />
  )
}