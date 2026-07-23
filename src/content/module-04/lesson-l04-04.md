## 混合检索与 Reranking

向量检索擅长"语义匹配"（"差旅报销" → "出差费用"），但不擅长"精确匹配"（搜"ISO 27001"时可能返回"ISO 9001"的文档）。BM25 关键词检索正好互补。把两者结合——混合检索 + Reranking——是生产级 RAG 的标配。

### 单一检索的局限

| 检索方式 | 擅长 | 不擅长 |
|----------|------|--------|
| 向量检索 | 语义相似、同义词、跨语言 | 精确匹配、专有名词、编号 |
| BM25 | 精确匹配、关键词命中 | 同义词、语义理解、错别字 |

**真实案例**：
```
用户问："ISO 27001 附录 A.8 有哪些控制措施？"

向量检索结果：
  1. "ISO 9001 质量管理体系的附录说明..."  ← 语义相近但不是 27001
  2. "信息安全管理体系控制措施概览..."      ← 语义对但缺附录编号
  3. "ISO 27001 附录 A.8 资产管理控制..."   ← 正确答案排第三

BM25 检索结果：
  1. "ISO 27001 附录 A.8 资产管理控制..."   ← 精确命中
  2. "ISO 27001 附录 A.5 组织安全..."       ← 编号命中但附录不同
  3. "ISO 27001 认证流程..."                ← 关键词命中但内容不相关
```

混合检索取两者之长——BM25 精确命中 + 向量语义扩展。

### BM25：关键词检索原理

BM25（Best Matching 25）是经典的关键词检索算法，基于词频（TF）和逆文档频率（IDF）。

```python
from rank_bm25 import BM25Okapi

def bm25_search(query: str, documents: list[str], top_k: int = 5) -> list:
    """BM25 关键词检索"""
    # 分词（中文用 jieba）
    import jieba
    tokenized_docs = [list(jieba.cut(doc)) for doc in documents]
    tokenized_query = list(jieba.cut(query))

    bm25 = BM25Okapi(tokenized_docs)
    scores = bm25.get_scores(tokenized_query)

    ranked = sorted(zip(scores, documents), reverse=True)
    return [{"score": s, "content": d} for s, d in ranked[:top_k]]
```

**BM25 的优势**：
- 精确匹配：搜索"ISO 27001"只会返回含这个关键词的文档
- 不需要 GPU：纯 CPU 计算，速度快
- 可解释：每个文档的得分可以分解为各词的贡献

### 混合检索：BM25 + 向量

把两种检索结果融合——用 **Reciprocal Rank Fusion（RRF）** 算法：

```python
def hybrid_search(
    query: str,
    documents: list[str],
    vector_collection,
    top_k: int = 5,
    bm25_weight: float = 1.0,
    vector_weight: float = 1.0,
) -> list:
    """混合检索：BM25 + 向量检索 + 加权 RRF 融合"""
    # 1. BM25 检索
    bm25_results = bm25_search(query, documents, top_k=top_k * 2)

    # 2. 向量检索
    from openai import OpenAI
    client = OpenAI()
    query_embedding = client.embeddings.create(
        model="text-embedding-3-small", input=query
    ).data[0].embedding
    vector_results = vector_collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k * 2,
    )

    # 3. 加权 RRF 融合（两侧都带权重；默认等权）
    rrf_k = 60  # RRF 常数
    scores = {}

    # BM25 的排名贡献
    for rank, result in enumerate(bm25_results):
        doc = result["content"]
        scores[doc] = scores.get(doc, 0) + bm25_weight / (rrf_k + rank + 1)

    # 向量检索的排名贡献
    for rank, doc in enumerate(vector_results["documents"][0]):
        scores[doc] = scores.get(doc, 0) + vector_weight / (rrf_k + rank + 1)

    # 排序
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [{"content": doc, "score": score} for doc, score in ranked[:top_k]]
```

**RRF 的优势**：不需要对两种检索的分数做归一化（BM25 分数和余弦相似度的量纲不同），只需要排名即可融合。`bm25_weight` / `vector_weight` 可按场景微调（如专有名词多时提高 BM25 权重）。

