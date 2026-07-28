## Function Calling 机制详解

M5 的 Agent 用文本解析（正则提取 `Action:`）来调用工具——这很透明但不可靠。Function Calling 是 API 层面的工具调用机制：**模型直接输出结构化的工具调用指令，不需要你解析文本**。它是生产级 Agent 的标配。

### 没有 Function Calling 的世界

```python
# 不用 Function Calling：模型输出文本，你用正则解析
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "北京今天天气怎么样？"}],
)
text = response.choices[0].message.content
# "我需要搜索天气信息。Action: search, Action Input: 北京天气"
# → 你需要正则提取 Action 和 Action Input → 脆弱、容易出错
```

### 有 Function Calling 的世界

```python
# 用 Function Calling：模型直接输出结构化工具调用
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "北京今天天气怎么样？"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名"},
                },
                "required": ["city"],
            },
        },
    }],
)
# 模型直接返回结构化的工具调用：
# tool_calls: [{name: "get_weather", arguments: '{"city": "北京"}'}]
# → arguments 是 JSON 字符串，需 json.loads 后再用；不需要正则解析工具名
```

### Function Calling 的数据流

```
1. 开发者定义工具 Schema（JSON Schema 格式）
       ↓
2. 用户提问 → 连同 tools 一起发送给 API
       ↓
3. 模型决策：需要调工具吗？调哪个？参数是什么？
       ↓
4. 模型返回 tool_call（结构化的工具调用指令）
       ↓
5. 开发者执行工具，获得结果
       ↓
6. 把结果以 role=tool 发回给模型
       ↓
7. 模型基于工具结果生成最终回答
```

第 3 步的决策依据主要是工具的 `name` / `description` / 参数描述（语义匹配）。工具写得越好，选对的概率越高——设计原则见 L06-02。
### 完整的 Function Calling 循环

```python
import json
from openai import OpenAI

client = OpenAI()

# 1. 定义工具
def get_weather(city: str) -> str:
    """模拟天气查询"""
    weather_db = {"北京": "晴 35°C", "上海": "多云 32°C", "成都": "雨 28°C"}
    return weather_db.get(city, f"{city}：暂无天气数据")

def get_time(timezone: str) -> str:
    """按 IANA 时区返回当前时间"""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    try:
        now = datetime.now(ZoneInfo(timezone))
    except Exception:
        return f"错误：无效时区 '{timezone}'。请使用 IANA 时区，如 'Asia/Shanghai'。"
    return f"{timezone} 当前时间: {now.strftime('%H:%M')}"

# 2. 定义工具 Schema（生产建议开启 strict，并禁止额外字段）
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名称，如'北京'"},
                },
                "required": ["city"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_time",
            "description": "获取指定时区的当前时间",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone": {"type": "string", "description": "时区，如'Asia/Shanghai'"},
                },
                "required": ["timezone"],
                "additionalProperties": False,
            },
        },
    },
]
# 3. 工具执行映射
TOOL_MAP = {
    "get_weather": get_weather,
    "get_time": get_time,
}

# 3.5 参数校验：Strict Schema 降低风险，但仍建议在应用层兜底
def parse_tool_args(raw: str, fn_name: str, required: list[str] | None = None) -> dict:
    try:
        args = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"工具 '{fn_name}' 的参数不是合法 JSON: {e}") from e
    if not isinstance(args, dict):
        raise ValueError(f"工具 '{fn_name}' 的参数必须是 object")
    for key in required or []:
        if key not in args:
            raise ValueError(f"工具 '{fn_name}' 缺少必填参数: {key}")
    return args

REQUIRED_ARGS = {
    "get_weather": ["city"],
    "get_time": ["timezone"],
}

# 4. Function Calling 循环
def chat_with_tools(user_input: str, max_rounds: int = 5) -> str:
    messages = [{"role": "user", "content": user_input}]

    for round_num in range(max_rounds):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
            temperature=0,
        )
        msg = response.choices[0].message

        # 如果模型没有调用工具 → 直接回答了
        if not msg.tool_calls:
            return msg.content

        # 把模型的工具调用加入历史
        messages.append(msg)

        # 执行每个工具调用
        for tool_call in msg.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = parse_tool_args(
                    tool_call.function.arguments,
                    fn_name,
                    REQUIRED_ARGS.get(fn_name),
                )
            except ValueError as e:
                result = f"错误: {e}"
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
                continue

            print(f"调用工具: {fn_name}({fn_args})")

            if fn_name in TOOL_MAP:
                result = TOOL_MAP[fn_name](**fn_args)
            else:
                result = f"错误: 未知工具 '{fn_name}'"

            print(f"工具结果: {result}")

            # 把工具结果发回给模型
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result),
            })

    return "达到最大轮次限制。"
# 运行
print(chat_with_tools("北京和上海现在的天气怎么样？现在几点了？"))
```

