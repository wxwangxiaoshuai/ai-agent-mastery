import type { Edge, Node } from '@xyflow/react'
import type { DiagramEdgeData } from './edges'

const SOURCE_HANDLE = { n: 'st', e: 'sr', s: 'sb', w: 'sl' } as const
const TARGET_HANDLE = { n: 't', e: 'r', s: 'b', w: 'l' } as const

type Side = keyof typeof SOURCE_HANDLE

/** Default node box when style.width/height are absent (matches .diagram-node CSS). */
const DEFAULT_W = 110
const DEFAULT_H = 48

type AbsBox = { x: number; y: number; w: number; h: number; cx: number; cy: number }

function nodeWidth(node: Node): number {
  const style = node.style as { width?: number | string } | undefined
  const w = style?.width
  if (typeof w === 'number') return w
  if (typeof w === 'string') {
    const parsed = parseFloat(w)
    if (!Number.isNaN(parsed)) return parsed
  }
  return DEFAULT_W
}

function nodeHeight(node: Node): number {
  const style = node.style as { height?: number | string } | undefined
  const h = style?.height
  if (typeof h === 'number') return h
  if (typeof h === 'string') {
    const parsed = parseFloat(h)
    if (!Number.isNaN(parsed)) return parsed
  }
  return DEFAULT_H
}

/** Absolute center/box for each non-group node, accounting for parentId offsets. */
export function absoluteBoxes(nodes: Node[]): Map<string, AbsBox> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const boxes = new Map<string, AbsBox>()

  for (const node of nodes) {
    if (node.type === 'group') continue

    let x = node.position.x
    let y = node.position.y
    let parentId = node.parentId
    while (parentId) {
      const parent = byId.get(parentId)
      if (!parent) break
      x += parent.position.x
      y += parent.position.y
      parentId = parent.parentId
    }

    const w = nodeWidth(node)
    const h = nodeHeight(node)
    boxes.set(node.id, { x, y, w, h, cx: x + w / 2, cy: y + h / 2 })
  }

  return boxes
}

function inferSides(dx: number, dy: number): { from: Side; to: Side } {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: 'e', to: 'w' } : { from: 'w', to: 'e' }
  }
  return dy >= 0 ? { from: 's', to: 'n' } : { from: 'n', to: 's' }
}

/**
 * Post-process edges: auto-infer source/target handles from node positions when
 * neither side was specified. Explicit handles / fromSide / toSide are preserved.
 * Also picks curve='bezier' for long / cross-lane hops when curve was unset.
 */
export function layoutEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const boxes = absoluteBoxes(nodes)

  return edges.map((edge) => {
    const hasSource = Boolean(edge.sourceHandle)
    const hasTarget = Boolean(edge.targetHandle)
    const data = (edge.data ?? {}) as DiagramEdgeData
    const hasCurve = data.curve != null

    if (hasSource && hasTarget && hasCurve) return edge

    const src = boxes.get(edge.source)
    const tgt = boxes.get(edge.target)
    if (!src || !tgt) return edge

    const dx = tgt.cx - src.cx
    const dy = tgt.cy - src.cy
    const dist = Math.hypot(dx, dy)
    const sides = inferSides(dx, dy)

    const next: Edge = { ...edge }
    if (!hasSource) next.sourceHandle = SOURCE_HANDLE[sides.from]
    if (!hasTarget) next.targetHandle = TARGET_HANDLE[sides.to]

    if (!hasCurve) {
      // Same-row short hops stay stepped; long / vertical-dominant spans use bezier.
      const sameRow = Math.abs(dy) < Math.max(src.h, tgt.h) * 0.75
      const short = dist < 220
      next.data = {
        ...data,
        curve: sameRow && short ? 'step' : Math.abs(dy) > Math.abs(dx) * 0.6 || dist > 280 ? 'bezier' : 'step',
      }
    }

    return next
  })
}
