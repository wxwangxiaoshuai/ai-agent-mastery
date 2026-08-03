/**
 * LLM-as-Judge 偏倚对照器 —— M13
 * 学员切换不同的裁判 prompt 风格 → 看同一个回答在不同裁判下的评分差异，直观理解偏倚
 */
import { useState } from 'react'

interface JudgeStyle {
  id: string
  name: string
  prompt: string
  bias: string
}

const JUDGES: JudgeStyle[] = [
  {
    id: 'neutral',
    name: '中性裁判',
    prompt: '请客观评价以下回答的质量，给出 1-5 分并说明理由。',
    bias: '最接近真实质量的参照',
  },
  {
    id: 'lenient',
    name: '宽松裁判',
    prompt: '你是一个鼓励型的裁判。尽量发现回答中的优点，对小的不准确宽容，在 1-5 分内给出评分。',
    bias: '系统性高估 0.5-1 分。说"Yes"的倾向，对幻觉不敏感。',
  },
  {
    id: 'strict',
    name: '严苛裁判',
    prompt: '你是严格的评分者。任何不精确、模糊、或缺少引用的陈述都应扣分。满分 5 分极为罕见。',
    bias: '系统性低估 0.5-1 分。一份好的回答可能只得 3 分，造成"质量未达上线标准"的假象。',
  },
  {
    id: 'position',
    name: '位置偏倚',
    prompt: '请比较回答A和回答B的质量，给出优劣判断。',
    bias: '倾向于更靠前的答案。交换 A/B 顺序可能得到相反的结论。这是 LLM 已知的系统性偏倚。',
  },
  {
    id: 'length',
    name: '长度偏倚',
    prompt: '请评价以下回答的质量，给出 1-5 分。',
    bias: '越长的回答分越高。AI 把"详细"等同于"好"，即使多出来的内容是空话或重复。',
  },
]

const SAMPLE_ANSWERS = [
  { label: '简短但正确', text: '温度参数控制输出的随机性。temperature=0 时模型选择概率最高的 token，输出确定。' },
  { label: '详细但有误', text: '温度参数是控制模型输出创造性的关键。当 temperature 为 0 时，模型总是选择概率最高的 token，输出变得确定。当 temperature 升高到 1.0 时，模型的输出更加随机。通常建议把 temperature 设置在 0.3 到 0.7 之间。此外还有一个叫 top_p 的参数可以替代 temperature 使用，它也是控制输出随机性的。' },
]

export function LLMJudgeBias() {
  const [judge, setJudge] = useState(JUDGES[0])
  const [answer, setAnswer] = useState(SAMPLE_ANSWERS[0])

  const score = judge.id === 'strict' ? 3 : judge.id === 'lenient' ? 5 : 4

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-1">⚖️ LLM-as-Judge 偏倚实验</h3>
      <p className="text-xs text-gray-400 mb-3">
        同一份回答，不同的裁判 prompt → 可能差 2 分。这不是质量波动，是系统性偏倚。
      </p>

      {/* 回答选择 */}
      <div className="flex gap-2 mb-3">
        {SAMPLE_ANSWERS.map((a) => (
          <button
            key={a.label}
            onClick={() => setAnswer(a)}
            className={`px-2 py-1 text-xs rounded ${
              answer.label === a.label ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="p-2 bg-white rounded border text-xs text-gray-600 mb-4">
        {answer.text}
      </div>

      {/* 裁判选择 */}
      <p className="text-xs text-gray-500 mb-2">选择裁判风格：</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {JUDGES.map((j) => (
          <button
            key={j.id}
            onClick={() => setJudge(j)}
            className={`px-2.5 py-1 text-xs rounded ${
              judge.id === j.id
                ? 'bg-purple-100 border border-purple-300 text-purple-700'
                : 'bg-white border text-gray-500 hover:bg-gray-50'
            }`}
          >
            {j.name}
          </button>
        ))}
      </div>

      {/* 评分结果 */}
      <div className="p-3 bg-white rounded border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">{judge.name}</span>
          <span className="text-lg font-bold text-purple-600">{score}/5</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{judge.prompt}</p>
        <div className="p-2 bg-red-50 rounded text-xs text-red-600">
          ⚠️ 偏倚警示：{judge.bias}
        </div>
      </div>

      {/* 跨裁判对比 */}
      <div className="mt-3 grid grid-cols-5 gap-1">
        {JUDGES.map((j) => {
          const s = j.id === 'strict' ? 3 : j.id === 'lenient' ? 5 : j.id === 'position' ? (answer.label === '简短但正确' ? 5 : 3) : 4
          return (
            <div key={j.id} className={`text-center p-1.5 rounded text-xs ${
              judge.id === j.id ? 'bg-purple-100 ring-1 ring-purple-300' : 'bg-gray-50'
            }`}>
              <div className="text-gray-400 truncate">{j.name}</div>
              <div className={`font-bold ${
                s >= 4 ? 'text-green-600' : 'text-yellow-600'
              }`}>{s}</div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 border-t pt-2">
        💡 消除偏倚的三种手段：(1) 同时用多个裁判 prompt 打分取平均；
        (2) 交换答案顺序做第二轮对比；(3) 严格要求引用原文证据而非单纯打分。
      </p>
    </div>
  )
}
