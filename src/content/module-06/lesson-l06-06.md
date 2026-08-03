## 工具调用的可观测性与调试

Agent 调错了工具、传错了参数、工具执行超时——这些是生产环境中最常见的 bug。没有可观测性，你只能在"模型说做完了但结果不对"和"Agent 卡住了不知道为什么"之间盲猜。这一节讲如何让 Agent 的工具调用**可追踪、可重放、可诊断**。

### 工具调用的典型 Bug

| Bug 类型 | 症状 | 根因 |
|----------|------|------|
| 选错工具 | 该搜索却调了计算器 | 工具描述不清晰、工具太多 |
| 参数错误 | city="beijing" 而非"北京" | 参数描述不具体、缺少枚举值 |
| 工具超时 | Agent 卡在某一步 | 外部 API 慢、未设超时 |
| 死循环 | 反复调同一个工具 | 无重复检测、无步数上限 |
| 结果解析失败 | 工具返回了但模型不理解 | 返回格式不清晰、信息过载 |

### Tracing：记录每一次工具调用

```python
import json
import time
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ToolCallTrace:
    """单次工具调用的追踪记录"""
    step: int
    tool_name: str
    arguments: dict
    result: Any = None
    error: str | None = None
    start_time: float = 0
    end_time: float = 0
    duration_ms: float = 0

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "tool": self.tool_name,
            "args": self.arguments,
            "result": str(self.result) if self.result else None,  # 存完整结果，保证重放精确
            "error": self.error,
            "duration_ms": round(self.duration_ms, 1),
        }


class AgentTracer:
    """Agent 工具调用追踪器"""

    def __init__(self):
        self.traces: list[ToolCallTrace] = []
        self._step = 0

    def trace_call(self, tool_name: str, arguments: dict) -> ToolCallTrace:
        self._step += 1
        trace = ToolCallTrace(
            step=self._step,
            tool_name=tool_name,
            arguments=arguments,
            start_time=time.time(),
        )
        return trace

    def record_result(self, trace: ToolCallTrace, result: Any):
        trace.end_time = time.time()
        trace.duration_ms = (trace.end_time - trace.start_time) * 1000
        trace.result = result
        self.traces.append(trace)

    def record_error(self, trace: ToolCallTrace, error: str):
        trace.end_time = time.time()
        trace.duration_ms = (trace.end_time - trace.start_time) * 1000
        trace.error = error
        self.traces.append(trace)

    def print_report(self):
        """打印调用链报告"""
        print("\n" + "=" * 60)
        print("TOOL CALL TRACE REPORT")
        print("=" * 60)
        for t in self.traces:
            status = "✓" if not t.error else "✗"
            print(f"\n[Step {t.step}] {status} {t.tool_name}({t.arguments})")
            if t.error:
                print(f"  ERROR: {t.error}")
            else:
                result_text = str(t.result)
                suffix = "..." if len(result_text) > 100 else ""
                print(f"  RESULT: {result_text[:100]}{suffix}")
            print(f"  TIME: {t.duration_ms:.0f}ms")
        total_ms = sum(t.duration_ms for t in self.traces)
        print(f"\n{'=' * 60}")
        print(f"总调用次数: {len(self.traces)} | 总耗时: {total_ms:.0f}ms")

    def export_json(self, filepath: str):
        """导出为 JSON 文件，便于离线分析"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump([t.to_dict() for t in self.traces], f, ensure_ascii=False, indent=2)
```

### 集成 Tracer 到 Agent Loop

```python
# SYSTEM_PROMPT / client / TOOLS / TOOL_MAP 沿用 L06-01
def agent_loop_with_tracing(question: str, max_steps: int = 10) -> str:
    """带 Tracing 的 Agent Loop"""
    tracer = AgentTracer()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    for step in range(max_steps):
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            tools=TOOLS,
            temperature=0,
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            tracer.print_report()
            return msg.content

        messages.append(msg)

        for tool_call in msg.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            # 记录调用
            trace = tracer.trace_call(fn_name, fn_args)

            try:
                if fn_name in TOOL_MAP:
                    result = TOOL_MAP[fn_name](**fn_args)
                    tracer.record_result(trace, result)
                else:
                    error = f"未知工具: {fn_name}"
                    tracer.record_error(trace, error)
                    result = error
            except Exception as e:
                tracer.record_error(trace, str(e))
                result = f"工具执行错误: {e}"

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result),
            })

    tracer.print_report()
    return "达到最大步数限制。"
```

### 重放：复现 Bug

当 Agent 出了 bug，你需要能**精确复现**当时的调用链——这就是"重放"。

