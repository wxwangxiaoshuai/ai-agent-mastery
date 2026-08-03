/**
 * 规格六段式模板器 —— M17 L17-03
 * 学员输入产品名 → 自动生成规格文档的六段骨架：问题/用户/方案/约束/验收/未知项
 */
import { useState } from 'react'

const SECTIONS = [
  { id: 'problem', label: '一、要解决的问题', hint: '用一句话说清它解决什么。不要描述功能，描述困扰。好例子："独立开发者不知道自己的产品是否合规"。坏例子："一个合规检查工具"。', placeholder: '我不确定自己开发的产品在隐私和支付方面是否合规...' },
  { id: 'users', label: '二、目标用户', hint: '谁会为这个问题付费？分成核心用户（没有它不行）和次要用户（有了更好）。', placeholder: '核心：独立开发者/小团队创始人。次要：自由职业者、数字游民。' },
  { id: 'solution', label: '三、方案概述', hint: '核心机制是什么？不是所有功能都列出来，就一个最关键的动作。', placeholder: '用户上传产品描述 → AI 生成合规检查清单 → 用户逐项确认 → 导出 PDF 报告' },
  { id: 'constraints', label: '四、约束与限制', hint: '时间、预算、技术水平、平台、第三方依赖。', placeholder: '· 2 周内出 MVP\n· 只能用 Python + React\n· 不使用需要审核的第三方 API\n· Web 端优先，暂不做移动端' },
  { id: 'acceptance', label: '五、验收标准', hint: '怎样算做完了？要可测试、可判断。避免"好用"这种模糊词。', placeholder: '· 能上传至少 1000 字的描述\n· 生成的清单 ≥ 10 项\n· 每项有法律依据来源链接\n· 用户可勾选并导出 PDF' },
  { id: 'unknowns', label: '六、未知项', hint: '你还不确定的事。诚实写出来比假装知道强——这些就是你要验证的风险。', placeholder: '· PDF 导出的法律效力\n· 不同国家的法规差异如何处理\n· 用户愿意为此付多少钱' },
]

export function SpecTemplateBuilder() {
  const [activeSection, setActiveSection] = useState(0)
  const [fills, setFills] = useState<Record<string, string>>({})

  const update = (text: string) => {
    setFills((prev) => ({ ...prev, [SECTIONS[activeSection].id]: text }))
  }

  const filled = Object.keys(fills).length
  const section = SECTIONS[activeSection]

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">📋 规格六段式模板</h3>
        <span className="text-xs text-gray-400">{filled}/{SECTIONS.length} 段已填</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        按照提示填写每个字段。写完后，把这份六段式规格发给 AI，它生成的代码会更贴合你的真实需求。
      </p>

      {/* 进度条 */}
      <div className="flex gap-1 mb-4">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(i)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i === activeSection
                ? 'bg-blue-500'
                : fills[s.id]
                  ? 'bg-green-400'
                  : 'bg-gray-200'
            }`}
            title={s.label}
          />
        ))}
      </div>

      <div className="bg-white rounded border p-3">
        <h4 className="text-sm font-semibold text-gray-700 mb-1">{section.label}</h4>
        <p className="text-xs text-gray-400 mb-2">{section.hint}</p>
        <textarea
          value={fills[section.id] || ''}
          onChange={(e) => update(e.target.value)}
          placeholder={section.placeholder}
          rows={3}
          className="w-full p-2 text-xs border rounded resize-none focus:outline-none focus:border-blue-300"
        />

        <div className="flex justify-between mt-2">
          <button
            onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
            disabled={activeSection === 0}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:text-gray-300"
          >
            ← 上一段
          </button>
          {activeSection < SECTIONS.length - 1 ? (
            <button
              onClick={() => setActiveSection(Math.min(SECTIONS.length - 1, activeSection + 1))}
              className="px-2 py-1 text-xs text-blue-500 hover:text-blue-700"
            >
              下一段 →
            </button>
          ) : (
            <button
              onClick={() => { setActiveSection(0); setFills({}) }}
              className="px-2 py-1 text-xs text-green-500 hover:text-green-700"
            >
              ✓ 完成，清空重来
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        💡 这个六段式的价值不是"写完交给 AI"——是强迫你在写第一行代码之前
        <strong>把模糊的想法变成可验证的规格</strong>。
      </p>
    </div>
  )
}
