/**
 * 通用架构图组件 —— 可复用的分层架构图基础设施。
 *
 * 使用方式：
 * <ArchitectureDiagram title="系统架构" layers={[...]} nodes={[...]} edges={[...]} />
 *
 * 所有坐标使用百分比，自动适配容器宽度。
 * CSS 变量颜色，自适应暗/亮双主题。
 */
import { useId } from 'react'

export interface DiagramLayer {
  id: string
  label: string
  y: number
  height: number
  color: string
}

export interface DiagramNode {
  id: string
  label: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
}

export interface DiagramEdge {
  from: string
  to: string
  label?: string
  dashed?: boolean
}

interface ArchitectureDiagramProps {
  title: string
  description?: string
  layers: DiagramLayer[]
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  height?: number
}

const NODE_W = 28
const NODE_H = 12

export function ArchitectureDiagram({
  title,
  description,
  layers,
  nodes,
  edges,
  height = 400,
}: ArchitectureDiagramProps) {
  const id = useId()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function getNodePos(id: string) {
    const n = nodeMap.get(id)
    return {
      x: (n?.x ?? 50) * 10,
      y: (n?.y ?? 50) * 10,
      w: (n?.width ?? NODE_W) * 10,
      h: (n?.height ?? NODE_H) * 10,
    }
  }

  return (
    <div className="card p-5 not-prose">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">{title}</h4>
      {description && <p className="mb-4 text-xs text-ink-500">{description}</p>}

      <svg
        viewBox={`0 0 1000 ${height}`}
        className="w-full rounded-lg"
        style={{ background: 'rgb(var(--ink-900) / 1)' }}
        role="img"
        aria-label={title}
      >
        {/* Layers */}
        {layers.map((l) => (
          <g key={l.id}>
            <rect
              x={10}
              y={l.y * 10}
              width={980}
              height={l.height * 10}
              rx={6}
              fill={`rgb(var(--${l.color}-500) / 0.08)`}
              stroke={`rgb(var(--${l.color}-500) / 0.2)`}
              strokeWidth={1}
            />
            <text
              x={24}
              y={l.y * 10 + 18}
              fill={`rgb(var(--${l.color}-400) / 1)`}
              fontSize={12}
              fontWeight={600}
            >
              {l.label}
            </text>
          </g>
        ))}

        {/* Edges */}
        {edges.map((e, i) => {
          const from = getNodePos(e.from)
          const to = getNodePos(e.to)
          const x1 = from.x + from.w
          const y1 = from.y + from.h / 2
          const x2 = to.x
          const y2 = to.y + to.h / 2
          const mx = (x1 + x2) / 2

          return (
            <g key={`${id}-edge-${i}`}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="rgb(var(--ink-500) / 1)"
                strokeWidth={1.5}
                strokeDasharray={e.dashed ? '6 3' : undefined}
                markerEnd={`url(#arrow-${id})`}
              />
              {e.label && (
                <text
                  x={mx}
                  y={Math.min(y1, y2) - 6}
                  textAnchor="middle"
                  fill="rgb(var(--ink-400) / 1)"
                  fontSize={10}
                >
                  {e.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Arrowhead marker */}
        <defs>
          <marker
            id={`arrow-${id}`}
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--ink-500) / 1)" />
          </marker>
        </defs>

        {/* Nodes */}
        {nodes.map((n) => {
          const pos = getNodePos(n.id)
          const c = n.color ?? 'brand'
          return (
            <g key={n.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.w}
                height={pos.h}
                rx={5}
                fill={`rgb(var(--${c}-500) / 0.15)`}
                stroke={`rgb(var(--${c}-500) / 0.5)`}
                strokeWidth={1.5}
              />
              <text
                x={pos.x + pos.w / 2}
                y={pos.y + pos.h / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={`rgb(var(--${c}-300) / 1)`}
                fontSize={11}
                fontWeight={500}
              >
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}