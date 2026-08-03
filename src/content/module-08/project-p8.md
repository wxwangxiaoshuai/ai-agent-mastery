## 有记忆的私人知识管家

M8 五节课讲了记忆的分类、短期窗口、长期架构、程序记忆、冲突遗忘。P8 把它们组装成一个**能跨会话记住你、能用你的私有知识回答、还能标引用来源的私人知识管家**——它不是无状态 API，而是越用越懂你的助手。

### 项目目标

构建一个有记忆的私人知识管家，具备：
- 跨会话长期记忆（记住用户偏好与历史事实）
- 私有文档 RAG 问答（基于用户的笔记/文档）
- 混合检索 + Reranker（BM25 + 向量 + Cross-encoder）
- 回答引用溯源（每个结论标注来源）
- 记忆维护（更新/冲突/遗忘）

### 验收标准

- [ ] 跨会话：关闭后重启，Agent 仍记得用户偏好（如过敏原、技术栈）
- [ ] 私有 RAG：基于用户文档回答，而非依赖模型训练知识
- [ ] 混合检索：BM25 + 向量 RRF 融合，Cross-encoder（bge-reranker）重排
- [ ] 引用溯源：回答中每个关键结论标注来源文档与片段
- [ ] 记忆更新：新偏好覆盖旧偏好，冲突正确解决
- [ ] 记忆隔离：不同用户记忆严格隔离，不串库
- [ ] 遗忘机制：过期/低重要度记忆被归档
- [ ] 含测试：记忆写入、检索、冲突解决、遗忘的回归测试

### 架构总览

```
┌──────────────────────────────────────────────────┐
│                私人知识管家 Agent                  │
│                                                   │
│  ┌─────────────┐   ┌──────────────────────────┐  │
│  │ 短期窗口管理  │   │  长期记忆系统             │  │
│  │ (L08-02)    │   │  · 语义记忆(Mem0式,L08-03)│  │
│  │ 摘要+滑动    │   │  · 程序记忆(技能库,L08-04，进阶可选)│  │
│  └──────┬──────┘   │  · 冲突/遗忘(L08-05)      │  │
│         │          └──────────┬───────────────┘  │
│         │                     │ recall(用户偏好)  │
│         ▼                     ▼                   │
│  ┌────────────────────────────────────────────┐  │
│  │        上下文组装器 (M3 上下文工程)          │  │
│  │  system + 摘要 + 用户偏好记忆 + 检索文档     │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                           │
│  ┌────────────────────▼───────────────────────┐  │
│  │           私有文档 RAG (M4)                 │  │
│  │  分块 → Embedding → BM25+向量混合 → Rerank  │  │
│  └────────────────────┬───────────────────────┘  │
│                       ▼                           │
│                   LLM 推理 → 带引用的回答          │
│                       │                           │
│                       └→ 触发记忆写入(抽取/更新)    │
└──────────────────────────────────────────────────┘
```
### 实施步骤

**Step 1：短期窗口管理（复用 L08-02）**

```python
from openai import OpenAI
import chromadb, json, hashlib, numpy as np
from datetime import datetime, timedelta

client = OpenAI()

class SummarizingWindowMemory:
    """L08-02 的滑动窗口+摘要压缩（本示例按条数窗口；Token 预算见 L08-02）"""
    def __init__(self, max_recent=6):
        self.system = ""
        self.summary = ""
        self.recent = []
        self.max_recent = max_recent

    def set_system(self, p): self.system = p
    def add(self, m):
        self.recent.append(m)
        while len(self.recent) > self.max_recent:
            old = self.recent.pop(0)
            self.summary = self._summarize(self.summary, old)

    def _summarize(self, existing, old):
        prompt = (f"维护对话摘要，保留关键事实/决策/偏好，删除寒暄。\n"
                  f"已有摘要：\n{existing or '（无）'}\n\n"
                  f"新消息({old['role']})：\n{old['content']}\n\n更新后摘要：")
        r = client.chat.completions.create(
            model="gpt-4.1-mini", messages=[{"role":"user","content":prompt}],
            temperature=0, max_tokens=500)
        return r.choices[0].message.content

    def get_context(self):
        msgs = []
        if self.system: msgs.append({"role":"system","content":self.system})
        if self.summary: msgs.append({"role":"system","content":f"[对话摘要]\n{self.summary}"})
        msgs.extend(self.recent)
        return msgs
```

