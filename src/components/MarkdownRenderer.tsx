import { Suspense, lazy, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CodeBlock } from './CodeBlock'
import { TokenizerDemo } from './interactive/TokenizerDemo'
import { TemperatureSampler } from './interactive/TemperatureSampler'
import { PromptTemplateTester } from './interactive/PromptTemplateTester'
import { AgentLoopVisualizer } from './interactive/AgentLoopVisualizer'
import { EmbeddingExplorer } from './interactive/EmbeddingExplorer'
import { HarnessMonitor } from './interactive/HarnessMonitor'
import { SandboxDemo } from './interactive/SandboxDemo'
import { MultiModalDemo } from './interactive/MultiModalDemo'
import { ChunkingVisualizer } from './interactive/ChunkingVisualizer'
import { RAGPipelineDemo } from './interactive/RAGPipelineDemo'
import { TokenBudgetPlanner } from './interactive/TokenBudgetPlanner'
import { ToolSchemaDesigner } from './interactive/ToolSchemaDesigner'
import { MemoryLayersDemo } from './interactive/MemoryLayersDemo'
import { GraphStateMachine } from './interactive/GraphStateMachine'
import { MultiAgentTopology } from './interactive/MultiAgentTopology'
import { GuardrailTester } from './interactive/GuardrailTester'
import { TradeoffMatrix } from './interactive/TradeoffMatrix'
import { CostLatencyOptimizer } from './interactive/CostLatencyOptimizer'
import { GrowthMapChecklist } from './interactive/GrowthMapChecklist'
import { ModelTierTable } from './interactive/ModelTierTable'
import { UIStateMatrix } from './interactive/UIStateMatrix'
import { UnitEconomicsModel } from './interactive/UnitEconomicsModel'
import { GrowthFunnelSim } from './interactive/GrowthFunnelSim'
import { PatternSelector } from './interactive/PatternSelector'
import { GateConfigurator } from './interactive/GateConfigurator'

// Diagrams are static + pull in @xyflow/react — lazy-load so lessons without
// diagrams don't pay the chunk cost on first paint.
const ReActLoopDiagram = lazy(() =>
  import('./diagrams/ReActLoopDiagram').then((m) => ({ default: m.ReActLoopDiagram })),
)
const RAGPipelineDiagram = lazy(() =>
  import('./diagrams/RAGPipelineDiagram').then((m) => ({ default: m.RAGPipelineDiagram })),
)
const ContextAssemblyDiagram = lazy(() =>
  import('./diagrams/ContextAssemblyDiagram').then((m) => ({ default: m.ContextAssemblyDiagram })),
)
const FunctionCallingSequence = lazy(() =>
  import('./diagrams/FunctionCallingSequence').then((m) => ({ default: m.FunctionCallingSequence })),
)
const CircuitBreakerDiagram = lazy(() =>
  import('./diagrams/CircuitBreakerDiagram').then((m) => ({ default: m.CircuitBreakerDiagram })),
)
const OpenSpecWorkflowDiagram = lazy(() =>
  import('./diagrams/OpenSpecWorkflowDiagram').then((m) => ({ default: m.OpenSpecWorkflowDiagram })),
)
const HarnessGatePipelineDiagram = lazy(() =>
  import('./diagrams/HarnessGatePipelineDiagram').then((m) => ({
    default: m.HarnessGatePipelineDiagram,
  })),
)
const PatternMapDiagram = lazy(() =>
  import('./diagrams/PatternMapDiagram').then((m) => ({ default: m.PatternMapDiagram })),
)
const MemoryLayersDiagram = lazy(() =>
  import('./diagrams/MemoryLayersDiagram').then((m) => ({ default: m.MemoryLayersDiagram })),
)
const LangGraphStateDiagram = lazy(() =>
  import('./diagrams/LangGraphStateDiagram').then((m) => ({ default: m.LangGraphStateDiagram })),
)
const HITLFlowDiagram = lazy(() =>
  import('./diagrams/HITLFlowDiagram').then((m) => ({ default: m.HITLFlowDiagram })),
)
const MultiAgentTopologyDiagram = lazy(() =>
  import('./diagrams/MultiAgentTopologyDiagram').then((m) => ({
    default: m.MultiAgentTopologyDiagram,
  })),
)
const SupervisorPatternDiagram = lazy(() =>
  import('./diagrams/SupervisorPatternDiagram').then((m) => ({
    default: m.SupervisorPatternDiagram,
  })),
)
const DeploymentArchDiagram = lazy(() =>
  import('./diagrams/DeploymentArchDiagram').then((m) => ({ default: m.DeploymentArchDiagram })),
)
const AgentPlatformDiagram = lazy(() =>
  import('./diagrams/AgentPlatformDiagram').then((m) => ({ default: m.AgentPlatformDiagram })),
)
const CursorArchDiagram = lazy(() =>
  import('./diagrams/CursorArchDiagram').then((m) => ({ default: m.CursorArchDiagram })),
)
const DevinArchDiagram = lazy(() =>
  import('./diagrams/DevinArchDiagram').then((m) => ({ default: m.DevinArchDiagram })),
)
const PerplexityArchDiagram = lazy(() =>
  import('./diagrams/PerplexityArchDiagram').then((m) => ({ default: m.PerplexityArchDiagram })),
)
const GrowthEngineDiagram = lazy(() =>
  import('./diagrams/GrowthEngineDiagram').then((m) => ({ default: m.GrowthEngineDiagram })),
)

