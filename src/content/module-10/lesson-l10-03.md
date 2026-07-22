## Human-in-the-Loop：人工介入编排

Agent 全自动跑很爽，直到它要执行一个**不可逆或高风险动作**——发邮件给客户、删数据库、转账、部署到生产。这种动作绝不能让 Agent 自己拍板。HITL（Human-in-the-Loop）让 Agent 在关键节点**暂停，等人工审核后再继续**。这一节在 LangGraph 上落地 HITL：工具审批、中断恢复、审核 UI、超时降级。

### 为什么需要 HITL：自主性与安全的张力

M5 定义了 Agent 的自主性——"模型决定下一步"。但自主性是个光谱，不是非黑即白：

```
自主性光谱：
  L1 纯工具调用（用户每步都确认）
  L2 工具可自动，关键动作前暂停 ← HITL 的甜蜜点
  L3 全自动（含高风险动作）
  L4 全自动且能自学
  L5 完全自主

问题：L3 以上，遇到不可逆动作（发邮件/删数据/转账）
      → 一次幻觉/注入就能造成真实损失
```

**HITL 的工程含义**：不是降低自主性，而是**在高风险动作前插一道人工闸门**。Agent 仍自主规划、自主执行低风险步骤，只在"危险边界"暂停交给人。这是自主性与安全的平衡点。

### 哪些动作该插入人工审核

判断标准：**这个动作是否可逆、损失多大**。

| 动作类型 | 可逆性 | 该不该 HITL |
|----------|--------|-------------|
| 读取/搜索/计算 | 可逆，无副作用 | 不需要 |
| 写文件（非生产） | 可逆 | 一般不需要 |
| 发邮件/通知客户 | 不可逆（发出去了） | 必须 HITL |
| 删数据库/删文件 | 不可逆 | 必须 HITL |
| 转账/支付 | 不可逆且涉钱 | 必须 HITL |
| 部署到生产 | 难逆且影响面大 | 必须 HITL |
| 调外部 API 改状态 | 看动作 | 视情况 |

> 设计原则：**按"可逆性"和"损失面"分级**。可逆、无副作用的自动跑；不可逆、涉钱/涉客户/涉数据的暂停等人审。把审核成本花在真正危险的边界，而非每个工具都拦（那样 Agent 退化成人肉操作）。

### LangGraph 的中断机制：interrupt

LangGraph 提供 `interrupt`——在节点里调用它，图会暂停，state 存进 checkpoint，等外部传入审核结果后续跑：

```python
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import MemorySaver

class State(TypedDict):
    email_draft: str
    approval: str        # approved / rejected
    sent: bool

def draft_email(state) -> dict:
    """起草邮件（自动）"""
    draft = llm_draft(state["messages"])
    return {"email_draft": draft}

def review_email(state):
    """人工审核节点——在这里暂停"""
    # interrupt() 暂停图，把 email_draft 抛给外部审核者
    decision = interrupt({
        "type": "email_approval",
        "draft": state["email_draft"],
        "prompt": "审核这封邮件：approve / reject / edit",
    })
    # 外部传回 decision 后，从这里继续
    return {"approval": decision["action"], "email_draft": decision.get("draft", state["email_draft"])}

def send_email(state) -> dict:
    """发送邮件（审核通过才到这）"""
    if state["approval"] != "approve":
        return {"sent": False}
    mail_api.send(state["email_draft"])
    return {"sent": True}

def route_after_review(state) -> str:
    if state["approval"] == "approve":
        return "send"
    elif state["approval"] == "edit":
        return "draft"     # 改完重审
    else:
        return END          # reject，结束

# 画图
g = StateGraph(State)
g.add_node("draft", draft_email)
g.add_node("review", review_email)
g.add_node("send", send_email)
g.add_edge(START, "draft")
g.add_edge("draft", "review")
g.add_conditional_edges("review", route_after_review)
g.add_edge("send", END)

app = g.compile(checkpointer=MemorySaver())
```

