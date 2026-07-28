## 记忆冲突与遗忘：更新策略、冲突解决、遗忘机制

前三节讲的都是"往记忆里加东西"。但记忆不是越多越好——**记得越多，越可能冲突、越可能过时、检索噪声越大**。用户上周说"在学 Rust"，这周说"改学 Go 了"——旧记忆不更新，Agent 还推荐 Rust 教程。这一节解决记忆系统最难的运维问题：怎么更新、怎么处理冲突、什么时候该忘掉。

### 记忆不是只读的

容易误以为记忆系统是"只增不删"的——抽取一条存一条。但真实记忆是**动态的**，要持续维护：

```
记忆生命周期：
  写入 → （被检索/被使用）→ 更新 / 合并 / 冲突解决
                              │
                              └─→ 过时 → 遗忘（删除/归档）

三种维护操作：
  1. 更新：新信息覆盖旧信息（用户偏好变了）
  2. 合并：多条相关记忆合成一条（信息去重）
  3. 遗忘：删除不再有用/冲突已解决的记忆（控噪声）
```

**不做维护的后果**：记忆库无限膨胀 → 检索变慢且噪声多 → Agent 被过时/冲突记忆误导 → 输出质量下降。记忆系统的价值会随规模下降——这是为什么"无脑全存"不可持续。

### 更新策略：覆盖、合并、版本化

遇到新记忆时，怎么处理已有的旧记忆？三种策略：

| 策略 | 做法 | 适用 | 风险 |
|------|------|------|------|
| **覆盖** | 新记忆直接替换旧记忆 | 明确偏好变更 | 丢失旧值（可能还要回溯） |
| **合并** | 把新旧合成一条更全的 | 互补信息 | 合并逻辑复杂 |
| **版本化** | 都存，带时间戳，取最新 | 需要追溯历史 | 占空间、检索要过滤 |

**判断该用哪种的关键**：新记忆和旧记忆是"矛盾"（同一事实的新旧值）还是"互补"（不同事实）？

```python
import json
from datetime import datetime, timedelta
from openai import OpenAI

client = OpenAI()

class MemoryUpdater:
    """记忆更新器：判断新旧关系并执行更新"""
    def __init__(self, collection):
        self.collection = collection

    def update(self, user_id: str, new_fact: str, created_at: str | None = None):
        """处理一条新事实"""
        created_at = created_at or datetime.now().isoformat()
        # 1. 检索是否有相关的旧记忆（仅 active）
        results = self.collection.query(
            query_texts=[new_fact], n_results=3,
            where={"$and": [{"user_id": user_id}, {"status": "active"}]},
        )
        old_ids = (results.get("ids") or [[]])[0]
        old_docs = (results.get("documents") or [[]])[0]
        old_metas = (results.get("metadatas") or [[]])[0]

        if not old_ids:
            self._add(user_id, new_fact, metadata={"created_at": created_at})
            return "added"

        old_id, old_doc, old_meta = old_ids[0], old_docs[0], old_metas[0]
        relation = self._judge_relation(new_fact, old_doc)

        if relation == "duplicate":
            return "skipped (重复)"
        elif relation == "complementary":
            merged = self._merge(old_doc, new_fact)
            self._replace(old_id, user_id, merged)
            return "merged"
        elif relation == "contradictory":
            return self._resolve_conflict(
                user_id, old_id, old_doc, old_meta, new_fact, created_at,
            )
        return "unknown"
```

**注意**：更新前必须先检索旧记忆判断关系——无脑覆盖会丢失互补信息，无脑新增会产生重复。这一步 LLM 判断是记忆质量的保障。

### 冲突解决：新旧事实打架怎么办

最棘手的情况：用户说 A，旧记忆是 B，A 和 B 矛盾。比如"我在学 Rust" vs "我在学 Go"。解决规则要明确：

```
冲突解决优先级（从高到低）：
  1. 时间最新：新记忆胜（用户偏好确实变了）
  2. 显式否定："不是 Rust 了，改 Go" → 明确覆盖
  3. 来源权威：人工标注 > Agent 抽取 > 推断
  4. 置信度：高置信记忆胜
  5. 不确定：都存，版本化，检索时取最新（保底）
```

**实现**：

