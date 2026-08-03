## 长期记忆架构：Mem0 / MemGPT 思路与工程实现

短期窗口（L08-02）解决"单次对话别溢出"。但用户关掉对话、明天再来，短期记忆全没了。**长期记忆让 Agent 跨会话记住用户偏好和历史**——这是"私人助手"和"无状态 API"的分水岭。这一节拆解两个业界标杆：Mem0 的"抽取-存储"和 MemGPT 的"虚拟内存分层"，并落地一套可演进的架构。

### 长期记忆要解决什么

先明确目标。长期记忆不是"把所有历史对话存进数据库"——那是日志系统。长期记忆要实现三件事：

```
1. 记住（写入）：从对话中抽取出稳定的"事实/偏好"，存成可检索单元
2. 回忆（检索）：新对话开始时，找出与当前话题相关的记忆
3. 维护（更新/遗忘）：新旧事实冲突时合并，过时信息清理（L08-05 详谈）
```

**最难的是第 1 步**——抽取。对话里的信息是临时的、口语化的、夹带噪声的，要提炼成稳定的结构化记忆。

### Mem0 思路：抽取-存储-检索

Mem0 的核心思想：**不存对话原文，存从对话里抽出的"记忆条目"**。每个条目是一条原子化的事实。

```
对话原文：
  用户："我最近在学 Rust，之前一直写 Python，觉得 Rust 的所有权有点难"

Mem0 抽取出的记忆条目：
  1. { user: u123, fact: "正在学习 Rust", type: "learning" }
  2. { user: u123, fact: "主力语言是 Python", type: "skill" }
  3. { user: u123, fact: "觉得 Rust 所有权难", type: "opinion" }
```

**抽取 pipeline**：每轮对话结束后，用一个 LLM 从中抽出"值得长期记住的事实"。

```python
from openai import OpenAI
client = OpenAI()

EXTRACT_PROMPT = """从以下对话中抽取值得长期记住的用户事实/偏好。
要求：
1. 每条事实原子化（一句话一个事实）
2. 只抽取稳定的、跨会话有用的事实，忽略寒暄、临时情绪、一次性任务
3. 输出 JSON 对象，格式必须为：{"facts": [{"fact": "...", "type": "preference|skill|fact|opinion"}]}
4. 没有值得抽取的事实就返回 {"facts": []}

对话：
{dialog}

输出 JSON："""

def extract_memories(dialog: str) -> list[dict]:
    """从对话抽取记忆条目"""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": EXTRACT_PROMPT.format(dialog=dialog)}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    import json
    data = json.loads(resp.choices[0].message.content)
    facts = data.get("facts", [])
    return facts if isinstance(facts, list) else []
```

### Mem0 的存储与检索

抽取出的记忆条目存进向量库，按用户隔离。语义事实常用向量库做模糊 recall；精确字段（如过敏原）可额外落 KV——与 L08-01 存储选型一致。

```python
import hashlib
import chromadb

class LongTermMemory:
    """Mem0 式长期记忆：抽取 + 向量存储 + 检索"""
    def __init__(self, collection_name: str = "memories"):
        db = chromadb.PersistentClient(path="./memory_db")
        self.collection = db.get_or_create_collection(collection_name)

    def remember(self, user_id: str, dialog: str):
        """从对话抽取记忆并存储"""
        facts = extract_memories(dialog)
        for i, f in enumerate(facts):
            # 存时带 user_id 元数据，检索时按用户隔离
            self.collection.add(
                ids=[f"{user_id}_{hashlib.md5(f['fact'].encode()).hexdigest()[:8]}_{i}"],
                documents=[f["fact"]],
                metadatas=[{"user_id": user_id, "type": f.get("type", "fact")}],
            )
        return facts

    def recall(self, user_id: str, query: str, top_k: int = 5) -> list[str]:
        """检索与当前话题相关的记忆（按用户隔离）"""
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where={"user_id": user_id},   # 关键：只查这个用户的记忆
        )
        docs = (results.get("documents") or [[]])[0]
        return docs or []
```

