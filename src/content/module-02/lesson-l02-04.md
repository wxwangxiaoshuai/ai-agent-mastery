## 结构化输出：让模型吐 JSON

Agent 的"手"要能解析模型的输出。如果模型返回的是自由格式文本，Agent 就需要再写一个"文本解析器"——这既脆弱又容易出错。结构化输出让模型直接返回可被代码消费的 JSON。

先用工具 Schema 设计器练一把「契约质量」——参数粒度、命名、描述、错误信息写清楚，模型才调得准。同样的纪律也适用于本节的结构化输出（主战场的 Function Calling 在 L06-02）：

::interactive{type="toolSchema"}

### 为什么需要结构化输出

```
自由文本输出：
"根据分析，这段代码的复杂度为 O(n²)，主要瓶颈在第 12 行的嵌套循环。
建议使用哈希表优化，可以将复杂度降到 O(n)。"

结构化输出：
{
  "complexity": "O(n²)",
  "bottleneck": { "line": 12, "reason": "嵌套循环" },
  "suggestion": "使用哈希表替代内层循环",
  "optimized_complexity": "O(n)"
}
```

结构化输出的优势：
- 可以被代码直接解析，无需正则或 NLP 后处理
- 字段类型明确，减少解析错误
- 缺少字段或格式错误可以被检测到（而自由文本的"错误"很难自动发现）

### 方法 1：Prompt 约束

最简单的方式：在 Prompt 中明确要求 JSON 格式。

```
请以 JSON 格式输出，不要包含任何其他文字。

{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 0.0 - 1.0,
  "keywords": ["关键词1", "关键词2"]
}

文本：{"这个产品功能强大但价格太高"}
```

**问题**：Prompt 约束不保证输出的 JSON 一定合法。模型可能：
- 输出额外的解释文字
- 忘记闭合引号
- 在 JSON 中使用注释（JSON 标准不支持注释）

### 方法 2：JSON Mode

主流 API 现在支持 JSON Mode——在 API 参数中指定 `response_format`，强制模型输出合法 JSON。

**OpenAI JSON Mode**：
```python
response = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "列出 3 种水果及其颜色"}],
    response_format={"type": "json_object"},
)
```

**OpenAI Structured Outputs**（更推荐）：

OpenAI 支持 `json_schema` 类型，不仅保证输出合法 JSON，还保证**符合你指定的 Schema**：

```python
response = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "列出 3 种水果及其颜色"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "fruit_list",
            "strict": True,  # 严格模式：模型必须完全遵循 Schema
            "schema": {
                "type": "object",
                "properties": {
                    "fruits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "color": {"type": "string"}
                            },
                            "required": ["name", "color"],
                            "additionalProperties": False  # strict 模式必需：禁止额外字段
                        }
                    }
                },
                "required": ["fruits"],
                "additionalProperties": False  # strict 模式必需：每一层 object 都要加
            }
        }
    },
)
```

> **注意**：OpenAI 的 `strict: true` 模式**要求** Schema 中每一层 `object` 都设置 `"additionalProperties": false`，否则 API 会返回 `400 Invalid schema` 错误。这是最常踩的坑。

**Anthropic 结构化输出**：

Anthropic 在 Claude 4.5+ 已提供原生 Structured Outputs（`output_format` 参数，语法约束式 JSON 生成）。以下是两种通用方式：

**方式 A：原生 Structured Outputs（推荐，Claude 4.5+）**：

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-sonnet-5",
    max_tokens=1024,
    output_format={
        "type": "json_schema",
        "json_schema": {
            "name": "review",
            "schema": {
                "type": "object",
                "properties": {
                    "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]},
                    "score": {"type": "integer", "minimum": 1, "maximum": 5},
                    "summary": {"type": "string"}
                },
                "required": ["sentiment", "score"]
            }
        }
    },
    messages=[{"role": "user", "content": "评价：这个产品功能强大但价格太高"}],
)
```

**方式 B：Tool Use（兼容旧版 Claude）**——利用工具调用机制返回结构化数据：

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[{
        "name": "extract_fruits",
        "description": "输出水果列表",
        "input_schema": {
            "type": "object",
            "properties": {
                "fruits": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "color": {"type": "string"}
                        },
                        "required": ["name", "color"]
                    }
                }
            },
            "required": ["fruits"]
        }
    }],
    tool_choice={"type": "tool", "name": "extract_fruits"},  # 强制调用此工具
    messages=[{"role": "user", "content": "列出 3 种水果及其颜色"}],
)

# 从 tool_use 响应中提取结构化数据
tool_result = next(
    block for block in response.content
    if block.type == "tool_use"
)
fruits_data = tool_result.input  # 已是 dict，无需 json.loads
```