**Step 2：长期记忆系统（Mem0 式抽取 + 冲突/遗忘）**

```python
class LongTermMemory:
    """L08-03 抽取存储 + L08-05 冲突遗忘"""
    def __init__(self, path="./memory_db"):
        db = chromadb.PersistentClient(path=path)
        self.col = db.get_or_create_collection("user_memories")

    def remember(self, user_id, dialog):
        """抽取并存储记忆"""
        facts = self._extract(dialog)
        for f in facts:
            self._upsert(user_id, f)
        return facts

    def _extract(self, dialog):
        prompt = """从对话抽取值得长期记住的用户事实/偏好。
每条原子化，输出 JSON：{"facts":[{"fact":"","type":""}]}。无可抽取返回{"facts":[]}。
对话：""" + dialog
        r = client.chat.completions.create(
            model="gpt-4.1-mini", messages=[{"role":"user","content":prompt}],
            temperature=0, response_format={"type":"json_object"})
        return json.loads(r.choices[0].message.content).get("facts", [])

    def _upsert(self, user_id, fact_obj):
        """更新策略：判断新旧关系后覆盖/合并/新增（L08-05）"""
        new_fact = fact_obj["fact"]
        new_ts = datetime.now().isoformat()
        fact_hash = hashlib.md5(new_fact.encode()).hexdigest()[:12]
        old = self.col.query(
            query_texts=[new_fact], n_results=1,
            where={"$and": [{"user_id": user_id}, {"status": "active"}]},
        )
        old_ids = (old.get("ids") or [[]])[0]
        if not old_ids:
            self.col.add(ids=[f"{user_id}_{fact_hash}"],
                documents=[new_fact], metadatas=[{
                    "user_id": user_id, "type": fact_obj.get("type","fact"),
                    "created_at": new_ts,
                    "last_accessed": new_ts,
                    "status": "active"}])
            return "added"
        old_doc = old["documents"][0][0]
        old_meta = (old.get("metadatas") or [[{}]])[0][0]
        relation = self._judge_relation(old_doc, new_fact)
        if relation == "duplicate":
            return "skipped"
        if relation == "complementary":
            merged = self._merge(old_doc, new_fact)
            self.col.update(ids=old_ids, documents=[merged])
            return "merged"
        # contradictory：按 created_at + 默认 new_wins（可扩展 L08-05 resolution）
        if old_meta.get("created_at", "") > new_ts:
            return "old kept (newer timestamp)"
        self.col.update(ids=old_ids, metadatas=[{**old_meta, "status": "archived"}])
        # 用时间戳后缀避免冲突链碰撞
        ts_suffix = datetime.now().strftime("%Y%m%d%H%M%S%f")
        self.col.add(ids=[f"{user_id}_{fact_hash}_{ts_suffix}"],
            documents=[new_fact], metadatas=[{
                "user_id": user_id, "type": fact_obj.get("type","fact"),
                "created_at": new_ts,
                "last_accessed": new_ts,
                "status": "active", "supersedes": old_ids[0]}])
        return "replaced"

    def _judge_relation(self, old, new):
        r = client.chat.completions.create(model="gpt-4.1-mini",
            messages=[{"role":"user","content":
                f'判断关系，输出JSON{{"relation":"duplicate|complementary|contradictory"}}\n旧:{old}\n新:{new}'}],
            temperature=0, response_format={"type":"json_object"})
        return json.loads(r.choices[0].message.content)["relation"]

    def _merge(self, old, new):
        r = client.chat.completions.create(model="gpt-4.1-mini",
            messages=[{"role":"user","content":f"合并为一条更全的事实。\n旧:{old}\n新:{new}\n合并:"}],
            temperature=0, max_tokens=200)
        return r.choices[0].message.content

    def recall(self, user_id, query, top_k=5):
        """检索相关记忆（只查 active，按用户隔离）"""
        res = self.col.query(query_texts=[query], n_results=top_k,
            where={"$and":[{"user_id":user_id},{"status":"active"}]})
        ids = res["ids"][0]
        if ids:  # 更新访问时间，保留已有元数据（L08-05 LRU）
            metas = (res.get("metadatas") or [[]])[0]
            now = datetime.now().isoformat()
            self.col.update(ids=ids, metadatas=[
                {**metas[i], "last_accessed": now} for i in range(len(ids))])
        return res["documents"][0]

    def forget(self, days=90):
        """软遗忘：超期未访问且非受保护的归档（L08-05）"""
        cutoff = (datetime.now()-timedelta(days=days)).isoformat()
        # Chroma 的 update() 不支持 where 参数，先 get 过滤再按 ids 更新
        all_mem = self.col.get()
        ids = all_mem.get("ids") or []
        metas = all_mem.get("metadatas") or []
        forget_ids = []
        for mid, meta in zip(ids, metas):
            accessed = meta.get("last_accessed", "")
            if (accessed < cutoff
                    and not meta.get("protected")
                    and meta.get("status") == "active"):
                forget_ids.append(mid)
        if forget_ids:
            self.col.update(ids=forget_ids, metadatas=[{"status": "archived"}]*len(forget_ids))
```

