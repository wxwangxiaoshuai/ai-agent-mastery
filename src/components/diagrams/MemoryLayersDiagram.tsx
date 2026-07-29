/**
 * 记忆四层路由静态图 —— M8 Agent 记忆系统
 * 工作记忆 → 短期记忆 → 长期记忆 → 程序记忆
 */
import { ArchitectureDiagram, type DiagramLayer, type DiagramNode, type DiagramEdge } from './ArchitectureDiagram'

const layers: DiagramLayer[] = [
  { id: 'l1', label: '工作记忆（Working Memory）—— 当前对话', y: 5, height: 7, color: 'brand' },
  { id: 'l2', label: '短期记忆（Short-term）—— 摘要 + 滑动窗口', y: 13, height: 7, color: 'emerald' },
  { id: 'l3', label: '长期记忆（Long-term）—— 向量库 + 结构化存储', y: 21, height: 7, color: 'amber' },
  { id: 'l4', label: '程序记忆（Procedural）—— Skill 库 + 经验', y: 29, height: 7, color: 'fuchsia' },
]

const nodes: DiagramNode[] = [
  { id: 'user', label: '用户\n输入', x: 5, y: 7, color: 'ink' },
  { id: 'retrieve', label: '检索\n相关记忆', x: 22, y: 7, color: 'brand' },
  { id: 'assemble', label: '组装\n上下文', x: 39, y: 7, color: 'brand' },
  { id: 'llm', label: 'LLM\n推理', x: 56, y: 7, color: 'brand' },
  { id: 'extract', label: '提取\n关键信息', x: 73, y: 7, color: 'emerald' },
  { id: 'summarize', label: '生成\n摘要', x: 73, y: 15, color: 'emerald' },
  { id: 'store_lt', label: '持久化\n长期记忆', x: 73, y: 23, color: 'amber' },
  { id: 'skill', label: '沉淀\nSkill', x: 73, y: 31, color: 'fuchsia' },
  { id: 'compressor', label: '压缩\n旧对话', x: 56, y: 15, color: 'emerald' },
  { id: 'vec_db', label: '向量\n数据库', x: 39, y: 23, color: 'amber' },
  { id: 'skill_db', label: 'Skill\n注册表', x: 39, y: 31, color: 'fuchsia' },
]

const edges: DiagramEdge[] = [
  { from: 'user', to: 'retrieve', label: '输入' },
  { from: 'retrieve', to: 'assemble', label: '注入' },
  { from: 'assemble', to: 'llm', label: '推理' },
  { from: 'llm', to: 'extract', label: '输出' },
  { from: 'extract', to: 'summarize', label: '值得记' },
  { from: 'summarize', to: 'store_lt', label: '持久化' },
  { from: 'extract', to: 'skill', label: '可复用' },
  { from: 'llm', to: 'compressor', label: '旧对话', dashed: true },
  { from: 'compressor', to: 'summarize', label: '摘要', dashed: true },
  { from: 'vec_db', to: 'retrieve', label: '查询', dashed: true },
  { from: 'skill_db', to: 'retrieve', label: '加载', dashed: true },
  { from: 'store_lt', to: 'vec_db', label: '写入' },
  { from: 'skill', to: 'skill_db', label: '注册' },
]

export function MemoryLayersDiagram() {
  return (
    <ArchitectureDiagram
      title="记忆四层路由"
      description="用户输入 → 检索相关记忆注入上下文 → LLM 推理 → 提取关键信息分流到短期/长期/程序记忆。"
      layers={layers}
      nodes={nodes}
      edges={edges}
      height={430}
    />
  )
}