**方式 C：Prefill（预填充）**——在 assistant 消息中预填 `{`，强制模型以 JSON 开头：

```python
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="你是一个 JSON 生成器。只输出合法 JSON，不要输出任何其他文字。",
    messages=[
        {"role": "user", "content": "列出 3 种水果及其颜色，格式：{\"fruits\": [{\"name\": \"...\", \"color\": \"...\"}]}"},
        {"role": "assistant", "content": "{"}  # prefill：强制以 { 开头
    ],
)
# 拼接 prefill 和响应
json_str = "{" + response.content[0].text
```

> **对比**：原生 Structured Outputs 最可靠（有 Schema 约束且返回保证合法 JSON），Tool Use 次之，Prefill 方式最轻量但不保证 Schema。生产环境推荐原生 Structured Outputs。

### 方法 3：Function Calling / Tool Use

Function Calling 是当前最可靠的结构化输出方式。它利用模型的工具调用机制，让模型"调用"一个函数来返回结构化数据。

```python
response = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "分析这段代码：def fib(n): return n if n<2 else fib(n-1)+fib(n-2)"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "code_analysis",
            "description": "输出代码分析结果",
            "parameters": {
                "type": "object",
                "properties": {
                    "complexity": {"type": "string", "enum": ["O(1)", "O(n)", "O(n²)", "O(2ⁿ)"]},
                    "issues": {"type": "array", "items": {"type": "string"}},
                    "suggestions": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["complexity", "issues", "suggestions"]
            }
        }
    }],
    tool_choice={"type": "function", "function": {"name": "code_analysis"}},
)
```

Function Calling 的优势：
- 模型擅长"调用函数"——这是它训练中大量接触的模式
- Schema 约束强，字段类型、枚举值都有保障
- 可以同时定义多个工具，让模型选择最合适的输出格式

### 方法 3.5：Gemini 结构化输出

Google Gemini 也支持通过 `response_schema` 参数约束输出结构：

```python
import google.generativeai as genai
from pydantic import BaseModel

# 定义 Schema（Pydantic 模型）
class Fruit(BaseModel):
    name: str
    color: str

class FruitList(BaseModel):
    fruits: list[Fruit]

# 使用 response_schema 约束输出
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content(
    "列出 3 种水果及其颜色",
    generation_config={
        "response_mime_type": "application/json",
        "response_schema": FruitList,
    },
)
fruits = FruitList.model_validate_json(response.text)
```

### 方法 4：instructor 库（推荐）

