/**
 * 验收自检清单 —— 项目页交互组件
 * 学员逐条勾选验收标准，完成所有项后显示通过标志
 */
import { useState } from 'react'

interface ChecklistItem {
  id: string
  text: string
}

const CHECKLIST: ChecklistItem[] = [
  { id: 'run', text: '功能能正常运行（所有核心流程无报错）' },
  { id: 'env', text: '环境变量 / API Key 通过 .env 管理' },
  { id: 'error', text: '异常场景有处理（网络断开、API 限流、输入为空）' },
  { id: 'test', text: '至少有一个测试能验证核心逻辑' },
  { id: 'readme', text: 'README 写明了如何安装和运行' },
  { id: 'commit', text: '代码已提交到版本管理，commit message 说明了做了什么' },
]

export function AcceptanceChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [allDone, setAllDone] = useState(false)

  const toggle = (id: string) => {
    const next = new Set(checked)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setChecked(next)
    if (next.size === CHECKLIST.length) setAllDone(true)
  }

  const progress = checked.size / CHECKLIST.length * 100

  if (allDone) {
    return (
      <div className="my-6 p-5 border border-green-300 bg-green-50 rounded-lg text-center">
        <div className="text-2xl mb-2">✅</div>
        <h3 className="text-lg font-semibold text-green-800">验收通过</h3>
        <p className="text-sm text-green-600 mt-1">
          全部检查项已完成。提交代码、部署上线，进入下一阶段。
        </p>
        <button
          onClick={() => { setChecked(new Set()); setAllDone(false) }}
          className="mt-3 text-xs text-green-500 hover:text-green-700 underline"
        >
          重置清单
        </button>
      </div>
    )
  }

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">📋 验收自检清单</h3>
        <span className="text-xs text-gray-400">{checked.size}/{CHECKLIST.length}</span>
      </div>
      {/* 进度条 */}
      <div className="h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* 检查项 */}
      <div className="space-y-2">
        {CHECKLIST.map((item) => (
          <label
            key={item.id}
            className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
              checked.has(item.id)
                ? 'bg-green-50 line-through text-gray-400'
                : 'hover:bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={checked.has(item.id)}
              onChange={() => toggle(item.id)}
              className="mt-0.5 accent-green-600"
            />
            <span className="text-sm">{item.text}</span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        勾选即确认。诚实自检——这是你自己的项目，不是交差。
      </p>
    </div>
  )
}
