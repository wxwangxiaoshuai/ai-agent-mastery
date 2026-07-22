## CrewAI：角色驱动的多 Agent 协作

L10-02、L10-03 用 LangGraph 画控制流图。但有一类需求用图表达很别扭——**任务天然能拆成"不同角色分工"**。开发一个软件：PM 调研需求、架构师设计、程序员实现、测试验收。这种"角色剧组"结构，用 CrewAI 表达比画图直观得多。这一节上手 CrewAI，并看清它和 LangGraph 的取舍。

### CrewAI 的核心抽象：剧组模型

CrewAI 把多 Agent 协作类比成一个剧组，四要素：

```
Crew（剧组）  = 整个任务团队
  ├─ Agents（演员）   = 多个角色 Agent，各有 role/goal/backstory
  ├─ Tasks（剧本）    = 多个任务，每个有 description/expected_output/agent
  └─ Process（流程）  = 怎么把任务串起来（sequential 顺序 / hierarchical 分层）

类比：
  Crew   = "拍一部电影的剧组"
  Agent  = "导演 / 编剧 / 主演"
  Task   = "写剧本 / 拍场景 / 后期"
  Process= "顺序拍 / 导演统一调度"
```

**和 LangGraph 的本质差异**：LangGraph 让你画"节点-边"控制流（精细）；CrewAI 让你定义"角色-任务"，**控制流由框架按 Process 隐式编排**（简洁）。哪个更合适，看你的任务更像"机器流程"还是"人协作"。

### 最小例子：一个开发剧组

装好 CrewAI（`pip install crewai`），定义一个 3 人开发剧组：

```python
from crewai import Agent, Task, Crew, Process

# 1. 定义角色（演员）
pm = Agent(
    role="产品经理",
    goal="把模糊需求拆解成清晰、可执行的功能点",
    backstory="资深 PM，擅长把用户语言翻译成开发能懂的需求",
    llm="gpt-4o-mini",
    allow_delegation=False,
)
architect = Agent(
    role="架构师",
    goal="为功能设计技术方案，选择合适的技术栈",
    backstory="10 年后端经验，擅长做技术选型和架构权衡",
    llm="gpt-4o-mini",
    allow_delegation=False,
)
coder = Agent(
    role="程序员",
    goal="按方案实现功能代码",
    backstory="全栈工程师，代码质量高、写得快",
    llm="gpt-4o-mini",
    allow_delegation=True,   # 允许委托（需要时请其他角色帮忙）
)

# 2. 定义任务（剧本）
req_task = Task(
    description="分析这个需求：{user_req}。输出清晰的功能点列表",
    expected_output="Markdown 格式的功能点列表，每个含验收标准",
    agent=pm,
)
design_task = Task(
    description="基于功能点设计技术方案，输出架构图描述和接口定义",
    expected_output="技术方案文档：含架构、接口、技术选型理由",
    agent=architect,
    context=[req_task],   # 依赖前一个任务的输出
)
impl_task = Task(
    description="按技术方案实现核心代码",
    expected_output="可运行的代码 + 简要说明",
    agent=coder,
    context=[design_task],
)

# 3. 组剧组（Crew），指定流程
crew = Crew(
    agents=[pm, architect, coder],
    tasks=[req_task, design_task, impl_task],
    process=Process.sequential,   # 顺序执行：pm→architect→coder
    verbose=True,
)

# 4. 开拍
result = crew.kickoff(inputs={"user_req": "做一个能记录每日心情的 CLI 工具"})
print(result.raw)
```

**关键设计**：
- **Agent 的 backstory 不是装饰**——它塑造角色的"思维方式"，影响输出风格。资深架构师 vs 实习生，给同样的功能点会出不同方案。
- **Task 的 context** 显式声明任务依赖——`design_task` 用 `context=[req_task]`，自动把 PM 的输出喂给架构师。**依赖关系是数据流的声明**，不用手写"把上一步结果传下一步"。
- **expected_output 约束输出**——让每个角色产出符合预期格式，减少发散。

### Process：sequential vs hierarchical

CrewAI 两种内置流程，决定任务怎么编排：

```
sequential（顺序）：
  pm → architect → coder → (结束)
  · 任务按列表顺序执行，前一个的输出喂后一个
  · 简单、可预测
  · 适合：流水线式任务

hierarchical（分层）：
  ┌─ manager（主管 Agent）─┐
  │ 分配任务给下属、汇总结果 │
  └────┬───┬───┬──────────┘
       ↓   ↓   ↓
      pm  arch coder
       ↓   ↓   ↓
       汇总回 manager
  · 自动加一个"主管"Agent 做调度
  · 更灵活：主管决定谁做、做几轮
  · 适合：复杂任务、需要动态分工
```

```python
# hierarchical：加主管调度
crew = Crew(
    agents=[pm, architect, coder],
    tasks=[req_task, design_task, impl_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o",   # 主管用更强的模型
    verbose=True,
)
```

**何时用 hierarchical**：任务不能预先排成线，需要"主管看情况分配、可能反复"。代价是多一个 Agent 调度开销、且主管的判断质量决定整体——主管不行则全盘乱。能预先排顺序就别上 hierarchical。

