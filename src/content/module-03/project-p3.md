## Context 预算管理器

P1 和 P2 解决了"能对话"和"能结构化"，但都假设上下文窗口是无限的——随便往 messages 里塞内容就行。P3 解决一个更底层的问题：**当 Agent 变复杂、对话变长、工具结果变多时，如何精确控制上下文的组成和成本？**

这个项目产出一个可复用的上下文管理中间件——任何 Agent Loop 都能即插即用。

### 项目目标

构建一个 Agent 上下文管理系统，具备：
- Token 预算分配与实时计量（知道每个部分花了多少）
- 动态 Context 组装与优先级裁剪（窗口不够时智能砍内容）
- 上下文压缩管道（长文本自动压缩到预算内）
- Prompt Caching 命中率优化（缓存友好的组装结构）
- 可视化调试面板（看见模型实际收到了什么）

### 学完能做什么

- 把 M3 的六节课知识组装成一个可运行的系统
- 理解"上下文工程"不是概念而是可量化的工程实践
- 产出一个可复用的 Python 包，后续所有 Agent 项目都能直接 import

### 验收标准

- [ ] 输入 System Prompt + 对话历史 + 工具结果 + 检索文档，输出组装好的 messages
- [ ] 总 token 数不超过预算上限（可配置）
- [ ] 超出预算时按优先级裁剪：历史 → 文档 → 工具结果 → 用户输入 → System
- [ ] 长文本自动压缩到预算内（支持摘要压缩）
- [ ] System Prompt 放在最前面；`enable_cache=True` 时写入 Claude `cache_control`（OpenAI 保持 False）
- [ ] 提供可视化方法，打印每条消息的角色、token 数、内容摘要
- [ ] 提供成本统计方法，累计输入/输出 token 和费用
- [ ] 通过 pytest 测试验证裁剪逻辑

### 实施步骤

**Step 1：环境准备**

```bash
pip install openai anthropic tiktoken python-dotenv pytest
```

**Step 2：实现 Token 计数器**

```python
import tiktoken

class TokenCounter:
    """统一的 Token 计数器"""

    _encoders: dict = {}

    @classmethod
    def count(cls, text: str, model: str = "gpt-4o") -> int:
        if model not in cls._encoders:
            try:
                cls._encoders[model] = tiktoken.encoding_for_model(model)
            except KeyError:
                cls._encoders[model] = tiktoken.get_encoding("cl100k_base")
        return len(cls._encoders[model].encode(text))

    @classmethod
    def count_messages(cls, messages: list, model: str = "gpt-4o") -> int:
        """计算 messages 列表的总 token 数（含格式开销）"""
        total = 0
        for msg in messages:
            total += 3  # 每条消息的格式开销
            for key, value in msg.items():
                total += cls.count(str(value), model)
                if key == "role":
                    total += 1
        total += 3  # 结尾开销
        return total
```

**Step 3：实现预算分配器**

```python
from dataclasses import dataclass, field

@dataclass
class BudgetAllocation:
    system_prompt: int = 0
    history: int = 0
    tool_results: int = 0
    retrieved_docs: int = 0
    user_input: int = 0
    output_reserve: int = 0
    total: int = 0

class BudgetManager:
    """Token 预算分配器"""

    def __init__(self, context_window: int = 128000, output_reserve: int = 4096):
        self.context_window = context_window
        self.output_reserve = output_reserve
        self.input_budget = context_window - output_reserve

    def allocate(self, system_prompt_tokens: int) -> BudgetAllocation:
        remaining = self.input_budget - system_prompt_tokens
        return BudgetAllocation(
            system_prompt=system_prompt_tokens,
            history=int(remaining * 0.30),
            tool_results=int(remaining * 0.25),
            retrieved_docs=int(remaining * 0.30),
            user_input=int(remaining * 0.15),
            output_reserve=self.output_reserve,
            total=self.context_window,
        )
```

