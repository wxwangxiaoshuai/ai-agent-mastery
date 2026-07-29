import { useId, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './theme.css'
import { defaultNodeTypes } from './nodes'
import { defaultEdgeTypes, markerFor } from './edges'
import type { DiagramColor } from './types'
import type { DiagramEdgeData } from './edges'

type DiagramShellProps = {
  title: string
  description?: string
  height?: number
  nodes: Node[]
  edges: Edge[]
  nodeTypes?: NodeTypes
  edgeTypes?: EdgeTypes
  fitViewPadding?: number
  minZoom?: number
  maxZoom?: number
}

function DiagramCanvas({
  title,
  description,
  height = 360,
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  fitViewPadding = 0.14,
  minZoom = 0.4,
  maxZoom = 1.35,
}: DiagramShellProps) {
  const descId = useId()
  const mergedNodeTypes = useMemo(
    () => ({ ...defaultNodeTypes, ...nodeTypes }),
    [nodeTypes],
  )
  const mergedEdgeTypes = useMemo(
    () => ({ ...defaultEdgeTypes, ...edgeTypes }),
    [edgeTypes],
  )

  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        zIndex: n.type === 'group' ? -1 : (n.zIndex ?? 2),
      })),
    [nodes],
  )

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const data = edge.data as DiagramEdgeData | undefined
        const accent = (data?.accent ?? 'ink') as DiagramColor
        return {
          ...edge,
          type: edge.type ?? 'diagram',
          zIndex: 0,
          markerEnd: markerFor(accent),
        }
      }),
    [edges],
  )

  return (
    <div className="card p-5 not-prose">
      <h4 className="mb-1 text-sm font-semibold text-ink-100">{title}</h4>
      {description ? (
        <p id={descId} className="mb-4 text-xs text-ink-500">
          {description}
        </p>
      ) : null}
      <div
        className="diagram-rf"
        style={{ height }}
        role="img"
        aria-label={title}
        aria-describedby={description ? descId : undefined}
      >
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          nodeTypes={mergedNodeTypes}
          edgeTypes={mergedEdgeTypes}
          fitView
          fitViewOptions={{ padding: fitViewPadding }}
          minZoom={minZoom}
          maxZoom={maxZoom}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          nodesFocusable={false}
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          onlyRenderVisibleElements={false}
          defaultEdgeOptions={{
            type: 'diagram',
            markerEnd: markerFor('ink'),
          }}
        />
      </div>
    </div>
  )
}

export function DiagramShell(props: DiagramShellProps) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  )
}
