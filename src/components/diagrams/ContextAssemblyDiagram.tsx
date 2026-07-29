/**
 * Context 组装流程图 —— M3 上下文工程
 *
 * 布局策略：泳道仅作装饰背景（不挂 parentId），六源用贝塞尔汇入中枢，
 * 再水平流向预算/输出，避免跨层正交折线被误读成中间层横向连线。
 */
import { DiagramShell, n, e, g } from './_shared'

const W = 780

const nodes = [
  g('lane-static', '静态底座', 0, 0, W, 118, 'brand'),
  g('lane-dyn', '动态注入', 0, 130, W, 118, 'emerald'),
  g('lane-out', '组装与输出', 0, 330, W, 140, 'amber'),

  // Absolute coords — no parentId (critical for clean fan-in routing)
  n('sys', 'System\nPrompt', 70, 42, { color: 'brand', caption: 'static', height: 64 }),
  n('rules', '项目约定', 310, 42, { color: 'brand', caption: 'static', height: 64 }),
  n('tools', '工具定义', 550, 42, { color: 'brand', caption: 'static', height: 64 }),

  n('history', '对话历史', 70, 172, { color: 'emerald', caption: 'dynamic', height: 56 }),
  n('rag', 'RAG 检索', 310, 172, { color: 'emerald', caption: 'dynamic', height: 56 }),
  n('user', '用户输入', 550, 172, { color: 'emerald', caption: 'dynamic', height: 56 }),

  n('merge', '六源汇入', 310, 262, {
    color: 'amber',
    emphasis: 'hub',
    width: 150,
    height: 56,
    caption: 'merge',
  }),

  n('priority', '优先级\n排序', 120, 368, { color: 'amber', height: 64 }),
  n('budget', 'Token\n预算', 320, 368, { color: 'amber', height: 64 }),
  n('output', '最终\nContext', 530, 368, { color: 'ink', emphasis: 'output', height: 64 }),
]

const edges = [
  // Fan-in with bezier — no per-edge labels (avoids mid-lane clutter)
  e('sys', 'merge', {
    id: 'sys-m',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('rules', 'merge', {
    id: 'rules-m',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('tools', 'merge', {
    id: 'tools-m',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'brand',
  }),
  e('history', 'merge', {
    id: 'hist-m',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'emerald',
  }),
  e('rag', 'merge', {
    id: 'rag-m',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'emerald',
  }),
  e('user', 'merge', {
    id: 'user-m',
    fromSide: 's',
    toSide: 'n',
    curve: 'bezier',
    accent: 'emerald',
  }),

  e('merge', 'priority', {
    label: '汇入',
    fromSide: 's',
    toSide: 'n',
    accent: 'amber',
  }),
  e('priority', 'budget', { label: '排序', accent: 'amber' }),
  e('budget', 'output', { label: '裁剪', accent: 'ink' }),
]

export function ContextAssemblyDiagram() {
  return (
    <DiagramShell
      title="Context 组装流程"
      description="静态底座（System Prompt / 约定 / 工具定义）与动态注入（历史 / RAG / 用户输入）六源并行汇入 → 优先级排序 → Token 预算裁剪 → 最终 Context。"
      height={520}
      nodes={nodes}
      edges={edges}
      fitViewPadding={0.1}
    />
  )
}