### OpenAI vs Anthropic 的 Function Calling

两家的机制本质相同，但 API 格式有差异：

| 差异点 | OpenAI | Anthropic |
|--------|--------|-----------|
| 参数名 | `tools` | `tools` |
| 模型返回 | `message.tool_calls` | `content` 中的 `tool_use` block |
| 工具结果 | `role: "tool"` | `role: "user"` + `tool_result` block |
| 并行调用 | 支持（多个 tool_calls） | 支持（多个 tool_use blocks） |
| 强制调用 | `tool_choice: {"type": "function", ...}` | `tool_choice: {"type": "tool", ...}` |

**Anthropic 版本**：

```python
from anthropic import Anthropic

claude = Anthropic()

response = claude.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[{
        "name": "get_weather",
        "description": "获取指定城市的当前天气",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名"},
            },
            "required": ["city"],
        },
    }],
    messages=[{"role": "user", "content": "北京天气怎么样？"}],
)

# 一次响应可能含多个 tool_use：先全部执行，再一次性回传 tool_result
tool_uses = [b for b in response.content if b.type == "tool_use"]
if tool_uses:
    tool_results = []
    for block in tool_uses:
        result = get_weather(**block.input)
        tool_results.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": result,
        })
    response2 = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        tools=[...],  # 同上
        messages=[
            {"role": "user", "content": "北京天气怎么样？"},
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ],
    )
    print(response2.content[0].text)
```

### tool_choice：控制模型的工具使用

```python
# auto（默认）：模型自己决定调不调工具
response = client.chat.completions.create(..., tool_choice="auto")

# none：禁止调工具（强制直接回答）
response = client.chat.completions.create(..., tool_choice="none")

# required：必须调工具（不能直接回答）
response = client.chat.completions.create(..., tool_choice="required")

# 指定工具：必须调某个特定工具
response = client.chat.completions.create(
    ...,
    tool_choice={"type": "function", "function": {"name": "get_weather"}},
)
```

### 动手 5 分钟

让模型自己暴露工具定义里的歧义。

1. 定义两个故意相近的工具：`search_docs` 和 `search_web`，描述都写得含糊。
2. 提 10 个问题，统计模型选错工具的次数。
3. 只改描述（不改代码逻辑），把"什么时候用我 / 什么时候别用我"写进去，再跑一遍。

**验收标准**：选错次数明显下降，且你能拿出改前改后的描述 diff，说明是哪一句话起了作用。

### 要点总结

- Function Calling 是 API 层面的工具调用——模型直接输出结构化指令，不需要文本解析
- 数据流：定义 Schema → 模型决策 → 返回 tool_call → 执行工具 → 结果发回 → 模型生成回答
- OpenAI 和 Anthropic 的机制相同但 API 格式不同（tool_calls vs tool_use block）
- tool_choice 控制模型行为：auto（自决）、none（禁用）、required（必调）、指定工具
- Function Calling 比文本解析可靠：工具名被约束在已注册集合内；仍可能选错工具或传错参数，需 Schema（可开 `strict`）+ 应用层校验 + 错误信息引导
- M5 的 ReAct Agent 可以直接用 Function Calling 替换文本解析，循环逻辑不变
