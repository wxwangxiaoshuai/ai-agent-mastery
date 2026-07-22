## LangGraph：图状态机与可微编排

L10-01 说所有框架底层都可画成"状态图"。LangGraph 直接把这张图交给你画——用节点和边显式表达 Agent 控制流。这一节动手用 StateGraph 实现分支、循环、持久化，你会理解为什么复杂控制流该用图，而非嵌套 if。

### LangGraph 的三个核心概念

上手前先建立模型。LangGraph 一切围绕三件事：

```
1. State（状态）：在节点间流动的数据
   · 一个 TypedDict 或 Pydantic Model
   · 节点接收它、改它、返回更新后的它
   · 例：{messages, retrieved_docs, answer}

2. Node（节点）：一步操作，接收 state 返回更新
   · 普通函数：def node(state) -> dict（返回部分更新）
   · 每个节点改 state 的一部分

3. Edge（边）：控制流，决定下一步去哪个节点
   · 普通边：A → B（固定顺序）
   · 条件边：A → ?（根据 state 决定去哪）
   · 循环：B → A（形成环）
```

**和手写 Loop 的本质差异**：手写是"指令式"——你写 while/if 控制流；LangGraph 是"声明式"——你画图，框架按图跑。图一旦画好，分支、循环、并行都成了边的配置，不用再在业务函数里塞控制逻辑。

### 最小例子：一个有条件分支的 Agent

先看一个不用任何花哨特性的最小例子，建立直觉。需求：检索 → 生成；但检索质量差时改写查询重试。

```python
# pip install langgraph
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

# 1. 定义状态
class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]   # 对话历史（add_messages 自动累加）
    query: str                                # 当前检索查询
    docs: list                                # 检索到的文档
    quality: str                              # 检索质量评估

# 2. 定义节点（每个节点是 普通函数）
def retrieve(state: ResearchState) -> dict:
    """检索节点"""
    docs = vector_db.search(state["query"], k=3)
    return {"docs": docs}

def evaluate(state: ResearchState) -> dict:
    """评估检索质量"""
    quality = "good" if len(state["docs"]) >= 2 else "poor"
    return {"quality": quality}

def rewrite_query(state: ResearchState) -> dict:
    """改写查询（质量差时）"""
    new_q = llm_rewrite(state["query"])
    return {"query": new_q}

def generate(state: ResearchState) -> dict:
    """生成回答"""
    answer = llm_generate(state["docs"], state["messages"])
    return {"messages": [{"role": "assistant", "content": answer}]}

# 3. 画图：节点 + 边
graph = StateGraph(ResearchState)
graph.add_node("retrieve", retrieve)
graph.add_node("evaluate", evaluate)
graph.add_node("rewrite", rewrite_query)
graph.add_node("generate", generate)

# 普通边
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "evaluate")

# 条件边：根据 quality 决定下一步
def route_by_quality(state: ResearchState) -> str:
    return "rewrite" if state["quality"] == "poor" else "generate"
graph.add_conditional_edges("evaluate", route_by_quality)

# 循环：rewrite 回到 retrieve 重试
graph.add_edge("rewrite", "retrieve")
graph.add_edge("generate", END)

# 4. 编译并运行
app = graph.compile()
result = app.invoke({"query": "LangGraph 和 CrewAI 区别", "messages": [], "docs": []})
```

**看清这张图**：

```
START → retrieve → evaluate ──(good)──→ generate → END
                        │                  ↑
                      (poor)               │
                        ↓                  │
                      rewrite ─────────────┘
                        （回到 retrieve 重试，形成循环）
```

**关键点**：循环 `rewrite → retrieve` 在手写 Loop 里要 `while` 加 `retry_count`；在 LangGraph 里就是一条边。条件分支在手写里是 `if quality == 'poor'`；在 LangGraph 里是 `add_conditional_edges` 加一个路由函数。**控制流从业务函数里剥离到图定义里**，节点函数只管"做这一步的事"。

### 状态累加 vs 覆盖：reducer 的作用

注意上面 `messages` 用了 `Annotated[list, add_messages]`——这叫 reducer。它决定节点返回的值怎么合并进 state：

```python
# 默认（无 reducer）：覆盖
# 节点返回 {"query": "新查询"} → state["query"] 被新值覆盖

# 用 reducer：累加
# messages: Annotated[list, add_messages]
# 节点返回 {"messages": [新消息]} → 新消息追加到 state["messages"]，而非覆盖
```

**为什么 messages 要累加**：每个节点都可能产生新消息（retrieve 的检索结果、generate 的回答），你要的是**全部历史**，而非每次只留最新的。reducer 让"累加"这件事框架自动做，节点不用手动管 state 全貌。

> 常见坑：忘了加 reducer，messages 被覆盖，导致后续节点看不到历史——状态莫名丢失。**对话历史类的字段几乎都要配 reducer 累加**。

### 循环与终止：防止无限循环

图可以成环（循环），但必须能终止。LangGraph 的终止靠两点：

```python
app = graph.compile()

# 1. 条件边返回 END（如上面 route_by_quality 在 good 时去 generate→END）
# 2. recursion_limit：防止无限循环的安全阀
result = app.invoke(input, config={"recursion_limit": 25})
# 超过 25 步抛异常，防止 rewrite↔retrieve 死循环
```