**Step 3：私有文档 RAG（复用 M4 混合检索 + Reranker）**

```python
from rank_bm25 import BM25Okapi
from collections import defaultdict

try:
    import jieba
    def tokenize(text: str) -> list[str]:
        return list(jieba.cut(text))
except ImportError:
    def tokenize(text: str) -> list[str]:
        return text.split()

def rrf_fuse(rank_lists: list[list[str]], k: int = 60) -> list[str]:
    """Reciprocal Rank Fusion（对齐 M4 / P4）"""
    scores = defaultdict(float)
    for ranks in rank_lists:
        for i, doc_id in enumerate(ranks):
            scores[doc_id] += 1.0 / (k + i + 1)
    return [d for d, _ in sorted(scores.items(), key=lambda x: -x[1])]

class PrivateRAG:
    """私有文档检索：BM25 + 向量 RRF 混合 + Cross-encoder 重排"""
    def __init__(self, path="./doc_db"):
        db = chromadb.PersistentClient(path=path)
        self.col = db.get_or_create_collection("private_docs")
        self.bm25_corpus = []   # [(doc_id, tokens)]
        self.bm25 = None

    def index(self, doc_id, text, chunk_size=400, overlap=50):
        """索引：分块（可重叠）+ embedding + BM25 语料；本示例简化 overlap"""
        step = max(1, chunk_size - overlap)
        chunks = [text[i:i+chunk_size] for i in range(0, len(text), step)]
        for i, c in enumerate(chunks):
            emb = client.embeddings.create(model="text-embedding-3-small", input=c).data[0].embedding
            cid = f"{doc_id}_c{i}"
            self.col.add(ids=[cid], embeddings=[emb], documents=[c],
                metadatas=[{"doc_id":doc_id,"chunk":i,"text":c}])
            self.bm25_corpus.append((cid, tokenize(c)))
        self.bm25 = BM25Okapi([t for _, t in self.bm25_corpus])

    def retrieve(self, query, top_k=5):
        """混合检索（RRF）+ 重排"""
        qemb = client.embeddings.create(model="text-embedding-3-small", input=query).data[0].embedding
        vec = self.col.query(query_embeddings=[qemb], n_results=top_k*2)
        vec_ids = vec["ids"][0]
        # BM25 仅在已索引文档时可用
        if self.bm25 is not None and self.bm25_corpus:
            bm_scores = self.bm25.get_scores(tokenize(query))
            bm_top = [self.bm25_corpus[i][0] for i in np.argsort(bm_scores)[::-1][:top_k*2]]
            cand_ids = rrf_fuse([vec_ids, bm_top])
        else:
            cand_ids = vec_ids
        docs = []
        for cid in cand_ids:
            r = self.col.get(ids=[cid])
            if r["documents"]:
                meta = r["metadatas"][0]
                docs.append((cid, meta["text"], meta["doc_id"], meta.get("chunk", 0)))
        try:
            from sentence_transformers import CrossEncoder
            # 中文场景对齐 M4：优先 bge-reranker
            reranker = CrossEncoder("BAAI/bge-reranker-base")
            scores = reranker.predict([(query, d[1]) for d in docs])
            docs = [d for _, d in sorted(zip(scores, docs), reverse=True)][:top_k]
        except Exception:
            docs = docs[:top_k]
        return docs  # [(chunk_id, text, doc_id, chunk_index), ...]
```

