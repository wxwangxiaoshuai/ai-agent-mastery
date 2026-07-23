## RAG 全景与架构范式

LLM 的知识停留在训练数据截止日。问它"公司最新的差旅政策"，它会"幻觉"一个看似合理但完全不存在的答案。RAG（Retrieval-Augmented Generation，检索增强生成）就是解决这个问题的——**让模型先"翻书"再回答**。

### RAG 的本质：开卷考试

把 LLM 想象成一个参加考试的学生：
- **不用 RAG**：闭卷考试——只能靠记忆（训练数据），遇到没学过的题就编答案（幻觉）
- **用 RAG**：开卷考试——先翻到相关章节（检索），再基于书上的内容答题（生成）

```
用户提问 → [检索相关文档] → [把文档塞进 Prompt] → [模型基于文档回答]
              ↑ 检索              ↑ 上下文组装          ↑ 生成
```

### Naive RAG：最简管道

最基础的 RAG 就是三步：索引 → 检索 → 生成。

```
离线阶段（索引）：
  文档 → 分块 → Embedding → 存入向量数据库

在线阶段（检索+生成）：
  用户问题 → Embedding → 向量数据库检索 top-k → 拼入 Prompt → LLM 生成回答
```

**Python 最小实现**：

```python
from openai import OpenAI
import chromadb

client = OpenAI()
db = chromadb.PersistentClient(path="./rag_db")
collection = db.get_or_create_collection("docs")

# --- 离线：索引阶段 ---
def index_document(text: str, chunk_size: int = 500):
    """把文档分块并索引"""
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    for i, chunk in enumerate(chunks):
        embedding = client.embeddings.create(
            model="text-embedding-3-small", input=chunk
        ).data[0].embedding
        collection.add(
            ids=[f"chunk_{i}"],
            embeddings=[embedding],
            documents=[chunk],
        )

# --- 在线：检索+生成 ---
def rag_query(question: str, top_k: int = 3) -> str:
    """检索相关文档并生成回答"""
    # 1. 检索
    query_embedding = client.embeddings.create(
        model="text-embedding-3-small", input=question
    ).data[0].embedding
    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)
    context = "\n\n".join(results["documents"][0])

    # 2. 生成
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"基于以下参考资料回答问题。如果资料中没有答案，说'根据现有资料无法回答'。\n\n参考资料：\n{context}"},
            {"role": "user", "content": question},
        ],
        temperature=0,
    )
    return response.choices[0].message.content
```

这就是 RAG 的最小骨架——30 行代码就能跑通。但生产级 RAG 远不止于此。

### Naive RAG 的典型失败模式

| 失败模式 | 症状 | 根因 |
|----------|------|------|
| 检索不到 | 模型说"无法回答"，但文档中明明有相关信息 | 分块太大/太小、Embedding 质量差、查询词与文档表述不一致 |
| 检索到但不相关 | 模型基于不相关内容生成错误答案 | top-k 太大、没有 Reranking、相似度阈值未设 |
| 检索到了但模型忽略 | 模型"明知故犯"，不用检索结果 | Prompt 未强调"必须基于参考资料"、上下文太长导致"Lost in Middle" |
| 检索结果冲突 | 两段文档说法矛盾，模型随机选一个 | 缺少来源标注、缺少时间排序、没有冲突检测 |

> 这些失败模式不是"RAG 不行"，而是 Naive RAG 的设计缺陷。Advanced RAG 和 Modular RAG 就是为解决这些问题而生的。

### Advanced RAG：检索前后双优化

Advanced RAG 在 Naive 的基础上，在检索前（Pre-retrieval）和检索后（Post-retrieval）各加了一层优化：

```
              ┌─── Pre-retrieval ───┐    ┌─── Post-retrieval ───┐
用户问题 → [查询改写/扩展] → [检索] → [去重/Reranking/压缩] → [生成]
              ↑ 提升检索质量           ↑ 提升上下文质量
```

**Pre-retrieval 优化**：

