## 参考架构案例拆解 III：Perplexity 与 ChatGPT 的 RAG+Agent 架构

L14-02/03 拆了编程领域。这一节拆**对话/搜索型 Agent**——Perplexity 和 ChatGPT，它们是大众最熟悉的 Agent 产品。两个产品看起来都是"问答"，但架构哲学截然不同：**搜索驱动 vs 对话驱动**。拆解对比能看清"同一表象下不同的架构取舍"。

### Perplexity：搜索→推理→引用→生成

Perplexity 定位"答案引擎"——给你问题，它搜索、综合、带引用地回答。架构核心是**搜索驱动的 RAG 流水线**：

::interactive{type="perplexityArch"}

**架构关键点**：

**1. 搜索是核心，不是辅助**：Perplexity 的主轴是"搜→综合"，LLM 用来"理解和综合"搜索结果，而非用模型自己的知识。这和 ChatGPT 早期（纯对话、靠模型知识）是根本不同的架构。

**2. 引用溯源是产品差异化**：每个论断标注来源——这既是可信度建设，也是 M4 RAG 的引用溯源工程化。用户能点来源验证，而非盲信模型。

**3. 多查询并行**：一个问题可能拆成多个查询并行搜（M6 并行工具），提升召回。这是工程优化——串行搜慢且覆盖窄。

**4. 查询改写**：用户口语化问题→改写成检索友好的查询（M4 Pre-retrieval）。这是检索质量的关键一环。

### Perplexity 的架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 知识来源 | 实时搜索而非模型参数知识 | 信息时效性、可引用溯源 |
| 检索方式 | 多查询并行+Reranking | 提升召回与精度（M4） |
| 引用 | 每论断标注来源 | 可信度+可验证（M4 引用溯源） |
| 多轮 | 相对弱（每次偏独立问答） | 搜索型任务上下文依赖弱 |
| 模型角色 | 综合器而非知识库 | 模型负责"组织答案"不负责"知道" |

**核心权衡**：Perplexity 牺牲"对话连贯性"换"信息时效与可溯源"。它不像 ChatGPT 那样擅长长对话连续追问，但它的答案有据可查、信息新。**产品定位（答案引擎）决定架构（搜索驱动）**。

### ChatGPT：对话→工具→多轮推理

ChatGPT 定位"对话助手"——多轮对话、记忆、工具调用。架构核心是**对话驱动 + 工具增强**：

```
ChatGPT 架构（简化）：
  多轮对话历史
    │
    ├─→ 1. 上下文组装
    │      · 长对话历史 + 记忆（M8 记忆系统）
    │      · 当前用户消息
    │
    ├─→ 2. 决策：直接答还是调工具？
    │      · 模型判断（M6 Function Calling）
    │      · 简单问题直接用知识答
    │      · 需要"当前信息/计算/外部数据"→调工具
    │
    ├─→ 3. 工具调用（可选）
    │      · web 搜索、代码执行、文件分析、GPTs / Actions
    │      · （历史：第三方 Plugins 已弃用，现由 GPTs/Actions 承接）
    │      · M6 的工具选择与执行
    │
    ├─→ 4. 综合回答
    │      · 基于对话+工具结果生成
    │
    └─→ 5. 持续对话
           · 答完等下一轮，历史累积（M8 长期记忆）
```

**架构关键点**：

**1. 对话历史是核心资产**：和 Perplexity 偏"单次问答"不同，ChatGPT 的价值很大程度在多轮对话的连贯性和记忆（M8）。同样问题在不同对话历史下答案不同。

**2. 工具是"按需"而非"必经"**：ChatGPT 不像 Perplexity 每次必搜——它判断需不需要工具。简单事实用模型知识，时效/计算/外部才调工具。这是 M6 的工具决策。

**3. 多种工具生态**：搜索、代码执行（M9 沙箱）、文件分析、GPTs/Actions——工具生态丰富，但模型要会选（M6 工具选择准确率，L06-02；运行时用 L13-03 可观测）。

**4. 长期记忆**：跨会话记住用户偏好（M8 记忆系统的 Mem0 式思路），让对话个性化。

### ChatGPT 的架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 知识来源 | 模型知识为主+工具增强 | 对话连贯优先，时效靠工具补 |
| 工具使用 | 按需调用（模型决策） | 不是每次都搜，简单问题直接答省成本 |
| 多轮 | 强（长对话+记忆） | 对话型产品核心价值 |
| 引用 | 弱（工具结果可显示来源但非每论断标注） | 对话流畅性优先于严格溯源 |
| 模型角色 | 主体（知识+对话+决策） | 模型是多面手，工具是补丁 |

### 搜索型 vs 对话型：架构对比

把两个放一起，差异鲜明：