**关键设计**：
- **按用户隔离**：`where={"user_id": user_id}`——绝不能让 A 用户的记忆被 B 检索到（这是隐私底线）。
- **原子化条目**：一条记忆一个事实，检索粒度细，更新/删除也方便（L08-05 要对单条做冲突合并）。
- **Embedding 与 RAG 对齐**：生产环境应显式指定 embedding 模型，与 M4 RAG 索引保持一致，避免跨库语义漂移。

### MemGPT 思路：虚拟内存分层

MemGPT（现已产品化为 **Letta**，2024 年下半年更名）换了个角度——**模拟操作系统的虚拟内存**：LLM 的上下文窗口是"内存"，外部存储是"磁盘"，Agent 自己像 OS 一样在两者间换页。

```
MemGPT 分层：
  ┌──────────────────────────┐
  │ Main Context（内存）     │  ← LLM 上下文窗口（有限）
  │  · system + 核心指令     │
  │  · 最近对话              │
  │  · 工作记忆              │
  ├──────────────────────────┤
  │ Recall Memory（换页区）  │  ← 完整对话历史（外部）
  │  · 向量检索历史          │
  ├──────────────────────────┤
  │ Archival Memory（归档）  │  ← 长期事实库（外部）
  │  · 向量检索事实          │
  └──────────────────────────┘

  Agent 可以主动调用"记忆工具"：
    memory_search(query)   → 从 Recall/Archival 检索塞回 Main
    memory_insert(text)    → 往 Archival 存新事实
```

**核心创新**：记忆访问变成了**工具调用**。Agent 不再被动接收所有历史，而是**主动决定"现在需不需要翻历史"**——要翻就用 `memory_search`，不翻就不占窗口。

### 两种思路的对比

| 维度 | Mem0（抽取-存储） | MemGPT（虚拟内存） |
|------|-------------------|-------------------|
| 记忆形态 | 抽取出的原子事实 | 原文 + 抽取事实混合 |
| 写入时机 | 对话后批量抽取 | Agent 主动 insert |
| 检索方式 | 自动注入相关记忆 | Agent 主动 search |
| 窗口压力 | 小（只注入精炼事实） | 可控（按需翻历史） |
| 实现复杂度 | 中 | 高（要训练 Agent 用记忆工具） |
| 适合场景 | 偏好/事实记忆 | 超长任务、需翻完整历史 |

**工程取舍**：Mem0 简单可控，适合大多数"记住用户偏好"的场景；MemGPT 更强大但复杂——要让模型学会"何时该检索记忆"是个额外的训练/调优问题。**生产中常做混合**：用 Mem0 的抽取思路存事实，借鉴 MemGPT 的"主动检索"思路让 Agent 在需要时查历史。

### 可演进的长期记忆架构

把两者优点结合，设计一套分层、可演进的架构：

```
┌─────────────────────────────────────────────┐
│  Layer 1：会话短期记忆（L08-02 的窗口管理）   │
│    最近对话 + 摘要                            │
├─────────────────────────────────────────────┤
│  Layer 2：用户语义记忆（Mem0 式抽取事实）     │
│    原子化事实，向量库，按用户隔离              │
│    · 写入：对话后抽取                          │
│    · 检索：每轮按当前 query 自动 recall       │
├─────────────────────────────────────────────┤
│  Layer 3：对话历史归档（MemGPT 式 recall）    │
│    完整历史轨迹，时间戳索引                    │
│    · 写入：对话结束批量存                      │
│    · 检索：Agent 主动 search（工具调用）      │
└─────────────────────────────────────────────┘
```

**组装到上下文**：

