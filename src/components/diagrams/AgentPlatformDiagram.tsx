/**
 * Agent 平台分层架构 —— M14 架构设计
 * 多租户接入 → Agent 编排 → 工具生态 → 基础设施
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'access', label: '接入层 —— 多租户 + API + 权限', y: 5, height: 7, color: 'fuchsia' },
  { id: 'orchestration', label: '编排层 —— Agent 生命周期管理', y: 14, height: 7, color: 'brand' },
  { id: 'tools', label: '工具生态层 —— MCP + 插件市场', y: 23, height: 7, color: 'amber' },
  { id: 'data', label: '数据层 —— 隔离 + 向量库 + 审计', y: 32, height: 7, color: 'emerald' },
  { id: 'infra', label: '基础设施层 —— 计算 + 网络 + 安全', y: 41, height: 7, color: 'ink' },
]

const nodes: DiagramNode[] = [
  { id: 'tenant_a', label: '租户 A', x: 5, y: 6, color: 'fuchsia' },
  { id: 'tenant_b', label: '租户 B', x: 50, y: 6, color: 'fuchsia' },
  { id: 'gw', label: 'API\n网关', x: 27, y: 6, color: 'fuchsia' },
  { id: 'agent_mgr', label: 'Agent\n管理器', x: 27, y: 15, color: 'brand' },
  { id: 'orchestrator', label: '编排\n引擎', x: 50, y: 15, color: 'brand' },
  { id: 'registry', label: '工具\n注册表', x: 27, y: 24, color: 'amber' },
  { id: 'mcp_gw', label: 'MCP\n网关', x: 50, y: 24, color: 'amber' },
  { id: 'isolate', label: '数据\n隔离', x: 27, y: 33, color: 'emerald' },
  { id: 'audit', label: '审计\n日志', x: 50, y: 33, color: 'emerald' },
  { id: 'compute', label: '计算\n资源池', x: 27, y: 42, color: 'ink' },
  { id: 'billing', label: '计费\n计量', x: 50, y: 42, color: 'ink' },
  { id: 'auth_svc', label: '权限\n服务', x: 73, y: 6, color: 'fuchsia' },
  { id: 'monitor', label: '平台\n监控', x: 73, y: 15, color: 'brand' },
]

const edges: DiagramEdge[] = [
  { from: 'tenant_a', to: 'gw', label: '请求' },
  { from: 'tenant_b', to: 'gw', label: '请求' },
  { from: 'gw', to: 'auth_svc', label: '鉴权' },
  { from: 'gw', to: 'agent_mgr', label: '路由' },
  { from: 'agent_mgr', to: 'orchestrator', label: '调度' },
  { from: 'orchestrator', to: 'registry', label: '加载工具' },
  { from: 'registry', to: 'mcp_gw', label: '连接' },
  { from: 'agent_mgr', to: 'isolate', label: '读写' },
  { from: 'isolate', to: 'audit', label: '记录' },
  { from: 'agent_mgr', to: 'compute', label: '分配' },
  { from: 'compute', to: 'billing', label: '统计' },
  { from: 'agent_mgr', to: 'monitor', label: '上报', dashed: true },
  { from: 'monitor', to: 'billing', label: '告警', dashed: true },
]

export function AgentPlatformDiagram() {
  return (
    <ArchitectureDiagram
      title="Agent 平台分层架构"
      description="多租户 → API 网关/鉴权 → Agent 管理器 → 编排引擎 → 工具注册表/MCP 网关 → 数据隔离 + 审计 → 计算资源池 + 计费。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={440}
    />
  )
}