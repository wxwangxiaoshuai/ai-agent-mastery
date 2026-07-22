## Supervisor 模式：中心化调度

L11-01 的星型拓扑，落地最主流的实现就是 **Supervisor 模式**——一个"主管" Agent 接收任务，决定分派给哪个下属、收集结果、决定下一步。这是 L11-04 对话式、P11 软件团队的基础。这一节用 LangGraph 实现 supervisor，并直面它的失败处理与中心化权衡。

### Supervisor 的角色：大脑而非手

先明确 supervisor 干什么、不干什么——这是设计正确的关键：

```
Supervisor 做的（"大脑"）：
  · 理解任务，拆解成子任务
  · 决定派给哪个下属 Agent
  · 收集下属结果，判断是否完成/还需做什么
  · 处理下属失败（重试/换人/降级）
  · 最终汇总输出

Supervisor 不做的（"手"）：
  · 不亲自执行具体工作（不写代码、不搜索）
  · 不懂所有领域的细节（细节交给下属）
  · 不替下属做决策（下属失败时重新分派，不是替它干）
```

**常见错误**：把 supervisor 写成"全能 Agent"——既调度又干活。这样它会上下文爆炸、职责混乱。**supervisor 只负责"想"，下属负责"做"**。这个分工和人类组织一样：主管不替程序员写代码。

### 用 LangGraph 实现 Supervisor

LangGraph 的 supervisor 核心是一个**路由节点**——它根据当前 state 决定下一步派给哪个下属，下属执行完回 supervisor，如此循环直到完成：

```python
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

class TeamState(TypedDict):
    messages: Annotated[list, add_messages]   # 团队对话历史
    next: str                                  # supervisor 决定的下一步

# —— 下属 Agent（"手"）——
def researcher(state: TeamState) -> dict:
    """研究员：检索信息"""
    result = search_and_summarize(state["messages"])
    return {"messages": [{"role": "user", "content": f"研究结果：{result}"}]}

def coder(state: TeamState) -> dict:
    """程序员：写代码"""
    code = write_code(state["messages"])
    return {"messages": [{"role": "user", "content": f"代码：{code}"}]}

# —— Supervisor（"大脑"）——
def supervisor(state: TeamState) -> dict:
    """主管：看历史，决定下一步派给谁"""
    # 让 LLM 在 [researcher, coder, FINISH] 里选
    decision = llm_route(
        state["messages"],
        options=["researcher", "coder", "FINISH"],
        prompt="你是团队主管。看任务进展，决定下一步派给谁，或FINISH。"
    )
    return {"next": decision, "messages": [{"role": "assistant", "content": f"主管决定：派给 {decision}"}]}

# —— 路由函数：按 supervisor 的决定走 ——
def route(state: TeamState) -> str:
    nxt = state["next"]
    if nxt == "FINISH":
        return END
    return nxt   # "researcher" / "coder"

# —— 画图 ——
g = StateGraph(TeamState)
g.add_node("supervisor", supervisor)
g.add_node("researcher", researcher)
g.add_node("coder", coder)
g.add_edge(START, "supervisor")              # 从主管开始
g.add_conditional_edges("supervisor", route) # 主管决定下一步
g.add_edge("researcher", "supervisor")       # 下属干完回主管
g.add_edge("coder", "supervisor")
app = g.compile(checkpointer=MemorySaver())
```

**看清这张图**：

```
START → supervisor ──(researcher)──→ researcher → supervisor
          │                                        │
          │(coder)──────→ coder → supervisor        │
          │                                        │
          └──────(FINISH)──→ END                   ↑
              主管每轮决定下一步，下属干完回到主管，循环
```

**和单 Agent 的本质区别**：单 Agent 的 Loop 是"一个模型自己想+做"；supervisor 是"模型想（派给谁），下属做，结果回流"。**想和做分离**——这正是 supervisor 的价值。

### Supervisor 的决策：路由怎么可靠

supervisor 的核心动作是"决定派给谁"。这个决策怎么让它可靠？关键在 prompt 设计：

```python
def llm_route(messages, options, prompt):
    """让 LLM 做结构化路由决策"""
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": prompt + "\n选项: " + ", ".join(options)}]
                  + messages,
        temperature=0,   # 路由要确定
        response_format={"type": "json_object"},
    )
    import json
    return json.loads(resp.choices[0].message.content)["next"]
```

**可靠路由的三个要点**：
1. **选项有限**：让 LLM 在明确的 options 里选，而非开放生成——结构化输出降低幻觉（M2 的约束）
2. **temperature=0**：路由要确定，不要随机性
3. **给 supervisor 每个下属的描述**：它得知道"派给研究员能干啥、派给程序员能干啥"，否则乱派

**常见 bug**：supervisor 把不存在的 Agent 名字当 next 输出（幻觉）。对策——**校验 next 在合法 options 里**，不在就当"重新决策"或降级：