[instructor](https://github.com/instructor-ai/instructor) 是一个 Python 库，它把 Function Calling / Tool Use 封装成了 Pydantic 模型——写出更自然，校验更可靠。

**OpenAI + instructor**：

```python
import instructor
from pydantic import BaseModel, Field
from openai import OpenAI

client = instructor.from_openai(OpenAI())

class CodeAnalysis(BaseModel):
    complexity: str = Field(description="时间复杂度", enum=["O(1)", "O(n)", "O(n²)", "O(2ⁿ)"])
    issues: list[str] = Field(description="发现的问题")
    suggestions: list[str] = Field(description="改进建议")

analysis = client.chat.completions.create(
    model="gpt-5",
    response_model=CodeAnalysis,
    messages=[{"role": "user", "content": "分析这段代码：def fib(n): return n if n<2 else fib(n-1)+fib(n-2)"}],
)

print(analysis.complexity)  # "O(2ⁿ)"
print(analysis.issues)      # ["使用递归导致指数级时间复杂度", "没有缓存中间结果"]
```

**Anthropic + instructor**：

```python
import instructor
from pydantic import BaseModel, Field
from anthropic import Anthropic

client = instructor.from_anthropic(Anthropic())

class CodeAnalysis(BaseModel):
    complexity: str = Field(description="时间复杂度")
    issues: list[str] = Field(description="发现的问题")
    suggestions: list[str] = Field(description="改进建议")

analysis = client.messages.create(
    model="claude-sonnet-4-20250514",
    response_model=CodeAnalysis,
    max_tokens=1024,
    messages=[{"role": "user", "content": "分析这段代码：def fib(n): return n if n<2 else fib(n-1)+fib(n-2)"}],
)

print(analysis.complexity)  # "O(2ⁿ)"
```

instructor 的核心优势：
- **自动重试**：如果模型输出不符合 Pydantic 模型，自动把验证错误反馈给模型并重试（可配置重试次数）
- **流式输出**：对于长列表，可以逐条流式接收
- **多模型支持**：OpenAI、Anthropic、Gemini、Ollama 等
- **统一接口**：同一套 Pydantic 模型可以切换不同模型后端

> **为什么推荐 instructor**：它把"结构化输出"从"写 Schema + 手动解析 + 处理异常"简化为"定义 Pydantic 模型 + 一行调用"。在 Agent 开发中，几乎所有模型输出都应该走结构化路径。

### 结构化输出的可靠性对比

| 方法 | 合法性保证 | Schema 保证 | 实现复杂度 | 推荐场景 |
|------|-----------|------------|-----------|---------|
| Prompt 约束 | 低 | 无 | 低 | 原型验证 |
| JSON Mode | 高 | 无 | 低 | 简单 JSON 输出 |
| Function Calling / Tool Use | 高 | 高 | 中 | 生产环境（OpenAI / Anthropic） |
| Gemini `response_schema` | 高 | 高 | 低 | Gemini 生态 |
| instructor | 高 | 高 | 低 | 生产环境（推荐，多模型） |

### 异常处理：输出不合法怎么办

即使使用 Function Calling，也需要处理异常：

```python
import json

def safe_parse(response) -> dict:
    """安全解析模型输出，多层降级"""
    try:
        # 方案 1：直接解析 JSON
        return json.loads(response)
    except json.JSONDecodeError:
        pass
    
    try:
        # 方案 2：从文本中提取 JSON 块
        import re
        match = re.search(r'\{[\s\S]*\}', response)
        if match:
            return json.loads(match.group())
    except (json.JSONDecodeError, AttributeError):
        pass
    
    # 方案 3：用另一个模型调用修复
    fix_response = call_llm(
        prompt=f"以下文本应该是 JSON，但解析失败。请修复它并只返回合法的 JSON：\n\n{response}",
        response_format={"type": "json_object"},
    )
    return json.loads(fix_response)
```

> 三层降级策略：直接解析 → 正则提取 → 模型修复。每一层都是对上一层的兜底。

### 动手 5 分钟

给一个会失败的结构化输出加上完整的兜底链路。

1. 写一个抽取任务（从简历文本抽出 `name` / `years` / `skills[]`），先用纯 Prompt 约束实现。
2. 故意喂 5 条脏输入（空文本、超长文本、含 JSON 片段的文本、非中文、纯表情）。
3. 补上三层兜底：Pydantic 校验失败 → 带错误信息重试一次 → 仍失败则返回带 `parse_error` 标记的降级对象。

**验收标准**：5 条脏输入全部不抛未捕获异常，且日志里能看出每条走的是哪一层。

### 要点总结

- 结构化输出是 Agent 的基石——模型输出必须能被代码可靠解析
- Prompt 约束最简单但不保证合法性；JSON Mode 保证合法但不保证 Schema
- Function Calling / Tool Use 是最可靠的结构化输出方式
- Gemini 通过 `response_schema` 同样支持 Schema 约束
- instructor 库封装了 Function Calling + Pydantic 校验，推荐生产使用
- 永远为解析失败准备降级策略（正则提取 → 模型修复 → 抛异常）