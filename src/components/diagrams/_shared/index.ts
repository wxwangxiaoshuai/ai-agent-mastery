import type { Edge, Node } from '@xyflow/react'
import type { DiagramColor, DiagramNodeData } from './types'
import type { DiagramEdgeData } from './edges'

export { DiagramShell } from './DiagramShell'
export { defaultNodeTypes, DiagramNode, DiagramGroup, DiagramAnnotation } from './nodes'
export { defaultEdgeTypes, DiagramEdge, defaultMarkerEnd } from './edges'
export type { DiagramColor, DiagramNodeData, DiagramGroupData, DiagramAnnotationData } from './types'
export type { DiagramEdgeData } from './edges'

type NodeOpts = {
  color?: DiagramColor
  width?: number
  height?: number
  size?: 'sm' | 'md'
  caption?: string
  emphasis?: DiagramNodeData['emphasis']
  parentId?: string
  extent?: 'parent'
}

/** Create a fixed-position diagram node. */
export function n(
  id: string,
  label: string,
  x: number,
  y: number,
  opts: NodeOpts = {},
): Node<DiagramNodeData> {
  const { color = 'brand', width, height, size, caption, emphasis, parentId, extent } = opts
  return {
    id,
    type: 'diagram',
    position: { x, y },
    data: { label, color, size, caption, emphasis },
    ...(width != null || height != null
      ? { style: { ...(width != null ? { width } : {}), ...(height != null ? { height } : {}) } }
      : {}),
    ...(parentId ? { parentId, extent: extent ?? 'parent' } : {}),
    draggable: false,
    selectable: false,
  }
}

/** Create a swimlane / group background node (decorative — prefer absolute child coords for cross-lane edges). */
export function g(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: DiagramColor = 'brand',
): Node {
  return {
    id,
    type: 'group',
    position: { x, y },
    data: { label, color },
    style: { width, height },
    draggable: false,
    selectable: false,
    zIndex: -1,
  }
}

/** Lightweight text annotation (not a state). */
export function ann(id: string, label: string, x: number, y: number): Node {
  return {
    id,
    type: 'annotation',
    position: { x, y },
    data: { label },
    draggable: false,
    selectable: false,
  }
}

/** Side shorthand: n/e/s/w → source handle id (st/sr/sb/sl) or target (t/r/b/l). */
export type Side = 'n' | 'e' | 's' | 'w'

const SOURCE_HANDLE: Record<Side, string> = { n: 'st', e: 'sr', s: 'sb', w: 'sl' }
const TARGET_HANDLE: Record<Side, string> = { n: 't', e: 'r', s: 'b', w: 'l' }

type EdgeOpts = {
  label?: string
  dashed?: boolean
  accent?: DiagramColor
  curve?: 'step' | 'bezier'
  animated?: boolean
  fromSide?: Side
  toSide?: Side
  sourceHandle?: string
  targetHandle?: string
  id?: string
}

function asSourceHandle(h?: string): string | undefined {
  if (!h) return undefined
  if (h === 't' || h === 'r' || h === 'b' || h === 'l') return `s${h}`
  return h
}

/** Create a labeled diagram edge. */
export function e(
  source: string,
  target: string,
  opts: EdgeOpts = {},
): Edge<DiagramEdgeData> {
  const { label, dashed, accent, curve, animated, fromSide, toSide, id } = opts
  const sourceHandle =
    asSourceHandle(opts.sourceHandle) ?? (fromSide ? SOURCE_HANDLE[fromSide] : undefined)
  const targetHandle = opts.targetHandle ?? (toSide ? TARGET_HANDLE[toSide] : undefined)
  return {
    id:
      id ??
      `${source}->${target}${label ? `:${label}` : ''}${sourceHandle ? `:${sourceHandle}` : ''}${targetHandle ? `>${targetHandle}` : ''}`,
    source,
    target,
    type: 'diagram',
    data: { label, dashed, accent, curve, animated },
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
  }
}