| 维度 | Perplexity（搜索型） | ChatGPT（对话型） |
|------|---------------------|---------------------|
| 核心驱动 | 搜索流水线 | 对话历史+工具 |
| 知识来源 | 实时检索 | 模型知识+工具补 |
| 多轮连贯 | 弱 | 强 |
| 引用溯源 | 强（每论断标注） | 弱（可选） |
| 工具使用 | 必经（每次搜） | 按需（模型决策） |
| 信息时效 | 强 | 靠工具（默认弱） |
| 适合 | 事实查询、调研 | 长对话、综合任务、创作 |

**关键洞察**：
- **同是"问答"，架构哲学相反**：Perplexity 把模型当"综合器"，知识在外面（搜索）；ChatGPT 把模型当"知识库+综合器"，外部工具是补丁
- **没有谁更对**，是产品定位不同：答案引擎 vs 对话助手。Perplexity 的强溯源对调研场景至关重要；ChatGPT 的强对话对陪伴/创作场景关键

> 这再次印证 L14-01 的核心：**架构服务于产品定位**。选搜索型还是对话型，先问"你的用户要什么"——要可溯源的答案还是连贯的对话。盲目"两个都要"会做出两个都不精的产品。

### 两者的融合趋势

有意思的是，两个产品在互相借鉴——这本身是架构演进的教材：

```
融合趋势：
  Perplexity 加对话能力（追问、记忆）
  ChatGPT 加搜索能力（web 搜索工具、引用标注）

融合的架构挑战：
  · 对话型加搜索：工具按需 vs 必经的权衡
  · 搜索型加对话：流水线 vs 多轮记忆的权衡
  · 不能简单叠加，要重新设计控制流
```

**启示**：架构演进常是"吸收对立架构的优点"，但**不是简单叠加**——Perplexity 加对话不能照搬 ChatGPT 的对话架构（会破坏搜索流水线），要重新设计融合的控制流。这是 L14-06 要讲的"架构演进要重设计不是堆砌"。

### 提炼：RAG+Agent 的通用架构

两个产品都是"RAG+Agent"的实现，提炼共通模式：

```
RAG+Agent 通用架构：
  1. 输入理解层
     · 查询改写、意图判断（要不要检索/工具）
  2. 检索/工具层（M4/M6）
     · 搜索、代码执行、文件分析
     · 并行 + Reranking
  3. 上下文组装层（M3）
     · 对话历史 + 检索结果 + 记忆
     · Token 预算管理
  4. 推理生成层
     · 基于上下文生成
     · 引用标注（可选但重要）
  5. 记忆层（M8）
     · 短期对话 + 长期记忆
  6. 可观测/护栏层（M13）
     · trace、输入输出护栏
```

**控制流的差异决定架构差异**：
- 搜索型：检索层是必经主线（每次必搜）
- 对话型：检索层是可选支线（按需调工具）
- 这个差异 ripple 到上下文组装、记忆、引用——整个架构不同

### 拆业界案例的正确姿势（收束 L14-02/03/04）

三节案例拆解，总结拆解的方法论：

```
拆业界架构的正确姿势：
  1. 先定产品定位（答案引擎？对话助手？编程助手？自主编程？）
  2. 从定位反推架构权衡（定位决定哪些维度优先）
  3. 看技术对号入座（M3/M4/M5/M6/M8/M9/M13 哪个用在哪）
  4. 提炼通用模式 + 理解差异（同表象不同架构）
  5. 映射到自己场景（我的 Agent 在谱系哪端，架构重点是什么）

而非：
  · 抄具体实现（会变、未必准）
  · 盲目"做大厂同款"（约束不同）
  · 只看技术不看定位（架构服务于定位）
```

> P14 会让你选真实场景做架构文档，"对标至少一个业界参考架构"——用这个姿势对标，学权衡思路而非抄实现。

### 实战：搜索型 vs 对话型——两套架构的代码对比

本节讲的两个架构哲学截然相反。来写两套最小实现，对比控制流的差异：