```python
CONFLICT_PROMPT = """判断新事实与旧事实的关系。
旧事实：{old}
新事实：{new}

输出 JSON：
  - relation: "duplicate" | "complementary" | "contradictory"
  - 如果 contradictory，给出 resolution: "new_wins"（新事实更新/覆盖旧） | "old_wins"（旧更可信） | "uncertain"（不确定，都存）
  - reason: 一句话理由
"""

def _resolve_conflict(
    self, user_id: str, old_id: str, old_fact: str, old_meta: dict,
    new_fact: str, new_created_at: str,
):
    """解决冲突：先比 created_at，再参考 LLM resolution"""
    old_ts = old_meta.get("created_at", "")
    # 时序优先：真实对话时间更新的胜（避免异步抽取乱序）
    if new_created_at and old_ts and new_created_at < old_ts:
        return "old kept (new older by created_at)"

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": CONFLICT_PROMPT.format(
            old=old_fact, new=new_fact)}],
        temperature=0, response_format={"type": "json_object"},
    )
    data = json.loads(resp.choices[0].message.content)
    resolution = data.get("resolution", "uncertain")

    if resolution == "new_wins":
        self._archive(old_id, user_id)
        self._add(user_id, new_fact, metadata={
            "supersedes": old_id, "created_at": new_created_at,
        })
        return "new replaced old (archived)"
    elif resolution == "old_wins":
        return "old kept (new ignored)"
    else:
        self._add(user_id, new_fact, metadata={
            "conflicts_with": old_id, "created_at": new_created_at,
        })
        return "both stored (versioned)"
```

**关键设计**：覆盖时**归档而非删除**旧记忆——万一判断错了（用户其实是说"除了 Rust 也学 Go"），还能回溯。删除是不可逆的，归档保留了纠错能力。

### 一个常见的冲突陷阱：时序颠倒

抽取是异步的（L08-03 提过），可能导致**时序错乱**：

```
真实顺序：用户先说"学 Rust"，后改口"学 Go"
抽取顺序（异步乱序）：先处理了"学 Go"，后处理了"学 Rust"
  → "学 Rust" 被当成"新事实"覆盖了"学 Go" → 错！

教训：记忆必须带时间戳，冲突解决按时间而非处理顺序
```

**对策**：每条记忆存 `created_at`（对话发生时间，非处理时间），冲突解决严格按 `created_at` 排序，最新的胜。处理顺序乱不影响，因为判定依据是真实时间。

### 遗忘机制：记什么该忘

遗忘不是 bug，是**特性**。人脑也会遗忘——保留太多反而检索困难、被过时信息干扰。三类遗忘：

**1. 基于时间**：太老的记忆，且长期没被检索，遗忘。

```python
from datetime import datetime, timedelta

def forget_by_age(self, threshold_days: int = 90):
    """遗忘超期且未被访问的记忆"""
    cutoff = (datetime.now() - timedelta(days=threshold_days)).isoformat()
    # 删除：创建时间早于 cutoff 且 last_accessed 也早于 cutoff
    self.collection.delete(where={
        "$and": [
            {"created_at": {"$lt": cutoff}},
            {"last_accessed": {"$lt": cutoff}},
        ]
    })
```

**2. 基于重要性**：低重要度的记忆优先遗忘。重要度综合：来源（用户明确说的 > 推断）、置信度、被检索频率。

```python
def forget_by_importance(self, keep_top: int = 1000):
    """保留重要度最高的 N 条，其余遗忘"""
    all_mem = self.collection.get()
    ids = all_mem.get("ids") or []
    metas = all_mem.get("metadatas") or []
    scored = [
        (self._importance(m), mid) for mid, m in zip(ids, metas)
    ]
    scored.sort(reverse=True)
    forget_ids = [mid for _, mid in scored[keep_top:]]
    if forget_ids:
        self.collection.delete(ids=forget_ids)
```

**3. 基于访问频率**：长期没人查的记忆，遗忘（LRU 思路）。

```python
# 每次检索命中时更新 last_accessed
def recall(self, user_id, query, top_k=5):
    results = self.collection.query(query_texts=[query], n_results=top_k,
                                    where={"user_id": user_id})
    # 更新命中记忆的访问时间
    for mid in results["ids"][0]:
        self.collection.update(ids=[mid], metadatas=[{
            "last_accessed": datetime.now().isoformat()}])
    return results["documents"][0]
```

