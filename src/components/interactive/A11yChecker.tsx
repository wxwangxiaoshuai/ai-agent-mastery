/**
 * 无障碍自检器 —— M17 L17-15
 * 列出 10 项前端无障碍检查，学员逐项自检并记录结果
 */
import { useState } from 'react'

interface A11yItem {
  id: string
  category: string
  check: string
  detail: string
  wcag: string
}

const ITEMS: A11yItem[] = [
  { id: 'semantic', category: '语义化', check: '页面使用语义化 HTML 标签', detail: '用 <main>/<nav>/<article>/<section> 替代全 <div>。语义标签自带 ARIA role。', wcag: '1.3.1 (A)' },
  { id: 'heading', category: '语义化', check: '标题层级连续（h1→h2→h3 不跳级）', detail: '每个页面一个 h1。标题不用于样式，用 CSS 控制字号。', wcag: '1.3.1 (A)' },
  { id: 'alt', category: '图片', check: '所有 <img> 有 alt 属性', detail: '信息型图片写描述，装饰型图片用 alt=""。SVG 用 <title>。', wcag: '1.1.1 (A)' },
  { id: 'contrast', category: '视觉', check: '文字与背景对比度 ≥ 4.5:1', detail: '浅色主题的灰色文字是重灾区。用 Chrome DevTools 的 Contrast Ratio 检查器。', wcag: '1.4.3 (AA)' },
  { id: 'keyboard', category: '交互', check: '所有交互可用键盘完成', detail: 'Tab 键可遍历所有可交互元素，Enter/Space 可激活。自定义组件需实现 onKeyDown。', wcag: '2.1.1 (A)' },
  { id: 'focus', category: '交互', check: '焦点状态清晰可见', detail: '不要 outline: none。用 :focus-visible 替代 :focus，鼠标点时不显示焦点环。', wcag: '2.4.7 (AA)' },
  { id: 'label', category: '表单', check: '所有输入框有 <label> 关联', detail: '用 <label for=> 或包裹 <input>。placeholder 不是 label 替代品。', wcag: '1.3.1 (A)' },
  { id: 'error', category: '表单', check: '表单错误有文字提示且关联输入框', detail: '错误信息用 aria-describedby 关联，不仅依赖颜色（红框）标示错误。', wcag: '3.3.1 (A)' },
  { id: 'lang', category: '基础', check: '<html> 标签有 lang 属性', detail: '<html lang="zh-CN">。屏幕阅读器据此选择正确的语音引擎。', wcag: '3.1.1 (A)' },
  { id: 'resize', category: '适应', check: '200% 缩放后内容不溢出', detail: '用 em/rem 而非 px，或用 clamp()/minmax()。避免固定宽度容器。', wcag: '1.4.4 (AA)' },
]

export function A11yChecker() {
  const [results, setResults] = useState<Record<string, 'pass' | 'fail' | null>>({})

  const setResult = (id: string, r: 'pass' | 'fail') => {
    setResults((prev) => ({ ...prev, [id]: prev[id] === r ? null : r }))
  }

  const passed = Object.values(results).filter((r) => r === 'pass').length
  const failed = Object.values(results).filter((r) => r === 'fail').length
  const total = ITEMS.length

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">♿ 无障碍自检清单</h3>
        <span className="text-xs text-gray-400">
          <span className="text-green-500">{passed} ✓</span> · <span className="text-red-400">{failed} ✗</span> · <span className="text-gray-300">{total - passed - failed}</span>
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        逐条检查你的产品。WCAG 2.1 AA 是多数国家法律要求的最低合规标准。
      </p>

      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {ITEMS.map((item) => (
          <div
            key={item.id}
            className={`p-2 rounded border text-xs transition-colors ${
              results[item.id] === 'pass'
                ? 'bg-green-50 border-green-200'
                : results[item.id] === 'fail'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[10px] w-16">{item.category}</span>
              <span className="text-gray-700 flex-1">{item.check}</span>
              <span className="text-gray-300 text-[10px] w-16 text-right">WCAG {item.wcag}</span>
              <button
                onClick={() => setResult(item.id, 'pass')}
                className={`px-1.5 py-0.5 text-[10px] rounded ${
                  results[item.id] === 'pass'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-green-100'
                }`}
              >
                ✓
              </button>
              <button
                onClick={() => setResult(item.id, 'fail')}
                className={`px-1.5 py-0.5 text-[10px] rounded ${
                  results[item.id] === 'fail'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-red-100'
                }`}
              >
                ✗
              </button>
            </div>
            {results[item.id] && (
              <p className="mt-1 text-gray-500 ml-18">{item.detail}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t text-xs text-gray-400">
        {passed + failed === total ? (
          passed === total
            ? '🎉 全部通过！你的产品在基础无障碍方面表现优秀。'
            : `⚠️ ${failed} 项未通过。优先修 WCAG A 级的问题——它们是法律要求的最低标准。`
        ) : (
          `还有 ${total - passed - failed} 项未检查。`
        )}
      </div>
    </div>
  )
}