**Step 4：实现 Context 组装器（核心）**

```python
from typing import Optional

class ContextAssembler:
    """动态 Context 组装器：静态底座 + 动态注入 + 优先级裁剪"""

    def __init__(self, system_prompt: str, model: str = "gpt-4o",
                 context_window: int = 128000, output_reserve: int = 4096):
        self.system_prompt = system_prompt
        self.model = model
        self.budget = BudgetManager(context_window, output_reserve)
        self.system_tokens = TokenCounter.count(system_prompt, model)

    def assemble(
        self,
        user_input: str,
        history: Optional[list] = None,
        tool_results: Optional[list] = None,
        retrieved_docs: Optional[list] = None,
        enable_cache: bool = False,
    ) -> list:
        """组装最终发送给 API 的 messages"""
        alloc = self.budget.allocate(self.system_tokens)

        # 1. System Prompt（最高优先级，不裁剪）
        # enable_cache=True 时生成 Claude 风格的 cache_control（OpenAI 请保持 False）
        messages = []
        if enable_cache:
            # 仅 Anthropic Claude 支持；发给 OpenAI 会报参数错误
            messages.append({
                "role": "system",
                "content": [{"type": "text", "text": self.system_prompt,
                             "cache_control": {"type": "ephemeral"}}],
            })
        else:
            messages.append({"role": "system", "content": self.system_prompt})

        # 2. 裁剪对话历史（从最早的开始删除）
        history = self._trim_history(history or [], alloc.history)

        # 3. 裁剪检索文档（按相关性排序，取 top-k）
        docs_content = self._trim_docs(retrieved_docs or [], alloc.retrieved_docs)

        # 4. 裁剪工具结果（长输出截断）
        tool_content = self._trim_tools(tool_results or [], alloc.tool_results)

        # 5. 组装顺序：历史 → 文档 → 工具 → 用户输入
        messages.extend(history)
        if docs_content:
            messages.append({"role": "system", "content": f"参考资料：\n{docs_content}"})
        if tool_content:
            messages.append({"role": "system", "content": f"工具返回：\n{tool_content}"})
        messages.append({"role": "user", "content": user_input})

        return messages

    def _trim_history(self, history: list, budget: int) -> list:
        trimmed = list(history)
        while TokenCounter.count_messages(trimmed, self.model) > budget and trimmed:
            trimmed.pop(0)
        return trimmed

    def _trim_docs(self, docs: list, budget: int) -> str:
        sorted_docs = sorted(docs, key=lambda d: d.get("score", 0), reverse=True)
        parts, total = [], 0
        for doc in sorted_docs:
            text = doc.get("content", "")
            tokens = TokenCounter.count(text, self.model)
            if total + tokens > budget:
                break
            parts.append(text)
            total += tokens
        return "\n---\n".join(parts)

    def _trim_tools(self, results: list, budget: int) -> str:
        if not results:
            return ""
        per_item = max(1, budget // len(results))
        parts = []
        for r in results:
            content = str(r.get("output", ""))
            original = content
            while TokenCounter.count(content, self.model) > per_item and len(content) > 20:
                content = content[: int(len(content) * 0.8)]
            if TokenCounter.count(original, self.model) > per_item:
                content = content + "\n...(已截断)"
            parts.append(f"[{r.get('tool', 'unknown')}] {content}")
        return "\n\n".join(parts)
```

**Step 5：实现压缩管道**

主路径用摘要压缩即可验收；LLMLingua 作为可选进阶（见文末挑战）。

