import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { DiagramAnnotationData, DiagramColor, DiagramGroupData, DiagramNodeData } from './types'

function colorClass(prefix: string, color: DiagramColor = 'brand') {
  return `${prefix} ${prefix}--${color}`
}

const handleStyle = { opacity: 0, width: 8, height: 8, border: 'none' as const }

/** Source + target on every side so edges can enter/leave freely. */
function QuadHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="t" style={handleStyle} />
      <Handle type="source" position={Position.Top} id="st" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="r" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="sr" style={handleStyle} />
      <Handle type="target" position={Position.Bottom} id="b" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="sb" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="l" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="sl" style={handleStyle} />
    </>
  )
}

export function DiagramNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  const size = data.size === 'sm' ? ' diagram-node--sm' : ''
  const emphasis =
    data.emphasis === 'hub'
      ? ' diagram-node--hub'
      : data.emphasis === 'output'
        ? ' diagram-node--output'
        : ''
  return (
    <div className={`${colorClass('diagram-node', data.color)}${size}${emphasis}`}>
      <QuadHandles />
      {data.caption ? <span className="diagram-node__caption">{data.caption}</span> : null}
      {data.label}
    </div>
  )
}

export function DiagramGroup({ data }: NodeProps<Node<DiagramGroupData>>) {
  return (
    <div className={colorClass('diagram-group', data.color)}>
      <div className="diagram-group__label">{data.label}</div>
    </div>
  )
}

export function DiagramAnnotation({ data }: NodeProps<Node<DiagramAnnotationData>>) {
  return <div className="diagram-annotation">{data.label}</div>
}

export const defaultNodeTypes = {
  diagram: DiagramNode,
  group: DiagramGroup,
  annotation: DiagramAnnotation,
}
