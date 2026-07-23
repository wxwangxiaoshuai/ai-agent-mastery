## 企业级 RAG 知识库系统

P2 解决了"让模型输出结构化数据"，P3 解决了"上下文怎么组装"，P4 解决"怎么让模型基于你的私有知识回答问题"。这个项目把 M4 的分块、Embedding、混合检索、Reranking、RAGAS 评估全部串起来，产出一个可对比、可评估、可溯源的生产级 RAG 系统。

### 项目目标

从零构建一个生产级 RAG 知识库系统，具备：
- 多种分块策略 AB 对比（固定 vs 语义 vs 递归），用数据说话
- BM25 + 向量混合检索 + Cross-encoder Reranking 全管道
- RAGAS 自动化评估流水线（忠实度、上下文精度、召回率、回答相关性）
- 引用溯源（每个回答标注来源文档和段落）
- 最终输出一份包含性能对比数据和优化建议的系统报告

### 学完能做什么

- 独立搭建一个可交付的 RAG 系统，覆盖索引→检索→生成→评估全链路
- 用 RAGAS 数据驱动分块策略和检索参数的选型，不再靠"感觉"
- 产出一个可写进简历的代表作——企业级知识库系统

### 验收标准

- [ ] 支持导入 Markdown/TXT 文档，自动分块并索引
- [ ] 至少实现 2 种分块策略，可切换对比
- [ ] 混合检索（BM25 + 向量），支持 RRF 融合
- [ ] Cross-encoder Reranking，精排 top-3
- [ ] 回答中标注引用来源（文档名 + 段落编号）
- [ ] RAGAS 评估输出四项指标（faithfulness / context_precision / context_recall / answer_relevancy）
- [ ] 生成分块策略 AB 对比报告（表格 + 结论）
- [ ] API Key 通过 `.env` 管理

### 实施步骤

**Step 1：环境准备**

```bash
pip install openai chromadb rank-bm25 sentence-transformers jieba python-dotenv
# RAGAS 依赖
pip install ragas datasets
```

**Step 2：文档索引模块**

```python
import chromadb
from openai import OpenAI
from dotenv import load_dotenv
import os, re, hashlib

load_dotenv()
client = OpenAI()
db = chromadb.PersistentClient(path="./rag_db")

class DocumentIndexer:
    """文档索引器：支持多种分块策略"""

    def __init__(self, collection_name: str = "knowledge_base"):
        self.collection = db.get_or_create_collection(
            collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def _embed(self, text: str) -> list[float]:
        return client.embeddings.create(
            model="text-embedding-3-small", input=text
        ).data[0].embedding

    def index(self, document: str, source: str, chunk_strategy: str = "recursive",
              chunk_size: int = 500, overlap: int = 50):
        """索引文档，支持多种分块策略"""
        if chunk_strategy == "fixed":
            chunks = self._fixed_chunk(document, chunk_size, overlap)
        elif chunk_strategy == "semantic":
            chunks = self._semantic_chunk(document)
        else:
            chunks = self._recursive_chunk(document, chunk_size, overlap)

        for i, chunk in enumerate(chunks):
            chunk_id = hashlib.md5(f"{source}_{i}".encode()).hexdigest()
            self.collection.add(
                ids=[chunk_id],
                embeddings=[self._embed(chunk)],
                documents=[chunk],
                metadatas=[{"source": source, "chunk_index": i, "strategy": chunk_strategy}],
            )
        return len(chunks)

    def _fixed_chunk(self, text: str, size: int, overlap: int) -> list[str]:
        if overlap >= size:
            raise ValueError("overlap 必须小于 chunk_size")
        step = size - overlap
        return [text[i:i+size] for i in range(0, len(text), step)]

    def _semantic_chunk(self, text: str, min_size: int = 200, max_size: int = 800) -> list[str]:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks, current = [], ""
        for para in paragraphs:
            if len(current) + len(para) > max_size and current:
                chunks.append(current.strip())
                current = para
            else:
                current += "\n\n" + para if current else para
        if current.strip():
            chunks.append(current.strip())
        return chunks

    def _recursive_chunk(self, text: str, size: int, overlap: int) -> list[str]:
        if overlap >= size:
            raise ValueError("overlap 必须小于 chunk_size")
        separators = ["\n## ", "\n### ", "\n\n", "\n", "。", "."]

        def split_text(t: str, seps: list) -> list[str]:
            if len(t) <= size:
                return [t] if t.strip() else []
            for i, sep in enumerate(seps):
                if sep not in t:
                    continue
                parts = t.split(sep)
                chunks, current = [], ""
                for part in parts:
                    candidate = current + sep + part if current else part
                    if len(candidate) <= size:
                        current = candidate
                    else:
                        if current:
                            chunks.append(current)
                        if len(part) > size:
                            chunks.extend(split_text(part, seps[i+1:]))
                        else:
                            current = part
                if current:
                    chunks.append(current)
                return [c for c in chunks if len(c) > 20]
            return [t[i:i+size] for i in range(0, len(t), size)]

        raw = split_text(text, separators)
        if overlap <= 0 or len(raw) <= 1:
            return raw
        overlapped = [raw[0]]
        for i in range(1, len(raw)):
            overlapped.append(raw[i - 1][-overlap:] + raw[i])
        return overlapped
```

