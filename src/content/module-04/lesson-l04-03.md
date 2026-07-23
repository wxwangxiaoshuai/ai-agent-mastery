## Embedding 与向量检索深度

分块解决了"怎么切"，Embedding 解决"怎么搜"。Embedding 把文本变成向量，让计算机能计算"语义相似度"——"差旅报销"和"出差费用"在向量空间里是近邻，即使没有一个字相同。

### Embedding 是什么

Embedding 是一段文本的**向量表示**——通常是一个 768 到 3072 维的浮点数数组。语义相近的文本，向量距离也近。

```python
from openai import OpenAI
client = OpenAI()

def embed(text: str) -> list[float]:
    """获取文本的 Embedding 向量"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding

# 语义相似的句子，向量距离（余弦相似度）更近
import math

def cosine_similarity(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x*x for x in a)) * math.sqrt(sum(y*y for y in b))
    return dot / norm

v1 = embed("差旅报销标准")
v2 = embed("出差的费用怎么报销")
v3 = embed("公司团建活动")

print(f"'差旅报销标准' vs '出差费用报销': {cosine_similarity(v1, v2):.3f}")  # ~0.85
print(f"'差旅报销标准' vs '公司团建活动': {cosine_similarity(v1, v3):.3f}")  # ~0.40
```

### Embedding 模型选型

| 模型 | 厂商 | 维度 | 中文支持 | 价格 | 推荐场景 |
|------|------|------|----------|------|----------|
| text-embedding-3-small | OpenAI | 1536 | 良好 | $0.02/M | 默认选择，性价比高 |
| text-embedding-3-large | OpenAI | 3072 | 良好 | $0.13/M | 精度要求高 |
| embed-v3 | Cohere | 1024 | 优秀 | $0.10/M | 多语言场景 |
| bge-m3 | 智源 | 1024 | 优秀 | 免费（开源） | 私有部署、中文优化 |
| jina-embeddings-v3 | Jina | 1024 | 良好 | 免费（开源） | 长文本支持好 |

**选型建议**：
- 起步用 OpenAI `text-embedding-3-small`——便宜、效果好、生态成熟
- 中文为主且需私有部署：用 `bge-m3`
- 切换 Embedding 模型后**必须重新索引全部文档**——不同模型的向量空间不兼容

### 向量数据库对比

向量数据库存储 Embedding 向量，并提供高效的相似度检索。

| 数据库 | 类型 | 部署方式 | 适合规模 | 特点 |
|--------|------|----------|----------|------|
| Chroma | 嵌入式 | 本地文件 | <100 万 | 最简单，pip install 即用 |
| Qdrant | 独立服务 | Docker/云 | <1 亿 | 性能好，支持过滤 |
| Milvus | 分布式 | K8s/云 | >1 亿 | 超大规模，企业级 |
| pgvector | PostgreSQL 扩展 | 数据库 | <1000 万 | 与业务数据同库，事务一致 |
| Pinecone | 云托管 | SaaS | 任意 | 零运维，按量付费 |

**选型建议**：
- 原型阶段用 **Chroma**（零配置）
- 生产中小规模用 **Qdrant**（Docker 部署，性能好）
- 已有 PostgreSQL 用 **pgvector**（不引入新组件）
- 超大规模用 **Milvus**

### Chroma 快速上手

```python
import chromadb

# 创建客户端（数据持久化到本地目录）
client = chromadb.PersistentClient(path="./vector_db")

# 创建 collection（类似数据库表）
collection = client.get_or_create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"},  # 使用余弦相似度
)

# --- 索引阶段 ---
def index_documents(documents: list[str], metadatas: list[dict] = None):
    """批量索引文档"""
    from openai import OpenAI
    oa = OpenAI()

    # 批量获取 Embedding
    embeddings = oa.embeddings.create(
        model="text-embedding-3-small",
        input=documents,
    ).data

    collection.add(
        ids=[f"doc_{i}" for i in range(len(documents))],
        embeddings=[e.embedding for e in embeddings],
        documents=documents,
        metadatas=metadatas or [{} for _ in documents],
    )

# --- 检索阶段 ---
def search(query: str, top_k: int = 5, where: dict = None) -> list:
    """向量检索"""
    from openai import OpenAI
    oa = OpenAI()

    query_embedding = oa.embeddings.create(
        model="text-embedding-3-small", input=query
    ).data[0].embedding

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,  # 可选：按 metadata 过滤
    )

    return [
        {"content": doc, "distance": dist, "metadata": meta}  # distance 越小越相似
        for doc, dist, meta in zip(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0],
        )
    ]
```

> **注意**：Chroma 在 `cosine` 空间返回的是 **distance**（越小越相关），不是相似度分数。需要相似度时可自行转换：`similarity ≈ 1 - distance`（视实现而定）。

### HNSW 索引：为什么向量检索这么快

向量数据库的核心是 **ANN（Approximate Nearest Neighbor，近似最近邻）** 算法。暴力检索需要与所有向量计算距离——100 万条文档就要算 100 万次。HNSW（Hierarchical Navigable Small World）通过分层图结构把检索复杂度从 O(n) 降到 O(log n)。

```
HNSW 分层结构：

Layer 2 (最稀疏):  A ──────── F
                   ↓
Layer 1 (中等):    A ── C ── E ── F
                   ↓    ↓    ↓
Layer 0 (最密集):  A─B─C─D─E─F─G─H─I─J...
```

检索时从最顶层开始，快速定位到大致区域，然后逐层向下精细化。类似"先看地图上的省，再看市，再看街道"。

**关键参数**：

| 参数 | 含义 | 影响 |
|------|------|------|
| M | 每个节点的连接数 | 越大→精度高但内存多，默认 16 |
| ef_construction | 建索引时的搜索宽度 | 越大→索引质量好但构建慢，默认 200 |
| ef_search | 查询时的搜索宽度 | 越大→精度高但查询慢，默认 10 |

```python
# Chroma 中配置 HNSW 参数
collection = client.create_collection(
    name="docs",
    metadata={
        "hnsw:space": "cosine",
        "hnsw:M": 16,
        "hnsw:construction_ef": 200,
        "hnsw:search_ef": 50,  # 提高检索精度
    },
)
```

**调优经验**：
- 精度优先：`ef_search = 50-100`（检索时间增加 2-5 倍，精度提升 1-3%）
- 速度优先：`ef_search = 10`（默认值，适合大规模数据）
- 内存紧张：`M = 8`（内存减半，精度略降）

### 元数据过滤：精确+语义混合检索

实际应用中，纯语义检索往往不够——用户经常需要"在我的部门文档中搜索"或"只看 2024 年的文档"。

```python
# 索引时附加元数据
collection.add(
    ids=["doc_1"],
    embeddings=[embedding],
    documents=["差旅报销标准..."],
    metadatas=[{
        "department": "finance",
        "date": "2024-03-15",
        "type": "policy",
        "author": "张三",
    }],
)

# 检索时按元数据过滤
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=5,
    where={"department": "finance"},  # 只在财务部文档中检索
)
```

### 要点总结

- Embedding 把文本变成向量，让"语义相似度"可计算
- 默认选 OpenAI `text-embedding-3-small`，中文私有部署用 `bge-m3`
- 切换 Embedding 模型必须重新索引——向量空间不兼容
- 向量数据库选型：原型 Chroma → 生产 Qdrant → 已有 PG 用 pgvector → 超大规模 Milvus
- HNSW 索引把检索从 O(n) 降到 O(log n)，`ef_search` 是精度 vs 速度的核心旋钮
- 元数据过滤是"精确+语义"混合检索的基础——生产 RAG 必备
