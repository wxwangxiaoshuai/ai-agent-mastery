import { useMemo, useState } from 'react'

/**
 * 分块策略可视化对比。
 *
 * 教学目标：让"固定分块会把句子劈开"这件事从抽象论断变成看得见的红色标记。
 */

const SAMPLE = `RAG 的第一步是把长文档切成块。分块看似是工程细节，实则决定了检索质量的上限。
固定长度分块实现最简单：按字符数硬切，配一个重叠窗口。它的问题在于不认识语义边界，
经常把一个完整的句子甚至一个术语劈成两半。语义分块则先按句子或段落切分，再按相邻块的
向量相似度决定是否合并，代价是需要额外的一次 embedding 计算。层级分块会同时保留粗粒度
和细粒度两份索引：检索时先用小块精确命中，再用它所属的大块补全上下文。这三种策略没有
绝对优劣，取舍点在于文档结构化程度、检索精度要求和你能接受的预处理成本。`

type Strategy = 'fixed' | 'semantic' | 'hierarchical'

interface Chunk {
  text: string
  /** 该块是否从句子中间被切断 */
  broken: boolean
  level?: '父块' | '子块'
}

const STRATEGIES: { id: Strategy; name: string; desc: string }[] = [
  { id: 'fixed', name: '固定长度', desc: '按字符数硬切 + 重叠窗口，最快但不认边界' },
  { id: 'semantic', name: '语义分块', desc: '先按句号切分，再合并到接近目标长度' },
  { id: 'hierarchical', name: '层级分块', desc: '父块保上下文，子块保精度，两份索引' },
]

/** 中文句子终止符 */
const SENT_END = /[。！？；\n]/

function splitSentences(text: string): string[] {
  const out: string[] = []
  let buf = ''
  for (const ch of text) {
    buf += ch
    if (SENT_END.test(ch)) {
      const t = buf.trim()
      if (t) out.push(t)
      buf = ''
    }
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}

function chunkFixed(text: string, size: number, overlap: number): Chunk[] {
  const flat = text.replace(/\n/g, '')
  const step = Math.max(1, size - overlap)
  const out: Chunk[] = []
  for (let i = 0; i < flat.length; i += step) {
    const piece = flat.slice(i, i + size)
    if (!piece) break
    // 块尾不是句子终止符，且后面还有内容 —— 说明句子被切断了
    const isLast = i + size >= flat.length
    const broken = !isLast && !SENT_END.test(piece[piece.length - 1] ?? '')
    out.push({ text: piece, broken })
    if (isLast) break
  }
  return out
}

function chunkSemantic(text: string, size: number): Chunk[] {
  const sents = splitSentences(text)
  const out: Chunk[] = []
  let buf = ''
  for (const s of sents) {
    if (buf && buf.length + s.length > size) {
      out.push({ text: buf, broken: false })
      buf = s
    } else {
      buf += s
    }
  }
  if (buf) out.push({ text: buf, broken: false })
  return out
}

function chunkHierarchical(text: string, size: number): Chunk[] {
  const parents = chunkSemantic(text, size * 2)
  const out: Chunk[] = []
  for (const p of parents) {
    out.push({ text: p.text, broken: false, level: '父块' })
    for (const c of chunkSemantic(p.text, Math.max(40, Math.floor(size / 2)))) {
      out.push({ text: c.text, broken: false, level: '子块' })
    }
  }
  return out
}

export function ChunkingVisualizer() {
  const [strategy, setStrategy] = useState<Strategy>('fixed')
  const [size, setSize] = useState(80)
  const [overlap, setOverlap] = useState(16)

  const chunks = useMemo(() => {
    if (strategy === 'fixed') return chunkFixed(SAMPLE, size, overlap)
    if (strategy === 'semantic') return chunkSemantic(SAMPLE, size)
    return chunkHierarchical(SAMPLE, size)
  }, [strategy, size, overlap])

  const brokenCount = chunks.filter((c) => c.broken).length
  const avgLen = chunks.length
    ? Math.round(chunks.reduce((s, c) => s + c.text.length, 0) / chunks.length)
    : 0
  const totalChars = chunks.reduce((s, c) => s + c.text.length, 0)
  const inflation = Math.round((totalChars / SAMPLE.replace(/\n/g, '').length) * 100)

  return (
    <div className="card my-8 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStrategy(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              strategy === s.id
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                : 'border-ink-700 text-ink-400 hover:text-ink-100'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-ink-500">
        {STRATEGIES.find((s) => s.id === strategy)?.desc}
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-400">
            目标块长度：<span className="font-mono text-ink-200">{size}</span> 字
          </span>
          <input
            type="range"
            min={40}
            max={200}
            step={10}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="mt-1 w-full accent-brand-500"
          />
        </label>
        <label className={`block ${strategy === 'fixed' ? '' : 'opacity-40'}`}>
          <span className="text-xs text-ink-400">
            重叠窗口：<span className="font-mono text-ink-200">{overlap}</span> 字
          </span>
          <input
            type="range"
            min={0}
            max={60}
            step={4}
            value={overlap}
            disabled={strategy !== 'fixed'}
            onChange={(e) => setOverlap(Number(e.target.value))}
            className="mt-1 w-full accent-brand-500"
          />
        </label>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="块数" value={String(chunks.length)} />
        <Stat label="平均长度" value={`${avgLen} 字`} />
        <Stat
          label="被切断的句子"
          value={String(brokenCount)}
          tone={brokenCount > 0 ? 'bad' : 'good'}
        />
        <Stat
          label="存储膨胀"
          value={`${inflation}%`}
          tone={inflation > 130 ? 'bad' : 'good'}
        />
      </div>

      <div className="space-y-2">
        {chunks.map((c, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 text-sm leading-relaxed ${
              c.broken
                ? 'border-rose-500/40 bg-rose-500/10 text-ink-200'
                : c.level === '父块'
                  ? 'border-amber-500/30 bg-amber-500/10 text-ink-200'
                  : 'border-ink-700 bg-ink-800/40 text-ink-300'
            }`}
          >
            <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-ink-500">
              <span>#{i + 1}</span>
              <span>·</span>
              <span>{c.text.length} 字</span>
              {c.level && (
                <>
                  <span>·</span>
                  <span>{c.level}</span>
                </>
              )}
              {c.broken && <span className="text-rose-400">· 句子被切断</span>}
            </div>
            {c.text}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-500">
        把固定分块的块长度调到 40 字，看红色标记怎么涨；再切到语义分块，红色会归零 ——
        代价是块长度不再均匀，且多了一次分句开销。层级分块的总字数会翻倍，
        这就是"父块 + 子块"两份索引的真实存储成本。
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  const color =
    tone === 'bad' ? 'text-rose-300' : tone === 'good' ? 'text-emerald-300' : 'text-ink-100'
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-800/40 p-2.5">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${color}`}>{value}</div>
    </div>
  )
}