```python
class CompressionPipeline:
    """上下文压缩：摘要压缩 → 选择性压缩"""

    @staticmethod
    def summarize_text(text: str, target_tokens: int, client=None) -> str:
        """用 LLM 将长文本压缩到目标 token 数"""
        from openai import OpenAI
        client = client or OpenAI()
        if TokenCounter.count(text) <= target_tokens:
            return text
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": (
                f"将以下内容压缩为不超过 {target_tokens} token 的摘要，"
                f"保留所有关键事实和数据：\n\n{text}"
            )}],
            max_tokens=target_tokens,
            temperature=0,
        )
        return response.choices[0].message.content

    @staticmethod
    def compress_history(history: list, max_tokens: int = 2000, client=None) -> list:
        """对话历史压缩：保留近期 + 摘要旧的"""
        if TokenCounter.count_messages(history) <= max_tokens:
            return history
        recent = history[-6:]  # 最近 3 轮
        old = history[:-6]
        if old:
            old_text = "\n".join(f"[{m['role']}] {m['content']}" for m in old)
            summary = CompressionPipeline.summarize_text(old_text, 500, client)
            return [{"role": "system", "content": f"[之前对话摘要]\n{summary}"}] + recent
        return recent
```

**Step 6：实现可视化调试器**

```python
class ContextDebugger:
    """Context 可视化调试器"""

    @staticmethod
    def visualize(messages: list, model: str = "gpt-4o") -> str:
        total = 0
        lines = ["=" * 60, "CONTEXT VISUALIZATION", "=" * 60]
        for i, msg in enumerate(messages):
            role = msg["role"]
            content = msg["content"] if isinstance(msg["content"], str) else str(msg["content"])
            tokens = TokenCounter.count(content, model)
            total += tokens
            preview = content[:80].replace("\n", " ")
            if len(content) > 80:
                preview += "..."
            lines.append(f"\n[{i}] {role} ({tokens} tokens)")
            lines.append(f"    {preview}")
        lines.append("\n" + "-" * 60)
        lines.append(f"总 token: {total} | 预算使用率: {total/128000*100:.1f}%")
        return "\n".join(lines)

    @staticmethod
    def cost_report(input_tokens: int, output_tokens: int,
                    input_price: float = 0.15, output_price: float = 0.60) -> str:
        cost = input_tokens / 1e6 * input_price + output_tokens / 1e6 * output_price
        return (f"输入: {input_tokens:,} | 输出: {output_tokens:,} | "
                f"费用: ${cost:.4f}")
```

**Step 7：组装完整系统**

```python
class ContextManager:
    """完整的上下文管理系统：组装 + 预算 + 压缩 + 调试"""

    def __init__(self, system_prompt: str, model: str = "gpt-4o",
                 context_window: int = 128000):
        self.assembler = ContextAssembler(system_prompt, model, context_window)
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    def prepare(self, user_input: str, history=None, tool_results=None,
                retrieved_docs=None, enable_cache=False) -> list:
        messages = self.assembler.assemble(
            user_input, history, tool_results, retrieved_docs, enable_cache
        )
        # 记录 token 消耗
        self.total_input_tokens += TokenCounter.count_messages(messages, self.assembler.model)
        return messages

    def record_output(self, output_tokens: int):
        self.total_output_tokens += output_tokens

    def debug(self, messages: list) -> str:
        return ContextDebugger.visualize(messages, self.assembler.model)

    def report(self) -> str:
        return ContextDebugger.cost_report(
            self.total_input_tokens, self.total_output_tokens
        )
```

### 验收测试

