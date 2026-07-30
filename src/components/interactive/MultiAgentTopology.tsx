import { useMemo, useState } from 'react'

/**
 * 多智能体拓扑对比。
 *
 * 教学目标：拓扑不是画风问题，它直接决定消息复杂度、端到端延迟和故障爆炸半径。
 */

type Topo = 'chain' | 'star' | 'mesh' | 'hier'

interface Spec {
  id: Topo
  name: string
  /** [x, y] 归一化坐标 */
  nodes: { id: string; x: number; y: number; hub?: boolean }[]
  edges: [string, string][]
  msgFormula: string
  msgCount: (n: number) => number
  /** 串行深度，决定端到端延迟 */
  depth: number
  blast: string
  fit: string
  risk: string
}

const N = 5

const SPECS: Record<Topo, Spec> = {
  chain: {
    id: 'chain',
    name: '链式',
    nodes: [
      { id: 'A', x: 8, y: 50 },
      { id: 'B', x: 30, y: 50 },
      { id: 'C', x: 52, y: 50 },
      { id: 'D', x: 74, y: 50 },
      { id: 'E', x: 92, y: 50 },
    ],
    edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E']],
    msgFormula: 'n − 1',
    msgCount: (n) => n - 1,
    depth: 5,
    blast: '任一节点失败，后续全断',
    fit: '流程固定、顺序不可交换的流水线（如：抓取 → 清洗 → 摘要 → 排版）',
    risk: '延迟是所有节点之和，且没有并行余地。误差会一路累积放大。',
  },
  star: {
    id: 'star',
    name: '星型 / Supervisor',
    nodes: [
      { id: 'S', x: 50, y: 50, hub: true },
      { id: 'A', x: 50, y: 12 },
      { id: 'B', x: 88, y: 62 },
      { id: 'C', x: 12, y: 62 },
      { id: 'D', x: 50, y: 88 },
    ],
    edges: [['S', 'A'], ['S', 'B'], ['S', 'C'], ['S', 'D']],
    msgFormula: '2(n − 1)',
    msgCount: (n) => 2 * (n - 1),
    depth: 3,
    blast: 'Supervisor 是单点，它挂则全挂',
    fit: '任务可拆成互不依赖的子任务，需要一个地方做汇总与仲裁',
    risk: 'Supervisor 的 context 会成为瓶颈：所有子结果都要回流到它这里，很容易撑爆窗口。',
  },
  mesh: {
    id: 'mesh',
    name: '网状',
    nodes: [
      { id: 'A', x: 50, y: 10 },
      { id: 'B', x: 90, y: 38 },
      { id: 'C', x: 75, y: 85 },
      { id: 'D', x: 25, y: 85 },
      { id: 'E', x: 10, y: 38 },
    ],
    edges: [
      ['A', 'B'], ['A', 'C'], ['A', 'D'], ['A', 'E'],
      ['B', 'C'], ['B', 'D'], ['B', 'E'],
      ['C', 'D'], ['C', 'E'], ['D', 'E'],
    ],
    msgFormula: 'n(n − 1) / 2',
    msgCount: (n) => (n * (n - 1)) / 2,
    depth: 4,
    blast: '单点失败影响小，但错误会在网中扩散',
    fit: '需要多方自由协商的场景，如辩论、评审',
    risk: '消息量随 n² 增长，5 个 Agent 就有 10 条边。这是最容易失控的拓扑，务必设总轮次上限。',
  },
  hier: {
    id: 'hier',
    name: '层级',
    nodes: [
      { id: 'R', x: 50, y: 12, hub: true },
      { id: 'M1', x: 25, y: 50, hub: true },
      { id: 'M2', x: 75, y: 50, hub: true },
      { id: 'W1', x: 12, y: 88 },
      { id: 'W2', x: 38, y: 88 },
      { id: 'W3', x: 62, y: 88 },
      { id: 'W4', x: 88, y: 88 },
    ],
    edges: [
      ['R', 'M1'], ['R', 'M2'],
      ['M1', 'W1'], ['M1', 'W2'],
      ['M2', 'W3'], ['M2', 'W4'],
    ],
    msgFormula: '2(n − 1)，但按层聚合',
    msgCount: (n) => 2 * (n - 1),
    depth: 5,
    blast: '故障被限制在子树内',
    fit: '规模较大、可按职能分组的团队式任务（如：产品 → 前端组 / 后端组）',
    risk: '层数每加一层，端到端延迟就多两跳，且中层容易变成"传话筒"而不产生实际价值。',
  },
}

const ORDER: Topo[] = ['chain', 'star', 'hier', 'mesh']

export function MultiAgentTopology() {
  const [t, setT] = useState<Topo>('star')
  const spec = SPECS[t]
  // 显式标注类型：Object.fromEntries 在 strict 下会把 [string, Node] 推成联合数组。
  const pos = useMemo<Record<string, { id: string; x: number; y: number; hub?: boolean }>>(
    () => Object.fromEntries(spec.nodes.map((n) => [n.id, n] as const)),
    [spec],
  )

  return (
    <div className="card p-5">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">多智能体拓扑对比</h4>
      <p className="mb-4 text-xs text-ink-500">
        同样 5 个 Agent，换个连法，消息量能差 10 倍。先想清楚失败时谁来兜底，再选拓扑。
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {ORDER.map((k) => (
          <button
            key={k}
            onClick={() => setT(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              t === k
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {SPECS[k].name}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 100 100" className="mb-4 h-56 w-full rounded-lg bg-ink-950/60">
        {spec.edges.map(([a, b], i) => (
          <line
            key={i}
            x1={pos[a].x}
            y1={pos[a].y}
            x2={pos[b].x}
            y2={pos[b].y}
            stroke="currentColor"
            className="text-brand-500/40"
            strokeWidth={0.6}
          />
        ))}
        {spec.nodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={6}
              className={n.hub ? 'fill-brand-500/30 stroke-brand-400' : 'fill-ink-800 stroke-ink-600'}
              strokeWidth={0.6}
            />
            <text
              x={n.x}
              y={n.y + 1.6}
              textAnchor="middle"
              fontSize={4}
              className={n.hub ? 'fill-brand-200' : 'fill-ink-300'}
            >
              {n.id}
            </text>
          </g>
        ))}
      </svg>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-ink-950/60 p-2">
          <p className="font-mono text-sm text-ink-100">{spec.msgCount(N)}</p>
          <p className="text-[10px] text-ink-500">消息通道数（{spec.msgFormula}）</p>
        </div>
        <div className="rounded-lg bg-ink-950/60 p-2">
          <p className="font-mono text-sm text-ink-100">{spec.depth}</p>
          <p className="text-[10px] text-ink-500">串行深度（≈ 延迟倍数）</p>
        </div>
        <div className="rounded-lg bg-ink-950/60 p-2">
          <p className="text-[11px] text-ink-100">{spec.blast}</p>
          <p className="text-[10px] text-ink-500">故障爆炸半径</p>
        </div>
      </div>

      <p className="mb-2 text-xs text-ink-300">
        <span className="text-ink-500">适用：</span>
        {spec.fit}
      </p>
      <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] text-amber-300">
        代价：{spec.risk}
      </p>
    </div>
  )
}
