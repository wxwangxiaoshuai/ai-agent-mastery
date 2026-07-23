## 手写一个最小 Agent Loop

Agent Loop 的本质就是一个 while 循环——理解它最好的方式是亲手写一个。先用交互组件感受 Thought → Action → Observation 的节奏，再动手实现。

::interactive{type="agentLoop"}

### Agent Loop 的本质：一个 while 循环

```python
while not done:
    thought = llm_think(context)      # 模型思考
    action = parse_action(thought)    # 解析行动
    if action == "FINAL_ANSWER":
        done = True
    else:
        result = execute_tool(action)  # 执行工具
        context += result              # 更新上下文
```

就这么简单。Agent 框架（LangChain、CrewAI）的底层也是这个循环——只是加了更多工程封装。

### 定义工具接口

Agent 需要工具才能"行动"。先定义工具的统一接口：

```python
import json
from typing import Callable

# 工具注册表
TOOL_REGISTRY: dict[str, dict] = {}

def tool(name: str, description: str, params: dict):
    """工具注册装饰器"""
    def decorator(fn: Callable):
        TOOL_REGISTRY[name] = {
            "name": name,
            "description": description,
            "params": params,
            "fn": fn,
        }
        return fn
    return decorator

# 注册一个搜索工具
@tool(
    name="search",
    description="搜索互联网获取信息。输入：搜索关键词。输出：搜索结果摘要。",
    params={"query": "搜索关键词"},
)
def search(query: str) -> str:
    # 这里用模拟数据，实际接入搜索 API
    mock_results = {
        "ReAct": "ReAct 是一种让 LLM 交替进行推理和行动的范式...",
        "LangChain": "LangChain 是一个用于构建 LLM 应用的开源框架...",
    }
    for key, val in mock_results.items():
        if key.lower() in query.lower():
            return val
    return f"搜索 '{query}' 未找到相关结果。"

# 注册一个计算工具
@tool(
    name="calculate",
    description="执行数学计算。输入：数学表达式。输出：计算结果。",
    params={"expression": "数学表达式，如 '2+3*4'"},
)
def calculate(expression: str) -> str:
    try:
        # 教学示例：仅演示工具接口。生产环境禁止 eval，
        # 请用受限 AST 求值或专用库（如 simpleeval / sympy）；ast.literal_eval 不能算表达式。
        import ast
        import operator as op
        ops = {
            ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul,
            ast.Div: op.truediv, ast.Pow: op.pow, ast.USub: op.neg,
        }
        def _eval(node):
            if isinstance(node, ast.Constant):
                return node.value
            if isinstance(node, ast.BinOp):
                return ops[type(node.op)](_eval(node.left), _eval(node.right))
            if isinstance(node, ast.UnaryOp):
                return ops[type(node.op)](_eval(node.operand))
            raise TypeError(f"不支持的表达式: {type(node)}")
        result = _eval(ast.parse(expression, mode="eval").body)
        return str(result)
    except Exception as e:
        return f"计算错误: {e}"
```

### 构建 Agent 的 System Prompt

Agent 的 System Prompt 需要告诉模型：你有哪些工具、怎么调用、什么时候该停下来回答。

```python
SYSTEM_PROMPT = """你是一个自主研究助手。你可以使用以下工具来帮助回答问题：

{tools}

使用工具的格式：
Thought: 你对下一步的思考
Action: 工具名
Action Input: 工具参数（JSON 格式）

当你已经收集到足够信息，可以直接回答时，使用：
Thought: 我已经收集到足够信息
Final Answer: 你的最终回答

注意：
- 每次只能调用一个工具
- Action 必须是上面列出的工具名之一
- Action Input 必须是合法的 JSON
- 如果搜索结果不够，可以多次搜索不同关键词
"""

def build_system_prompt() -> str:
    tools_desc = "\n".join([
        f"- {t['name']}: {t['description']}（参数: {json.dumps(t['params'], ensure_ascii=False)}）"
        for t in TOOL_REGISTRY.values()
    ])
    return SYSTEM_PROMPT.format(tools=tools_desc)
```

### 核心循环实现

