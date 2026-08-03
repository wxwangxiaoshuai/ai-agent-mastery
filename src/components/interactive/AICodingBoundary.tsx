/**
 * AI 编码边界决策树 —— M17 L17-01
 * 学员选择任务类型 → 判断该交给 AI 还是必须自己写
 */
import { useState } from 'react'

interface TaskScenario {
  id: string
  task: string
  judgment: 'ai' | 'self' | 'hybrid'
  reason: string
}

const SCENARIOS: TaskScenario[] = [
  {
    id: 'crud',
    task: '写一个标准的 CRUD 接口（增删改查）',
    judgment: 'ai',
    reason: '机械重复、模式固定。AI 可以一次生成完整的 router + model + validation，你只需检查边界条件。',
  },
  {
    id: 'test_existing',
    task: '给已有函数补充单元测试',
    judgment: 'ai',
    reason: 'AI 擅长列举分支和边界值。让它生成测试骨架，你确认覆盖是否完整。',
  },
  {
    id: 'rename',
    task: '全局重命名一个模块',
    judgment: 'ai',
    reason: '纯机械操作。IDE 就能做，但 AI 可以帮你同时更新 import 路径和文档。',
  },
  {
    id: 'api_design',
    task: '设计一个新模块的公开 API 签名',
    judgment: 'self',
    reason: 'API 设计是一锤子买卖——改接口的成本远高于改实现。必须自己思考调用场景和向后兼容。',
  },
  {
    id: 'permission',
    task: '修改权限校验逻辑',
    judgment: 'self',
    reason: '权限错了就是安全漏洞，而且 AI 看不到你的业务上下文。自己写，自己审查。',
  },
  {
    id: 'debug_race',
    task: '排查一个偶发的并发 bug',
    judgment: 'self',
    reason: 'AI 需要稳定复现才能帮忙。偶发的并发问题依赖你对系统的深层理解。',
  },
  {
    id: 'bug_report',
    task: '根据用户报错日志定位问题',
    judgment: 'hybrid',
    reason: '先用 AI 快速排查（贴日志、问可疑模块），定位后自己改关键代码并验证。',
  },
  {
    id: 'ui_layout',
    task: '实现一个标准页面布局（列表 + 详情 + 表单）',
    judgment: 'ai',
    reason: '布局实现是体力活。AI 生成后你调整间距和交互细节。',
  },
  {
    id: 'pricing_logic',
    task: '实现计费 / 扣款逻辑',
    judgment: 'self',
    reason: '钱相关的代码必须每条路径都跑过、每行注释都理解。错了就是真金白银。',
  },
  {
    id: 'doc',
    task: '给模块写使用文档',
    judgment: 'ai',
    reason: 'AI 擅长从代码生成文档。你只要补充动机和注意事项。',
  },
]

export function AICodingBoundary() {
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const reveal = (id: string) => {
    const next = new Set(revealed)
    next.add(id)
    setRevealed(next)
  }

  const aiCount = SCENARIOS.filter((s) => s.judgment === 'ai').length
  const selfCount = SCENARIOS.filter((s) => s.judgment === 'self').length
  const hybridCount = SCENARIOS.filter((s) => s.judgment === 'hybrid').length

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-1">🤖 该给 AI，还是自己写？</h3>
      <p className="text-xs text-gray-400 mb-4">
        点每个任务看判断。先别偷看——你心里先想一个答案，再看对不对。
      </p>

      {/* 统计条 */}
      <div className="flex gap-2 mb-4 text-xs">
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">AI 做 {aiCount}</span>
        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">自己写 {selfCount}</span>
        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">混合 {hybridCount}</span>
      </div>

      {/* 任务列表 */}
      <div className="space-y-1.5">
        {SCENARIOS.map((s) => (
          <div
            key={s.id}
            className="border border-gray-200 rounded overflow-hidden"
          >
            <button
              onClick={() => reveal(s.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-white transition-colors flex justify-between items-center"
            >
              <span className={revealed.has(s.id) ? 'text-gray-500' : 'text-gray-700'}>
                {s.task}
              </span>
              <span className="text-xs text-gray-300">{revealed.has(s.id) ? '▼' : '▶'}</span>
            </button>
            {revealed.has(s.id) && (
              <div className={`px-3 py-2 text-xs ${
                s.judgment === 'ai' ? 'bg-green-50 border-t border-green-100' :
                s.judgment === 'self' ? 'bg-red-50 border-t border-red-100' :
                'bg-yellow-50 border-t border-yellow-100'
              }`}>
                <span className={`font-semibold ${
                  s.judgment === 'ai' ? 'text-green-700' :
                  s.judgment === 'self' ? 'text-red-700' :
                  'text-yellow-700'
                }`}>
                  {s.judgment === 'ai' ? '✅ 交给 AI' : s.judgment === 'self' ? '⚠️ 必须自己写' : '🔄 混合模式'}
                </span>
                <p className="mt-1 text-gray-600">{s.reason}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        规则：机械重复 → AI。一锤子买卖 → 自己。钱/权限/安全 → 自己。不确定 → 混合。
      </p>
    </div>
  )
}
