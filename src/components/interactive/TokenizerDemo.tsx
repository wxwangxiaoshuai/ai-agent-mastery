import { useState } from 'react'

/**
 * 教学用分词模拟：对齐课程口径
 * - 中文：大致按字切（1 汉字 ≈ 1 token）
 * - 英文：按空白/标点切，长词再拆常见后缀子词
 * 不是真实 BPE，只为让差异可见。
 */
function tokenize(text: string): string[] {
  if (!text.trim()) return []
  const tokens: string[] = []
  // 中日韩字符、英数字词、标点、空白
  const regex =
    /[\u3400-\u9fff\uf900-\ufaff]|[A-Za-z0-9_]+|[^\sA-Za-z0-9_\u3400-\u9fff\uf900-\ufaff]+|\s+/g
  const parts = text.match(regex) ?? []

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      // 空白通常附着在前一个 token 上（英文 BPE 常见）
      if (tokens.length > 0) tokens[tokens.length - 1] += part
      continue
    }
    // 单个 CJK 字：直接成 token
    if (/^[\u3400-\u9fff\uf900-\ufaff]$/.test(part)) {
      tokens.push(part)
      continue
    }
    // 英文长词：演示子词切分
    if (/^[A-Za-z0-9_]+$/.test(part) && part.length > 6) {
      tokens.push(...splitIntoSubwords(part))
      continue
    }
    // 连续标点再拆开，便于观察「。」「!」各自占 token
    if (/^[^\sA-Za-z0-9_\u3400-\u9fff\uf900-\ufaff]+$/.test(part) && part.length > 1) {
      tokens.push(...[...part])
      continue
    }
    tokens.push(part)
  }
  return tokens
}

function splitIntoSubwords(word: string): string[] {
  const result: string[] = []
  const common = [
    'ing',
    'tion',
    'able',
    'ment',
    'ness',
    'ize',
    'er',
    'ed',
    'ly',
    'ous',
    'ive',
    'al',
    'ent',
  ]
  let remaining = word
  while (remaining.length > 0) {
    let found = false
    for (const suffix of common) {
      if (remaining.endsWith(suffix) && remaining.length > suffix.length + 2) {
        result.unshift('##' + suffix)
        remaining = remaining.slice(0, -suffix.length)
        found = true
        break
      }
    }
    if (!found) {
      result.unshift(remaining)
      break
    }
  }
  return result.length > 1 ? result : [word]
}

const SAMPLES = [
  '人工智能正在改变世界。',
  'The quick brown fox jumps over the lazy dog.',
  'Tokenization is the first step in LLM processing.',
  '大语言模型通过分词器将文本转换为数字ID。',
  'def hello_world():\n    print("Hello, Agent!")',
]

export function TokenizerDemo() {
  const [text, setText] = useState(SAMPLES[0])
  const tokens = tokenize(text)

  const colors = [
    'bg-brand-500/20 text-brand-300 border-brand-500/30',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'bg-danger-500/20 text-danger-300 border-danger-500/30',
  ]

  const cjkCount = [...text].filter((ch) =>
    /[\u3400-\u9fff\uf900-\ufaff]/.test(ch),
  ).length

  return (
    <div className="card p-5">
      <h4 className="mb-3 text-sm font-semibold text-ink-100">Token 分词演示</h4>
      <div className="mb-3 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => setText(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              text === s
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {s.length > 20 ? s.slice(0, 20) + '...' : s}
          </button>
        ))}
      </div>
      <div className="mb-3 rounded-lg bg-ink-950/60 p-3">
        <p className="whitespace-pre-wrap text-sm text-ink-200">{text}</p>
      </div>
      <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
        <span>
          共 {tokens.length} 个 token
          {cjkCount > 0 ? `（含 ${cjkCount} 个汉字）` : ''}
        </span>
        <span>字符数: {text.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((t, i) => (
          <span
            key={i}
            className={`rounded-md border px-2 py-1 font-mono text-xs ${
              colors[i % colors.length]
            }`}
            title={`Token #${i + 1}`}
          >
            {t === '\n' ? '↵' : t}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        每个色块代表一个 token（教学模拟，非真实 BPE）。中文按字切分，英文按子词切分——同一句中文往往比「看起来字数差不多」的英文更贵。
      </p>
    </div>
  )
}