const componentMap: Record<string, React.ComponentType<Record<string, string>>> = {
  tokenizer: TokenizerDemo,
  temperature: TemperatureSampler,
  promptTester: PromptTemplateTester,
  agentLoop: AgentLoopVisualizer,
  embedding: EmbeddingExplorer,
  harnessMonitor: HarnessMonitor,
  sandboxDemo: SandboxDemo,
  multimodalDemo: MultiModalDemo,
  chunking: ChunkingVisualizer,
  ragPipeline: RAGPipelineDemo,
  contextBudget: TokenBudgetPlanner,
  toolSchema: ToolSchemaDesigner,
  memoryLayers: MemoryLayersDemo,
  graphOrchestrator: GraphStateMachine,
  topology: MultiAgentTopology,
  guardrail: GuardrailTester,
  tradeoff: TradeoffMatrix,
  costLatency: CostLatencyOptimizer,
  growthMap: GrowthMapChecklist,
  modelTiers: ModelTierTable,
  uiStateMatrix: UIStateMatrix,
  costModel: UnitEconomicsModel,
  growthFunnel: GrowthFunnelSim,
  patternSelector: PatternSelector,
  gateConfigurator: GateConfigurator,
  reActLoop: ReActLoopDiagram,
  ragPipelineDiagram: RAGPipelineDiagram,
  contextAssembly: ContextAssemblyDiagram,
  functionCalling: FunctionCallingSequence,
  circuitBreaker: CircuitBreakerDiagram,
  openSpecWorkflow: OpenSpecWorkflowDiagram,
  harnessGatePipeline: HarnessGatePipelineDiagram,
  patternMap: PatternMapDiagram,
  memoryLayersDiagram: MemoryLayersDiagram,
  langGraphState: LangGraphStateDiagram,
  hitlFlow: HITLFlowDiagram,
  multiAgentTopologyDiagram: MultiAgentTopologyDiagram,
  supervisorPattern: SupervisorPatternDiagram,
  deploymentArch: DeploymentArchDiagram,
  agentPlatform: AgentPlatformDiagram,
  cursorArch: CursorArchDiagram,
  devinArch: DevinArchDiagram,
  perplexityArch: PerplexityArchDiagram,
  growthEngine: GrowthEngineDiagram,
}

function parseInteractiveDirective(
  text: string,
): { type: string; props: Record<string, string> } | null {
  const m = text.match(/^::interactive\{([^}]+)\}$/)
  if (!m) return null
  const props: Record<string, string> = {}
  for (const part of m[1].split(/\s+/)) {
    const eq = part.indexOf('=')
    if (eq > 0) {
      const key = part.slice(0, eq)
      let val = part.slice(eq + 1)
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      props[key] = val
    }
  }
  return { type: props.type || 'unknown', props }
}

type ContentSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'interactive'; type: string; props: Record<string, string> }

function splitContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const regex = /^::interactive\{([^}]+)\}$/gm
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) {
      segments.push({ kind: 'markdown', text: content.slice(last, m.index) })
    }
    const parsed = parseInteractiveDirective(m[0])
    if (parsed) {
      segments.push({ kind: 'interactive', type: parsed.type, props: parsed.props })
    }
    last = m.index + m[0].length
  }
  if (last < content.length) {
    segments.push({ kind: 'markdown', text: content.slice(last) })
  }
  return segments.length > 0 ? segments : [{ kind: 'markdown', text: content }]
}

const sharedComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mb-6 mt-10 text-3xl font-bold text-ink-50 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-4 mt-10 text-2xl font-bold text-ink-50 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-3 mt-8 text-xl font-semibold text-ink-100" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-4 leading-relaxed text-ink-300" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-6 text-ink-300" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-ink-300" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-ink-100" {...props}>
      {children}
    </strong>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mb-4 border-l-4 border-brand-500/40 bg-brand-500/5 py-3 pl-5 pr-4 italic text-ink-300"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse border border-ink-700 text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-ink-700 bg-ink-800/50 px-4 py-2 text-left font-semibold text-ink-100"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-ink-700 px-4 py-2 text-ink-300" {...props}>
      {children}
    </td>
  ),
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt || ''}
      className="my-6 max-w-full rounded-xl border border-ink-700"
      loading="lazy"
      {...props}
    />
  ),
  code: ({ className, children, ...props }: any) => {
    const isInline = !className
    if (isInline) {
      return (
        <code
          className="rounded-md bg-ink-800/60 px-1.5 py-0.5 font-mono text-sm text-brand-300"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }: any) => {
    const codeChild = children?.props?.children
    const lang = children?.props?.className?.replace('language-', '')
    const code = typeof codeChild === 'string' ? codeChild : String(codeChild ?? '')
    return (
      <div className="mb-6">
        <CodeBlock code={code} lang={lang || 'text'} />
      </div>
    )
  },
}

interface Props {
  content: string
}

export function MarkdownRenderer({ content }: Props) {
  const segments = useMemo(() => splitContent(content), [content])

  return (
    <div className="lesson-content">
      {segments.map((seg, i) => {
        if (seg.kind === 'markdown') {
          return (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              components={sharedComponents}
            >
              {seg.text}
            </ReactMarkdown>
          )
        }
        // Interactive block placeholder — rendered by LessonPage
        return (
          <div key={i} className="my-6" data-interactive-type={seg.type}>
            <InteractiveBlock type={seg.type} props={seg.props} />
          </div>
        )
      })}
    </div>
  )
}

function InteractiveBlock({
  type,
  props,
}: {
  type: string
  props: Record<string, string>
}) {
  const Comp = componentMap[type]
  if (!Comp) {
    return (
      <div className="card border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
        交互组件 "{type}" 尚未实现。
      </div>
    )
  }
  return (
    <Suspense
      fallback={
        <div className="card animate-pulse p-8 text-center text-xs text-ink-500">加载图示…</div>
      }
    >
      <Comp {...props} />
    </Suspense>
  )
}

export { componentMap }