### 角色间委托：allow_delegation

上面 coder 设了 `allow_delegation=True`——它执行时如果觉得"这需求该 PM 再澄清一下"，可以委托回 PM。这是 CrewAI 的特色：

```
程序员实现时发现需求模糊
  → allow_delegation 触发
  → 自动问 PM："这个功能点 X 的验收标准能否再明确？"
  → PM 回答 → 程序员继续
```

**价值**：角色间能动态求助，比死板的顺序流灵活。
**风险**：委托可能循环（PM 问架构师、架构师问程序员……）。生产要限制委托深度和轮次，呼应 M11 的"多 Agent 病态行为"。

### 工具集成：给角色装手

CrewAI 的 Agent 能配工具（衔接 M6 的工具工程）：

```python
from crewai.tools import tool

@tool("搜索网络")
def web_search(query: str) -> str:
    """搜索网络获取最新信息。输入搜索词。"""
    return search_api(query)

researcher = Agent(
    role="研究员",
    goal="用搜索工具调研指定主题",
    backstory="擅长用搜索快速收集资料",
    tools=[web_search],   # 这个角色有搜索能力
    llm="gpt-4o-mini",
)
```

**工具粒度的设计**：不是所有角色都有所有工具。研究员有搜索，程序员有代码执行沙箱（M9），PM 可能啥工具都没有只负责写需求——**角色能力边界 = 它带的工具集**。这是 CrewAI 把"分工"落到工程的方式。

### CrewAI vs LangGraph：什么时候用哪个

这是 L10-01 选型框架的具体化，对照两个框架的取舍：

| 维度 | CrewAI | LangGraph |
|------|--------|-----------|
| 抽象形状 | 角色-任务 | 节点-边状态图 |
| 控制流 | 隐式（框架按 Process 编排） | 显式（你画图） |
| 表达力 | 顺序/分层两种，复杂流吃力 | 分支/循环/并行/HITL 都能画 |
| 上手 | 快（像写岗位说明） | 慢（要想清楚图） |
| 灵活性 | 低（流程被框架管） | 高（完全自定义） |
| 适合 | 角色天然分工的多 Agent | 复杂控制流的单/多 Agent |
| 调试 | 角色输出好读，控制流黑盒 | 状态轨迹清晰，可重放 |
| 持久化 | 较弱 | checkpointer 内建强 |

**决策准则**：

```
你的任务像"角色分工协作"吗？（PM/架构师/程序员这种天然角色）
├─ 是，且流程大致顺序或可分层 → CrewAI
└─ 否，是"机器流程"有复杂分支/循环/并行/HITL → LangGraph

需要精细控制流（条件分支、循环、并行汇聚、人工介入）吗？
├─ 需要 → LangGraph（CrewAI 表达不了或不优雅）
└─ 不需要，角色分工就够 → CrewAI

需要状态���久化和重放调试吗？
├─ 需要 → LangGraph（checkpointer 内建）
└─ 不需要 → 两者都行，看上面
```

> 反模式：**用 CrewAI 硬拧复杂控制流**。"第 3 个任务做完要看结果决定是回到第 1 个还是跳第 5 个"——这种条件循环 CrewAI 的 sequential/hierarchical 都不擅长，硬写出来的"主管"提示词会很长很脆，且不可控。这种该用 LangGraph。反过来，"PM→架构师→程序员"用 LangGraph 画 3 节点线性图也没错，但 CrewAI 表达更自然。

### 混合使用：各取所长

生产里常见混合：**CrewAI 管角色分工的大结构，关键节点用 LangGraph 的精细控制**。比如：

```
用 CrewAI 编排 "调研→设计→实现" 三角色
  但在"设计"后插入 LangGraph 的 HITL 人工审核
  审核通过才让"实现"角色开工
```

这需要把 CrewAI 的 Task 输出接到 LangGraph 的节点，反之亦然——集成成本存在。务实路径：**先选一个为主**，除非真的两种抽象都不可替代，否则别混合（混合增加调试复杂度，L10-06 会讲框架混用的坑）。

### 要点总结

- CrewAI 剧组模型四要素：Crew（剧组）/Agent（演员，role+goal+backstory）/Task（剧本）/Process（流程）
- 与 LangGraph 本质差异：CrewAI 隐式控制流（简洁），LangGraph 显式画图（精细）
- Task 的 context 声明依赖（数据流），expected_output 约束输出，backstory 塑造角色思维
- Process：sequential（顺序流水线）vs hierarchical（主管调度）——能顺序就别上 hierarchical
- allow_delegation 让角色间动态委托求助，但要限深度防循环（呼应 M11 病态行为）
- 工具按角色配：角色能力边界 = 它带的工具集，这是分工的工程落地
- CrewAI vs LangGraph：角色分工选 CrewAI，复杂控制流/HITL/持久化选 LangGraph
- 反模式：用 CrewAI 拧条件循环、用 LangGraph 画简单线性剧组——都别扭，匹配抽象形状
- 混合可用但增本：先选一个为主，除非两种抽象都不可替代
- 下一节 L10-05：无论哪个框架，都要把 Agent 思考过程流式推到前端