```python
# tests/test_context_manager.py
import pytest
from src.context_manager import ContextAssembler, TokenCounter, BudgetManager

class TestTokenCounter:
    def test_basic_count(self):
        assert TokenCounter.count("Hello world") > 0

    def test_chinese_count(self):
        assert TokenCounter.count("你好世界") > 0

    def test_empty_string(self):
        assert TokenCounter.count("") == 0

class TestBudgetManager:
    def test_allocation_sums_to_budget(self):
        bm = BudgetManager(context_window=8000, output_reserve=2048)
        alloc = bm.allocate(system_prompt_tokens=500)
        total_alloc = alloc.system_prompt + alloc.history + alloc.tool_results + alloc.retrieved_docs + alloc.user_input
        assert total_alloc <= 8000 - 2048  # 不超过输入预算
        assert alloc.output_reserve == 2048

class TestContextAssembler:
    def setup_method(self):
        self.assembler = ContextAssembler(
            system_prompt="你是一个助手。",
            context_window=4000,
            output_reserve=1024,
        )

    def test_basic_assembly(self):
        messages = self.assembler.assemble(user_input="你好")
        assert messages[0]["role"] == "system"
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == "你好"

    def test_user_input_always_last(self):
        messages = self.assembler.assemble(
            user_input="最后的问题",
            history=[{"role": "user", "content": "旧问题"}],
            tool_results=[{"tool": "search", "output": "结果"}],
        )
        assert messages[-1]["content"] == "最后的问题"

    def test_history_trimming(self):
        long_history = [{"role": "user", "content": f"消息 {i} " * 50} for i in range(20)]
        messages = self.assembler.assemble(user_input="最新", history=long_history)
        total = TokenCounter.count_messages(messages)
        input_budget = 4000 - 1024  # 窗口 - 输出预留
        assert total <= input_budget  # 输入部分不得超过输入预算

    def test_cache_control(self):
        messages = self.assembler.assemble(user_input="test", enable_cache=True)
        system_msg = messages[0]
        if isinstance(system_msg["content"], list):
            assert system_msg["content"][0].get("cache_control") is not None

    def test_tool_result_truncation(self):
        long_tool = [{"tool": "search", "output": "x" * 10000}]
        messages = self.assembler.assemble(user_input="test", tool_results=long_tool)
        # 工具结果应该被截断
        tool_msg = [m for m in messages if "工具" in m.get("content", "")]
        assert len(tool_msg) > 0
```

### 进阶挑战

1. **Claude 集成**：接入 Anthropic API，实现分段缓存（System Rules + Documents 两级缓存）
2. **压缩管道升级**：集成 LLMLingua 做 token 级压缩，对比摘要压缩的效果差异（主路径验收不要求）
3. **实时监控仪表盘**：用 Streamlit/Gradio 做一个 Web 界面，实时显示每次调用的 token 分布
4. **自动预算调优**：根据历史调用数据自动调整预算分配比例（如历史越长，history 预算占比越大）
5. **多模型路由**：根据 token 预算自动选择模型（预算紧张用 mini，预算充足用 4o）

### 常见问题

**Q: 为什么要做成"中间件"而不是直接写在 Agent 里？**
A: 上下文管理是跨 Agent 复用的能力。做成独立模块，P4（ReAct Agent）、P7（LangGraph Agent）、P10（深度研究 Agent）都能直接 import 使用，不用重复实现。

**Q: 预算分配比例（30%/25%/30%/15%）是固定的吗？**
A: 不是。这只是默认值（合计占满「剩余输入预算」）。实际场景中，RAG 重度应用应该调高 retrieved_docs 比例；工具密集型 Agent 应该调高 tool_results 比例。进阶挑战中的"自动预算调优"就是解决这个问题。

**Q: Prompt Caching 值得做吗？**
A: 如果你的 Agent 每分钟调用超过 10 次，System Prompt 超过 1000 token，缓存节省通常超过 50%。如果调用频率很低（如每小时一次），缓存可能频繁 miss，收益不大。

### 要点回顾

- 上下文管理的核心是"预算分配 + 优先级裁剪 + 压缩降级"
- 组装顺序：System → 历史 → 文档 → 工具 → 用户输入（近因效应 + 缓存友好）
- Token 计数必须用目标模型的 tokenizer，不能靠字数估算
- 可视化调试器是开发阶段必备工具——"看见模型收到了什么"
- 这个中间件是后续所有 Agent 项目的基石

### 下一步

完成 P3 后，你已经掌握了上下文工程的全链路。P4「ReAct 研究助手」会把这个中间件接入一个真正的 Agent Loop——从此你的 Agent 不再是"单轮问答"，而是"能搜索、能阅读、能总结"的自主系统。
