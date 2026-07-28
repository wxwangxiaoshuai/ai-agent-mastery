import { useState } from 'react'

/**
 * RAG 流水线单步执行演示。
 *
 * 教学目标：RAG 不是"塞进向量库然后搜"，而是一条有 6~7 道工序的流水线，
 * 每一道都会累加延迟和成本，也每一道都可能是召回率的瓶颈。
 */

interface Stage {
  key: string
  name: string
  role: string
  /** 该阶段的输出示意 */
  output: string
  latencyMs: number
  costUsd: number
  /** 跳过这一步会发生什么 */
  ifSkipped: string
}

const STAGES: Stage[] = [
  {
    key: 'rewrite',
    name: '① 查询改写',
    role: '把口语化、指代不清的问题改写成检索友好的表达',
    output: '原问题：「它跟上一个比怎么样」\n改写后：「LangGraph 与 CrewAI 在编排可控性上的差异」',
    latencyMs: 420,
    costUsd: 0.0002,
    ifSkipped: '多轮对话中的指代（"它""上面那个"）会直接把检索打偏，这是 RAG 最常见的隐性失败。',
  },
  {
    key: 'embed',
    name: '② 查询向量化',
    role: '用与建库时相同的模型把查询映射到同一向量空间',
    output: 'vector[1536] = [0.0231, -0.0117, 0.0442, ...]',
    latencyMs: 90,
    costUsd: 0.00001,
    ifSkipped: '建库和查询用了不同 embedding 模型是新手最致命的错误，相似度会完全失去意义。',
  },
  {
    key: 'retrieve',
    name: '③ 向量召回 top-k',
    role: '在向量库里取回 k 个候选块，k 通常远大于最终要用的数量',
    output: '召回 20 块，相似度 0.83 ~ 0.61\n其中 3 块明显跑题（相似度虚高的"语义近邻陷阱"）',
    latencyMs: 35,
    costUsd: 0,
    ifSkipped: '不召回就没有 RAG。但 k 取太小（比如 3）会让后面的 rerank 无米下锅。',
  },
  {
    key: 'hybrid',
    name: '④ 关键词混合检索',
    role: 'BM25 补足向量检索对专有名词、型号、错误码的弱项',
    output: 'BM25 命中 8 块，与向量结果用 RRF 融合 → 24 个去重候选',
    latencyMs: 25,
    costUsd: 0,
    ifSkipped: '纯向量检索找不准 "ERR_2043" 这类精确 token，产品文档场景尤其明显。',
  },
  {
    key: 'rerank',
    name: '⑤ 重排序',
    role: '用交叉编码器逐对精算相关性，把 24 块压到最相关的 5 块',
    output: 'top-5 相关性：0.94 / 0.91 / 0.77 / 0.52 / 0.48\n后两块低于阈值 0.6，丢弃',
    latencyMs: 260,
    costUsd: 0.0004,
    ifSkipped: '不重排就等于把噪声一起塞进上下文，模型会被跑题片段带偏，且白烧 token。',
  },
  {
    key: 'assemble',
    name: '⑥ 上下文组装',
    role: '拼接片段、附上来源标记、裁剪到预算内',
    output: '3 块 · 约 1,850 tokens\n每块前面加 [来源: 文档名#章节] 便于模型引用',
    latencyMs: 5,
    costUsd: 0,
    ifSkipped: '不带来源标记，就无法要求模型给出可核查的引用，幻觉将无从追溯。',
  },
  {
    key: 'generate',
    name: '⑦ 生成与引用',
    role: '让模型基于片段回答，并强制标注引用来源',
    output: '「LangGraph 用显式图状态机换取可控性[来源1]，CrewAI 用角色抽象换取上手速度[来源2]。」',
    latencyMs: 1800,
    costUsd: 0.0031,
    ifSkipped: '—',
  },
]

export function RAGPipelineDemo() {
  const [step, setStep] = useState(0)
  const done = STAGES.slice(0, step + 1)
  const totalMs = done.reduce((s, x) => s + x.latencyMs, 0)
  const totalCost = done.reduce((s, x) => s + x.costUsd, 0)
  const cur = STAGES[step]

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">RAG 流水线单步执行</h4>
      <p className="mb-4 text-xs text-ink-500">
        点击任一工序查看它的产出，以及"跳过它会怎样"。注意右上角累计的延迟与成本。
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              i === step
                ? 'border-brand-500/40 bg-brand-500/20 text-brand-300'
                : i < step
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300/80'
                  : 'border-ink-700 bg-ink-800/50 text-ink-500 hover:text-ink-300'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-3 text-xs">
        <span className="rounded-lg bg-ink-950/60 px-3 py-1.5 text-ink-400">
          累计延迟 <span className="font-mono text-ink-100">{totalMs} ms</span>
        </span>
        <span className="rounded-lg bg-ink-950/60 px-3 py-1.5 text-ink-400">
          累计成本 <span className="font-mono text-ink-100">${totalCost.toFixed(4)}</span>
        </span>
        <span className="rounded-lg bg-ink-950/60 px-3 py-1.5 text-ink-400">
          其中生成占 <span className="font-mono text-ink-100">
            {totalMs > 0 ? Math.round(((done.find((d) => d.key === 'generate')?.latencyMs ?? 0) / totalMs) * 100) : 0}%
          </span>
        </span>
      </div>

      <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-4">
        <p className="mb-2 text-xs text-ink-400">{cur.role}</p>
        <pre className="mb-3 whitespace-pre-wrap break-words font-mono text-xs text-ink-200">{cur.output}</pre>
        {cur.ifSkipped !== '—' && (
          <p className="rounded border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] text-amber-300">
            跳过它：{cur.ifSkipped}
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 disabled:opacity-40"
        >
          上一步
        </button>
        <button
          onClick={() => setStep((s) => Math.min(STAGES.length - 1, s + 1))}
          disabled={step === STAGES.length - 1}
          className="rounded-lg border border-brand-500/30 bg-brand-500/20 px-3 py-1.5 text-xs text-brand-300 disabled:opacity-40"
        >
          下一步
        </button>
      </div>
    </div>
  )
}