**重要**：任何成环的图都该设 `recursion_limit`——呼应 M7 的"步数上限"。图里的循环和 ReAct 的步数一样，失控时会无限转。`recursion_limit` 是图版的最大步数保护。

### 并行：一个节点扇出多个

LangGraph 支持并行——一个节点连多条边，下游节点并行执行，结果在汇聚节点自动合并：

```python
# 并行搜索多个来源
graph.add_edge("plan", "search_web")     # plan 扇出
graph.add_edge("plan", "search_arxiv")
graph.add_edge("plan", "search_news")
# 三个搜索节点并行跑
graph.add_edge("search_web", "merge")     # 汇聚到 merge
graph.add_edge("search_arxiv", "merge")
graph.add_edge("search_news", "merge")
```

```
      plan
     / |  \
    /  |   \        ← 并行扇出
web arxiv news
    \  |   /
     \ |  /
     merge          ← 汇聚，框架等所有并行节点完成
```

**并行节点的 state 合并**：多个并行节点同时改 state，用 reducer 决定怎么合并（如 `docs` 用 list 累加，自动收集三个来源的结果）。这是 P10"并行搜索"的理论基础。

### 状态持久化：Checkpointer

M7 讲过 Checkpointing——失败从断点恢复。LangGraph 把它做成内建能力，叫 checkpointer。编译时传一个即可：

```python
from langgraph.checkpoint.memory import MemorySaver
# 生产用持久化的：SqliteSaver / PostgresSaver / RedisSaver

app = graph.compile(checkpointer=MemorySaver())

# 每次执行用 thread_id 标识，状态按 thread 存
config = {"configurable": {"thread_id": "research_001"}}
result = app.invoke(input, config=config)

# 中途失败？同一 thread_id 再调，从断点恢复
# 人工介入暂停？状态保留在 checkpoint，随时续跑（L10-03 详讲）
```

**checkpointer 做了什么**：每次节点执行完，把当前 state 存进 checkpoint。失败重启、人工中断、重放调试都基于这套机制。**这比 M7 手写 Checkpoint 更省心**——框架在每个节点边界自动存，你不用手动插保存点。

### 一个完整带持久化的 Agent

把上面的检索 Agent 加上 checkpointer 和重放：

```python
from langgraph.checkpoint.sqlite import SqliteSaver

# 用 SQLite 持久化（生产换 Postgres）
app = graph.compile(checkpointer=SqliteSaver.from_conn_string("agent.db"))

config = {"configurable": {"thread_id": "task_42"}}

# 第一次跑，可能在 generate 前失败
try:
    result = app.invoke({"query": "...", "messages": []}, config=config)
except Exception as e:
    print(f"失败: {e}，状态已存 checkpoint")

# 恢复：同 thread_id，自动从断点续跑
result = app.invoke(None, config=config)   # input=None 表示续跑

# 查看历史状态（调试/重放）
history = list(app.get_state_history(config))
# 每个 state checkpoint 都能取出，可重放到任意节点
```

**重放的价值**：出了 bug，你可以把历史 checkpoint 拉出来，逐步看 state 怎么变的，定位是哪个节点改错了状态。这是图驱动 Agent 相比手写 Loop 的一大调试优势——状态变化有完整轨迹。

### LangGraph 何时该用，何时不该用

| 该用 LangGraph | 不该用（退回手写/线性） |
|----------------|------------------------|
| 有分支/循环/并行的控制流 | 纯线性 A→B→C |
| 要状态持久化和恢复 | 一次性、不需恢复 |
| 要人工介入（L10-03） | 全自动、无人工 |
| 多步骤、复杂业务逻辑 | 单轮问答 |
| 要可重放、可调试 | 简单到画图反而更绕 |

> 反模式：**简单需求硬上 LangGraph**。一个"调一次 LLM 解析 JSON"的需求，画成图要定义 state+3 个节点+边，比直接 `result = llm(prompt)` 啰嗦十倍。图抽象有固定开销，简单场景它反而是负担。L10-06 会系统讲"何时退回手写"。

### 要点总结

- LangGraph 三概念：State（流动数据）、Node（一步操作）、Edge（控制流）
- 声明式画图 vs 手写指令式：控制流从业务函数剥离到图定义，节点只管"做这一步"
- 条件边做分支、成环边做循环、多边扇出做并行——控制流都是边的配置
- reducer 决定状态合并：累加（如 messages）vs 覆盖；对话历史类字段务必加 reducer
- 循环图必设 recursion_limit，防止无限循环——图版的步数上限（呼应 M7）
- 并行节点用扇出+汇聚，多节点改同字段靠 reducer 自动合并（P10 并行搜索基础）
- checkpointer 内建状态持久化：按 thread_id 存，失败续跑、中断续跑、历史重放
- 重放调试：拉历史 checkpoint 逐步看 state 变化，定位节点错改状态——图驱动的一大优势
- 何时用：分支/循环/并行/持久化/HITL；何时不用：纯线性简单需求（图有固定开销，反成负担）
- 下一节 L10-03：在图的关键节点暂停，等人工审核再继续——HITL 编排
