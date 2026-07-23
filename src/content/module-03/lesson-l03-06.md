## 上下文工程的测试与调试

> 本节代码依赖 L03-02 的 `ContextAssembler` 与 L03-03 的 `TokenBudgetManager` / `count_tokens`。建议先完成这两节再动手。

你设计了精心的 System Prompt，实现了动态 Context 组装，配置了 Token 预算管理——但它真的按预期工作吗？Agent 的 bug 有 80% 不是代码逻辑错误，而是**上下文出了问题**：该放的信息没放、不该放的放了、信息顺序错了、token 超限了……

### Context 调试的常见 Bug 类型

| Bug 类型 | 症状 | 根因 |
|----------|------|------|
| Context 污染 | 模型回答中混入了之前用户的私有信息 | 对话历史未正确隔离 |
| 信息丢失 | 模型"忘了"用户之前说的话 | 历史裁剪策略太激进 |
| 优先级错乱 | 模型遵循了用户指令但忽略了 System 规则 | 组装顺序错误，用户输入在前 |
| 缓存失效 | 成本比预期高很多 | 动态内容混入静态前缀 |
| 静默截断 | 模型回复突然中断 | 未给输出预留足够 token |
| 信息淹没 | 模型忽略了关键信息 | 关键信息被放在了上下文中部（Lost in Middle） |

### Context 可视化：看见模型实际收到的内容

调试的第一步是**看见模型实际收到了什么**——而不是你以为它收到了什么。

```python
class ContextDebugger:
    """Context 可视化调试器"""

    @staticmethod
    def visualize(messages: list, model: str = "gpt-4o") -> str:
        """可视化 messages 列表：显示每条消息的角色、内容摘要和 token 数"""
        total_tokens = 0
        lines = ["=" * 70, "CONTEXT VISUALIZATION", "=" * 70]

        for i, msg in enumerate(messages):
            role = msg["role"]
            content = msg["content"] if isinstance(msg["content"], str) else str(msg["content"])
            tokens = count_tokens(content)
            total_tokens += tokens

            # 截断长内容用于显示
            preview = content[:100].replace("\n", " ")
            if len(content) > 100:
                preview += "..."

            lines.append(f"\n[{i}] {role} ({tokens} tokens)")
            lines.append(f"    {preview}")

        lines.append("\n" + "-" * 70)
        lines.append(f"总 token 数: {total_tokens}")

        # 预算检查
        if model == "gpt-4o":
            limit = 128000
        else:
            limit = 200000

        usage_pct = total_tokens / limit * 100
        lines.append(f"窗口使用率: {usage_pct:.1f}% ({total_tokens}/{limit})")

        if usage_pct > 80:
            lines.append("⚠️ 警告：上下文使用率超过 80%，建议压缩")
        if usage_pct > 95:
            lines.append("🔴 严重：上下文即将超限，输出可能被截断")

        return "\n".join(lines)

    @staticmethod
    def dump_to_file(messages: list, filepath: str = "context_debug.txt"):
        """将完整 context 写入文件，便于离线分析"""
        with open(filepath, "w") as f:
            for i, msg in enumerate(messages):
                content = msg["content"] if isinstance(msg["content"], str) else str(msg["content"])
                f.write(f"=== Message {i} [{msg['role']}] ===\n")
                f.write(f"{content}\n\n")
            f.write(f"=== Total: {count_tokens(str(messages))} tokens ===\n")
```

**使用示例**：

```python
messages = assembler.assemble(user_input, history, tool_results, docs)
print(ContextDebugger.visualize(messages))
```

输出效果：

```
======================================================================
CONTEXT VISUALIZATION
======================================================================

[0] system (3200 tokens)
    你是一位资深 Python 安全审计专家...

[1] system (180 tokens)
    当前用户：张三，偏好：中文

[2] user (15 tokens)
    之前的对话：你好...

[3] assistant (30 tokens)
    你好！我是代码审计助手...

[4] system (450 tokens)
    工具返回：{"scan_result": "发现 2 个安全风险"...}...

[5] user (50 tokens)
    帮我检查这段代码的安全风险：def eval_input(user_input): return eval(user_input)

----------------------------------------------------------------------
总 token 数: 3925
窗口使用率: 2.0% (3925/200000)
```

### Context 单元测试

像测试代码一样测试你的 Context 组装逻辑：

