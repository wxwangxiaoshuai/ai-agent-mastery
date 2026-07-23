## AutoGen / AG2 对话式多 Agent

L11-02 的 supervisor 用"主管调度"组织多 Agent，L11-03 的 debate 用"立场对立"组织多 Agent。这一节换个范式——**对话式**：让多个 Agent 像人在群里聊天一样协作，谁说话、什么时候说，由消息和规则驱动。AutoGen（现 AG2）是对话式多 Agent 的代表。这一节上手它，并直面对话协作最难的问题——发散与收敛。

### 对话式范式的直觉

先建立直觉——对话式和 supervisor/debate 的根本不同：

```
Supervisor：中心指挥
  主管："你做这个，你做那个" → 下属做 → 回主管
  · 控制流：自上而下，主管说了算
  · 像军队

Debate：固定对抗
  正反方按轮次轮流发言 → 裁判总结
  · 控制流：预设轮次+角色
  · 像辩论赛

对话式（AutoGen）：消息驱动涌现
  AgentA 说："需求我拆好了，你看" → AgentB 回："方案这样...，能写吗" → AgentC："我来写..."
  · 控制流：由对话内容涌现，谁该接话由规则+模型决定
  · 像工作群聊
```

**对话式的特点**：控制流不在代码里写死，而是**从消息交互中涌现**。优势是灵活——Agent 能根据对话进展自然协作，不必预排流程；代价是**不可预测**——可能发散、跑题、无限聊下去。

### AutoGen 的核心抽象：Conversable Agent

AutoGen 一切围绕"能对话的 Agent"。每个 Agent 有 system message（角色）、能收发消息、能配工具。关键机制——**谁给谁发消息，由发起者显式指定，或由 group chat 管理器动态决定**：

```python
# pip install ag2   # 包名 ag2；代码里仍 import autogen
import autogen

# 配置 LLM
config_list = [{"model": "gpt-4o-mini", "api_key": "..."}]

# 1. 定义能对话的 Agent
coder = autogen.ConversableAgent(
    name="Coder",
    system_message="你是程序员，负责实现代码。完成后说 TERMINATE。",
    llm_config={"config_list": config_list},
    is_termination_msg=lambda m: "TERMINATE" in (m.get("content") or ""),
)
reviewer = autogen.ConversableAgent(
    name="Reviewer",
    system_message="你是代码审查员，审 Coder 的代码，指出问题或认可。完成后说 TERMINATE。",
    llm_config={"config_list": config_list},
    is_termination_msg=lambda m: "TERMINATE" in (m.get("content") or ""),
)

# 2. 显式编排对话：谁跟谁聊
coder.initiate_chat(
    reviewer,
    message="请帮我写一个计算斐波那契的函数，并审查它",
    max_turns=4,   # 限制轮次，防无限聊
)
```

**执行流程**：Coder 先发言（写函数）→ Reviewer 回应（审查）→ Coder 再回（修改）→ Reviewer 再审……直到有人说 TERMINATE 或到 max_turns。**像两个人在群里对话**，控制流从消息内容涌现。

### Group Chat：多 Agent 群聊

两个 Agent 显式 initiate_chat 够用，但多 Agent 时要"谁该接话"——这要 Group Chat 和一个 manager：

```python
# Group Chat Manager：决定下一个谁发言
pm = autogen.ConversableAgent(
    name="PM",
    system_message="你是产品经理，拆需求并推动协作完成。完成后说 TERMINATE。",
    llm_config={"config_list": config_list},
    is_termination_msg=lambda m: "TERMINATE" in (m.get("content") or ""),
)

groupchat = autogen.GroupChat(
    agents=[coder, reviewer, pm],
    messages=[],                    # 群聊历史
    max_round=6,                     # 最多 6 轮（防发散）
)

manager = autogen.GroupChatManager(
    groupchat=groupchat,
    llm_config={"config_list": config_list},
    system_message=(
        "你是群聊管理者。职责："
        "1. 每轮看历史，指定下一个发言者（最相关的角色）"
        "2. 发现跑题/重复/绕圈，提示拉回主题"
        "3. 任务完成或明显卡住，结束对话"
        "只做调度，不亲自给方案。"
    ),
)

# 发起群聊
pm.initiate_chat(manager, message="需求：写斐波那契函数并审查。请协作完成。")
```

**manager 的职责**：每轮看群聊历史，决定下一个让谁发言。它本质是 L11-02 的 supervisor——但调度的是"对话发言权"而非"任务执行"。**对话式里 supervisor 隐身成了 group chat manager**。

> 关键认知：对话式并没有真正"去中心化"——还是有 manager 在决定谁说话。区别在于**控制流的表达**：supervisor 是"派任务"，对话式是"分配发言权"。底层仍是星型（L11-01），只是抽象换了层皮。

### 终止条件：对话式最容易翻车的地方

对话式最危险的是**不知道何时停**。三个终止手段，必须用：

```
1. 显式终止词（TERMINATE）
   Agent 完成任务后说 TERMINATE → 群聊结束
   · 语义清晰，但依赖 Agent 自觉说

2. max_round 硬上限
   群聊最多 N 轮，到就停
   · 安全阀，防无限聊（必须设，呼应 M7 步数上限）

3. 自动终止检测（AutoGen 的 is_termination_msg）
   检测消息内容判断是否该停
   · 比依赖 TERMINATE 词更灵活
```