**三者结合**：实际系统通常**时间+重要性+频率综合**——既老又低重要度又没人查的记忆，最先遗忘。

### 软遗忘 vs 硬遗忘

遗忘有"软""硬"之分：

```
硬遗忘：直接 delete，彻底删除
  优点：释放空间、检索干净
  缺点：不可逆，删错了找不回

软遗忘：降级到冷存储，不参与日常检索，但保留
  优点：可恢复，合规审计需要
  缺点：仍占空间
```

**生产推荐软遗忘**：把记忆标记 `status: "archived"`，日常检索用 `where={"status": "active"}` 过滤掉归档的，但数据仍在。合规要求（如 GDPR"被遗忘权"）才做硬删除。

```python
def soft_forget(self, memory_id: str):
    """软遗忘：归档，不删除"""
    self.collection.update(
        ids=[memory_id],
        metadatas=[{"status": "archived",
                    "archived_at": datetime.now().isoformat()}],
    )
```

### 遗忘的边界：什么绝不能忘

不是所有记忆都能忘。**绝对不能遗忘的记忆**：

- 安全相关：用户过敏原、医疗禁忌、权限边界——忘了一次可能出事
- 合规相关：用户明确要求保留的、审计需要的
- 身份相关：用户的核心身份信息（除非用户要求删）

**实现**：这类记忆标记 `protected: true`，遗忘机制跳过：

```python
def forget_by_age(self, threshold_days=90):
    cutoff = (datetime.now() - timedelta(days=threshold_days)).isoformat()
    self.collection.delete(where={
        "$and": [
            {"created_at": {"$lt": cutoff}},
            {"last_accessed": {"$lt": cutoff}},
            {"protected": {"$ne": True}},  # 受保护的不忘
        ]
    })
```

> 设计原则：**遗忘要有"安全网"**。重要记忆显式标记保护，遗忘机制带白名单跳过——宁可记忆库稍大，也不能遗忘关键安全信息。

### 记忆维护的调度

遗忘和更新不是每轮对话都做——那样成本太高。批量调度：

```
维护时机：
  · 对话结束：触发抽取+更新（增量，轻量）
  · 每日/低峰：批量遗忘+合并（全量扫描，重）
  · 记忆库超阈值：触发压缩（淘汰低质记忆）
```

**类比**：短期记忆（对话内）是"内存"，长期记忆是"磁盘"，维护任务像"垃圾回收"——不必每次操作都 GC，但要定期跑，否则内存泄漏。

### 动手 5 分钟

造一次记忆冲突，看你的系统站哪边。

1. 依次写入两条冲突事实："我在学 Rust"（一周前）和"我改学 Go 了"（今天）。
2. 检索"给我推荐学习资料"，看注入的是哪条。
3. 再造一次时序颠倒：让旧事实后写入，看系统会不会被骗。

**验收标准**：你的记忆条目带时间戳且冲突时按事实发生时间（不是写入时间）取胜，并且旧事实是软删除、可追溯。

### 要点总结

- 记忆不是只读的——要持续维护（更新/合并/遗忘），否则库膨胀、噪声大、被过时信息误导
- 更新三策略：覆盖（偏好变更）、合并（互补信息）、版本化（需追溯）——按新旧是矛盾还是互补选
- 冲突解决优先级：时间最新 > 显式否定 > 来源权威 > 置信度 > 不确定则版本化保底
- 覆盖要归档而非删除——保留纠错能力；记忆必须带时间戳，按真实时间而非处理顺序判冲突
- 遗忘三机制：时间（超期未访问）、重要性（低重要度先忘）、频率（长期没人查的先忘）
- 软遗忘（归档）优于硬遗忘（删除）——可恢复、合规友好，除非 GDPR 等要求硬删
- 绝不能忘的记忆（安全/合规/身份）标记 protected，遗忘机制带白名单跳过——遗忘要有安全网
- 维护要批量调度：对话结束做增量更新，低峰做批量遗忘，类比"垃圾回收"
- M8 至此串联：分类(L08-01)→短期窗口(L08-02)→长期架构(L08-03)→程序记忆(L08-04)→冲突遗忘(L08-05)，P8 综合落地