**Step 3：混合检索 + Reranking 管道**

```python
import jieba
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder

class HybridRetriever:
    """混合检索 + Reranking"""

    def __init__(self, indexer: DocumentIndexer):
        self.indexer = indexer
        self.reranker = CrossEncoder("BAAI/bge-reranker-base")  # 中文默认
        self._bm25_docs = None
        self._bm25_ids = None
        self._bm25_engine = None

    def _build_bm25(self):
        """构建 BM25 索引（与向量库共用同一套 ids）"""
        all_data = self.indexer.collection.get()
        self._bm25_docs = all_data["documents"]
        self._bm25_ids = all_data["ids"]
        tokenized = [list(jieba.cut(doc)) for doc in self._bm25_docs]
        self._bm25_engine = BM25Okapi(tokenized)

    def retrieve(self, query: str, top_k: int = 10, rerank_top_n: int = 3) -> list[dict]:
        # 确保 BM25 已构建
        if self._bm25_engine is None:
            self._build_bm25()

        # 1. 向量检索
        query_emb = self.indexer._embed(query)
        vec_results = self.indexer.collection.query(
            query_embeddings=[query_emb], n_results=top_k,
        )

        # 2. BM25 检索
        tokenized_query = list(jieba.cut(query))
        bm25_scores = self._bm25_engine.get_scores(tokenized_query)
        bm25_ranked = sorted(
            range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True
        )[:top_k]

        # 3. RRF 融合——两侧统一使用 Chroma document id，才能正确合并同一文档
        rrf_k = 60
        scores = {}
        for rank, doc_id in enumerate(vec_results["ids"][0]):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (rrf_k + rank + 1)
        for rank, idx in enumerate(bm25_ranked):
            doc_id = self._bm25_ids[idx]
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (rrf_k + rank + 1)

        # 取融合后 top-k
        sorted_ids = sorted(scores, key=scores.get, reverse=True)[:top_k]
        candidates = []
        for doc_id in sorted_ids:
            result = self.indexer.collection.get(ids=[doc_id])
            if result["documents"]:
                candidates.append({
                    "content": result["documents"][0],
                    "metadata": result["metadatas"][0],
                    "score": scores[doc_id],
                })

        # 4. Cross-encoder Reranking
        if candidates:
            pairs = [(query, c["content"]) for c in candidates]
            rerank_scores = self.reranker.predict(pairs)
            for i, c in enumerate(candidates):
                c["relevance_score"] = float(rerank_scores[i])
            candidates.sort(key=lambda x: x["relevance_score"], reverse=True)

        return candidates[:rerank_top_n]
```

**Step 4：引用溯源生成**