**Step 4：组装带记忆的 Agent**

```python
class KnowledgeButler:
    """私人知识管家：短期窗口 + 长期记忆 + 私有 RAG"""
    def __init__(self):
        self.window = SummarizingWindowMemory()
        self.window.set_system(
            "你是私人知识管家。基于[相关记忆]和[检索文档]回答。"
            "每个关键结论用 [doc_id#chunk] 标注来源。文档中没有的说明'资料中未提及'。")
        self.ltm = LongTermMemory()
        self.rag = PrivateRAG()

    def chat(self, user_id, user_msg, enable_rag=True):
        # 1. recall 长期记忆（用户偏好）
        memories = self.ltm.recall(user_id, user_msg)
        mem_block = "\n".join(f"- {m}" for m in memories)

        # 2. 私有文档检索（如需）
        doc_block = ""
        if enable_rag:
            docs = self.rag.retrieve(user_msg)
            doc_block = "\n\n".join(
                f"[{d[2]}#{d[3]}] {d[1]}" for d in docs
            )

        # 3. 组装上下文：摘要 + 记忆 + 文档 + 最近对话
        ctx = self.window.get_context()
        if mem_block:
            ctx.append({"role":"system","content":f"[相关记忆]\n{mem_block}"})
        if doc_block:
            ctx.append({"role":"system","content":f"[检索文档]\n{doc_block}"})
        ctx.append({"role":"user","content":user_msg})

        # 4. 推理
        resp = client.chat.completions.create(model="gpt-4.1-mini", messages=ctx, temperature=0)
        reply = resp.choices[0].message.content

        # 5. 写入短期 + 触发长期记忆抽取（异步更好，此处同步示意）
        self.window.add({"role":"user","content":user_msg})
        self.window.add({"role":"assistant","content":reply})
        self.ltm.remember(user_id, f"用户：{user_msg}\n助手：{reply}")
        return reply
```

**Step 5：使用示例——验证跨会话记忆**

```python
butler = KnowledgeButler()

# 会话 1：告诉管家偏好
print(butler.chat("user_001", "我对花生过敏，最近在学 Rust"))
# → 已记下你对花生过敏，会在推荐食物时避开；也记下你在学 Rust。

# 模拟"关闭对话"——只保留长期记忆和文档库
# 重新创建 Agent（短期记忆清空，长期记忆仍在磁盘）
butler2 = KnowledgeButler()

# 会话 2：验证跨会话记忆
print(butler2.chat("user_001", "推荐我一道晚餐"))  # 不带 RAG 可 enable_rag=False
# → 鉴于你对花生过敏，推荐清炒时蔬配米饭（已避开花生）。
#   ↑ 仍记得"花生过敏"，证明跨会话记忆生效

# 索引私有文档
butler2.rag.index("my_notes", "我的学习笔记：Rust 的所有权系统包括借用检查器...")
print(butler2.chat("user_001", "我的笔记里 Rust 所有权是什么？"))
# → 根据你的笔记[my_notes#0]，Rust 所有权系统包括借用检查器...
#   ↑ 基于私有文档回答 + 引用溯源
```

