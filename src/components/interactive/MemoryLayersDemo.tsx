import { useState } from 'react'

/**
 * 记忆分层路由演示。
 *
 * 教学目标：把"Agent 记忆"这个笼统的词拆成四层，并让人看到同一句话
 * 会被路由到不同层、在不同时机被召回。
 */

type LayerKey = 'working' | 'episodic' | 'semantic' | 'procedural'

interface Layer {
  key: LayerKey
  name: string
  en: string
  desc: string
  ttl: string
  store: string
  color: string
}

const LAYERS: Layer[] = [
  {
    key: 'working',
    name: '工作记忆',
    en: 'Working',
    desc: '当前这一轮推理用得上的东西：最近几条消息、刚拿到的工具结果',
    ttl: '本次会话，随窗口滚动淘汰',
    store: '直接放在 context 里',
    color: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  {
    key: 'episodic',
    name: '情景记忆',
    en: 'Episodic',
    desc: '"什么时候发生了什么"：具体交互事件，带时间戳',
    ttl: '数周到数月，可衰减',
    store: '向量库 + 时间过滤',
    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  {
    key: 'semantic',
    name: '语义记忆',
    en: 'Semantic',
    desc: '从多次事件中抽出的稳定事实与偏好',
    ttl: '长期，直到被新事实推翻',
    store: '结构化 KV + 向量库',
    color: 'border-brand-500/30 bg-brand-500/10 text-ink-100',
  },
  {
    key: 'procedural',
    name: '程序记忆',
    en: 'Procedural',
    desc: '"怎么做"：成功过的操作序列、可复用技能',
    ttl: '长期，按成功率加权',
    store: '技能库 / 代码片段',
    color: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
]

interface Event {
  text: string
  layer: LayerKey
  stored: string
  note: string
}

const EVENTS: Event[] = [
  {
    text: '「帮我查一下昨天那个订单」',
    layer: 'working',
    stored: '当前轮 user message',
    note: '"昨天那个"是指代，必须靠工作记忆里的上文消解，否则检索会直接跑偏。',
  },
  {
    text: '「我上周三退了 CUS-10293 的货」',
    layer: 'episodic',
    stored: '{ ts: 2026-07-22, event: "退货", order: "CUS-10293" }',
    note: '带时间的具体事件。注意存的是结构化事实，不是原句 —— 原句召回时噪声太大。',
  },
  {
    text: '「我一直用 pnpm，别再给我 npm 命令了」',
    layer: 'semantic',
    stored: '{ key: "package_manager", value: "pnpm", confidence: 0.95 }',
    note: '这是偏好而非事件。存成 KV 才能在每次组装 context 时无条件注入。',
  },
  {
    text: '「上次那个部署脚本很好用，以后都这么干」',
    layer: 'procedural',
    stored: 'skill: deploy_via_actions(steps=[...], success_rate=1.0)',
    note: '把成功的动作序列固化成技能，下次同类任务直接复用，省掉重新试错的轮次。',
  },
]

export function MemoryLayersDemo() {
  const [i, setI] = useState(0)
  const ev = EVENTS[i]

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">记忆分层路由</h4>
      <p className="mb-4 text-xs text-ink-500">
        点一条用户输入，看它应该落到哪一层、以什么形态存下来。写入形态比写入本身更关键。
      </p>

      <div className="mb-4 space-y-1.5">
        {EVENTS.map((e, idx) => (
          <button
            key={e.text}
            onClick={() => setI(idx)}
            className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${
              idx === i
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {e.text}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {LAYERS.map((l) => {
          const hit = l.key === ev.layer
          return (
            <div
              key={l.key}
              className={`rounded-lg border p-3 transition-all ${
                hit ? l.color : 'border-ink-700 bg-ink-900/40 text-ink-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {l.name} <span className="opacity-60">{l.en}</span>
                </span>
                {hit && <span className="text-[10px]">← 命中</span>}
              </div>
              <p className="mt-1 text-[11px] opacity-80">{l.desc}</p>
              <p className="mt-1 text-[10px] opacity-60">
                存储：{l.store} · 生命周期：{l.ttl}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg bg-ink-950/60 p-3">
        <p className="mb-1 text-[11px] text-ink-500">写入形态</p>
        <pre className="mb-2 whitespace-pre-wrap font-mono text-xs text-ink-200">{ev.stored}</pre>
        <p className="text-[11px] text-ink-400">{ev.note}</p>
      </div>
    </div>
  )
}
