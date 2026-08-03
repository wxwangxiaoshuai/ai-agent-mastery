/**
 * MCP 连接状态面板 —— M6 L06-04/05
 * 学员切换 MCP Server 状态 → 观察 Client ↔ Server 通信流程和状态变化
 */
import { useState } from 'react'

interface ToolDef {
  name: string
  description: string
  inputSchema: string
}

const MOCK_TOOLS: ToolDef[] = [
  { name: 'query_db', description: '执行 SQL 查询（仅 SELECT）', inputSchema: 'sql: string' },
  { name: 'list_tables', description: '列出数据库中所有表', inputSchema: '(无)' },
]

const MOCK_RESOURCES = [
  'kb://stats — 数据库统计信息',
  'kb://schema — 数据库表结构',
]

export function MCPStatusPanel() {
  const [phase, setPhase] = useState<'init' | 'handshake' | 'ready' | 'error'>('init')
  const [discoveryStep, setDiscoveryStep] = useState(0)

  const connect = () => {
    setPhase('handshake')
    setDiscoveryStep(1)
    const timer1 = setTimeout(() => setDiscoveryStep(2), 600)
    const timer2 = setTimeout(() => {
      setDiscoveryStep(3)
      setPhase('ready')
    }, 1200)
    return () => { clearTimeout(timer1); clearTimeout(timer2) }
  }

  const disconnect = () => {
    setPhase('init')
    setDiscoveryStep(0)
  }

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50 font-mono text-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">🔌 MCP 连接面板</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            phase === 'ready' ? 'bg-green-500' : phase === 'handshake' ? 'bg-yellow-500' : phase === 'error' ? 'bg-red-500' : 'bg-gray-300'
          }`} />
          <span className="text-xs text-gray-500">
            {phase === 'init' ? '未连接' : phase === 'handshake' ? '握手中...' : phase === 'ready' ? '已就绪' : '错误'}
          </span>
        </div>
      </div>

      {/* Client ↔ Server 通信流 */}
      <div className="mb-4">
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
          <span className="px-2 py-0.5 bg-blue-50 rounded text-blue-600">Client (Python)</span>
          <span className="text-gray-300">⟷</span>
          <span className="px-2 py-0.5 bg-purple-50 rounded text-purple-600">Server (stdio/HTTP)</span>
        </div>

        {/* 初始化 */}
        <div className={`p-2 rounded mb-1 text-xs ${phase === 'init' ? 'bg-gray-100' : 'text-gray-400'}`}>
          <button
            onClick={connect}
            disabled={phase !== 'init'}
            className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            启动 Server 并连接
          </button>
          <span className="ml-2 text-gray-400">python mcp_server.py</span>
        </div>

        {/* Handshake */}
        {phase !== 'init' && (
          <>
            <div className={`p-2 rounded mb-1 text-xs ${discoveryStep >= 1 ? 'bg-yellow-50' : 'text-gray-300'}`}>
              {discoveryStep >= 1 ? '▶' : '·'} initialize() → 协商协议版本与能力
            </div>
            <div className={`p-2 rounded mb-1 text-xs ${discoveryStep >= 2 ? 'bg-yellow-50' : 'text-gray-300'}`}>
              {discoveryStep >= 2 ? '▶' : '·'} tools/list() → 发现可用工具
            </div>
            <div className={`p-2 rounded mb-1 text-xs ${discoveryStep >= 3 ? 'bg-yellow-50' : 'text-gray-300'}`}>
              {discoveryStep >= 3 ? '▶' : '·'} resources/list() → 发现可用资源
            </div>
          </>
        )}

        {/* 就绪状态 */}
        {phase === 'ready' && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-2">已发现的工具和资源：</p>

            <div className="mb-2">
              <span className="text-xs text-gray-400">Tools:</span>
              {MOCK_TOOLS.map((t) => (
                <div key={t.name} className="ml-3 mt-1 p-2 bg-white rounded border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-semibold">{t.name}</span>
                    <span className="text-gray-500">({t.inputSchema})</span>
                  </div>
                  <p className="text-gray-400 mt-0.5">{t.description}</p>
                </div>
              ))}
            </div>

            <div>
              <span className="text-xs text-gray-400">Resources:</span>
              {MOCK_RESOURCES.map((r, i) => (
                <div key={i} className="ml-3 mt-1 p-1.5 bg-white rounded border text-xs text-gray-600">
                  {r}
                </div>
              ))}
            </div>

            <button
              onClick={disconnect}
              className="mt-3 px-3 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
            >
              断开连接
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 border-t pt-2">
        💡 MCP 的核心是 <strong>协议而非框架</strong>——任何实现了 tools/list + tools/call 的服务都是 MCP Server。
        Client 不需要预先知道 Server 有什么工具，连接时自动发现 (discovery)，这就是它比硬编码工具的优越之处。
      </p>
    </div>
  )
}
