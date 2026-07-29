/**
 * Agent 平台分层架构 —— M14 架构设计
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-access', '接入层 —— 多租户 + API + 权限', 0, 0, 820, 100, 'fuchsia'),
  g('lane-orch', '编排层 —— Agent 生命周期管理', 0, 120, 820, 100, 'brand'),
  g('lane-tools', '工具生态层 —— MCP + 插件市场', 0, 240, 820, 100, 'amber'),
  g('lane-data', '数据层 —— 隔离 + 向量库 + 审计', 0, 360, 820, 100, 'emerald'),
  g('lane-infra', '基础设施层 —— 计算 + 网络 + 安全', 0, 480, 820, 100, 'ink'),
  n('tenant_a', '租户 A', 40, 35, { color: 'fuchsia', parentId: 'lane-access' }),
  n('gw', 'API\n网关', 220, 35, { color: 'fuchsia', parentId: 'lane-access' }),
  n('tenant_b', '租户 B', 400, 35, { color: 'fuchsia', parentId: 'lane-access' }),
  n('auth_svc', '权限\n服务', 600, 35, { color: 'fuchsia', parentId: 'lane-access' }),
  n('agent_mgr', 'Agent\n管理器', 220, 35, { color: 'brand', parentId: 'lane-orch' }),
  n('orchestrator', '编排\n引擎', 420, 35, { color: 'brand', parentId: 'lane-orch' }),
  n('registry', '工具\n注册表', 220, 35, { color: 'amber', parentId: 'lane-tools' }),
  n('mcp_gw', 'MCP\n网关', 420, 35, { color: 'amber', parentId: 'lane-tools' }),
  n('isolate', '数据\n隔离', 120, 35, { color: 'emerald', parentId: 'lane-data' }),
  n('vec', '向量\n数据库', 320, 35, { color: 'emerald', parentId: 'lane-data' }),
  n('audit', '审计\n日志', 520, 35, { color: 'emerald', parentId: 'lane-data' }),
  n('compute', '计算\n资源池', 220, 35, { color: 'ink', parentId: 'lane-infra' }),
  n('billing', '计费\n计量', 420, 35, { color: 'ink', parentId: 'lane-infra' }),
]

const edges = [
  e('tenant_a', 'gw', { label: '请求', id: 'ta-gw' }),
  e('tenant_b', 'gw', { label: '请求', id: 'tb-gw' }),
  e('gw', 'auth_svc', { label: '鉴权' }),
  e('auth_svc', 'gw', { label: '放行', dashed: true, id: 'auth-ok' }),
  e('gw', 'agent_mgr', { label: '路由', sourceHandle: 'b', targetHandle: 't' }),
  e('agent_mgr', 'orchestrator', { label: '调度' }),
  e('orchestrator', 'registry', { label: '加载工具', sourceHandle: 'b', targetHandle: 't' }),
  e('registry', 'mcp_gw', { label: '连接' }),
  e('mcp_gw', 'orchestrator', {
    label: '工具结果',
    dashed: true,
    fromSide: 'n',
    toSide: 's',
    accent: 'amber',
    id: 'mcp-back',
  }),
  e('agent_mgr', 'isolate', { label: '读写', sourceHandle: 'b', targetHandle: 't' }),
  e('orchestrator', 'vec', { label: '检索', sourceHandle: 'b', targetHandle: 't', dashed: true }),
  e('isolate', 'audit', { label: '记录' }),
  e('vec', 'audit', { label: '记录', dashed: true, id: 'vec-audit' }),
  e('agent_mgr', 'compute', { label: '分配', sourceHandle: 'b', targetHandle: 't' }),
  e('compute', 'billing', { label: '统计' }),
]

export function AgentPlatformDiagram() {
  return (
    <DiagramShell
      title="Agent 平台分层架构"
      description="多租户 → API 网关鉴权放行 → Agent 管理器 → 编排引擎 → 工具注册表/MCP 网关；数据层含隔离、向量库与审计；基建为计算资源池与计费。"
      height={640}
      nodes={nodes}
      edges={edges}
    />
  )
}
