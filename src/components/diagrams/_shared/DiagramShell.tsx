import { useEffect, useId, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './theme.css'
import { defaultNodeTypes } from './nodes'
import { defaultEdgeTypes, markerFor } from './edges'
import { layoutEdges } from './layout'
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

function nodeLabel(node: Node): string {
  const data = node.data as { label?: string } | undefined
  return (data?.label ?? node.id).replace(/\n/g, ' ')
}

/** Structured text for screen readers — swimlanes, nodes, edges. */
function buildSrDescription(title: string, description: string | undefined, nodes: Node[], edges: Edge[]) {
  const lanes = nodes
    .filter((n) => n.type === 'group')
    .map((n) => nodeLabel(n))
  const steps = nodes
    .filter((n) => n.type !== 'group' && n.type !== 'annotation')
    .map((n) => nodeLabel(n))
  const flows = edges.map((edge) => {
    const data = edge.data as DiagramEdgeData | undefined
    const label = data?.label ? `（${data.label}）` : ''
    const undirected = data?.undirected ? '对等连接' : '流向'
    return `${edge.source} ${undirected}${label} ${edge.target}`
  })

  const parts = [
    title,
    description,
    lanes.length ? `泳道：${lanes.join('；')}` : '',
    steps.length ? `节点：${steps.join('、')}` : '',
    flows.length ? `连线：${flows.join('；')}` : '',
  ].filter(Boolean)

  return parts.join('。')
}

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return narrow
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
  minZoom: minZoomProp = 0.4,
  maxZoom = 1.35,
}: DiagramShellProps) {
  const descId = useId()
  const srId = useId()
  const narrow = useNarrowScreen()
  const minZoom = narrow ? Math.min(minZoomProp, 0.2) : minZoomProp

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

  const styledEdges = useMemo(() => {
    const laidOut = layoutEdges(nodes, edges)
    return laidOut.map((edge) => {
      const data = edge.data as DiagramEdgeData | undefined
      const accent = (data?.accent ?? 'ink') as DiagramColor
      const undirected = Boolean(data?.undirected)
      return {
        ...edge,
        type: edge.type ?? 'diagram',
        zIndex: 0,
        ...(undirected ? {} : { markerEnd: markerFor(accent) }),
      }
    })
  }, [nodes, edges])

  const srText = useMemo(
    () => buildSrDescription(title, description, nodes, edges),
    [title, description, nodes, edges],
  )

  return (
    <figure className="card p-5 not-prose">
      <figcaption className="mb-4">
        <h4 className="mb-1 text-sm font-semibold text-ink-100">{title}</h4>
        {description ? (
          <p id={descId} className="text-xs text-ink-500">
            {description}
          </p>
        ) : null}
        {narrow ? (
          <p className="mt-1 text-[11px] text-ink-500">可双指缩放 / 拖动平移，右下角有缩放控件</p>
        ) : null}
      </figcaption>
      <div className="diagram-rf" style={{ height }} aria-describedby={srId}>
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
          }}
        >
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>
      <p id={srId} className="diagram-sr-only">
        {srText}
      </p>
    </figure>
  )
}

export function DiagramShell(props: DiagramShellProps) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  )
}