```python
def route(state):
    nxt = state["next"]
    valid = {"researcher", "coder", "FINISH"}
    if nxt not in valid:
        return "supervisor"   # 非法路由，回主管重新决定
    return END if nxt == "FINISH" else nxt
```

### 处理下属失败：supervisor 的容错职责

下属 Agent 会失败（LLM 报错、工具超时、产出质量差）。supervisor 要处理——这是 L11-01 说的"中心化的容错优势"：

```python
def researcher(state):
    try:
        result = search_and_summarize(state["messages"])
        if not result or "错误" in result:
            # 质量差，告诉主管让它决定重试/换人
            return {"messages": [{"role": "user",
                "content": "研究失败：搜索无结果，请考虑换方案或重试"}]}
        return {"messages": [{"role": "user", "content": f"研究结果：{result}"}]}
    except Exception as e:
        # 异常，报告主管
        return {"messages": [{"role": "user",
            "content": f"研究异常：{e}，需要重试或降级"}]}

def supervisor(state):
    decision = llm_route(state["messages"], options=[...], prompt=
        "你是主管。如果下属报告失败，考虑重试（最多2次）或换人。"
        "多次失败则降级为'人工介入'或FINISH。")
    return {"next": decision, ...}
```

**supervisor 容错三策**：
- **重试**：暂时性失败（超时/限流），同一下属重试（呼应 M7 重试）
- **换人**：某下属持续失败，换另一个下属或换方法
- **降级/上报**：彻底搞不定，降级到简化方案或转人工（M7 降级链 + L10-03 HITL）

> 容错的关键是**把"失败"作为正常 state 流动**——下属失败不是抛异常炸掉整个图，而是把"失败信息"作为消息回 supervisor，让它决策。这要求下属节点**捕获异常转成消息**，而非让异常冒泡。

### 中心化 vs 去中心化：Supervisor 的权衡

supervisor 是中心化方案，但中心化有代价。清醒对比：

| 维度 | 中心化（supervisor） | 去中心化（网状/对话式） |
|------|---------------------|------------------------|
| 全局协调 | 强（主管全局可见） | 弱（各自为政） |
| 单点风险 | 高（主管挂全崩） | 低（无单点） |
| 扩展性 | 主管成瓶颈，下属多则慢 | 通信 O(n²) 爆炸 |
| 控制流可预测 | 高 | 低（涌现行为） |
| 调试 | 易（看主管决策） | 难（交互路径多） |
| 适合 | 结构化、需协调 | 开放、需涌现创造性 |

**什么时候 supervisor 是对的选择**：
- 任务可拆解、有明确子角色 → supervisor 调度高效
- 需要全局视角做协调 → supervisor 看全貌
- 要可预测、可调试 → 中心化决策清晰

**什么时候该避免 supervisor**：
- 下属数量太多 → 主管带宽/智力成瓶颈（升级到层级拓扑）
- 下属间需要灵活直接协作 → 绕主管低效（用网状/对话式）
- 主管决策质量决定一切 → 主管不够强会拖垮全局

> 反模式：**一个 supervisor 直管 10+ 个下属**。主管每次要在 10 个选项里路由，决策噪声大、慢、易错。这种该升级成**层级**——主管只管 2-3 个组长，组长再管下属。L11-01 的拓扑选型在这里落地。

### Supervisor 的变体：动态 vs 静态分派

supervisor 有两种分派风格：

```
静态分派：任务一开始就规划好"谁做哪步"，supervisor 按计划派
  · 可预测、快
  · 但不适应执行中的意外（下属失败/需求变化）

动态分派：supervisor 每轮看当前 state，决定下一步派谁
  · 适应性强、能容错
  · 决策多、慢、可能乱
```

上面的 LangGraph 实现是**动态分派**（每轮回 supervisor 决策）。生产中常**混合**——先用 LLM 做一次粗规划（静态骨架），执行中 supervisor 在骨架内动态微调（适应意外）。P11 的软件团队就是这种混合。

### 要点总结

- supervisor 是"大脑"不是"手"——只负责想（拆解/派发/汇总/容错），不亲自干活；职责分离是关键
- LangGraph 实现：supervisor 是路由节点，按 state 选下属，下属干完回 supervisor 循环，FINISH 结束
- 路由可靠三要点：选项有限（结构化）、temperature=0、给每个下属的描述；非法路由要校验回退
- 容错三策：重试（暂时性）、换人（持续失败）、降级/上报（彻底失败）——把失败作为消息流动，而非抛异常
- 中心化权衡：全局协调强/可预测/易调试，但单点风险+主管瓶颈；下属太多升级层级
- 静态分派（规划好按计划）vs 动态分派（每轮决策）——生产常混合（静态骨架+动态微调）
- 反模式：一个 supervisor 直管 10+ 下属——升级层级，主管只管 2-3 个组长
- 下一节 L11-03：换网状拓扑，让 Agent 平等辩论——debate 多视角