```python
groupchat = autogen.GroupChat(
    agents=[coder, reviewer],
    messages=[],
    max_round=6,   # 手段2：硬上限（安全阀，必设）
)
# 手段1：Agent system message 里要求完成说 TERMINATE
# 手段3：is_termination_msg 配在 Agent 构造参数上（见上文），检测 TERMINATE
```

> 反模式：**只靠 Agent 自觉说 TERMINATE，不设 max_round**。某天 Agent 没说终止词，群聊无限转，烧 token 烧到天亮。**max_round 是对话式的安全带，不可不系**。

### 发散与收敛：对话式的核心难题

对话式灵活，但灵活的另一面是**发散**——聊着聊着跑题、重复、绕圈。识别病态并收敛：

```
发散的病态：
  · 跑题：从"写斐波那契"聊到"算法复杂度理论"再到"图灵机"
  · 重复：A 说完 B 复述一遍 A 的话（互相恭维，L11-05 详谈）
  · 绕圈：A 提方案 B 否定 A 换方案 B 又否定，无限循环
  · 礼让：双方都说"你来""你来"，谁都不动手

收敛手段：
  1. manager 主动引导：看历史判断"跑题了"，提示拉回主题
  2. 角色明确化：每个 Agent 的 system message 限定职责，防越界
  3. 结构化产出：要求每轮产出明确物（代码/审查意见），而非泛泛讨论
  4. 终止条件：发散了也到 max_round 强制停
```

**给 GroupChatManager 配收敛引导**：把引导写进 `GroupChatManager` 的 `system_message`（见上一节示例），不要另起一个普通 `ConversableAgent` 冒充 manager——**只有 `GroupChatManager` 才负责群聊发言权调度**。

**收敛的本质**：对话式要靠**强 manager + 明确角色 + 结构化产出 + 硬终止**把"涌现"约束在"有用"的轨道里。不约束的对话式会发散成废话——这是它和 supervisor 的差距：supervisor 天然收敛（主管拍板），对话式要人为加收敛压力。

### AutoGen vs LangGraph supervisor：何时用哪个

对话式和 supervisor 的取舍：

| 维度 | AutoGen 对话式 | LangGraph supervisor |
|------|---------------|---------------------|
| 控制流 | 涌现（消息驱动） | 显式（图定义） |
| 灵活性 | 高（Agent 自然协作） | 低（按图走） |
| 可预测 | 低（可能发散） | 高（路径确定） |
| 适合 | 开放协作、讨论 | 结构化、需协调 |
| 调试 | 难（对话轨迹乱） | 易（状态可重放） |
| 终止 | 难（依赖规则+上限） | 易（图到 END） |

**决策**：
- 任务开放、需要 Agent 灵活协作讨论 → 对话式（如头脑风暴、方案研讨）
- 任务结构化、要可预测可调试 → supervisor（如流水线、有明确步骤的）
- 想要涌现创造性 → 对话式；想要可控可靠 → supervisor

> 务实建议：**生产优先 LangGraph supervisor**——可控、可调试、可重放。对话式适合需要"涌现"的场景，但生产用它要特别小心发散——没把收敛手段配齐，对话式会变成不可控的 token 黑洞。L11-05 会系统讲多 Agent 失败模式。

### AutoGen 的工具集成与人类介入

AutoGen 的 Agent 也能配工具、也能让人参与：

```python
# Agent 配工具（衔接 M6）
@coder.register_for_execution()
@reviewer.register_for_llm(name="run_code", description="执行代码验证")
def run_code(code: str) -> str:
    return sandbox_exec(code)   # M9 的沙箱

# 人类介入（衔接 L10-03）：把人作为一个 Agent
user_proxy = autogen.UserProxyAgent(
    name="Human",
    human_input_mode="TERMINATE",   # 关键决策让人介入
)
# 群聊里 user_proxy 在需要时会问真人
```

**意义**：对话式天然支持"人作为一个 Agent"参与——比 supervisor 的 HITL 更无缝。但这也意味着**对话式适合有人参与的协作流程**（人和 Agent 一起讨论），而非全自动。

### 要点总结

- 对话式：控制流从消息交互涌现，像群聊，灵活但不可预测
- AutoGen 核心：Conversable Agent（能对话）+ GroupChat + Manager（决定谁发言）
- Group Chat Manager 本质是 supervisor——对话式没真"去中心化"，只是抽象换皮
- 终止三手段：显式 TERMINATE 词、max_round 硬上限、is_termination_msg——max_round 必设（安全带）
- 发散病态：跑题/重复/绕圈/礼让；收敛手段：强 manager 引导、角色明确、结构化产出、硬终止
- 收敛本质：把"涌现"约束在"有用"轨道——不约束的对话式发散成废话
- vs supervisor：对话式灵活涌现但不可控难调试；supervisor 可靠可重放——生产优先 supervisor
- 对话式适合：开放协作讨论、人参与的流程（UserProxyAgent 无缝接人）
- 反模式：不设 max_round 靠 Agent 自觉终止 → 无限聊烧 token
- 下一节 L11-05：多 Agent 的协调成本与失败模式——病态行为、护栏、边际收益