```python
import pytest

class TestContextAssembly:
    """Context 组装的单元测试"""

    def setup_method(self):
        self.assembler = ContextAssembler(
            system_prompt="你是一个助手。",
            max_tokens=8000,
        )

    def test_basic_assembly(self):
        """测试基本组装：System + User Input"""
        messages = self.assembler.assemble(user_input="你好")
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == "你好"

    def test_history_trimming(self):
        """测试历史裁剪：超出预算时删除最早的消息"""
        long_history = [
            {"role": "user", "content": f"消息 {i} " * 100}
            for i in range(20)
        ]
        messages = self.assembler.assemble(
            user_input="最新问题",
            history=long_history,
        )
        # 确保总 token 不超过预算
        total = count_tokens(str(messages))
        assert total <= 8000
        # 确保最新问题在最后
        assert messages[-1]["content"] == "最新问题"

    def test_tool_results_included(self):
        """测试工具结果被正确包含"""
        messages = self.assembler.assemble(
            user_input="查询结果",
            tool_results=[{"tool": "search", "output": "找到 3 条结果"}],
        )
        tool_content = [m["content"] for m in messages if "工具" in m.get("content", "")]
        assert len(tool_content) > 0

    def test_user_input_always_last(self):
        """测试用户输入始终在最后（近因效应）"""
        messages = self.assembler.assemble(
            user_input="最后的问题",
            history=[{"role": "user", "content": "旧问题"}],
            tool_results=[{"tool": "t", "output": "结果"}],
        )
        assert messages[-1]["content"] == "最后的问题"
        assert messages[-1]["role"] == "user"

    def test_output_reserved(self):
        """测试输出 token 预留"""
        budget = TokenBudgetManager(context_window=8000, output_reserve=2048)
        allocation = budget.allocate(system_prompt_tokens=500)
        # 输入预算 = 8000 - 2048 = 5952
        assert allocation["output_reserve"] == 2048
        total_input = sum(allocation[k] for k in ["system_prompt", "history", "tool_results", "retrieved_docs", "user_input"])
        assert total_input <= 5952
```

### 回归测试：防止 Context 改动引入退化

当你修改 Context 组装逻辑后，需要确保已有功能没有退化：

```python
class ContextRegressionTest:
    """Context 回归测试：用快照对比确保改动不引入退化"""

    @staticmethod
    def save_snapshot(messages: list, name: str):
        """保存 context 快照"""
        import json
        with open(f"snapshots/{name}.json", "w") as f:
            json.dump({"messages": messages, "tokens": count_tokens(str(messages))}, f,
                      ensure_ascii=False, indent=2)

    @staticmethod
    def compare_snapshot(messages: list, name: str) -> dict:
        """对比当前 context 与快照"""
        import json
        with open(f"snapshots/{name}.json") as f:
            snapshot = json.load(f)

        current_tokens = count_tokens(str(messages))
        diff = {
            "snapshot_tokens": snapshot["tokens"],
            "current_tokens": current_tokens,
            "token_diff": current_tokens - snapshot["tokens"],
            "structure_changed": len(messages) != len(snapshot["messages"]),
        }
        return diff
```

### 调试"Context 污染"

**场景**：用户 A 的 Agent 回答中出现了用户 B 的私有信息。

**排查步骤**：

```python
def diagnose_pollution(messages: list, current_user: str) -> list:
    """检测 context 中是否有其他用户的信息泄露"""
    issues = []
    for i, msg in enumerate(messages):
        content = msg.get("content", "")
        # 检查是否包含非当前用户的信息
        if "用户：" in content and current_user not in content:
            issues.append(f"[{i}] 可能泄露其他用户信息: {content[:80]}...")
        # 检查历史是否被正确隔离
        if msg["role"] == "system" and "之前对话" in content:
            # 确认摘要中不包含其他用户的 PII
            if any(pii in content for pii in ["手机号", "身份证", "密码"]):
                issues.append(f"[{i}] 摘要中包含敏感信息: {content[:80]}...")
    return issues
```

**常见根因**：
1. 对话历史全局共享（应按用户/会话隔离）
2. 摘要压缩时未脱敏（摘要应过滤 PII）
3. 检索知识库时跨用户检索（RAG 应加用户过滤条件）

### 调试"缓存失效"

**场景**：配置了 Prompt Caching 但成本没有下降。

```python
def diagnose_cache_miss(response, expected_prefix_tokens: int) -> str:
    """诊断缓存未命中的原因"""
    cached = getattr(response.usage, 'cache_read_input_tokens', 0)

    if cached == 0:
        return ("⚠️ 缓存完全未命中！可能原因：\n"
                "1. 前缀内容有动态部分（时间戳/UUID/用户名）\n"
                "2. 距离上次调用超过 5 分钟（缓存过期）\n"
                "3. 前缀长度未达到最小要求（1024 tokens）\n"
                "4. Claude：未正确设置 cache_control")
    elif cached < expected_prefix_tokens * 0.5:
        return (f"⚠️ 缓存部分命中（{cached}/{expected_prefix_tokens}）。"
                f"可能前缀中有部分动态内容。")
    else:
        return f"✅ 缓存正常（{cached}/{expected_prefix_tokens} tokens 命中）"
```

### 要点总结

- Agent bug 有 80% 是上下文问题，不是代码逻辑问题
- 六类常见 Context Bug：污染、丢失、优先级错乱、缓存失效、静默截断、信息淹没
- Context 可视化是调试第一步——看见模型实际收到了什么
- 用单元测试验证组装逻辑：基本组装、历史裁剪、工具包含、用户输入位置、输出预留
- 用快照回归测试防止 Context 改动引入退化
- Context 污染排查：检查历史隔离、摘要脱敏、RAG 用户过滤
- 缓存失效排查：检查前缀是否纯静态、是否超过 TTL、是否达到最小长度
