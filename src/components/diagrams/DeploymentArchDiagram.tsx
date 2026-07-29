/**
 * 生产部署架构图 —— M15 生产运维
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-edge', '边缘层 —— 网关 + 限流 + 鉴权', 0, 0, 820, 100, 'fuchsia'),
  g('lane-queue', '队列层 —— 削峰填谷', 0, 120, 820, 100, 'amber'),
  g('lane-agent', 'Agent 服务层 —— 推理 + 工具调用', 0, 240, 820, 110, 'brand'),
  g('lane-model', '模型层 —— LLM API + 缓存', 0, 370, 820, 110, 'emerald'),
  g('lane-data', '数据层 —— 向量库 + 日志 + 监控', 0, 500, 820, 110, 'ink'),
  n('gw', 'API\n网关', 40, 35, { color: 'fuchsia', parentId: 'lane-edge' }),
  n('auth', '鉴权\n限流', 250, 35, { color: 'fuchsia', parentId: 'lane-edge' }),
  n('mq', '消息\n队列', 250, 35, { color: 'amber', parentId: 'lane-queue' }),
  n('worker', 'Agent\nWorker', 40, 40, { color: 'brand', parentId: 'lane-agent' }),
  n('tool', '工具\n执行器', 250, 40, { color: 'brand', parentId: 'lane-agent' }),
  n('cache', '语义\n缓存', 250, 40, { color: 'emerald', parentId: 'lane-model' }),
  n('cb', '熔断器', 450, 40, { color: 'danger', parentId: 'lane-model' }),
  n('llm', 'LLM\nAPI', 640, 40, { color: 'emerald', parentId: 'lane-model' }),
  n('vec', '向量\n数据库', 40, 40, { color: 'ink', parentId: 'lane-data' }),
  n('log', '日志\n追踪', 250, 40, { color: 'ink', parentId: 'lane-data' }),
  n('monitor', '监控\n告警', 460, 40, { color: 'ink', parentId: 'lane-data' }),
]

const edges = [
  e('gw', 'auth', { label: '请求' }),
  e('auth', 'mq', { label: '入队', sourceHandle: 'b', targetHandle: 't' }),
  e('mq', 'worker', { label: '消费', sourceHandle: 'b', targetHandle: 't' }),
  e('worker', 'tool', { label: '调工具' }),
  e('tool', 'worker', { label: '结果', dashed: true, sourceHandle: 'l', targetHandle: 'r', id: 'tool-back' }),
  e('worker', 'cache', { label: '查缓存', sourceHandle: 'b', targetHandle: 't' }),
  e('cache', 'worker', { label: 'Hit', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'cache-hit' }),
  e('cache', 'cb', { label: 'Miss', dashed: true, accent: 'amber', id: 'cache-miss' }),
  e('cb', 'llm', { label: '放行', accent: 'emerald' }),
  e('llm', 'worker', {
    label: '响应',
    dashed: true,
    fromSide: 'n',
    toSide: 'e',
    curve: 'bezier',
    id: 'llm-back',
  }),
  e('worker', 'vec', { label: 'RAG', sourceHandle: 'b', targetHandle: 't' }),
  e('vec', 'worker', { label: '片段', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'vec-back' }),
  e('worker', 'log', { label: 'Trace', sourceHandle: 'b', targetHandle: 't' }),
  e('log', 'monitor', { label: '聚合' }),
]

export function DeploymentArchDiagram() {
  return (
    <DiagramShell
      title="Agent 生产部署架构"
      description="请求 → 网关/鉴权/限流 → 消息队列削峰 → Agent Worker：调工具并回传、查语义缓存（Hit 直返 / Miss 经熔断调 LLM）、并行 RAG 与 Trace 监控。"
      height={660}
      nodes={nodes}
      edges={edges}
    />
  )
}