```python
# SummarizingWindowMemory / client 来自 L08-02（建议先完成该课）
class MemoryAugmentedAgent:
    def __init__(self, ltm: LongTermMemory):
        self.ltm = ltm
        self.window = SummarizingWindowMemory(max_recent=6)

    def chat(self, user_id: str, user_msg: str) -> str:
        # 1. 自动 recall 语义记忆（Layer 2）
        related = self.ltm.recall(user_id, user_msg, top_k=5)

        # 2. 组装上下文：摘要 + 检索记忆 + 最近对话
        context = self.window.get_context()
        context.append({
            "role": "system",
            "content": f"[相关记忆]\n" + "\n".join(f"- {m}" for m in related),
        })
        context.append({"role": "user", "content": user_msg})

        # 3. LLM 推理
        resp = client.chat.completions.create(
            model="gpt-4.1-mini", messages=context, temperature=0,
        )
        reply = resp.choices[0].message.content

        # 4. 写入：抽取新记忆（Layer 2）+ 归档历史（Layer 3 省略）
        self.window.add({"role": "user", "content": user_msg})
        self.window.add({"role": "assistant", "content": reply})
        self.ltm.remember(user_id, f"用户：{user_msg}\n助手：{reply}")

        return reply
```

**注意**：`remember` 是异步触发的——不必阻塞用户等待抽取。生产中把抽取丢进后台队列，对话先返回。

### 架构演进路径

这套分层架构的价值在于**可演进**——可以分阶段落地，不必一次到位：

```
阶段0：只有短期窗口（L08-02）
  ↓ 用户开始抱怨"怎么不记得上次说的"
阶段1：加 Layer 2 语义记忆（Mem0 式抽取）
  ↓ 用户开始问"上次我们聊的那个方案"
阶段2：加 Layer 3 历史归档（MemGPT 式主动检索）
  ↓ 记忆变多，开始冲突、过时
阶段3：加遗忘与冲突解决（L08-05）
```

> 反模式：**一上来就做 MemGPT 全套**。Agent 连"主动检索记忆"都没学会，加了 `memory_search` 工具它也不会用，反而增加决策噪声。从 Layer 2 起步，验证了 recall 确实有用，再考虑主动检索。

### 隐私与成本的现实约束

落地长期记忆前，必须想清楚两个现实约束：

**隐私**：用户记忆是敏感数据。设计上——按用户严格隔离（`where` 过滤）、提供"忘记我"接口（按 user_id 删除）、敏感事实（如医疗）考虑加密存储或单独治理。

**成本**：抽取要调 LLM，recall 要向量检索。一个高频对话的 Agent，每轮都 recall + 记住，成本不低。优化——recall 用更小的 embedding 模型、抽取做成批量异步、对"显然没新事实"的对话跳过抽取（用规则预判）。

### 动手 5 分钟

实现一个最小的长期记忆闭环，并测它的跨会话能力。

1. 会话结束时用 LLM 抽取"值得长期记住的事实"，存进带 embedding 的表。
2. 新会话开始时按当前输入检索 top-3 事实注入 System Prompt。
3. 关掉进程重开，问一个只有靠上次记忆才能答对的问题。

**验收标准**：跨会话答对了，且注入的事实不超过 3 条——记忆检索的第一敌人是噪声，不是遗漏。

### 要点总结

- 长期记忆三件事：记住（抽取）、回忆（检索）、维护（更新/遗忘）——最难的是抽取
- Mem0 思路：对话→抽取原子事实→向量库（按用户隔离）→每轮自动 recall
- MemGPT 思路：模拟虚拟内存分层，记忆访问变成工具调用，Agent 主动 search/insert
- 对比：Mem0 简单可控适合偏好记忆；MemGPT 强大但复杂适合超长任务——生产常做混合
- 可演进架构三层：短期窗口 + 语义记忆（自动 recall）+ 历史归档（主动检索），可分阶段落地
- 反模式：别一上来做 MemGPT 全套，Agent 还没学会主动检索——从 Layer 2 起步验证
- 现实约束：隐私（按用户隔离+忘记接口+敏感数据治理）、成本（小 embedding+批量异步抽取+跳过无新事实对话）
- 下一节 L08-04 讲程序记忆（记住"怎么做"），L08-05 讲记忆的冲突与遗忘
