/**
 * 生产部署架构图 —— M15 生产运维
 * 网关 → 队列 → 缓存 → 限流 → Agent 服务 → 模型 API
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'edge', label: '边缘层 —— 网关 + 限流 + 鉴权', y: 5, height: 7, color: 'fuchsia' },
  { id: 'queue', label: '队列层 —— 削峰填谷', y: 14, height: 7, color: 'amber' },
  { id: 'agent', label: 'Agent 服务层 —— 推理 + 工具调用', y: 23, height: 7, color: 'brand' },
  { id: 'model', label: '模型层 —— LLM API + 缓存', y: 32, height: 7, color: 'emerald' },
  { id: 'data', label: '数据层 —— 向量库 + 日志 + 监控', y: 41, height: 7, color: 'ink' },
]

const nodes: DiagramNode[] = [
  { id: 'gw', label: 'API\n网关', x: 5, y: 6, color: 'fuchsia' },
  { id: 'auth', label: '鉴权\n限流', x: 25, y: 6, color: 'fuchsia' },
  { id: 'mq', label: '消息\n队列', x: 25, y: 15, color: 'amber' },
  { id: 'worker', label: 'Agent\nWorker', x: 5, y: 24, color: 'brand' },
  { id: 'tool', label: '工具\n执行器', x: 25, y: 24, color: 'brand' },
  { id: 'cache', label: '语义\n缓存', x: 45, y: 33, color: 'emerald' },
  { id: 'llm', label: 'LLM\nAPI', x: 65, y: 33, color: 'emerald' },
  { id: 'vec', label: '向量\n数据库', x: 5, y: 42, color: 'ink' },
  { id: 'log', label: '日志\n追踪', x: 25, y: 42, color: 'ink' },
  { id: 'monitor', label: '监控\n告警', x: 45, y: 42, color: 'ink' },
  { id: 'cb', label: '熔断器', x: 85, y: 24, color: 'danger' },
]

const edges: DiagramEdge[] = [
  { from: 'gw', to: 'auth', label: '请求' },
  { from: 'auth', to: 'mq', label: '入队' },
  { from: 'mq', to: 'worker', label: '消费' },
  { from: 'worker', to: 'tool', label: '调工具' },
  { from: 'worker', to: 'cache', label: '查缓存' },
  { from: 'cache', to: 'llm', label: 'Miss', dashed: true },
  { from: 'llm', to: 'cache', label: '回填', dashed: true },
  { from: 'worker', to: 'vec', label: 'RAG' },
  { from: 'worker', to: 'log', label: 'Trace' },
  { from: 'log', to: 'monitor', label: '聚合' },
  { from: 'worker', to: 'cb', label: '保护', dashed: true },
  { from: 'cb', to: 'llm', label: '放行/阻断', dashed: true },
]

export function DeploymentArchDiagram() {
  return (
    <ArchitectureDiagram
      title="Agent 生产部署架构"
      description="请求 → 网关/鉴权/限流 → 消息队列削峰 → Agent Worker 消费 → 语义缓存 → LLM API，并行查向量库、记录 Trace、熔断保护。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={440}
    />
  )
}