**Step 6：测试（记忆系统的回归测试）**

```python
# tests/test_memory.py
# 建议将上文类复制到 knowledge_butler.py 后运行：
# from knowledge_butler import LongTermMemory
import pytest
from knowledge_butler import LongTermMemory
from datetime import datetime, timedelta

class TestLongTermMemory:
    def setup_method(self):
        self.ltm = LongTermMemory(path="./test_memory_db")

    def test_remember_and_recall(self):
        self.ltm.remember("u1", "我对花生过敏")
        assert "花生" in self.ltm.recall("u1", "食物偏好")[0]

    def test_user_isolation(self):
        self.ltm.remember("u1", "我学 Rust")
        self.ltm.remember("u2", "我学 Go")
        assert "Rust" not in " ".join(self.ltm.recall("u2", "学什么"))
        assert "Go" in " ".join(self.ltm.recall("u2", "学什么"))

    def test_conflict_resolution_new_wins(self):
        self.ltm.remember("u1", "我在学 Rust")
        self.ltm.remember("u1", "改学 Go 了")  # 矛盾，新覆盖
        recalled = " ".join(self.ltm.recall("u1", "学什么语言"))
        assert "Go" in recalled

    def test_archived_not_recalled(self):
        self.ltm.remember("u1", "临时任务：订外卖")
        # days=0 不会归档「刚写入」的记忆（last_accessed≈now）；测试需回拨时间
        res = self.ltm.col.get(where={"user_id": "u1"})
        past = (datetime.now() - timedelta(days=120)).isoformat()
        self.ltm.col.update(
            ids=res["ids"],
            metadatas=[{**m, "last_accessed": past} for m in res["metadatas"]],
        )
        self.ltm.forget(days=90)
        assert self.ltm.recall("u1", "外卖") == []
```

::interactive{type="acceptanceChecklist"}

### 进阶挑战

1. **异步记忆抽取**：把 `remember` 丢进后台队列，对话不阻塞等待抽取
2. **程序记忆**：加 L08-04 的技能库，让管家记住"用户常问的查询模式"自动优化检索
3. **记忆可视化**：做一个面板展示某用户的全部记忆、冲突历史、归档记录
4. **隐私合规**：实现"被遗忘权"接口，一键硬删除某用户全部记忆
5. **主动检索**：借鉴 MemGPT，给 Agent 加 `memory_search` 工具，让它自己决定何时翻历史
6. **多模态记忆**：不仅记文本，还记用户上传过的图片/文档摘要

### 要点回顾

- 私人知识管家 = 短期窗口(L08-02) + 长期记忆(L08-03/L08-05) + 私有 RAG(M4)
- 跨会话记忆的关键：对话后抽取原子事实存向量库，按用户隔离，每轮 recall 注入上下文
- 私有 RAG 复用 M4：BM25+向量 **RRF** → bge-reranker 重排 → `[doc#chunk]` 引用
- 冲突解决：判断新旧关系（重复/互补/矛盾），矛盾时新覆盖旧且旧归档保留追溯
- 遗忘：软遗忘（归档）优于硬删，受保护记忆（安全/合规）跳过遗忘
- 测试覆盖：记忆写入、用户隔离、冲突解决、归档过滤的回归测试
- 记忆不是只读的——要持续维护，否则库膨胀、噪声大、被过时信息误导

### 下一步

完成 P8 后，你的 Agent 有了"长期记忆"和"私有知识"。M9「Code Execution 与沙箱」会让 Agent 安全地写代码、跑代码——从能对话、能记忆，到能动手执行，能力再上一个台阶。