```python
class ToolCallReplayer:
    """工具调用重放器"""

    def __init__(self, trace_file: str):
        with open(trace_file) as f:
            self.traces = json.load(f)
        self._index = 0

    def replay(self, tool_name: str, arguments: dict) -> str:
        """重放：返回记录中的结果而非真正执行工具"""
        if self._index >= len(self.traces):
            raise RuntimeError("没有更多记录可重放")

        trace = self.traces[self._index]
        self._index += 1

        if trace["tool"] != tool_name:
            print(f"⚠️ 工具不匹配: 期望 {trace['tool']}, 实际 {tool_name}")

        if trace.get("error"):
            return trace["error"]
        return trace["result"]

# 使用：把 Agent 的工具执行替换为重放
replayer = ToolCallReplayer("trace_20260722.json")

def replay_tool(fn_name, **kwargs):
    return replayer.replay(fn_name, kwargs)

# 用 replay_tool 替代真实工具执行，Agent 会按完全相同的路径运行
```

### 调试"选错工具"

**症状**：Agent 该调 `search_web` 却调了 `calculate`。

**排查步骤**：

```python
def debug_tool_selection(question: str, tools: list):
    """诊断为什么模型选错了工具"""
    # 1. 检查工具描述是否清晰
    for tool in tools:
        desc = tool["function"]["description"]
        if len(desc) < 20:
            print(f"⚠️ {tool['function']['name']}: description 太短（{len(desc)} 字）")
        if "适用" not in desc and "用于" not in desc:
            print(f"⚠️ {tool['function']['name']}: description 缺少适用场景说明")

    # 2. 让模型解释为什么选这个工具
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "你是一个调试助手。分析以下工具列表和用户问题，解释应该选哪个工具以及为什么。"},
            {"role": "user", "content": f"问题: {question}\n\n工具: {json.dumps(tools, ensure_ascii=False)}"},
        ],
        temperature=0,
    )
    print(f"模型分析: {response.choices[0].message.content}")
```

### 调试"参数错误"

**症状**：模型传了 `{"city": "beijing"}` 但工具期望 `"北京"`。

**排查与修复**：

```python
# 1. 在参数描述中加示例和枚举
{
    "name": "get_weather",
    "parameters": {
        "properties": {
            "city": {
                "type": "string",
                "description": "城市名（中文），如'北京'、'上海'、'成都'",
                "enum": ["北京", "上海", "成都", "广州", "深圳"],  # 加枚举
            }
        }
    }
}

# 2. 在工具内部做容错
def get_weather(city: str) -> str:
    # 城市名容错映射
    city_map = {"beijing": "北京", "shanghai": "上海", "Beijing": "北京"}
    city = city_map.get(city, city)
    # ... 正常逻辑
```

### 可观测性仪表盘指标

生产环境建议监控以下指标：

```python
class ToolMetrics:
    """工具调用指标统计"""
    def __init__(self):
        self.calls: dict[str, list] = {}  # tool_name → [durations]

    def record(self, tool_name: str, duration_ms: float, success: bool):
        if tool_name not in self.calls:
            self.calls[tool_name] = []
        self.calls[tool_name].append({
            "duration": duration_ms, "success": success
        })

    def report(self) -> dict:
        report = {}
        for tool, records in self.calls.items():
            durations = [r["duration"] for r in records]
            successes = sum(1 for r in records if r["success"])
            report[tool] = {
                "total_calls": len(records),
                "success_rate": successes / len(records),
                "avg_duration_ms": sum(durations) / len(durations),
                "p99_duration_ms": sorted(durations)[int(len(durations) * 0.99)],
            }
        return report
```

### 动手 5 分钟

给一次真实的 Agent 失败做完整的事后追溯。

1. 打开 Tracing，让 Agent 跑一个会失败的任务，把完整 trace 落盘。
2. 沿 trace 回答三个问题：它在哪一步偏离了？那一步的输入是什么？如果换个工具描述还会偏吗？
3. 用 trace 里的原始输入做一次重放，验证问题可稳定复现。

**验收标准**：你能只看 trace（不重跑）就定位到根因，并且重放能一次次复现同样的错误。

### 要点总结

- Agent bug 的 80% 是工具调用问题——可观测性是调试的前提
- Tracing 记录每次工具调用的：步骤号、工具名、参数、结果、错误、耗时
- 重放（Replay）用记录的结果替代真实执行，精确复现 bug
- "选错工具"排查：检查 description 是否清晰 + 让模型解释选择理由
- "参数错误"修复：加枚举值 + 加示例 + 工具内部做容错映射
- 生产监控指标：调用次数、成功率、平均耗时、P99 耗时——接入告警系统
