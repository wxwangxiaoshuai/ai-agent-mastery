/**
 * 约定检查配置器 —— M17 L17-04
 * 学员选择项目阶段和代码规范需求 → 自动生成约定文件配置清单
 */
import { useState } from 'react'

interface Convention {
  tool: string
  file: string
  purpose: string
  stage: ('prototype' | 'growth' | 'production')
}

const CONVENTIONS: Convention[] = [
  { tool: 'ruff', file: '.ruff.toml', purpose: 'Python 代码风格与 lint 规则', stage: 'prototype' },
  { tool: 'prettier', file: '.prettierrc', purpose: '前端代码格式化规则', stage: 'prototype' },
  { tool: 'mypy', file: '.mypy.ini', purpose: 'Python 静态类型检查', stage: 'growth' },
  { tool: 'eslint', file: '.eslintrc.js', purpose: '前端代码质量规则', stage: 'growth' },
  { tool: 'editorconfig', file: '.editorconfig', purpose: '跨编辑器缩进与换行统一', stage: 'prototype' },
  { tool: 'gitignore', file: '.gitignore', purpose: '版本管理忽略规则', stage: 'prototype' },
  { tool: 'commitlint', file: '.commitlintrc.js', purpose: 'Commit message 格式约束', stage: 'production' },
  { tool: 'hadolint', file: '.hadolint.yaml', purpose: 'Dockerfile 最佳实践检查', stage: 'production' },
  { tool: 'bandit', file: '.bandit.yaml', purpose: 'Python 安全漏洞扫描', stage: 'production' },
]

const AI_CODING_CONVENTIONS = [
  '禁止修改已有变量名和函数签名（重构除外）',
  '禁止删除任何 return/raise/assert （它们可能在修你不知道的 bug）',
  '新增代码遵循已有代码的缩进和导入风格',
  'import 按标准库→第三方→本地分组，用 isort 格式',
  '所有 AI 生成的注释用 # AI: 标记，便于 review 时溯源',
]

export function ConventionChecker() {
  const [stage, setStage] = useState<'prototype' | 'growth' | 'production'>('prototype')

  const filtered = CONVENTIONS.filter((c) => {
    if (stage === 'prototype') return c.stage === 'prototype'
    if (stage === 'growth') return c.stage === 'prototype' || c.stage === 'growth'
    return true
  })

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-1">📐 代码规范配置器</h3>
      <p className="text-xs text-gray-400 mb-3">
        选项目阶段 → 自动推荐需要的约定文件。原型期只需基础的 linter 和格式化；
        成长期加类型检查；生产期加安全扫描。
      </p>

      {/* 阶段选择 */}
      <div className="flex gap-2 mb-4">
        {(['prototype', 'growth', 'production'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`flex-1 py-1.5 text-xs rounded border ${
              stage === s
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {s === 'prototype' ? '🛠 原型期' : s === 'growth' ? '📈 成长期' : '🏭 生产期'}
          </button>
        ))}
      </div>

      {/* 推荐的约定文件 */}
      <div className="space-y-1.5 mb-4">
        <p className="text-xs font-medium text-gray-500">
          推荐 {filtered.length} 个约定文件：
        </p>
        {filtered.map((c) => (
          <div key={c.tool} className="flex items-center gap-2 p-1.5 bg-white rounded border text-xs">
            <span className="font-mono text-blue-600 w-20">{c.tool}</span>
            <code className="text-gray-400 text-[11px] w-32">{c.file}</code>
            <span className="text-gray-500">{c.purpose}</span>
          </div>
        ))}
      </div>

      {/* AI Coding 额外约定 */}
      <div className="p-3 bg-yellow-50 rounded border border-yellow-100">
        <p className="text-xs font-medium text-yellow-700 mb-1.5">
          ⚠️ AI Coding 必须加上的额外约束
        </p>
        <ol className="text-xs text-yellow-600 space-y-0.5 list-decimal list-inside">
          {AI_CODING_CONVENTIONS.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-gray-400 mt-3 border-t pt-2">
        💡 约定文件的价值不在文件本身，而在于<strong>让 AI 在每次生成前读到它们</strong>。
        把 .ruff.toml + .mypy.ini + 约定清单 塞进 system prompt 或项目上下文——
        AI 生成的代码质量会有质的提升。
      </p>
    </div>
  )
}