```python
def rewrite_query(question: str) -> str:
    """查询改写：把口语化问题改写为检索友好的关键词"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"把以下问题改写为适合向量检索的查询语句（保留关键实体和概念）：\n{question}",
        }],
        temperature=0,
        max_tokens=100,
    )
    return response.choices[0].message.content

# 原始问题："差旅报销最多能报多少？"
# 改写后："差旅报销标准 限额 报销金额上限"
```

**Post-retrieval 优化**：

```python
def rerank_results(question: str, docs: list, top_n: int = 3) -> list:
    """用 Cross-encoder 对检索结果重排序"""
    from sentence_transformers import CrossEncoder
    reranker = CrossEncoder("BAAI/bge-reranker-base")  # 中文默认
    scores = reranker.predict([(question, doc) for doc in docs])
    ranked = sorted(zip(scores, docs), reverse=True)
    return [doc for _, doc in ranked[:top_n]]
```

### Modular RAG：可插拔的组件架构

Modular RAG 把 RAG 拆成独立可替换的组件：

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Retriever   │ →  │   Reranker    │ →  │   Generator   │
│  (检索器)     │     │  (重排器)     │     │  (生成器)     │
└──────────────┘     └──────────────┘     └──────────────┘
       ↑                    ↑                    ↑
       │                    │                    │
  可替换为：            可替换为：            可替换为：
  · 向量检索            · Cross-encoder       · GPT-4o
  · BM25                · Cohere Rerank       · Claude
  · 混合检索             · LLM Rerank          · 本地模型
  · 图谱检索            · 多模型融合           · 流式生成
```

**核心组件**：

| 组件 | 职责 | 可选项 |
|------|------|--------|
| Router | 判断是否需要检索、检索哪个库 | 规则路由、LLM 路由 |
| Retriever | 从知识库检索相关文档 | 向量、BM25、混合、图谱 |
| Reranker | 对检索结果重排序 | Cross-encoder、Cohere、LLM |
| Generator | 基于上下文生成回答 | 任意 LLM |
| Memory | 记住历史检索和对话 | 向量记忆、摘要记忆 |

> Modular RAG 的价值在于"可演进"——你可以从 Naive RAG 起步，随着需求复杂化，逐步加入 Router、Reranker、Memory 等组件，不需要推翻重来。

### RAG vs 微调 vs 长上下文

| 维度 | RAG | 微调 | 长上下文（直接塞全文） |
|------|-----|------|----------------------|
| 知识更新 | 实时（更新数据库即可） | 需要重新训练 | 取决于文档更新 |
| 成本 | 每次检索+生成 | 一次性训练成本 | 高（每次都塞全文） |
| 准确性 | 高（有引用来源） | 中（可能幻觉） | 中（Lost in Middle） |
| 适用场景 | 动态知识、大文档库 | 固定领域知识、风格定制 | 小文档（<50 页） |
| 可解释性 | 高（可追溯检索来源） | 低 | 中 |

**黄金法则**：知识用 RAG，行为用微调，小文档用长上下文。三者不互斥，可以组合使用。

### RAG 的数据流图

完整的 RAG 数据流（含离线索引和在线查询）：

```
离线索引：
  原始文档 → 文档解析(PDF/HTML/Markdown) → 分块(Chunking)
           → Embedding → 存入向量数据库 + 全文索引

在线查询：
  用户问题 → 查询改写 → [向量检索 + BM25检索] → 混合排序
           → Reranking → 上下文组装 → LLM 生成 → 引用标注 → 返回用户
```

### 要点总结

- RAG = 开卷考试：先检索相关文档，再基于文档生成回答
- Naive RAG 三步走：索引 → 检索 → 生成，30 行代码可跑通
- 四类典型失败：检索不到、检索不相关、模型忽略、结果冲突
- Advanced RAG 在检索前后加优化：查询改写、Reranking、去重压缩
- Modular RAG 把 RAG 拆成可替换组件：Router → Retriever → Reranker → Generator
- RAG vs 微调 vs 长上下文：知识用 RAG，行为用微调，小文档用长上下文
- 后续 5 节课会深入每个环节：分块（L04-02）→ Embedding（L04-03）→ 混合检索（L04-04）→ 评估（L04-05）→ 前沿范式（L04-06）
