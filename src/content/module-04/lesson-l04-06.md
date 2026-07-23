## 高级 RAG 范式

Naive RAG 是"检索一次，生成一次"的固定管道。但真实场景中，用户的问题可能需要多步检索、可能检索结果不够好需要修正、可能需要理解文档间的实体关系。高级 RAG 范式就是解决这些"Naive RAG 不够用"的场景。

### 范式全景

```
Naive RAG      →  检索一次，生成一次（固定管道）
Self-RAG       →  模型自己决定"要不要检索"（自适应）
CRAG           →  检索质量不好？自动修正（纠错）
Graph RAG       →  用知识图谱替代平面文档（结构化）
Agentic RAG    →  LLM 作为检索 Agent，多步推理+检索（自主）
```

### Self-RAG：模型自己决定要不要检索

Naive RAG 对每个问题都检索——但"你好"这种闲聊不需要检索。Self-RAG 让模型自己判断：这个问题需要检索吗？检索结果够好吗？

> **说明**：原论文 Self-RAG（Asai et al.）通过微调让模型生成 reflection token。下面是**教学简化版**——用额外 LLM 调用模拟「是否检索 / 是否相关」的决策，便于理解思路，无需微调。

```
用户问题 → [模型判断：需要检索吗？]
              ├─ 是 → 检索 → [检索结果相关吗？] → 是 → 基于检索生成
              │                              → 否 → 用自身知识回答
              └─ 否 → 直接回答（无需检索）
```

```python
def self_rag_query(question: str, collection, client) -> str:
    """Self-RAG：模型决定是否检索"""
    # Step 1: 判断是否需要检索
    judge_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"判断以下问题是否需要检索知识库才能回答。只输出 yes 或 no。\n\n问题：{question}",
        }],
        temperature=0,
        max_tokens=5,
    )
    need_retrieval = judge_response.choices[0].message.content.strip().lower() == "yes"

    if not need_retrieval:
        # 不需要检索，直接回答
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": question}],
        )
        return f"[直接回答] {response.choices[0].message.content}"

    # Step 2: 检索
    query_embedding = client.embeddings.create(
        model="text-embedding-3-small", input=question
    ).data[0].embedding
    results = collection.query(query_embeddings=[query_embedding], n_results=3)
    context = "\n\n".join(results["documents"][0])

    # Step 3: 判断检索结果是否相关
    relevance_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"判断以下检索结果是否能回答问题。只输出 relevant 或 irrelevant。\n\n问题：{question}\n\n检索结果：{context[:500]}",
        }],
        temperature=0,
        max_tokens=10,
    )
    is_relevant = "relevant" in relevance_response.choices[0].message.content.lower()

    if not is_relevant:
        # 检索不相关，用自身知识回答（并标注）
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": question}],
        )
        return f"[检索不相关，使用模型知识] {response.choices[0].message.content}"

    # Step 4: 基于检索结果生成
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"基于以下资料回答：\n{context}"},
            {"role": "user", "content": question},
        ],
        temperature=0,
    )
    return f"[基于检索] {response.choices[0].message.content}"
```

**适用场景**：混合型对话（有时需要查知识库，有时是闲聊）、节省检索成本。

### CRAG：检索质量纠错

CRAG（Corrective RAG）在检索后加一步"质量评估"——如果检索结果质量不好，用网络搜索补充。

```
用户问题 → 检索 → [检索质量评估]
                      ├─ 好 → 直接用于生成
                      ├─ 差 → 用网络搜索补充 → 合并生成
                      └─ 模糊 → 检索 + 网络搜索 → 合并生成
```

```python
def crag_query(question: str, collection, web_search_fn, client) -> str:
    """Corrective RAG：检索质量不好时自动修正"""
    # Step 1: 知识库检索
    query_embedding = client.embeddings.create(
        model="text-embedding-3-small", input=question
    ).data[0].embedding
    kb_results = collection.query(query_embeddings=[query_embedding], n_results=3)
    kb_context = "\n\n".join(kb_results["documents"][0])

    # Step 2: 评估检索质量
    eval_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"评估以下检索结果对回答问题的帮助程度。输出 high/low/ambivalent。\n\n问题：{question}\n\n检索结果：{kb_context[:500]}",
        }],
        temperature=0,
        max_tokens=10,
    )
    quality = eval_response.choices[0].message.content.strip().lower()

    # Step 3: 根据质量决定后续策略
    if "high" in quality:
        context = kb_context
    elif "low" in quality:
        # 检索质量差，用网络搜索补充
        web_results = web_search_fn(question)
        context = web_results
    else:
        # 模糊，两者都用
        web_results = web_search_fn(question)
        context = kb_context + "\n\n---网络搜索---\n" + web_results

    # Step 4: 生成回答
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"基于以下资料回答。如果资料不足，说明缺什么。\n\n{context}"},
            {"role": "user", "content": question},
        ],
        temperature=0,
    )
    return response.choices[0].message.content
```

**适用场景**：知识库覆盖不全、需要实时信息补充的场景。

### Graph RAG：知识图谱融合

平面文档检索的问题是——它不知道文档间的实体关系。比如"A 公司收购了 B 公司"和"B 公司的产品 C 存在安全漏洞"，平面检索很难把两条独立文档关联起来。Graph RAG 用知识图谱建模实体关系。

