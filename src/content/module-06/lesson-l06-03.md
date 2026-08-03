## 并行工具调用与组合

M5 的 ReAct Agent 每次只调一个工具——搜索完再搜索，串行执行。但很多场景中，多个工具调用之间没有依赖关系，可以**并行执行**，大幅缩短 Agent 的响应时间。

先看 Function Calling 的完整调用链时序——从用户消息到模型返回 tool_calls，再到执行工具、回传结果、模型最终回答：

::interactive{type="functionCalling"}

### 串行 vs 并行

```
任务："对比北京和上海的天气"

串行（5 步，~15 秒）：
  Thought → get_weather("北京") → Obs
  Thought → get_weather("上海") → Obs
  Thought → Final Answer

并行（3 步，~8 秒）：
  Thought → 同时调 get_weather("北京") + get_weather("上海") → Obs
  Thought → Final Answer
```

并行调用把 2 次工具执行重叠在同一时间内，省了 1 次 LLM 推理和 1 次工具等待。

### OpenAI 并行工具调用

OpenAI 的 Function Calling 原生支持并行——模型可以在一次响应中返回多个 `tool_calls`。若工具有副作用或必须严格顺序，可显式关闭：`parallel_tool_calls=False`。

```python
# from openai import OpenAI; client = OpenAI()  # 沿用 L06-01
response = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "北京和上海现在的天气怎么样？"}],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "获取指定城市的当前天气",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            },
        }
    ],
)

# 模型可能一次返回 2 个 tool_calls
for tool_call in response.choices[0].message.tool_calls:
    print(f"工具: {tool_call.function.name}, 参数: {tool_call.function.arguments}")
# 工具: get_weather, 参数: {"city": "北京"}
# 工具: get_weather, 参数: {"city": "上海"}
```

### 并行执行 + 结果收集

```python
import json
import concurrent.futures

def execute_tools_parallel(tool_calls: list, tool_map: dict) -> list:
    """并行执行多个工具调用"""
    results = []

    with concurrent.futures.ThreadPoolExecutor() as executor:
        # 提交所有工具调用
        futures = {}
        for tool_call in tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            if fn_name in tool_map:
                future = executor.submit(tool_map[fn_name], **fn_args)
                futures[future] = tool_call
            else:
                results.append({
                    "tool_call_id": tool_call.id,
                    "content": f"错误: 未知工具 '{fn_name}'",
                })

        # 收集结果
        for future in concurrent.futures.as_completed(futures):
            tool_call = futures[future]
            try:
                result = future.result(timeout=30)
                results.append({
                    "tool_call_id": tool_call.id,
                    "content": str(result),
                })
            except Exception as e:
                results.append({
                    "tool_call_id": tool_call.id,
                    "content": f"工具执行错误: {e}",
                })

    return results


def agent_loop_parallel(user_input: str, max_rounds: int = 5) -> str:
    """支持并行工具调用的 Agent（client / TOOLS / TOOL_MAP 沿用 L06-01）"""
    messages = [{"role": "user", "content": user_input}]

    for _ in range(max_rounds):
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            tools=TOOLS,
            temperature=0,
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            return msg.content

        messages.append(msg)

        # 并行执行所有工具调用
        results = execute_tools_parallel(msg.tool_calls, TOOL_MAP)
        for result in results:
            messages.append({
                "role": "tool",
                "tool_call_id": result["tool_call_id"],
                "content": result["content"],
            })

    return "达到最大轮次限制。"
```

### 工具组合（Composite Tool）

当多个工具总是被一起调用时，可以组合成一个"超级工具"：

```python
# 三个独立工具
def search(query): ...
def fetch(url): ...
def summarize(text): ...

# 组合成一个研究工具
def research_topic(topic: str) -> str:
    """搜索一个主题，抓取最相关页面，返回摘要"""
    search_results = search(topic)
    if not search_results:
        return f"未找到关于 '{topic}' 的信息"

    # 抓取第一个结果的完整内容
    top_url = extract_url(search_results)
    page_content = fetch(top_url)
    summary = summarize(page_content)

    return f"主题: {topic}\n来源: {top_url}\n摘要: {summary}"

# 注册组合工具
TOOLS.append({
    "type": "function",
    "function": {
        "name": "research_topic",
        "description": "研究一个主题：自动搜索、抓取和总结。适合需要深入了解某个话题的场景。",
        "parameters": {
            "type": "object",
            "properties": {"topic": {"type": "string", "description": "研究主题"}},
            "required": ["topic"],
        },
    },
})
```

**组合的好处**：3 次工具调用 → 1 次，省 2 次 LLM 推理。
**组合的代价**：灵活性降低（模型不能中途换策略）。

### 工具间依赖管理

有些工具调用有先后依赖——B 的输入依赖 A 的输出：

```
无依赖（可并行）：            有依赖（必须串行）：
  search("北京天气")            search("北京景点") → 返回"故宫"
  search("上海天气")            fetch("故宫详情URL") → 依赖上一步的 URL
```

**处理策略**：让模型自己决定。模型在拿到第一轮结果后，会自然地在第二轮调依赖工具。不需要你在代码层硬编码依赖关系。

```python
# 第一轮：模型并行调用两个独立搜索
# tool_calls: [search("北京天气"), search("上海天气")]

# 第二轮：模型基于第一轮结果，调用有依赖的工具
# tool_calls: [compare_weather(beijing_result, shanghai_result)]
```

### 何时用并行 vs 串行

| 场景 | 推荐 | 原因 |
|------|------|------|
| 查多个独立信息 | 并行 | 无依赖，省时间 |
| 多步推理（A的结果影响B） | 串行 | 有依赖 |
| 批量处理（同一操作对多个输入） | 并行 | 无依赖 |
| 探索性搜索（不确定搜什么） | 串行 | 需要根据结果调整策略 |

**经验法则**：如果两个工具调用之间没有数据依赖，就并行。有依赖，就串行。让模型自己判断——它会根据问题自然选择。

### 动手 5 分钟

量化并行工具调用的真实加速比。

1. 造一个需要查 5 个独立数据源的任务，先串行实现，记录总耗时。
2. 改成 `asyncio.gather` 并行，再记录一次。
3. 加入一个会超时的数据源，确认单个失败不会拖垮整批。

**验收标准**：你算出的加速比接近但小于 5×，并能说出差距来自哪里（模型输出工具调用本身是串行的）。

### 要点总结

- 并行工具调用：一次 LLM 响应返回多个 tool_calls，并行执行，缩短响应时间
- OpenAI 原生支持并行——模型自动决定是否并行调用；有副作用时可设 `parallel_tool_calls=False`
- Anthropic 并行时须在**一条** user 消息中聚合全部 `tool_result`（见 L06-01），不要在循环里反复 `messages.create`
- 用 ThreadPoolExecutor 并行执行工具，设置超时防止单个工具卡住
- 工具组合（Composite Tool）：多个总是被一起调的工具合并成一个，省 LLM 调用次数
- 工具间依赖：让模型自己处理——有依赖时模型会自然串行调用
- 经验法则：无依赖→并行，有依赖→串行，模型自己判断
