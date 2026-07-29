import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  MarkerType,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { DiagramColor } from './types'

export type DiagramEdgeData = {
  label?: string
  dashed?: boolean
  accent?: DiagramColor
  curve?: 'step' | 'bezier'
  animated?: boolean
}

const ACCENT_STROKE: Record<DiagramColor, string> = {
  brand: 'rgb(var(--brand-500) / 1)',
  emerald: 'rgb(var(--emerald-500) / 1)',
  amber: 'rgb(var(--amber-500) / 1)',
  fuchsia: 'rgb(var(--fuchsia-500) / 1)',
  danger: 'rgb(var(--danger-500) / 1)',
  ink: 'rgb(var(--ink-400) / 1)',
  violet: 'rgb(var(--violet-500) / 1)',
}

const ACCENT_MARKER: Record<DiagramColor, string> = {
  brand: 'rgb(var(--brand-500) / 1)',
  emerald: 'rgb(var(--emerald-500) / 1)',
  amber: 'rgb(var(--amber-500) / 1)',
  fuchsia: 'rgb(var(--fuchsia-500) / 1)',
  danger: 'rgb(var(--danger-500) / 1)',
  ink: 'rgb(var(--ink-400) / 1)',
  violet: 'rgb(var(--violet-500) / 1)',
}

export function markerFor(accent: DiagramColor = 'ink') {
  return {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: ACCENT_MARKER[accent],
  }
}

export function DiagramEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps<Edge<DiagramEdgeData>>) {
  const dashed = data?.dashed
  const label = data?.label
  const accent = data?.accent
  const curve = data?.curve ?? 'step'

  const [path, labelX, labelY] =
    curve === 'bezier'
      ? getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          curvature: 0.28,
        })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 10,
          offset: 12,
        })

  const stroke = accent
    ? ACCENT_STROKE[accent]
    : dashed
      ? 'rgb(var(--ink-500) / 0.85)'
      : 'rgb(var(--ink-400) / 1)'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke,
          strokeWidth: dashed ? 1.5 : 2,
          strokeDasharray: dashed ? '6 4' : undefined,
          strokeLinecap: 'round',
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="diagram-edge-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

export const defaultEdgeTypes = {
  diagram: DiagramEdge,
}

export const defaultMarkerEnd = markerFor('ink')

export const MARKER_COLORS: DiagramColor[] = [
  'brand',
  'emerald',
  'amber',
  'fuchsia',
  'danger',
  'ink',
  'violet',
]

export { ACCENT_MARKER }
