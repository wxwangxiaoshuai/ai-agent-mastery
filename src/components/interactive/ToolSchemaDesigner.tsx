import { useMemo, useState } from 'react'

/**
 * 工具 Schema 设计对照器。
 *
 * 教学目标：工具调用失败往往不是模型笨，而是 schema 写得让人（模型）无从下手。
 * 这里把四个设计选择做成开关，实时生成 schema 并给出一个可解释的"可调用性"评分。
 */

interface Choice {
  key: 'granularity' | 'naming' | 'description' | 'errors'
  label: string
  good: string
  bad: string
  /** 选择 good 时加多少分 */
  weight: number
  why: string
}

const CHOICES: Choice[] = [
  {
    key: 'granularity',
    label: '粒度',
    good: '细粒度：一个工具做一件事',
    bad: '万能工具：一个 action 参数分发十种行为',
    weight: 30,
    why: '万能工具把"选哪个功能"的决策塞进一个自由文本参数，模型没有 schema 约束可依，错误率成倍上升。',
  },
  {
    key: 'naming',
    label: '命名',
    good: '动词 + 名词，语义自解释',
    bad: '缩写 / 内部黑话 / doIt2',
    weight: 20,
    why: '工具名是模型看到的第一行信息，也是它做路由决策的主要依据。名字含糊，描述再长也救不回来。',
  },
  {
    key: 'description',
    label: '描述',
    good: '写清用途、边界、何时不该用',
    bad: '一句话复述函数名',
    weight: 25,
    why: '「何时不该用」比「用途」更有价值——它是模型避免误调用的唯一线索。',
  },
  {
    key: 'errors',
    label: '错误信息',
    good: '可执行的错误：说明错在哪、该怎么改',
    bad: '布尔 false 或 500 Internal Error',
    weight: 25,
    why: 'Agent 唯一的纠错输入就是错误信息。不可执行的错误 = 模型只能原样重试，直到耗尽轮次。',
  },
]

function buildSchema(sel: Record<string, boolean>): string {
  const good = (k: string) => sel[k]
  const name = good('naming') ? 'search_customer_orders' : 'srchOrd2'
  const desc = good('description')
    ? '按客户 ID 查询历史订单。仅用于已知客户 ID 的场景；若只有姓名或邮箱，请先调用 find_customer 获取 ID。单次最多返回 50 条。'
    : '搜索订单'
  const params = good('granularity')
    ? `    "customer_id": { "type": "string", "description": "客户唯一 ID，形如 CUS-10293" },
    "limit": { "type": "integer", "description": "返回条数，1-50，默认 20", "default": 20 }`
    : `    "action": { "type": "string", "description": "要执行的操作" },
    "payload": { "type": "object", "description": "操作参数" }`
  const errNote = good('errors')
    ? `\n// 失败时返回：\n// { "error": "customer_not_found",\n//   "message": "CUS-999 不存在。可用 find_customer(email=...) 先查 ID。",\n//   "retryable": false }`
    : `\n// 失败时返回：\n// false`
  return `{
  "name": "${name}",
  "description": "${desc}",
  "parameters": {
    "type": "object",
    "properties": {
${params}
    },
    "required": ["${good('granularity') ? 'customer_id' : 'action'}"]
  }
}${errNote}`
}

export function ToolSchemaDesigner() {
  const [sel, setSel] = useState<Record<string, boolean>>({
    granularity: false,
    naming: false,
    description: false,
    errors: false,
  })

  const score = useMemo(
    () => CHOICES.reduce((s, c) => s + (sel[c.key] ? c.weight : 0), 0),
    [sel],
  )
  const schema = useMemo(() => buildSchema(sel), [sel])

  const tone =
    score >= 80 ? 'text-emerald-300' : score >= 50 ? 'text-amber-300' : 'text-rose-300'

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">工具 Schema 设计对照</h4>
      <p className="mb-4 text-xs text-ink-500">
        逐项切换设计选择，看 schema 怎么变。评分是教学用的启发式，不是真实基准。
      </p>

      <div className="mb-4 space-y-2">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            onClick={() => setSel((p) => ({ ...p, [c.key]: !p[c.key] }))}
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              sel[c.key]
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-rose-500/25 bg-rose-500/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-200">{c.label}</span>
              <span className={`text-[11px] ${sel[c.key] ? 'text-emerald-300' : 'text-rose-300'}`}>
                {sel[c.key] ? `+${c.weight}` : '+0'}
              </span>
            </div>
            <p className={`mt-1 text-xs ${sel[c.key] ? 'text-emerald-300' : 'text-rose-300'}`}>
              {sel[c.key] ? c.good : c.bad}
            </p>
            {sel[c.key] && <p className="mt-1 text-[11px] text-ink-500">{c.why}</p>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
          <div
            className={`h-full transition-all ${
              score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`font-mono text-xs ${tone}`}>可调用性 {score}/100</span>
      </div>

      <pre className="overflow-x-auto rounded-lg bg-ink-950/60 p-3 font-mono text-[11px] leading-relaxed text-ink-200">
        {schema}
      </pre>
    </div>
  )
}