**执行流程**：

```python
config = {"configurable": {"thread_id": "email_1"}}

# 第一次跑：到 review 节点 interrupt 暂停
result = app.invoke({"messages": [...]}, config=config)
# 此时图停在 review，state 存进 checkpoint，result 含 interrupt 信息

# 人工看 draft，决定 approve/edit/reject
# 把决定传回，图从 review 续跑
result = app.invoke(
    Command(resume={"action": "approve"}),
    config=config,
)
# → 走 send 节点 → 发送 → END
```

**关键认知**：`interrupt` 不是"结束"，是"挂起"。state 完整保留在 checkpoint，随时可续。这比手写"暂停等用户"省心——框架管状态保存和恢复，你只管业务逻辑。

### 中断后的状态恢复：靠 checkpointer

HITL 的难点不在"暂停"，而在"恢复"。Agent 暂停了，人可能 10 分钟后才审核——这期间进程不能傻等。LangGraph 靠 checkpointer 解决：

```
时间线：
  T0: Agent 跑到 review，interrupt 暂停，state 存 checkpoint
  T0~T10: 进程可以处理别的请求（state 在 checkpoint 里，不占进程）
  T10: 人审核完，调 app.invoke(Command(resume=...), config=thread_id)
       → 框架从 checkpoint 加载 state → 从 review 续跑 → send → END
```

**这是为什么 HITL 必须配 checkpointer**（L10-02 的机制）。没有 checkpointer，暂停时 state 在内存里，进程一挂就全丢；有了它，state 持久化，暂停多久都能恢复。**HITL 和状态持久化是绑定的能力**。

### 工具调用前的审批：Tool Calling + interrupt

更常见的 HITL 场景：Agent 要调一个危险工具（如 `send_email`），调之前先让人审批。LangGraph 的 `ToolNode` + `interrupt` 实现：

```python
from langgraph.prebuilt import ToolNode

# 危险工具打标记
DANGEROUS_TOOLS = {"send_email", "delete_record", "transfer_money"}

def call_model(state):
    """Agent 决策节点：调 LLM 决定用哪个工具"""
    resp = llm(state["messages"], tools=ALL_TOOLS)
    msg = resp.choices[0].message
    # 如果要调危险工具，interrupt 让人审
    if msg.tool_calls:
        for tc in msg.tool_calls:
            if tc.function.name in DANGEROUS_TOOLS:
                decision = interrupt({
                    "type": "tool_approval",
                    "tool": tc.function.name,
                    "args": tc.function.arguments,
                    "prompt": f"批准执行 {tc.function.name}({tc.function.arguments})?",
                })
                if decision["action"] != "approve":
                    # 拒绝：把拒绝原因塞回 messages，让 Agent 重新决策
                    return {"messages": [{"role": "user",
                        "content": f"工具 {tc.function.name} 被人工拒绝：{decision.get('reason','')}，请换方案"}]}
    return {"messages": [msg]}

g = StateGraph(State)
g.add_node("agent", call_model)
g.add_node("tools", ToolNode(ALL_TOOLS))
g.add_edge(START, "agent")
g.add_conditional_edges("agent", lambda s: "tools" if s["messages"][-1].tool_calls else END)
g.add_edge("tools", "agent")
app = g.compile(checkpointer=MemorySaver())
```

**审批的两种粒度**：
- **粗粒度**：危险工具一律拦（如上，`send_email` 必须审）
- **细粒度**：看参数拦（如转账超过 1000 才审，小额自动）

> 生产推荐细粒度——按"动作+参数"组合判断危险度。转账 10 元自动放行，转账 1 万元必须审。这把人工成本花在真正高风险的调用上。

### 审核 UI：让人能方便地审

HITL 的体验取决于审核 UI 好不好用。Agent 暂停后，要让人看到"它要做什么、为什么、参数是啥"，并能一键批准/拒绝/编辑：

