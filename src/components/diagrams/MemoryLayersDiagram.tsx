/**
 * 记忆四层路由静态图 —— M8 Agent 记忆系统
 */
import { DiagramShell, n, e, g } from './_shared'

const nodes = [
  g('lane-l1', '工作记忆 —— 当前对话 · 容量≈上下文窗口 · TTL=会话内', 0, 0, 860, 110, 'brand'),
  g('lane-l2', '短期记忆 —— 摘要+滑动窗口 · 容量≈N 轮 · TTL=天级', 0, 130, 860, 110, 'emerald'),
  g('lane-l3', '长期记忆 —— 向量库 · 容量≈∞ · TTL=永久', 0, 260, 860, 110, 'amber'),
  g('lane-l4', '程序记忆 —— Skill 库 · 容量≈技能数 · TTL=版本化永久', 0, 390, 860, 110, 'fuchsia'),
  n('user', '用户\n输入', 20, 40, { color: 'ink', parentId: 'lane-l1' }),
  n('retrieve', '检索\n相关记忆', 180, 40, { color: 'brand', parentId: 'lane-l1' }),
  n('assemble', '组装\n上下文', 360, 40, { color: 'brand', parentId: 'lane-l1' }),
  n('llm', 'LLM\n推理', 540, 40, { color: 'brand', parentId: 'lane-l1' }),
  n('extract', '提取\n关键信息', 720, 40, { color: 'brand', parentId: 'lane-l1' }),
  n('summarize', '生成\n摘要', 720, 40, { color: 'emerald', parentId: 'lane-l2' }),
  n('short_buf', '滑动\n窗口', 520, 40, { color: 'emerald', parentId: 'lane-l2' }),
  n('store_lt', '持久化\n长期记忆', 720, 40, { color: 'amber', parentId: 'lane-l3' }),
  n('vec_db', '向量\n数据库', 400, 40, { color: 'amber', parentId: 'lane-l3' }),
  n('skill', '沉淀\nSkill', 720, 40, { color: 'fuchsia', parentId: 'lane-l4' }),
  n('skill_db', 'Skill\n注册表', 400, 40, { color: 'fuchsia', parentId: 'lane-l4' }),
]

const edges = [
  e('user', 'retrieve', { label: '输入' }),
  e('retrieve', 'assemble', { label: '注入' }),
  e('assemble', 'llm', { label: '推理' }),
  e('llm', 'extract', { label: '输出' }),
  e('extract', 'summarize', { label: '值得记', fromSide: 's', toSide: 'n' }),
  e('summarize', 'short_buf', { label: '写入短期' }),
  e('short_buf', 'assemble', { label: '下轮注入', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'short-read' }),
  e('summarize', 'store_lt', { label: '升格长期', sourceHandle: 'b', targetHandle: 't' }),
  e('store_lt', 'vec_db', { label: '写入' }),
  e('vec_db', 'retrieve', { label: '查询', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'vec-read' }),
  e('extract', 'skill', {
    label: '可复用',
    fromSide: 'e',
    toSide: 'e',
    curve: 'bezier',
    accent: 'fuchsia',
    id: 'ex-skill',
  }),
  e('skill', 'skill_db', { label: '注册' }),
  e('skill_db', 'retrieve', { label: '查询', dashed: true, sourceHandle: 't', targetHandle: 'b', id: 'skill-read' }),
]

export function MemoryLayersDiagram() {
  return (
    <DiagramShell
      title="记忆四层路由"
      description="用户输入 → 从长期/程序记忆检索并注入工作上下文 → LLM 推理 → 提取关键信息分流到短期摘要、长期向量库与 Skill 库。每层标注容量上限与 TTL。"
      height={560}
      nodes={nodes}
      edges={edges}
    />
  )
}
