/**
 * 模型标识别名层。
 *
 * 为什么需要这一层：模型标识是全站最容易过期的信息。厂商几个月就换一代，
 * 而课程正文里散落着上百处硬编码的模型名。过去的做法是"改内容时顺手全局替换"，
 * 结果必然是改漏 —— 审查时就发现过写成 `claude-opus-4-8` 这种不存在的型号。
 *
 * 现在的约定：
 * 1. 这个文件是模型标识的唯一真源，`scripts/check-curriculum.mjs` 的 C5
 *    直接从这里读白名单，正文里出现任何不在这里登记的标识都会让 CI 失败。
 * 2. 课程正文讨论"用哪一档模型"时，优先用档位（tier）而不是具体型号；
 *    只有可运行的代码示例才写具体标识。
 * 3. 每次校准后更新 `CALIBRATED_ON`，C14 会在它过期时发出警告。
 *
 * 重要：下面的定价与能力描述是写作当时的量级参考，不是报价单。
 * 任何选型决策都请以厂商官方文档为准。
 */

/** 课程内部使用的模型档位。正文优先引用档位，而不是具体型号。 */
export type ModelTier = 'nano' | 'small' | 'mid' | 'large' | 'embedding'

export interface ModelEntry {
  /** 厂商 API 里使用的标识 */
  id: string
  vendor: 'OpenAI' | 'Anthropic' | 'Google'
  /** 是否为钉死版本的快照 ID（生产环境应当使用） */
  snapshot: boolean
}

export interface TierSpec {
  tier: ModelTier
  /** 课程正文里用来指代这一档的中文名 */
  name: string
  /** 这一档解决什么问题 */
  useFor: string
  /** 什么时候不该用这一档 */
  avoidFor: string
  models: ModelEntry[]
}

/**
 * 白名单最后一次对照厂商文档核对的日期（ISO）。
 * 改动 MODEL_TIERS 时请一并更新，C14 会在超过 180 天未校准时告警。
 */
export const CALIBRATED_ON = '2026-07-27'

/** 超过这个天数未校准，check 会发出警告。 */
export const CALIBRATION_MAX_AGE_DAYS = 180

export const MODEL_TIERS: TierSpec[] = [
  {
    tier: 'nano',
    name: '极小档',
    useFor: '意图分类、路由判断、格式校验这类"一句话就能说清"的窄任务',
    avoidFor: '任何需要多步推理或长上下文的场景，它会自信地给出错误答案',
    models: [
      { id: 'gpt-4o-mini', vendor: 'OpenAI', snapshot: false },
      { id: 'claude-haiku-4-5', vendor: 'Anthropic', snapshot: false },
      { id: 'gemini-2.0-flash', vendor: 'Google', snapshot: false },
    ],
  },
  {
    tier: 'small',
    name: '小档',
    useFor: '结构化抽取、摘要、简单工具调用；高频调用时的成本主力',
    avoidFor: '开放式规划、需要自我纠错的长链路任务',
    models: [
      { id: 'gpt-4o-mini', vendor: 'OpenAI', snapshot: false },
      { id: 'claude-haiku-4-5', vendor: 'Anthropic', snapshot: false },
    ],
  },
  {
    tier: 'mid',
    name: '中档',
    useFor: '大多数生产 Agent 的默认档位：工具调用、RAG 问答、中等复杂度规划',
    avoidFor: '需要极致推理深度的架构级任务，以及成本敏感的超高频调用',
    models: [
      { id: 'claude-sonnet-5', vendor: 'Anthropic', snapshot: false },
      { id: 'claude-sonnet-4-20250514', vendor: 'Anthropic', snapshot: true },
      { id: 'gpt-4o', vendor: 'OpenAI', snapshot: false },
      { id: 'gpt-4o-2024-08-06', vendor: 'OpenAI', snapshot: true },
      { id: 'gpt-4o-2024-11-20', vendor: 'OpenAI', snapshot: true },
    ],
  },
  {
    tier: 'large',
    name: '大档',
    useFor: '复杂推理、长链路自主规划、代码库级重构；也用作评测里的裁判模型',
    avoidFor: '能用中档解决的任何事情 —— 这一档的价格通常是中档的数倍',
    models: [{ id: 'claude-opus-5', vendor: 'Anthropic', snapshot: false }],
  },
  {
    tier: 'embedding',
    name: '向量档',
    useFor: 'RAG 建库与查询向量化；建库与查询必须用同一个模型',
    avoidFor: '拿它做相关性精排 —— 那是 reranker 的活',
    models: [],
  },
]

/** 全站允许出现的模型标识。C5 直接消费这个集合。 */
export const KNOWN_MODEL_IDS: string[] = Array.from(
  new Set(MODEL_TIERS.flatMap((t) => t.models.map((m) => m.id))),
).sort()

/** 按档位取一个推荐标识；正文示例代码用它比硬编码型号更耐放。 */
export function defaultModelOf(tier: ModelTier): string | undefined {
  return MODEL_TIERS.find((t) => t.tier === tier)?.models[0]?.id
}

/** 距上次校准过去了多少天。 */
export function calibrationAgeDays(now: Date = new Date()): number {
  const then = new Date(`${CALIBRATED_ON}T00:00:00Z`).getTime()
  return Math.floor((now.getTime() - then) / 86_400_000)
}