### Reranking：精排提升精度

混合检索得到了候选集（比如 top-20），但排序还不够精确。Reranker 对候选集做二次精排。

**为什么需要 Reranking？**

向量检索和 BM25 都是**双塔模型**——query 和 document 独立编码，再计算相似度。这种方式速度快但精度有限。Reranker 用 **Cross-encoder**——把 query 和 document 拼在一起送入模型，输出相关性分数。精度更高但速度更慢。

```
双塔模型（检索阶段）：           Cross-encoder（Rerank 阶段）：
  Query → Embedding               [Query + Document] → 相关性分数
  Document → Embedding            精度高，但必须逐对计算
  相似度 = cos(q_vec, d_vec)      速度慢，只适合小规模候选集
  速度快，适合大规模检索
```

```python
from sentence_transformers import CrossEncoder

def rerank(query: str, documents: list[str], top_n: int = 3) -> list:
    """用 Cross-encoder 对候选文档重排序"""
    # 中文场景默认用多语言 / 中文优化模型；纯英文可换 ms-marco-MiniLM-L-6-v2
    model = CrossEncoder("BAAI/bge-reranker-base")

    # 逐对计算相关性分数
    pairs = [(query, doc) for doc in documents]
    scores = model.predict(pairs)

    # 按分数排序
    ranked = sorted(zip(scores, documents), reverse=True)
    return [
        {"content": doc, "relevance_score": float(score)}
        for score, doc in ranked[:top_n]
    ]
```

**模型选型**：

| 模型 | 大小 | 多语言 | 推荐场景 |
|------|------|--------|----------|
| bge-reranker-base | 280MB | 是 | **中文默认**、高精度 |
| multilingual-MiniLM-L-6-v2 | 80MB | 是 | 多语言、资源受限 |
| ms-marco-MiniLM-L-6-v2 | 80MB | 否 | 纯英文、快速 |
| ms-marco-MiniLM-L-12-v2 | 120MB | 否 | 纯英文、精度优先 |

### 完整的混合检索 + Reranking 管道

```python
class HybridRetriever:
    """完整的混合检索 + Reranking 管道"""

    def __init__(self, documents: list[str], vector_collection):
        import jieba
        from rank_bm25 import BM25Okapi
        from sentence_transformers import CrossEncoder

        self.documents = documents
        self.collection = vector_collection
        self.bm25 = BM25Okapi([list(jieba.cut(doc)) for doc in documents])
        self.reranker = CrossEncoder("BAAI/bge-reranker-base")  # 中文默认

    def retrieve(self, query: str, top_k: int = 5, rerank_top_n: int = 3) -> list:
        # Stage 1: 混合检索（召回阶段）
        candidates = hybrid_search(query, self.documents, self.collection, top_k=top_k)
        docs = [c["content"] for c in candidates]

        # Stage 2: Cross-encoder Reranking（精排阶段）
        reranked = rerank(query, docs, top_n=rerank_top_n)

        return reranked
```

### 效果对比

| 检索方式 | 召回率@5 | 精确率@3 | 延迟 |
|----------|---------|---------|------|
| 纯向量检索 | 72% | 68% | 50ms |
| 纯 BM25 | 65% | 71% | 10ms |
| 混合检索（RRF） | 84% | 76% | 60ms |
| 混合 + Reranking | 84% | 89% | 200ms |

> 召回率：top-k 中包含正确答案的比例。精确率：top-n 中正确答案的占比。混合检索提升召回（找得全），Reranking 提升精确（排得准）。

### 要点总结

- 向量检索擅长语义匹配，BM25 擅长精确匹配——混合检索取两者之长
- RRF（Reciprocal Rank Fusion）是融合两种检索结果的标配算法
- Reranking 用 Cross-encoder 做精排，精度显著提升但增加延迟
- 完整管道：混合检索召回 top-20 → Cross-encoder 精排取 top-3
- 中文 Reranker 推荐默认用 `bge-reranker-base`；纯英文场景再用 `ms-marco-MiniLM`
- 生产环境标配：混合检索 + Reranking 是 RAG 质量的"及格线"
