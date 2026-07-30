import { useState, useEffect, useCallback } from 'react'

interface Step {
  id: number
  phase: 'thought' | 'action' | 'observation'
  content: string
}

const SCENARIO: Step[] = [
  { id: 1, phase: 'thought', content: '用户想了解今天的天气，我需要调用天气查询工具。' },
  { id: 2, phase: 'action', content: '调用 get_weather(city="北京")' },
  { id: 3, phase: 'observation', content: '北京今天晴，气温 22-30°C，空气质量良。' },
  { id: 4, phase: 'thought', content: '已获取天气信息，现在可以回答用户了。同时注意到今天是周五，可以顺便提醒用户周末天气。' },
  { id: 5, phase: 'action', content: '调用 get_weather(city="北京", days=3)' },
  { id: 6, phase: 'observation', content: '周五晴 22-30°C，周六多云 20-28°C，周日小雨 18-25°C。' },
  { id: 7, phase: 'thought', content: '信息完整，可以给出最终回答了。' },
  { id: 8, phase: 'action', content: 'FINAL_ANSWER: 北京今天晴 22-30°C；周末周六多云、周日有小雨，记得带伞。' },
  { id: 9, phase: 'observation', content: '已向用户输出最终回答，循环结束。' },
]

const phaseConfig = {
  thought: {
    label: '思考',
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/30',
    text: 'text-ink-100',
    icon: '💭',
  },
  action: {
    label: '行动',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon: '🔧',
  },
  observation: {
    label: '观察',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    icon: '👁️',
  },
}

export function AgentLoopVisualizer() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const step = SCENARIO[currentStep]
  const config = step ? phaseConfig[step.phase] : null

  const next = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= SCENARIO.length - 1) {
        setIsRunning(false)
        return s
      }
      return s + 1
    })
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const timer = setTimeout(next, 1500)
    return () => clearTimeout(timer)
  }, [isRunning, currentStep, next])

  const reset = () => {
    setIsRunning(false)
    setCurrentStep(0)
  }

  return (
    <div className="card p-5">
      <h4 className="mb-3 text-sm font-semibold text-ink-100">
        ReAct Agent 循环可视化
      </h4>
      <p className="mb-4 text-xs text-ink-500">
        观察 Agent 如何在 Thought → Action → Observation 循环中自主完成任务。
      </p>

      {/* Progress bar */}
      <div className="mb-4 flex gap-1">
        {SCENARIO.map((s, i) => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < currentStep
                ? 'bg-brand-500'
                : i === currentStep
                  ? 'bg-brand-400 animate-pulse'
                  : 'bg-ink-700'
            }`}
          />
        ))}
      </div>

      {/* Current step */}
      {config && step && (
        <div className={`rounded-lg border ${config.border} ${config.bg} p-4`}>
          <div className="mb-2 flex items-center gap-2">
            <span>{config.icon}</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
              {config.label}
            </span>
            <span className="text-xs text-ink-500">
              Step {step.id}/{SCENARIO.length}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ink-200">{step.content}</p>
        </div>
      )}

      {/* Loop diagram */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs">
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-ink-100">
          💭 思考
        </div>
        <span className="text-ink-600">→</span>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-300">
          🔧 行动
        </div>
        <span className="text-ink-600">→</span>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
          👁️ 观察
        </div>
        <span className="text-ink-600">→</span>
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-ink-100">
          💭 ...
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => setIsRunning(true)}
          disabled={isRunning || currentStep >= SCENARIO.length - 1}
          className="interactive-selected interactive-focus rounded-lg px-4 py-2 text-xs disabled:opacity-40"
        >
          ▶ 自动播放
        </button>
        <button
          onClick={next}
          disabled={currentStep >= SCENARIO.length - 1}
          className="interactive-chip interactive-focus rounded-lg px-4 py-2 text-xs disabled:opacity-40"
        >
          ⏭ 下一步
        </button>
        <button
          onClick={reset}
          className="interactive-chip interactive-focus rounded-lg px-4 py-2 text-xs"
        >
          🔄 重置
        </button>
      </div>
    </div>
  )
}