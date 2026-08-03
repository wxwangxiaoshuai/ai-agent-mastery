/**
 * 沙箱安全策略配置器 —— M9 L09-04
 * 学员拖动安全级别 → 自动推荐对应的沙箱策略配置（网络/文件/资源/权限）
 */
import { useState } from 'react'

interface PolicyItem {
  name: string
  low: string
  medium: string
  high: string
}

const POLICIES: PolicyItem[] = [
  {
    name: '网络访问',
    low: '允许（可访问外网）',
    medium: '限制（仅白名单域名）',
    high: '禁止（--network=none）',
  },
  {
    name: '文件系统',
    low: '可读写工作区',
    medium: '只读挂载（--read-only）',
    high: '无挂载（tmpfs 临时目录）',
  },
  {
    name: 'CPU / 内存',
    low: '无限制',
    medium: 'CPU 2核 / 内存 512MB',
    high: 'CPU 1核 / 内存 256MB',
  },
  {
    name: '系统调用',
    low: '默认 seccomp',
    medium: '自定义 seccomp profile',
    high: '最小化 seccomp（仅允许白名单）',
  },
  {
    name: '进程权限',
    low: '默认用户',
    medium: '非 root 用户',
    high: '非 root + no-new-privileges',
  },
  {
    name: '超时限制',
    low: '30 秒',
    medium: '10 秒',
    high: '5 秒',
  },
]

const SCENARIOS = [
  { level: 'low' as const, name: '内部 CI/CD', description: '已知安全的内网环境，运行你自己的代码' },
  { level: 'medium' as const, name: '客户数据分析', description: '客户上传的数据，第三方依赖，含网络请求' },
  { level: 'high' as const, name: '公开 API 服务', description: '任意用户提交的代码，公网暴露' },
]

export function SandboxPolicyConfigurator() {
  const [level, setLevel] = useState<'low' | 'medium' | 'high'>('medium')

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-1">🛡️ 沙箱安全策略配置器</h3>
      <p className="text-xs text-gray-400 mb-3">
        拖动安全级别滑块 → 看到每个维度的策略变化。安全级别不是越高越好——越安全，能做的事越少。
      </p>

      {/* 场景选择 */}
      <div className="flex gap-2 mb-4">
        {SCENARIOS.map((s) => (
          <button
            key={s.level}
            onClick={() => setLevel(s.level)}
            className={`flex-1 p-2 rounded border text-xs ${
              level === s.level
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`font-semibold ${
              s.level === 'high' ? 'text-red-600' : s.level === 'medium' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {s.name}
            </div>
            <div className="text-gray-400 mt-0.5">{s.description}</div>
          </button>
        ))}
      </div>

      {/* 策略表 */}
      <div className="space-y-2">
        {POLICIES.map((p) => (
          <div key={p.name} className="p-2 bg-white rounded border text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-700">{p.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                level === 'high' ? 'bg-red-100 text-red-600' :
                level === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                'bg-green-100 text-green-600'
              }`}>
                {p[level]}
              </span>
            </div>
            <div className="flex gap-0.5">
              {(['low', 'medium', 'high'] as const).map((l) => (
                <div
                  key={l}
                  className={`flex-1 h-1 rounded-full ${
                    level === l
                      ? (l === 'high' ? 'bg-red-400' : l === 'medium' ? 'bg-yellow-400' : 'bg-green-400')
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 border-t pt-2">
        💡 纵深防御的三个原则：(1) 最小权限——只给任务需要的权限；
        (2) 分层——网络/文件/资源/权限各有独立防护层；
        (3) 不可逆——一旦降级到低安全级别，不能在同一次会话中回升。
      </p>
    </div>
  )
}