```python
# agent_architectures.py —— 搜索型 vs 对话型 Agent 架构对比

# ═══════════════════════════════════════════════════
# 1. 搜索型 Agent（Perplexity 模式）——每次必搜，模型是综合器
# ═══════════════════════════════════════════════════

class SearchDrivenAgent:
    """搜索驱动的 Agent——搜索是主线，LLM 是综合器。"""

    def __init__(self):
        self.queries_made = 0

    def answer(self, question: str) -> dict:
        """回答一个问题——必须先搜索，再综合。"""
        # 1. 查询改写（L14-04 讲的关键环节）
        rewritten = self._rewrite_query(question)
        print(f"[搜索型] 原始问题: {question}")
        print(f"[搜索型] 改写查询: {rewritten}")

        # 2. 多源并行搜索（每次必搜）
        sources = self._search_multi(rewritten)
        self.queries_made += len(sources)
        print(f"[搜索型] 搜索了 {len(sources)} 个来源")

        # 3. Reranking（按相关性排序）
        ranked = self._rerank(sources, question)
        print(f"[搜索型] 保留了 {len(ranked)} 条最相关结果")

        # 4. 综合生成 + 引用标注
        answer = self._synthesize(question, ranked)

        return {
            "architecture": "搜索驱动",
            "answer": answer["text"],
            "citations": answer["citations"],
            "searches_made": self.queries_made,
            "model_role": "综合器——知识来自搜索，模型负责组织",
        }

    def _rewrite_query(self, question: str) -> str:
        """将口语化问题改写为检索友好格式。"""
        # 简化实现——实际由 LLM 生成
        return f"{question} site:docs.python.org OR site:github.com"

    def _search_multi(self, query: str) -> list[dict]:
        """多源并行搜索（模拟）。"""
        return [
            {"title": f"搜索结果: {query[:30]}...", "snippet": "相关文档片段...",
             "url": "https://docs.python.org/...", "relevance": 0.9},
            {"title": f"相关讨论: {query[:30]}...", "snippet": "社区讨论...",
             "url": "https://github.com/...", "relevance": 0.7},
        ]

    def _rerank(self, results: list[dict], question: str) -> list[dict]:
        """按问题相关性重排序。"""
        return sorted(results, key=lambda r: r["relevance"], reverse=True)

    def _synthesize(self, question: str, sources: list[dict]) -> dict:
        """综合搜索结果为回答（实际由 LLM 生成）。"""
        citations = [s["url"] for s in sources[:3]]
        text = f"基于 {len(sources)} 个来源的综合回答。\n"
        for s in sources[:2]:
            text += f"  · {s['snippet']} [来源]({s['url']})\n"
        return {"text": text, "citations": citations}


# ═══════════════════════════════════════════════════
# 2. 对话型 Agent（ChatGPT 模式）——按需搜索，对话是核心
# ═══════════════════════════════════════════════════

from collections import deque

class ConversationDrivenAgent:
    """对话驱动的 Agent——对话历史是核心，工具按需调用。"""

    def __init__(self):
        self.history: deque[dict] = deque(maxlen=20)
        self.tools_used = 0
        self.questions_answered = 0

    def answer(self, question: str) -> dict:
        """回答一个问题——先判断需不需要搜，再决定怎么答。"""
        self.questions_answered += 1

        # 1. 上下文组装：对话历史 + 当前问题（M3 Context Assembly）
        context = self._assemble_context(question)
        print(f"[对话型] 上下文长度: {len(context['history'])} 轮对话")

        # 2. 决策：需要调工具吗？（M6 Function Calling）
        needs_search = self._should_search(question)
        print(f"[对话型] 需要搜索: {needs_search}")

        # 3. 按需调工具
        search_results = []
        if needs_search:
            search_results = self._search(question)
            self.tools_used += 1
            print(f"[对话型] 调用了搜索工具")

        # 4. 综合回答（模型知识 + 可选工具结果）
        answer = self._respond(question, context, search_results)

        # 5. 更新对话历史
        self.history.append({"role": "user", "content": question})
        self.history.append({"role": "assistant", "content": answer["text"][:200]})

        return {
            "architecture": "对话驱动",
            "answer": answer["text"],
            "used_search": needs_search,
            "history_turns": len(self.history),
            "model_role": "主体——模型是知识库 + 综合器，工具是补丁",
        }

    def _assemble_context(self, question: str) -> dict:
        """组装上下文：对话历史 + 当前问题。"""
        return {
            "question": question,
            "history": list(self.history),
            "token_budget_used": sum(len(str(m)) for m in self.history) // 4,
        }

    def _should_search(self, question: str) -> bool:
        """判断是否需要搜索（实际由 LLM 做 Function Calling 决策）。"""
        # 简化规则：时效性、计算、外部数据相关的问题需要搜索
        time_sensitive = any(w in question for w in
            ["今天", "最近", "最新", "现在", "2026", "当前"])
        computation = any(w in question for w in
            ["计算", "等于", "多少", "分析数据"])
        external_info = any(w in question for w in
            ["新闻", "股价", "天气", "汇率"])

        return time_sensitive or computation or external_info

    def _search(self, query: str) -> list[dict]:
        """按需搜索（不是每次必搜！这是和搜索型最大的区别）。"""
        return [{"title": f"搜索结果: {query[:30]}", "snippet": "..."}]

    def _respond(self, question: str, context: dict, search: list[dict]) -> dict:
        """生成回答（实际由 LLM 生成）。"""
        text = ""
        if context["history"]:
            text += f"[基于 {len(context['history'])} 轮对话上下文]\n"
        if search:
            text += f"[基于 {len(search)} 条实时搜索结果]\n"
        text += f"回答: {question[:50]}..."
        return {"text": text}


# ═══════════════════════════════════════════════════
# 3. 对比实验
# ═══════════════════════════════════════════════════

def compare_architectures(test_questions: list[str]):
    """用同一组问题测试两种架构的差异。"""
    print("=" * 65)
    print("搜索型 vs 对话型 Agent 架构对比实验")
    print("=" * 65)

    search_agent = SearchDrivenAgent()
    conv_agent = ConversationDrivenAgent()

    results = []
    for q in test_questions:
        print(f"\n--- 测试问题: {q[:40]}... ---")

        s_result = search_agent.answer(q)
        c_result = conv_agent.answer(q)

        results.append({
            "question": q,
            "search_driven": s_result,
            "conversation_driven": c_result,
        })

    # 总结
    print(f"\n{'=' * 65}")
    print(f"{'指标':<25} {'搜索型 (Perplexity)':<25} {'对话型 (ChatGPT)'}")
    print("-" * 65)
    print(f"{'模型角色':<25} {'综合器（知识在外）':<25} {'知识库+综合器（工具补丁）'}")
    print(f"{'搜索调用':<25} {'每次必搜':<25} {'按需（简单问题不搜）'}")
    print(f"{'引用溯源':<25} {'强——每论断标注来源':<25} {'弱——可选'}")
    print(f"{'多轮连贯':<25} {'弱——每次偏独立问答':<25} {'强——依赖对话历史'}")
    print(f"{'适合场景':<25} {'事实查询、调研':<25} {'长对话、创作、综合任务'}")

    return results


if __name__ == "__main__":
    questions = [
        "Python 3.14 有哪些新特性？",
        "帮我写一篇文章的大纲，主题是微服务架构",
        "今天天气怎么样？",
        "解释一下什么是装饰器",
    ]
    compare_architectures(questions)
```