```
审核界面要素：
  ┌─────────────────────────────────────┐
  │ Agent 想执行：send_email            │
  │ 参数：{to: "client@x.com",          │
  │        subject: "...", body: "..."} │
  │ 上下文：基于前 3 轮对话草拟         │
  │                                     │
  │ [批准]  [拒绝]  [编辑后批准]         │
  │ 超时：5 分钟无操作自动拒绝          │
  └─────────────────────────────────────┘
```

**前端怎么拿到待审内容**：Agent `interrupt` 后，前端轮询或 WebSocket 拿到 interrupt payload，渲染审核卡。用户点批准，前端调 `app.invoke(Command(resume=...))` 续跑。P10 会把这个流做成可视化的。

### 超时降级：人不在怎么办

人审核可能拖延、可能离线。不能让 Agent 永远挂起。设计超时降级：

```python
import time

def review_with_timeout(state, timeout_sec=300):
    """带超时的审核"""
    started = time.time()
    try:
        decision = interrupt({...})
        return {"approval": decision["action"]}
    except Exception:
        pass
    # 超时（实际由外部调度器触发续跑 + 判定超时）
    return {"approval": "timeout_rejected"}   # 超时按拒绝处理

def route_after_review(state):
    if state["approval"] == "approve":
        return "send"
    elif state["approval"] == "timeout_rejected":
        return "notify_user"   # 超时：通知用户"待你审核的动作已取消"
    else:
        return END
```

**超时策略选项**：
- **超时拒绝**（默认安全）：没审就当拒绝，宁可不做也别误做
- **超时自动批准**：仅限低风险动作，高风险绝不可
- **超时升级**：转给更高级别审核者（如主管）

> 安全原则：**高风险动作超时一律按"拒绝"处理**。宁可让用户重跑一次，也别让"没审的动作"自动执行。这是"安全默认"思想——不确定时选更安全的那个。

### HITL 的成本：别过度使用

HITL 不是越多越好。每次人工审核都打断 Agent、消耗人的时间：

```
过度 HITL 的症状：
  · 每个工具都拦 → Agent 退化成人肉操作，人成了瓶颈
  · 低风险动作也拦 → 审核疲劳，人开始无脑点"批准"，审核形同虚设
  · 审核队列堆积 → 任务积压，响应变慢

正确姿势：
  · 只拦不可逆/高损失动作
  · 细粒度：看参数定危险度，低风险自动放行
  · 给审核者足够上下文（为啥要这么做），减少误判
  · 批量审核：同类动作聚合成一批一次审
```

> HITL 的目标是"在关键边界把关"，不是"全程盯着 Agent"。把闸门设在真正危险的边界，其余让 Agent 自主——这才发挥了 Agent 的效率优势。

### 要点总结

- HITL 平衡自主性与安全：Agent 自主跑低风险步骤，在高风险动作前暂停交人审
- 该审的动作：不可逆、涉钱/涉客户/涉数据的（发邮件、删数据、转账、部署）；可逆无副作用的自动跑
- LangGraph interrupt：暂停图、state 存 checkpoint、外部传 decision 后续跑——不是结束是挂起
- HITL 必须配 checkpointer：暂停多久都能恢复，state 持久化，进程可处理别的请求
- 工具审批粒度：粗粒度（危险工具一律拦）vs 细粒度（看参数，如转账超阈值才拦）——生产推荐细粒度
- 审核 UI 要给足上下文：做什么、为什么、参数、超时策略，一键批准/拒绝/编辑
- 超时降级：高风险动作超时一律按"拒绝"（安全默认），低风险才可超时自动批准
- 别过度使用：只拦关键边界，否则 Agent 退化成人肉操作、审核疲劳让人无脑点批准
- 下一节 L10-04：换 CrewAI 的视角，用角色分工表达多 Agent 协作