```python
class RAGGenerator:
    """带引用溯源的 RAG 生成器"""

    def __init__(self, retriever: HybridRetriever):
        self.retriever = retriever

    def answer(self, question: str) -> dict:
        # 检索
        results = self.retriever.retrieve(question, top_k=10, rerank_top_n=3)
        if not results:
            return {"answer": "未找到相关资料", "citations": []}

        # 组装上下文（带引用编号）
        context_parts = []
        citations = []
        for i, r in enumerate(results):
            source = r["metadata"].get("source", "unknown")
            chunk_idx = r["metadata"].get("chunk_index", 0)
            context_parts.append(f"[{i+1}] {r['content']}")
            citations.append({"id": i+1, "source": source, "chunk": chunk_idx})

        context = "\n\n".join(context_parts)

        # 生成
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": (
                    "基于以下参考资料回答问题。"
                    "在回答中用 [1]、[2] 等标注引用来源。"
                    "如果资料中没有答案，说'根据现有资料无法回答'。\n\n"
                    f"参考资料：\n{context}"
                )},
                {"role": "user", "content": question},
            ],
            temperature=0,
        )

        return {
            "answer": response.choices[0].message.content,
            "citations": citations,
            "contexts": [r["content"] for r in results],
        }
```

**Step 5：RAGAS 评估流水线**

```python
from ragas import evaluate
from ragas.metrics import faithfulness, context_precision, context_recall, answer_relevancy
from datasets import Dataset
# ragas API 可能随版本变化；若报错请对照官方文档调整字段名（如 ground_truth → reference）

class RAGEvaluator:
    """RAGAS 自动化评估"""

    def __init__(self, test_cases: list):
        self.test_cases = test_cases

    def run(self, rag_generator: RAGGenerator) -> dict:
        results = []
        for tc in self.test_cases:
            output = rag_generator.answer(tc["question"])
            results.append({
                "question": tc["question"],
                "answer": output["answer"],
                "contexts": output["contexts"],
                "ground_truth": tc.get("ground_truth", ""),
            })

        dataset = Dataset.from_list(results)
        scores = evaluate(
            dataset,
            metrics=[faithfulness, context_precision, context_recall, answer_relevancy],
        )
        return {k: float(v) for k, v in scores.items()}
```

**Step 6：分块策略 AB 对比**

```python
def compare_chunking_strategies(documents: list, test_cases: list) -> str:
    """对比不同分块策略的 RAG 效果"""
    strategies = ["fixed", "semantic", "recursive"]
    results = {}

    for strategy in strategies:
        print(f"\n测试分块策略: {strategy}")
        # 重新索引：先删 collection 再建，避免脏数据
        name = f"test_{strategy}"
        try:
            db.delete_collection(name)
        except Exception:
            pass
        indexer = DocumentIndexer(name)
        for doc, source in documents:
            indexer.index(doc, source, chunk_strategy=strategy)

        # 评估
        retriever = HybridRetriever(indexer)
        generator = RAGGenerator(retriever)
        evaluator = RAGEvaluator(test_cases)
        scores = evaluator.run(generator)
        results[strategy] = scores
        print(f"  Faithfulness: {scores.get('faithfulness', 0):.2f}")
        print(f"  Context Precision: {scores.get('context_precision', 0):.2f}")
        print(f"  Context Recall: {scores.get('context_recall', 0):.2f}")
        print(f"  Answer Relevancy: {scores.get('answer_relevancy', 0):.2f}")

    # 生成对比报告
    report = "\n分块策略 AB 对比报告\n" + "=" * 50 + "\n"
    report += f"{'策略':<12} {'Faithfulness':<15} {'Ctx Precision':<15} {'Ctx Recall':<15} {'Relevancy':<12}\n"
    report += "-" * 69 + "\n"
    for strategy, scores in results.items():
        report += f"{strategy:<12} "
        report += f"{scores.get('faithfulness', 0):<15.2f} "
        report += f"{scores.get('context_precision', 0):<15.2f} "
        report += f"{scores.get('context_recall', 0):<15.2f} "
        report += f"{scores.get('answer_relevancy', 0):<12.2f}\n"
    report += "=" * 50
    return report
```

### 验收测试

