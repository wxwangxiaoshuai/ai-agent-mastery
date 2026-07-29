/**
 * 交互式门禁配置器 —— M17 L17-14 Harness 质量门禁
 * 学习者选择项目风险等级 → 自动生成推荐的门禁配置
 */
import { useState } from 'react'

type RiskLevel = 'low' | 'medium' | 'high'

interface GateConfig {
  name: string
  description: string
  commands: string[]
}

const RISK_LABELS: Record<RiskLevel, { label: string; description: string; color: string }> = {
  low: {
    label: '低风险',
    description: '个人玩具 / 练手项目',
    color: 'emerald',
  },
  medium: {
    label: '中风险',
    description: '有用户的产品 / SaaS',
    color: 'amber',
  },
  high: {
    label: '高风险',
    description: '涉及钱、权限、数据删除',
    color: 'danger',
  },
}

function getConfig(risk: RiskLevel): GateConfig[] {
  const common: GateConfig[] = [
    {
      name: 'Gate 6: Pre-commit（lint）',
      description: '代码风格检查 —— 防止风格漂移',
      commands: ['ruff check src/ && ruff format --check src/'],
    },
    {
      name: 'Gate 6: Pre-commit（test）',
      description: '测试收集验证 —— 防止测试文件损坏',
      commands: ['python -m pytest --co -q 2>/dev/null | tail -1'],
    },
  ]

  const mediumPlus: GateConfig[] = [
    {
      name: 'Gate 6: Pre-commit（type-check）',
      description: '类型检查 —— 防止类型错误',
      commands: ['mypy src/ --strict'],
    },
    {
      name: 'Gate 6: Pre-commit（quality）',
      description: '代码质量 —— 防止吞异常、依赖膨胀、超复杂度',
      commands: ['bash scripts/check-quality.sh', 'bash scripts/check-dependency-redline.sh'],
    },
    {
      name: 'Gate 6: Pre-commit（security）',
      description: '安全扫描 —— 防止已知漏洞',
      commands: ['safety check --bare 2>/dev/null || echo "⚠️ 安全扫描跳过"'],
    },
    {
      name: 'Gate 7: Pre-push',
      description: '完整回归测试 —— 防止已有功能被破坏',
      commands: ['python -m pytest', 'safety check'],
    },
  ]

  const highOnly: GateConfig[] = [
    {
      name: 'Gate 7: Pre-push（安全审计）',
      description: '安全审计 —— 额外的人工审批节点',
      commands: ['bash scripts/security-audit.sh', '# 需要人工审批通过'],
    },
  ]

  if (risk === 'low') return common
  if (risk === 'medium') return [...common, ...mediumPlus]
  return [...common, ...mediumPlus, ...highOnly]
}

export function GateConfigurator() {
  const [risk, setRisk] = useState<RiskLevel>('medium')
  const config = getConfig(risk)
  const rl = RISK_LABELS[risk]

  return (
    <div className="card p-5 not-prose">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">门禁配置器</h4>
      <p className="mb-4 text-xs text-ink-500">
        选择项目风险等级，查看推荐的门禁配置。配置写在 .claude/settings.json 或 .github/hooks/ 里，随项目 Git 版本管理。
      </p>

      {/* Risk selector */}
      <div className="mb-4 flex gap-2">
        {(Object.entries(RISK_LABELS) as [RiskLevel, typeof rl][]).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setRisk(key)}
            className={`flex-1 rounded-control border px-3 py-2 text-xs font-medium transition-colors ${
              risk === key
                ? `border-${info.color}-500/50 bg-${info.color}-500/15 text-${info.color}-300`
                : 'border-ink-700 bg-ink-800/40 text-ink-400 hover:border-ink-600'
            }`}
          >
            <div>{info.label}</div>
            <div className="text-[10px] opacity-60">{info.description}</div>
          </button>
        ))}
      </div>

      {/* Generated config */}
      <div className="space-y-2">
        {config.map((gate, i) => (
          <div
            key={i}
            className="rounded-lg border border-ink-700 bg-ink-800/40 p-3"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                {gate.name}
              </span>
              <span className="text-xs text-ink-400">{gate.description}</span>
            </div>
            <div className="rounded bg-ink-900 p-2">
              <pre className="text-[11px] text-ink-300 font-mono leading-relaxed">
                {gate.commands.map((cmd) => `$ ${cmd}`).join('\n')}
              </pre>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3">
        <p className="text-xs text-brand-300">
          <span className="font-semibold">门禁原则：</span>
          门禁失败的 commit 不允许创建。AI 必须修复问题后重新提交。pre-commit 检查耗时约 30 秒，但省掉的是"合并后发现问题返工 1 小时"。
        </p>
      </div>
    </div>
  )
}