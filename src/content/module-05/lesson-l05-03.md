## ReAct 范式深度解析

L05-02 你已经手写了一个 Agent Loop——那个循环的核心模式就叫 **ReAct**（Reason + Act）。这一节我们深入 ReAct 的论文原理、失败模式和工程优化。

### ReAct 的来源：让模型"出声思考"

ReAct 来自 2022 年的论文《ReAct: Synergizing Reasoning and Acting in Language Models》。核心思想极其简单：

> **让 LLM 交替进行"推理"（Thought）和"行动"（Action），而不是只做其中一件。**

```
纯推理（CoT）：       纯行动：              ReAct：
Thought → Answer     Action → Observation   Thought → Action → Observation → Thought → ...

"巴黎是哪国首都？"    search("巴黎")         Thought: 我需要确认巴黎是哪个国家的首都
"法国。"             "巴黎是法国首都..."     Action: search("巴黎")
                                           Observation: 巴黎是法国的首都...
                                           Thought: 确认了，巴黎是法国首都
                                           Final Answer: 法国
```

**为什么交替比纯推理好？** 纯推理靠模型内部知识，可能过时或错误；交替让模型在推理过程中可以"查证"，答案更可靠。

**为什么交替比纯行动好？** 纯行动只是机械调用工具，不思考"为什么调这个工具"和"结果意味着什么"；交替让模型在行动前思考目的，行动后反思结果。

### ReAct 的标准格式

```
Question: 用户的问题

Thought: 模型的推理（为什么选这个行动）
Action: 工具名
Action Input: 工具参数

Observation: 工具返回结果

Thought: 基于观察结果的推理
Action: 工具名
Action Input: 工具参数

Observation: 工具返回结果

Thought: 已经收集到足够信息
Final Answer: 最终回答
```

**关键约束**：
- Thought 和 Action 必须成对出现——不能只有 Action 没有 Thought
- Observation 由系统（不是模型）生成
- Final Answer 出现时循环结束

### ReAct 的失败模式

ReAct 不是完美的——它有几种典型的"跑偏"方式：

**失败模式 1：循环**

```
Thought: 搜索 "AI Agent"
Action: search
Action Input: {"query": "AI Agent"}
Observation: AI Agent 是...

Thought: 让我再搜索一下
Action: search
Action Input: {"query": "AI Agent"}  ← 重复搜索！
```

**解决方案**：检测重复行动 + 强制换策略。

```python
def detect_loop(history: list, window: int = 3) -> bool:
    """检测最近 window 步是否有重复行动"""
    if len(history) < window:
        return False
    recent_actions = [h["action"] + str(h.get("input", "")) for h in history[-window:]]
    return len(set(recent_actions)) < len(recent_actions)
```

**失败模式 2：发散**

```
Thought: 我需要了解 AI Agent
Action: search
Action Input: {"query": "AI Agent 历史"}
Observation: ...

Thought: 顺便看看深度学习的起源
Action: search
Action Input: {"query": "深度学习 起源"}  ← 偏离主题！
```

**解决方案**：在 System Prompt 中强调"只搜索与原问题直接相关的内容"。

**失败模式 3：幻觉工具调用**

```
Action: web_scraper
Action Input: {"url": "https://example.com"}
```

但你的工具注册表里根本没有 `web_scraper` 这个工具——模型"编造"了一个不存在的工具。

**解决方案**：工具不存在时返回明确错误 + 在 System Prompt 中列出所有可用工具。

**失败模式 4：过早终止**

```
Thought: 我大概知道答案了
Final Answer: AI Agent 是一种人工智能...  ← 没搜索就直接回答了
```

**解决方案**：在 System Prompt 中要求"必须至少使用一次工具后再回答"。

### ReAct vs Plan-and-Execute

ReAct 是"边想边做"——每一步都重新推理。Plan-and-Execute 是"先想好所有步骤再执行"。

```
ReAct（逐步推理）：              Plan-and-Execute（先规划）：
Thought → Action → Obs           Plan: 1. 搜索 X
Thought → Action → Obs                  2. 搜索 Y
Thought → Action → Obs                  3. 综合 X 和 Y
Thought → Final Answer          Execute: 1. 搜索 X → 结果
                                Execute: 2. 搜索 Y → 结果
                                Execute: 3. 综合结果 → 答案
```

| 维度 | ReAct | Plan-and-Execute |
|------|-------|-----------------|
| 灵活性 | 高（每步可调整） | 中（计划可重规划但有成本） |
| 适合任务 | 开放性探索、信息检索 | 多步骤固定流程、批处理 |
| Token 成本 | 高（每步都推理） | 中（规划一次 + 执行多次） |
| 可预测性 | 低 | 高（有明确的计划） |

**选型建议**：
- 不确定需要几步的任务 → ReAct
- 明确知道步骤的长流程 → Plan-and-Execute
- L05-04 会深入讲解 Plan-and-Execute

### 用 Function Calling 替代文本解析

L05-02 用的是文本解析（正则提取 `Action:` 和 `Action Input:`）。生产环境推荐用 Function Calling——更可靠、更不容易出格式错误。

```python
def agent_loop_fc(question: str, max_steps: int = 10) -> str:
    """用 Function Calling 实现的 ReAct Agent"""
    messages = [
        {"role": "system", "content": "你是一个自主研究助手。根据需要调用工具收集信息，然后给出最终回答。"},
        {"role": "user", "content": question},
    ]

    # 定义工具给 API
    tools = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        k: {"type": "string", "description": v}
                        for k, v in t["params"].items()
                    },
                    "required": list(t["params"].keys()),
                },
            },
        }
        for t in TOOL_REGISTRY.values()
    ]

    for step in range(max_steps):
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            tools=tools,
            temperature=0,
        )
        msg = response.choices[0].message

        # 如果模型没有调用工具，说明它在直接回答
        if not msg.tool_calls:
            return msg.content

        # 执行工具调用
        messages.append(msg)
        for tool_call in msg.tool_calls:
            fn = TOOL_REGISTRY[tool_call.function.name]["fn"]
            args = json.loads(tool_call.function.arguments)
            result = fn(**args)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result),
            })

    return "达到最大步数限制。"
```

**Function Calling 版本的优势**：
- 不需要正则解析——API 直接返回结构化的工具调用
- 模型不会"幻觉工具名"——只能调用定义好的工具
- 支持并行调用——一次可以调多个工具（M06-03 详解）

### 动手 5 分钟

把文本解析的 ReAct 换成 Function Calling，对比失败率。

1. 保留 L05-02 的正则解析版本，另写一版用原生工具调用。
2. 用同样 20 个任务各跑一遍，统计"解析失败 / 参数格式错误"的次数。
3. 故意让模型的思考里出现 `Action:` 字样（比如让它解释 ReAct 格式），看正则版会不会误触发。

**验收标准**：你能拿出正则版的具体崩溃样例，并说明为什么生产环境应该用结构化工具调用。

### 要点总结

- ReAct = Reason + Act：让 LLM 交替推理和行动，比纯推理或纯行动都好
- 标准格式：Thought → Action → Observation → ... → Final Answer
- 四类失败模式：循环、发散、幻觉工具、过早终止——每类都有对应解法
- ReAct vs Plan-Execute：开放探索用 ReAct，固定流程用 Plan-Execute
- 生产环境用 Function Calling 替代文本解析——更可靠、不会幻觉工具名
- ReAct 是 M5 的核心范式，后续 M6-M7 都是在 ReAct 基础上加工工程能力
