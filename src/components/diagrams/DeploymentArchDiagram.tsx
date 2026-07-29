/**
 * 生产部署架构图 —— M15 生产运维
 * 含熔断打开时的降级路径、重试与扩缩容提示
 */
import { DiagramShell, n, e, g, ann } from './_shared'

const nodes = [
  g('lane-edge', '边缘层 —— 网关 + 限流 + 鉴权', 0, 0, 860, 100, 'fuchsia'),
  g('lane-queue', '队列层 —— 削峰填谷', 0, 120, 860, 100, 'amber'),
  g('lane-agent', 'Agent 服务层 —— 推理 + 工具 + 扩缩容', 0, 240, 860, 110, 'brand'),
  g('lane-model', '模型层 —— LLM API + 缓存 + 熔断降级', 0, 370, 860, 130, 'emerald'),
  g('lane-data', '数据层 —— 向量库 + 日志 + 监控', 0, 520, 860, 110, 'ink'),
  n('gw', 'API\n网关', 40, 35, { color: 'fuchsia', parentId: 'lane-edge' }),
  n('auth', '鉴权\n限流', 250, 35, { color: 'fuchsia', parentId: 'lane-edge' }),
  n('mq', '消息\n队列', 250, 35, { color: 'amber', parentId: 'lane-queue' }),
  n('worker', 'Agent\nWorker', 40, 40, { color: 'brand', parentId: 'lane-agent' }),
  n('tool', '工具\n执行器', 250, 40, { color: 'brand', parentId: 'lane-agent' }),
  n('scale', 'HPA\n扩缩容', 480, 40, { color: 'brand', parentId: 'lane-agent' }),
  n('cache', '语义\n缓存', 160, 45, { color: 'emerald', parentId: 'lane-model' }),
  n('cb', '熔断器', 360, 45, { color: 'danger', parentId: 'lane-model' }),
  n('llm', 'LLM\nAPI', 540, 45, { color: 'emerald', parentId: 'lane-model' }),
  n('fallback', '降级回复\n缓存/模板', 720, 45, { color: 'amber', width: 120, parentId: 'lane-model' }),
  n('vec', '向量\n数据库', 40, 40, { color: 'ink', parentId: 'lane-data' }),
  n('log', '日志\n追踪', 250, 40, { color: 'ink', parentId: 'lane-data' }),
  n('monitor', '监控\n告警', 460, 40, { color: 'ink', parentId: 'lane-data' }),
  ann('retry-note', '重试：指数退避，仅幂等读', 620, 560),
]

const edges = [
  e('gw', 'auth', { label: '请求' }),
  e('auth', 'mq', { label: '入队', fromSide: 's', toSide: 'n' }),
  e('mq', 'worker', { label: '消费', fromSide: 's', toSide: 'n' }),
  e('worker', 'tool', { label: '调工具' }),
  e('tool', 'worker', { label: '结果', dashed: true, fromSide: 'w', toSide: 'e', id: 'tool-back' }),
  e('monitor', 'scale', { label: '负载触发', dashed: true, fromSide: 'n', toSide: 's', accent: 'brand', id: 'mon-scale' }),
  e('scale', 'worker', { label: '副本±', dashed: true, accent: 'brand', id: 'scale-w' }),
  e('worker', 'cache', { label: '查缓存', fromSide: 's', toSide: 'n' }),
  e('cache', 'worker', { label: 'Hit', dashed: true, fromSide: 'n', toSide: 's', id: 'cache-hit' }),
  e('cache', 'cb', { label: 'Miss', dashed: true, accent: 'amber', id: 'cache-miss' }),
  e('cb', 'llm', { label: '放行', accent: 'emerald' }),
  e('cb', 'fallback', { label: 'Open 降级', accent: 'danger', dashed: true, id: 'cb-fb' }),
  e('fallback', 'worker', {
    label: '兜底响应',
    dashed: true,
    fromSide: 'n',
    toSide: 'e',
    curve: 'bezier',
    accent: 'amber',
    id: 'fb-worker',
  }),
  e('llm', 'worker', {
    label: '响应',
    dashed: true,
    fromSide: 'n',
    toSide: 'e',
    curve: 'bezier',
    id: 'llm-back',
  }),
  e('llm', 'cb', {
    label: '失败重试耗尽',
    dashed: true,
    fromSide: 'w',
    toSide: 'e',
    accent: 'danger',
    id: 'llm-fail',
  }),
  e('worker', 'vec', { label: 'RAG', fromSide: 's', toSide: 'n' }),
  e('vec', 'worker', { label: '片段', dashed: true, fromSide: 'n', toSide: 's', id: 'vec-back' }),
  e('worker', 'log', { label: 'Trace', fromSide: 's', toSide: 'n' }),
  e('log', 'monitor', { label: '聚合' }),
]

export function DeploymentArchDiagram() {
  return (
    <DiagramShell
      title="Agent 生产部署架构"
      description="网关/鉴权/限流 → 队列 → Worker（工具+HPA 扩缩容）→ 语义缓存；Miss 经熔断调 LLM，熔断 Open 时走降级回复；失败重试耗尽回熔断；Trace 驱动监控与扩缩。"
      height={690}
      nodes={nodes}
      edges={edges}
    />
  )
}