**跑一下看差异**：

```bash
python3 agent_architectures.py
```

你会看到：
- 问题"Python 3.14 新特性"——搜索型必搜（时效性），对话型判断是否需要搜（通常也要搜，因为需要最新信息）
- 问题"帮我写一篇文章的大纲"——��索型仍会搜，但对话型判断不需要搜，直接用模型知识
- 问题"解释什么是装饰器"——对话型判断不需要搜（基础知识），搜索型仍会搜一下（可能找到更多例子）

关键在于**控制流的差异**——搜索型是 `搜索→综合→引用` 的固定流水线，对话型是 `判断→搜索(可选)→对话` 的动态分支。这个差异 ripple 到整个架构的每一层。

### 动手 5 分钟

对比搜索驱动与对话驱动，在你的场景里选一个。

1. 写下你的用户最常问的 10 个问题。
2. 判定每个问题是"需要最新外部信息"还是"需要延续上下文"。
3. 按占比决定你的主架构，并为少数派场景设计一条兜底路径。

**验收标准**：你的结论有比例支撑（如"8/10 需要外部信息，所以以检索为主干"），并且引用可追溯的设计已经落进方案里。

### 要点总结

- Perplexity 搜索型架构：查询改写→多源并行搜索→Reranking→综合生成→引用溯源；搜索是核心主线，模型是综合器
- Perplexity 权衡：牺牲对话连贯换信息时效与可溯源——产品定位（答案引擎）决定架构
- ChatGPT 对话型架构：长对话历史+记忆+按需工具调用；对话是核心，工具是补丁，模型是主体
- ChatGPT 权衡：工具按需而非必经、引用弱、多轮强——对话助手定位决定
- 搜索型 vs 对话型：知识来源（检索 vs 模型）、多轮（弱 vs 强）、引用（强 vs 弱）、工具（必经 vs 按需）
- 核心洞察：同是问答架构相反——Perplexity 模型当综合器知识在外，ChatGPT 模型当知识库工具补丁
- 没有谁更对：答案引擎要溯源，对话助手要连贯；盲目都要会做都不精
- 融合趋势：两产品互相借鉴，但不能简单叠加——加对立优点要重设计控制流（L14-06 演进要重设计）
- 通用 RAG+Agent 六层：输入理解/检索工具/上下文/推理/记忆/可观测护栏；控制流差异决定架构差异
- 拆解正确姿势：定定位→反推权衡→技术对号→提炼模式映射自己；别抄实现/盲目同款/只看技术
- 下一节 L14-05：从单 Agent 到 Agent 平台——多租户、可扩展、AaaS
