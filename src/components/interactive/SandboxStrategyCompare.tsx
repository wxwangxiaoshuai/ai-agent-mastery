/**
 * 沙箱方案谱系对比 —— M9 L09-01
 * 展示 subprocess / Docker / E2B / Modal 四种沙箱方案的对比矩阵，帮助学员按场景选型
 */
import { useState } from 'react'

interface Strategy {
  name: string
  isolation: string
  isolationScore: number
  startup: string
  startupScore: number
  cost: string
  costScore: number
  bestFor: string
  tooling: string
}

const STRATEGIES: Strategy[] = [
  {
    name: 'subprocess',
    isolation: '进程级（同一 OS，可逃逸）',
    isolationScore: 1,
    startup: '毫秒',
    startupScore: 5,
    cost: '零（无额外开销）',
    costScore: 5,
    bestFor: '本机开发/调试、已知安全的内网脚本',
    tooling: 'Python subprocess、multiprocessing',
  },
  {
    name: 'Docker 自建',
    isolation: '容器级（内核共享，内核漏洞可逃逸）',
    isolationScore: 3,
    startup: '秒级（冷启动 2-5s）',
    startupScore: 3,
    cost: '机器成本（需预留资源）',
    costScore: 3,
    bestFor: '内部 CI/CD、批量数据分析',
    tooling: 'docker-py、podman',
  },
  {
    name: 'E2B 云端',
    isolation: 'VM 级（独立内核，厂商维护安全）',
    isolationScore: 4,
    startup: '秒级（SDK 约 150ms 创建）',
    startupScore: 4,
    cost: '按用量付费（~$0.01/session）',
    costScore: 4,
    bestFor: '生产环境、多租户安全隔离、需要 GUI 支持',
    tooling: 'e2b-code-interpreter SDK',
  },
  {
    name: 'Modal / Fly.io',
    isolation: 'VM 级 + 厂商托管',
    isolationScore: 5,
    startup: '分钟级（冷启动含镜像拉取）',
    startupScore: 2,
    cost: '按 GPU/CPU 时间计费',
    costScore: 2,
    bestFor: 'LLM 推理、GPU 密集计算、批量离线任务',
    tooling: 'modal CLI、flyctl',
  },
]

export function SandboxStrategyCompare() {
  const [detail, setDetail] = useState<number | null>(null)

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-3">🏰 沙箱方案谱系对比</h3>
      <p className="text-xs text-gray-400 mb-3">
        四种沙箱方案在隔离性、启动速度、成本上的取舍。点击行查看详细适用场景。
      </p>

      {/* 矩阵表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-gray-400">
              <th className="text-left p-1.5">方案</th>
              <th className="text-center p-1.5">隔离性</th>
              <th className="text-center p-1.5">启动</th>
              <th className="text-center p-1.5">成本</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGIES.map((s, i) => (
              <tr
                key={s.name}
                onClick={() => setDetail(detail === i ? null : i)}
                className={`border-b cursor-pointer transition-colors ${
                  detail === i ? 'bg-blue-50' : 'hover:bg-white'
                }`}
              >
                <td className="p-1.5 font-medium text-gray-700">{s.name}</td>
                <td className="p-1.5 text-center">{'■'.repeat(s.isolationScore)}{'□'.repeat(5 - s.isolationScore)}</td>
                <td className="p-1.5 text-center">{'■'.repeat(s.startupScore)}{'□'.repeat(5 - s.startupScore)}</td>
                <td className="p-1.5 text-center">{'■'.repeat(s.costScore)}{'□'.repeat(5 - s.costScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail !== null && (
        <div className="mt-3 p-3 bg-white rounded border text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">{STRATEGIES[detail].name}</span>
            <span className="text-gray-400">—</span>
            <span className="text-gray-500">隔离: {STRATEGIES[detail].isolation}</span>
            <span className="text-gray-500">启动: {STRATEGIES[detail].startup}</span>
            <span className="text-gray-500">成本: {STRATEGIES[detail].cost}</span>
          </div>
          <div>
            <span className="text-gray-400">最适合：</span>
            <span className="text-gray-600">{STRATEGIES[detail].bestFor}</span>
          </div>
          <div>
            <span className="text-gray-400">工具链：</span>
            <span className="text-gray-600">{STRATEGIES[detail].tooling}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3 border-t pt-2">
        💡 选型思路：先看<strong>安全需求</strong>（不可信代码必须 VM 级隔离），再看<strong>延迟需求</strong>（同步 Agent 不能等分钟级冷启动），最后算<strong>成本</strong>。
      </p>
    </div>
  )
}