```python
import re
from openai import OpenAI

client = OpenAI()

def agent_loop(question: str, max_steps: int = 10) -> str:
    """最小 Agent 循环"""
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": question},
    ]

    for step in range(max_steps):
        print(f"\n--- Step {step + 1} ---")

        # 1. LLM 推理
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0,
            max_tokens=500,
        )
        text = response.choices[0].message.content
        print(f"模型输出:\n{text}")
        messages.append({"role": "assistant", "content": text})

        # 2. 解析行动
        action_match = re.search(r"Action:\s*(\w+)", text)
        final_match = re.search(r"Final Answer:\s*(.+)", text, re.DOTALL)

        if final_match:
            # 模型给出了最终答案，循环结束
            return final_match.group(1).strip()

        if action_match:
            tool_name = action_match.group(1)
            # 解析 Action Input：优先提取 JSON 对象，避免贪婪匹配
            json_match = re.search(r"Action Input:\s*(\{[\s\S]*?\})", text)
            raw_input = json_match.group(1) if json_match else None
            if not raw_input:
                line_match = re.search(r"Action Input:\s*(.+)", text)
                raw_input = line_match.group(1).strip() if line_match else None
            if raw_input:
                try:
                    tool_input = json.loads(raw_input)
                except json.JSONDecodeError:
                    # 如果不是 JSON，当作纯字符串
                    tool_input = {"query": raw_input} if tool_name == "search" \
                        else {"expression": raw_input}

                # 3. 执行工具
                if tool_name in TOOL_REGISTRY:
                    tool_fn = TOOL_REGISTRY[tool_name]["fn"]
                    result = tool_fn(**tool_input) if isinstance(tool_input, dict) \
                        else tool_fn(tool_input)
                    print(f"工具结果: {result[:200]}")

                    # 4. 观察结果（加入历史）
                    messages.append({
                        "role": "user",
                        "content": f"Observation: {result}",
                    })
                else:
                    messages.append({
                        "role": "user",
                        "content": f"Observation: 错误 - 未知工具 '{tool_name}'",
                    })
            else:
                messages.append({
                    "role": "user",
                    "content": "Observation: 未找到 Action Input，请重新指定。",
                })
        else:
            # 模型没有输出 Action 或 Final Answer
            messages.append({
                "role": "user",
                "content": "请使用 Action: 工具名 或 Final Answer: 回答。",
            })

    return "达到最大步数限制，未能完成任务。"
```

### 运行你的第一个 Agent

```python
if __name__ == "__main__":
    answer = agent_loop("ReAct 是什么？请搜索后总结。")
    print(f"\n最终答案: {answer}")
```

运行效果：

```
--- Step 1 ---
模型输出:
Thought: 我需要搜索 ReAct 的相关信息
Action: search
Action Input: {"query": "ReAct"}

工具结果: ReAct 是一种让 LLM 交替进行推理和行动的范式...

--- Step 2 ---
模型输出:
Thought: 我已经获取了 ReAct 的信息，可以回答了
Final Answer: ReAct 是一种让 LLM 交替进行推理（Reasoning）和行动（Acting）的范式...
```

### 关键设计决策

**1. 为什么用文本格式而不是 Function Calling？**

这一节的目的是让你**理解 Agent 的内核**。文本解析是最透明的方式——你能看到模型每一步在想什么、做什么。实际生产中可以用 Function Calling 替代文本解析（更可靠），但底层逻辑完全一样。

**2. 为什么设置 max_steps？**

没有步数上限的 Agent 可能无限循环——模型反复搜索同样的关键词、反复执行同样的工具。`max_steps` 是安全阀。生产环境通常设 5-15 步。

**3. 为什么用 Observation 而不是 tool 角色？**

因为这里用的是纯文本协议（不是 Function Calling），工具结果以 `Observation:` 前缀作为 user 消息加入历史。如果你用 Function Calling，工具结果会自动以 `tool` 角色返回。

### 常见陷阱

| 陷阱 | 症状 | 解决方案 |
|------|------|----------|
| 格式不遵从 | 模型不输出 `Action:` 或 `Final Answer:` | 加 Few-shot 示例，或改用 Function Calling |
| 无限循环 | 反复搜索同样的词 | 检测重复行动 + 强制终止 |
| 幻觉工具 | 调用不存在的工具 | System Prompt 明确列出可用工具 |
| 参数错误 | Action Input 不是合法 JSON | 宽松解析 + 错误反馈让模型重试 |
| 上下文爆炸 | 历史太长导致 token 超限 | 用 M3 的压缩策略裁剪历史 |

### 要点总结

- Agent Loop 的本质就是一个 while 循环 + LLM 决定下一步
- 三个核心步骤：LLM 推理 → 解析行动 → 执行工具 → 观察结果 → 回到推理
- 工具接口统一设计：name + description + params + function
- max_steps 是必须的安全阀——防止无限循环
- 这一节的文本解析方式是为了"透明理解"，生产中可用 Function Calling 替代
- 下一节 ReAct 深度解析会拆解这个循环的论文原理和失败模式
