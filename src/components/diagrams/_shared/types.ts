export type DiagramColor =
  | 'brand'
  | 'emerald'
  | 'amber'
  | 'fuchsia'
  | 'danger'
  | 'ink'
  | 'violet'

export type DiagramNodeData = {
  label: string
  color?: DiagramColor
  size?: 'sm' | 'md'
  /** Optional micro-caption above the main label */
  caption?: string
  /** Emphasize as a sink / output / hub */
  emphasis?: 'default' | 'hub' | 'output'
}

export type DiagramGroupData = {
  label: string
  color?: DiagramColor
}

export type DiagramAnnotationData = {
  label: string
}

/** CSS color token triples used by nodes/edges (rgb channels). */
export const COLOR_RGB: Record<DiagramColor, string> = {
  brand: 'var(--brand-500)',
  emerald: 'var(--emerald-500)',
  amber: 'var(--amber-500)',
  fuchsia: 'var(--fuchsia-500)',
  danger: 'var(--danger-500)',
  ink: 'var(--ink-500)',
  violet: 'var(--violet-500)',
}