```
传统 RAG：                    Graph RAG：

文档 A: "A收购了B"             A --收购--> B --生产--> C --有--> 漏洞
文档 B: "B的产品C有漏洞"       ↑ 实体和关系构成图谱
↑ 两条独立文档，互不关联        ↑ 可以沿图谱路径推理
```

Graph RAG 的核心步骤：

1. **实体抽取**：从文档中抽取实体（人、公司、产品等）和关系
2. **图谱构建**：构建实体-关系图
3. **社区发现**：用图算法（如 Leiden）把图谱分成"社区"（主题聚类）
4. **社区摘要**：用 LLM 为每个社区生成摘要
5. **检索+生成**：查询时先匹配社区摘要，再深入具体实体

```python
def build_graph_rag(documents: list[str], client) -> dict:
    """简化版 Graph RAG 构建"""
    entities = []
    relations = []

    for doc in documents:
        # 用 LLM 抽取实体和关系
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""从以下文档中抽取实体和关系，输出 JSON：
{{
  "entities": [{{"name": "实体名", "type": "person|company|product|concept"}}],
  "relations": [{{"source": "实体A", "relation": "关系", "target": "实体B"}}]
}}

文档：{doc}""",
            }],
            temperature=0,
            response_format={"type": "json_object"},
        )
        import json
        data = json.loads(response.choices[0].message.content)
        entities.extend(data.get("entities", []))
        relations.extend(data.get("relations", []))

    return {"entities": entities, "relations": relations}
```

**适用场景**：需要理解实体关系的场景（如企业情报分析、法律案例推理、科研文献综述）。

### Agentic RAG：LLM 作为检索 Agent

最前沿的范式——把 LLM 当作"检索 Agent"，它自己决定：搜什么、搜几次、什么时候停。Agentic RAG 本质上是 M5 的 ReAct 范式应用到检索任务上。

```
用户问题："对比 A 公司和 B 公司的 AI 战略"

Agentic RAG 的执行过程：
  Thought: 需要分别搜索 A 公司和 B 公司的 AI 战略
  Action: search("A 公司 AI 战略 2024")
  Observation: A 公司聚焦通用大模型...

  Thought: 现在搜索 B 公司
  Action: search("B 公司 AI 战略 2024")
  Observation: B 公司专注行业垂直 AI...

  Thought: 已获取两家公司信息，可以生成对比
  Answer: A 公司聚焦通用大模型，B 公司专注行业垂直 AI...
```

```python
def agentic_rag(question: str, search_fn, client, max_steps: int = 5) -> str:
    """Agentic RAG：LLM 自主决定检索策略"""
    messages = [{
        "role": "system",
        "content": """你是一个研究助手。你可以使用 search 工具检索信息。
每次检索后，判断是否已有足够信息回答问题。
如果不够，继续检索；如果够了，直接回答。

调用工具格式：SEARCH: <查询词>
回答格式：ANSWER: <回答>""",
    }, {
        "role": "user",
        "content": question,
    }]

    for step in range(max_steps):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0,
            max_tokens=500,
        )
        reply = response.choices[0].message.content

        if reply.startswith("ANSWER:"):
            return reply[7:].strip()

        if "SEARCH:" in reply:
            # 提取搜索查询
            query = reply.split("SEARCH:")[1].strip()
            results = search_fn(query)
            messages.append({"role": "assistant", "content": reply})
            messages.append({"role": "user", "content": f"检索结果：\n{results}"})
        else:
            messages.append({"role": "assistant", "content": reply})
            messages.append({"role": "user", "content": "请继续。使用 SEARCH: 检索或 ANSWER: 回答。"})

    return "达到最大步数限制，无法完整回答。"
```

**适用场景**：复杂问题（需要多步检索）、对比分析、开放性研究问题。

### 五种范式对比

| 范式 | 核心思想 | 适用场景 | 成本 | 复杂度 |
|------|----------|----------|------|--------|
| Naive RAG | 检索一次生成一次 | 简单问答 | 低 | 低 |
| Self-RAG | 自适应决定是否检索 | 混合对话（闲聊+问答） | 中 | 中 |
| CRAG | 检索质量纠错 | 知识库不完整、需实时补充 | 中 | 中 |
| Graph RAG | 知识图谱融合 | 实体关系推理 | 高 | 高 |
| Agentic RAG | LLM 自主多步检索 | 复杂研究、对比分析 | 高 | 高 |

**选型建议**：
- 从 Naive RAG 起步，用 RAGAS 评估发现问题
- 检索不准 → 加 Reranking（L04-04）
- 闲聊混问答 → 升级 Self-RAG
- 知识库不全 → 升级 CRAG
- 需要实体关系 → 升级 Graph RAG
- 需要多步研究 → 升级 Agentic RAG

### 要点总结

- Naive RAG 是固定管道；高级范式让 RAG 变得"自适应"和"可纠错"
- Self-RAG：模型自己决定要不要检索（省成本、避免无意义检索）
- CRAG：检索质量不好时自动补充网络搜索（纠错能力）
- Graph RAG：用知识图谱建模实体关系，支持跨文档推理（结构化优势）
- Agentic RAG：LLM 作为检索 Agent，自主决定搜什么、搜几次（最灵活但最贵）
- 不是越高级越好——从 Naive 起步，用 RAGAS 诊断瓶颈，按需升级