```python
# tests/test_rag.py
import pytest
from src.indexer import DocumentIndexer, db
from src.retriever import HybridRetriever
from src.generator import RAGGenerator

SAMPLE_DOC = """
## 差旅报销政策

### 住宿标准
国内出差住宿上限：一线城市 500 元/晚，其他城市 400 元/晚。
国际出差住宿上限：800 元/晚（美元按报销日汇率折算）。

### 交通费用
飞机：经济舱，飞行 4 小时以上可申请商务舱。
高铁：二等座，特殊情况可申请一等座。

### 报销流程
出差归来后 5 个工作日内提交报销申请，附发票原件。
审批流程：直属上级 → 部门经理 → 财务部。
"""

TEST_CASES = [
    {
        "question": "国内出差住宿报销上限是多少？",
        "ground_truth": "一线城市 500 元/晚，其他城市 400 元/晚。",
    },
    {
        "question": "飞机什么时候可以坐商务舱？",
        "ground_truth": "飞行 4 小时以上可申请商务舱。",
    },
    {
        "question": "报销审批流程是什么？",
        "ground_truth": "直属上级 → 部门经理 → 财务部。",
    },
]

class TestRAG:
    def setup_method(self):
        try:
            db.delete_collection("test_kb")
        except Exception:
            pass
        self.indexer = DocumentIndexer("test_kb")
        self.indexer.index(SAMPLE_DOC, "差旅政策.md", chunk_strategy="recursive")
        self.retriever = HybridRetriever(self.indexer)
        self.generator = RAGGenerator(self.retriever)

    def test_retrieval_returns_results(self):
        results = self.retriever.retrieve("住宿报销上限", top_k=5, rerank_top_n=3)
        assert len(results) > 0
        assert "住宿" in results[0]["content"]

    def test_rrf_merges_same_doc(self):
        """RRF 两侧使用同一 id，融合后同一文档不应重复出现"""
        results = self.retriever.retrieve("住宿报销", top_k=10, rerank_top_n=5)
        contents = [r["content"] for r in results]
        assert len(contents) == len(set(contents))

    def test_answer_contains_citations(self):
        output = self.generator.answer("住宿报销上限是多少？")
        assert "[1]" in output["answer"] or "[2]" in output["answer"]
        assert len(output["citations"]) > 0

    def test_answer_accuracy(self):
        output = self.generator.answer("飞机什么时候可以坐商务舱？")
        assert "4 小时" in output["answer"]

    def test_no_answer_for_unknown(self):
        output = self.generator.answer("公司食堂菜单是什么？")
        assert "无法回答" in output["answer"] or "未找到" in output["answer"]
```

### 进阶挑战

1. **多格式支持**：支持 PDF、Word、HTML 文档导入（用 PyMuPDF、python-docx、BeautifulSoup）
2. **增量索引**：文档更新时只重新索引变化部分（用文件 hash 判断）
3. **查询改写**：加入 LLM 查询改写步骤，对比改写前后的检索效果
4. **多语言**：支持中英文混合文档，用多语言 Embedding 模型
5. **Web 界面**：用 Streamlit/Gradio 做一个知识库管理 + 问答界面

### 常见问题

**Q: 为什么我的 RAG 回答不准确？**
A: 按 RAGAS 指标诊断：Context Recall 低 → 分块太大/太小或 top-k 不够；Context Precision 低 → 加 Reranking；Faithfulness 低 → 加强 Prompt 约束"只基于资料回答"。一步步排查，不要同时改多个参数。

**Q: Chroma 和 Qdrant 怎么选？**
A: 原型和单机用 Chroma（零配置），生产环境用 Qdrant（Docker 部署，性能更好，支持过滤查询）。代码层面只需改 client 初始化，业务逻辑不变。

**Q: Cross-encoder Reranking 太慢怎么办？**
A: 减少候选集大小（top_k 从 20 降到 10）、用更小的模型（MiniLM-L-6 比 L-12 快 2 倍）、或用 Cohere Rerank API（云端推理，不占本地资源）。

### 要点回顾

- RAG 系统的四大支柱：分块策略 + 混合检索 + Reranking + RAGAS 评估
- 分块策略没有"最优解"——用 AB 对比实验，让数据说话
- 混合检索（BM25 + 向量 + RRF 融合）是检索质量的"及格线"
- Reranking 用 Cross-encoder 精排，精确率可提升 10-20 个百分点
- 引用溯源不是可选项——生产级 RAG 必须能追溯每个回答的来源
- RAGAS 评估是优化的闭环：改参数 → 跑评估 → 看指标 → 判断效果

### 下一步

完成 P4 后，你已经能构建生产级 RAG 系统。P5「ReAct 研究助手」会进入 Agent 核心领域——不再只是"检索+生成"，而是让 Agent 自主决定"搜什么、读什么、怎么总结"。
