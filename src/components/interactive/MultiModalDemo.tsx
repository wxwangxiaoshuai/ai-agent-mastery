import { useState } from 'react'

type Modality = 'image' | 'audio' | 'video'

interface Scenario {
  id: string
  modality: Modality
  title: string
  inputLabel: string
  inputHint: string
  textOnly: {
    how: string
    loss: string
    output: string
  }
  multimodal: {
    pipeline: string[]
    output: Record<string, unknown>
  }
}

const SCENARIOS: Scenario[] = [
  {
    id: 'chart',
    modality: 'image',
    title: '柱状图读数',
    inputLabel: 'sales_q1.png',
    inputHint: '一张 Q1 销售额柱状图：Jan/Feb/Mar，三根柱高度不等',
    textOnly: {
      how: '人先口述：「左边矮、中间高、右边更高…」再喂给文本模型',
      loss: '柱高被模糊成形容词，数值/坐标轴刻度丢失，无法可靠提取数据',
      output: '「三月销售额看起来最高，大概比一月多不少。」（无 JSON、无精确值）',
    },
    multimodal: {
      pipeline: ['读图（vision）', '识别坐标轴/图例', '估读柱高', '结构化 JSON'],
      output: {
        chart_type: 'bar',
        title: 'Q1 Sales',
        data: [
          { label: 'Jan', value: 42 },
          { label: 'Feb', value: 58 },
          { label: 'Mar', value: 71 },
        ],
        confidence: 'medium',
      },
    },
  },
  {
    id: 'invoice',
    modality: 'image',
    title: '发票 OCR',
    inputLabel: 'invoice.jpg',
    inputHint: '扫描件发票：含公司名、金额、日期、税号',
    textOnly: {
      how: '人手工抄字段进表格，或先跑传统 OCR 再拼进 prompt',
      loss: '版式/印章干扰、抄写错误；跨栏字段易漏',
      output: '「好像是某某公司、金额差不多两千多。」（字段不全）',
    },
    multimodal: {
      pipeline: ['整页送视觉模型', '按 schema 抽字段', '标 [?]/存疑', '可选双路校验'],
      output: {
        vendor: '星河科技有限公司',
        amount: 2380.0,
        currency: 'CNY',
        date: '2026-03-12',
        tax_id: '91XXXXMA1XXXXXX',
        uncertain: [],
      },
    },
  },
  {
    id: 'voice',
    modality: 'audio',
    title: '会议录音',
    inputLabel: 'standup.m4a',
    inputHint: '约 45 秒站会录音：有人报进度、提到延期风险',
    textOnly: {
      how: '无法直接听；只能等人工纪要或先 STT 成字再分析',
      loss: '纯文本 Agent 听不见；若只有粗糙纪要，情感/语气丢失',
      output: '（无音频时）无法处理，或只拿到残缺纪要。',
    },
    multimodal: {
      pipeline: ['STT 转写', '摘要', '情感/风险点', '统一报告 schema'],
      output: {
        transcript_preview: '…本周登录页还差验证码，有延期风险…',
        summary: '登录页验证码未完成，存在延期风险；其余模块按计划。',
        sentiment: '中性偏负',
        key_points: ['验证码未完成', '延期风险'],
      },
    },
  },
  {
    id: 'clip',
    modality: 'video',
    title: '产品演示短视频',
    inputLabel: 'demo_60s.mp4',
    inputHint: '60 秒产品演示：开场 UI → 点击操作 → 结果页',
    textOnly: {
      how: '人写分镜文案，或抽几帧口述「第 10 秒点了按钮」',
      loss: '时序关系靠文字转述，易漏关键瞬间；无法定位精确秒数',
      output: '「视频里演示了产品流程，最后出了结果页。」（无时间戳）',
    },
    multimodal: {
      pipeline: ['关键帧采样', '时间戳标注', '时序理解', '事件列表 + 摘要'],
      output: {
        events: [
          { time_sec: 2, description: '开场展示首页' },
          { time_sec: 18, description: '点击「开始分析」' },
          { time_sec: 41, description: '结果页出现报告卡片' },
        ],
        summary: '演示从首页进入分析，约 41 秒展示结果页。',
        frame_count: 12,
      },
    },
  },
]

const modalityMeta: Record<
  Modality,
  { label: string; badge: string; tokenHint: string }
> = {
  image: {
    label: '视觉',
    badge: 'border-brand-500/40 bg-brand-500/10 text-ink-100',
    tokenHint: '1 张图约 1–2k token；大图需压缩再 base64',
  },
  audio: {
    label: '语音',
    badge: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    tokenHint: '常走 STT→LLM→TTS 流水线；实时要流式重叠',
  },
  video: {
    label: '视频',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    tokenHint: '不可整段硬喂；先采样 10–30 帧再理解时序',
  },
}

export function MultiModalDemo() {
  const [modality, setModality] = useState<Modality>('image')
  const options = SCENARIOS.filter((s) => s.modality === modality)
  const [activeId, setActiveId] = useState(options[0]?.id ?? 'chart')
  const scenario =
    SCENARIOS.find((s) => s.id === activeId && s.modality === modality) ??
    options[0] ??
    SCENARIOS[0]
  const meta = modalityMeta[scenario.modality]

  const switchModality = (m: Modality) => {
    setModality(m)
    const first = SCENARIOS.find((s) => s.modality === m)
    if (first) setActiveId(first.id)
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-ink-100">多模态输入输出对比</h4>
          <p className="mt-1 text-xs text-ink-500">
            同一任务：纯文本转述 vs 多模态直读。观察信息损失与结构化产出差异（模拟，不调用真实模型）。
          </p>
        </div>
        <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(modalityMeta) as Modality[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchModality(m)}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              modality === m
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {modalityMeta[m].label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {options.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
              activeId === s.id
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-ink-700/80 bg-ink-900/40 px-3 py-2">
        <div className="font-mono text-[11px] text-ink-100">{scenario.inputLabel}</div>
        <p className="mt-1 text-xs text-ink-400">{scenario.inputHint}</p>
        <p className="mt-1 text-[11px] text-ink-500">{meta.tokenHint}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-danger-500/25 bg-danger-500/5 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-300">
            纯文本路径
          </div>
          <p className="mb-2 text-xs text-ink-400">
            <span className="text-ink-500">做法：</span>
            {scenario.textOnly.how}
          </p>
          <p className="mb-2 text-xs text-danger-300">
            <span className="text-ink-500">损失：</span>
            {scenario.textOnly.loss}
          </p>
          <div className="rounded-md border border-ink-700/60 bg-ink-950/50 p-2 text-[11px] leading-relaxed text-ink-400">
            {scenario.textOnly.output}
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            多模态路径
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {scenario.multimodal.pipeline.map((step, i) => (
              <span
                key={step}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-ink-950/40 px-1.5 py-0.5 text-[10px] text-emerald-300"
              >
                <span className="text-ink-500">{i + 1}.</span>
                {step}
              </span>
            ))}
          </div>
          <pre className="overflow-x-auto rounded-md border border-ink-700/60 bg-ink-950/50 p-2 font-mono text-[10px] leading-relaxed text-emerald-300">
            {JSON.stringify(scenario.multimodal.output, null, 2)}
          </pre>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        关键：多模态是直接吃像素/波形/帧，不是「先写成字再塞进 prompt」。视觉→L12-02，语音→L12-03，视频→L12-04，集成→P12。
      </p>
    </div>
  )
}
