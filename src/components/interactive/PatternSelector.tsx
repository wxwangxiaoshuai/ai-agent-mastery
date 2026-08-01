/**
 * 设计模式选择决策树 —— M5 L05-07 Agent 设计模式全景
 * 学习者输入任务描述 → 自动推荐最适合的 Agent 设计模式
 */
import { useState } from 'react'

interface PatternInfo {
  name: string
  description: string
  when: string
  example: string
  module: string
}

const PATTERNS: Record<string, PatternInfo> = {
  chain: {
    name: 'Prompt Chaining',
    description: 'A 的输出 → B 的输入，按固定步骤串联多个 LLM 调用。',
    when: '任务可拆分为固定的、有先后依赖的子任务。',
    example: '写文档 → 翻译 → 格式化；数据清洗 → 分析 → 生成报告。',
    module: 'M2 Prompt 工程',
  },
  routing: {
    name: 'Routing',
    description: '分类意图 → 分发到专门的处理者，每个处理者处理一类输入。',
    when: '输入类型差异大，各自需要不同的处理方式。',
    example: '客服问题分类（退换货 / 技术咨询 / 投诉）→ 不同 handler。',
    module: 'M6 工具使用',
  },
  parallel: {
    name: 'Parallelization',
    description: '同时执行多个独立子任务 → 聚合结果。分 Sectioning（分块并行）和 Voting（多路投票）。',
    when: '子任务之间没有依赖，可以同时执行。',
    example: '同时搜索多个数据源 → 合并去重；多路审核 → 投票决策。',
    module: 'M6 并行工具调用 + M11 多 Agent',
  },
  orchestrator: {
    name: 'Orchestrator-Workers',
    description: '中央规划者动态拆任务 → 派发给多个 worker，worker 结果反馈给规划者。',
    when: '子任务无法预知，需要动态规划，且各子任务可能相互依赖。',
    example: '深度研究 Agent（规划 → 派搜索 → 派总结 → 派综合）。',
    module: 'M11 Supervisor / CrewAI',
  },
  evaluator: {
    name: 'Evaluator-Optimizer',
    description: '生成者产出 → 评估者打分 → 反馈 → 生成者改进 → 循环迭代。',
    when: '有明确的质量标准，且一次生成难以达到理想效果。',
    example: '代码生成 → review → 修改 → 再 review；文章草稿 → 打分 → 修订 → 再打分。',
    module: 'M5 Reflection + M13 评估',
  },
  single: {
    name: '单次 LLM 调用',
    description: '一次 Prompt → 一次回复，不引入多步工作流。',
    when: '任务简单、步骤不可拆、也没有客观质量门禁可迭代。',
    example: '问答、摘要、简单改写、一次性代码片段。',
    module: 'M1 · M2 基础对话',
  },
}

type DecisionNode = {
  question: string
  yes: string | DecisionNode
  no: string | DecisionNode
}

const DECISION_TREE: DecisionNode = {
  question: '任务步骤是否线性且固定？',
  yes: 'chain',
  no: {
    question: '输入类型差异大，需要不同处理方式？',
    yes: 'routing',
    no: {
      question: '子任务可以并行执行（无依赖）？',
      yes: 'parallel',
      no: {
        question: '子任务不可预知，需要动态规划？',
        yes: 'orchestrator',
        no: {
          question: '有明确的客观质量标准可以评估产出？',
          yes: 'evaluator',
          no: 'single',
        },
      },
    },
  },
}

export function PatternSelector() {
  const [currentNode, setCurrentNode] = useState<DecisionNode>(DECISION_TREE)
  const [path, setPath] = useState<string[]>([])
  const [result, setResult] = useState<PatternInfo | null>(null)

  function answer(yes: boolean) {
    const next = yes ? currentNode.yes : currentNode.no
    setPath((p) => [...p, `${currentNode.question} → ${yes ? '是' : '否'}`])

    if (typeof next === 'string') {
      setResult(PATTERNS[next])
      setCurrentNode(DECISION_TREE)
    } else {
      setCurrentNode(next)
    }
  }

  function reset() {
    setCurrentNode(DECISION_TREE)
    setPath([])
    setResult(null)
  }

  return (
    <div className="card p-5 not-prose">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">Agent 设计模式选择器</h4>
      <p className="mb-4 text-xs text-ink-500">
        按决策树逐步回答，找到最适合你任务的 Agent 设计模式。
      </p>

      {!result ? (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-4">
          <p className="mb-3 text-sm text-ink-100">{currentNode.question}</p>
          <div className="flex gap-3">
            <button
              onClick={() => answer(true)}
              className="interactive-selected interactive-focus rounded-control px-4 py-2 text-xs"
            >
              是
            </button>
            <button
              onClick={() => answer(false)}
              className="interactive-chip interactive-focus rounded-control px-4 py-2 text-xs"
            >
              否
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-sm font-semibold text-emerald-300">{result.name}</span>
          </div>
          <p className="mb-3 text-sm text-ink-100">{result.description}</p>
          <div className="mb-2 space-y-1">
            <p className="text-xs text-ink-400">
              <span className="font-medium text-ink-100">适用场景：</span>
              {result.when}
            </p>
            <p className="text-xs text-ink-400">
              <span className="font-medium text-ink-100">示例：</span>
              {result.example}
            </p>
            <p className="text-xs text-ink-400">
              <span className="font-medium text-ink-100">先修课程：</span>
              {result.module}
            </p>
          </div>
          <button
            onClick={reset}
            className="interactive-chip interactive-focus rounded-control px-3 py-1.5 text-xs"
          >
            重新选择
          </button>
        </div>
      )}

      {/* Decision path */}
      {path.length > 0 && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-800/40 p-3">
          <p className="mb-2 text-xs font-medium text-ink-400">决策路径</p>
          <ol className="space-y-0.5">
            {path.map((step, i) => (
              <li key={i} className="text-xs text-ink-500">
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}