## Token 预算管理

Token 是 Agent 的"货币"——每次 API 调用都消耗 token，而你的上下文窗口就是"预算上限"。没有预算管理的 Agent 就像没有预算控制的公司：要么超支（超出窗口报错），要么浪费（花了钱但效果不好）。

先用下面的分配器亲手排一遍预算——尤其注意把「输出预留」拖到很小时会发生什么：

::interactive{type="contextBudget"}

### Token 预算分配模型

一个 Agent 的上下文预算需要分配给五个"部门"：

```
总预算 = 上下文窗口大小（如 200K tokens）
├── System Prompt 预算     ~5-10%   （固定开销，可被缓存）
├── 对话历史预算           ~20-30%   （随对话增长，需要裁剪）
├── 工具结果预算           ~15-25%   （工具返回可能很长）
├── 检索知识预算           ~20-30%   （RAG 召回的文档片段）
├── 用户输入预算           ~10-15%   （通常较短）
└── 输出预留              ~15-25%   （必须给模型留生成空间！）
```

> 下文 `allocate()` 在扣掉 System Prompt 与输出预留后，将剩余输入预算按 **历史 30% / 工具 25% / 检索 30% / 用户 15%** 分配（合计 100%）。上表百分比是相对整窗的量级参考。

**最常犯的错误**：忘记给输出预留 token。如果 200K 窗口塞了 195K 的输入，模型只剩 5K 生成回复——可能话没说完就被截断了。

```python
class TokenBudgetManager:
    """Token 预算管理器"""

    def __init__(self, context_window: int, output_reserve: int = 4096):
        self.context_window = context_window
        self.output_reserve = output_reserve
        self.input_budget = context_window - output_reserve

    def allocate(self, system_prompt_tokens: int) -> dict:
        """计算各部分的预算分配"""
        remaining = self.input_budget - system_prompt_tokens

        return {
            "system_prompt": system_prompt_tokens,
            "history": int(remaining * 0.30),        # 30%
            "tool_results": int(remaining * 0.25),    # 25%
            "retrieved_docs": int(remaining * 0.30),  # 30%
            "user_input": int(remaining * 0.15),      # 15%
            "output_reserve": self.output_reserve,    # 输出预留
            "total": self.context_window,
        }

    def check_budget(self, parts: dict) -> dict:
        """检查各部分是否超出预算，返回裁剪建议"""
        budget = self.allocate(parts.get("system_prompt", 0))
        warnings = []
        for key in ["history", "tool_results", "retrieved_docs", "user_input"]:
            actual = parts.get(key, 0)
            limit = budget[key]
            if actual > limit:
                warnings.append(f"{key}: {actual} > {limit} (超出 {actual - limit})")
        return {"budget": budget, "actual": parts, "warnings": warnings}
```

### Token 计数：精确计量

不同模型使用不同的 tokenizer，token 数不能靠"字数估算"——必须用对应模型的 tokenizer 精确计数。

**Python：用 tiktoken 计数 OpenAI 模型**

```python
import tiktoken

# 不同模型使用不同的 encoding
enc = tiktoken.encoding_for_model("gpt-5")

def count_tokens(text: str, model: str = "gpt-5") -> int:
    """精确计算文本的 token 数"""
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def count_messages_tokens(messages: list, model: str = "gpt-5") -> int:
    """计算完整 messages 列表的 token 数（含格式开销）"""
    enc = tiktoken.encoding_for_model(model)
    tokens_per_message = 3  # 每条 message 的格式开销
    tokens_per_name = 1     # role 字段的额外开销
    total = 0
    for msg in messages:
        total += tokens_per_message
        for key, value in msg.items():
            total += len(enc.encode(str(value)))
            if key == "role":
                total += tokens_per_name
    total += 3  # 结尾格式开销
    return total
```

**Anthropic 模型的计数**：

```python
# Anthropic SDK 自带 token 计数（已 GA）
from anthropic import Anthropic

client = Anthropic()

# 方法 1：API 返回的 usage 字段
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=100,
    messages=[{"role": "user", "content": "Hello"}],
)
print(f"输入 token: {response.usage.input_tokens}")
print(f"输出 token: {response.usage.output_tokens}")

# 方法 2：调用前提前计数（不消耗 API 调用额度）
count = client.messages.count_tokens(
    model="claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": "Hello"}],
)
print(f"预估 token 数: {count.input_tokens}")
```

> **重要**：OpenAI 和 Anthropic 的 tokenizer 不同，同一段文本在两个模型上的 token 数可能差 5-15%。做预算规划时要用目标模型的 tokenizer。

### 超限处理与降级策略

当内容超出预算时，需要逐级降级——而不是直接报错：

```python
class OverflowHandler:
    """超限处理器：逐级降级——从最温和的手段开始，逐步升级到激进裁剪"""

    @staticmethod
    def handle(history: list, tool_results: list, retrieved_docs: list,
               budget: dict, client=None) -> tuple:
        """按优先级从低到高裁剪，直到满足预算"""

        # Level 1：截断工具结果——长输出截断，保留前面部分
        for result in tool_results:
            output = result["output"]
            if count_tokens(output) > 500:
                shortened = output[: int(len(output) * 0.8)]
                result["output"] = shortened + "\n...(已截断)"
                print("[降级] 截断工具结果")

        # Level 2：减少检索文档数量——只保留 top-1
        if count_messages_tokens(retrieved_docs) > budget["retrieved_docs"]:
            retrieved_docs = retrieved_docs[:1] if retrieved_docs else []
            print("[降级] 只保留最相关的 1 个文档")

        # Level 3：用摘要替代完整历史（历史较长时用 LLM 摘要旧轮次）
        if len(history) > 6 and client:
            summary = summarize_history(history[:-4], client)
            history = [{"role": "user", "content": f"之前对话摘要：{summary}"}] + history[-4:]
            print("[降级] 用摘要替代旧历史")

        # Level 4：裁剪对话历史——从最早的开始删除
        while count_messages_tokens(history) > budget["history"] and history:
            removed = history.pop(0)
            print(f"[降级] 删除最早的历史: {removed['content'][:30]}...")

        # Level 5：放弃非核心内容
        if count_messages_tokens(tool_results) > budget["tool_results"]:
            tool_results = []  # 完全放弃工具结果
            print("[降级] 放弃所有工具结果")
        if count_messages_tokens(retrieved_docs) > budget["retrieved_docs"]:
            retrieved_docs = []
            print("[降级] 放弃所有检索文档")

        return history, tool_results, retrieved_docs
```

**降级策略层次**（从最温和到最激进，与 `handle()` 中的 Level 1→5 对应）：

```
Level 1: 截断长工具输出（保留前 80% + "已截断"标记）
Level 2: 减少检索文档数量（top-k → top-1）
Level 3: 用摘要替代完整历史（LLM 摘要旧对话，需传入 client）
Level 4: 删除最早的对话历史（滑动窗口裁剪）
Level 5: 放弃非核心内容（工具结果、检索文档全部清空）
Level 6: 缩短 System Prompt（最后手段，可能影响行为一致性；未在 handle() 中实现）
```

`summarize_history` 辅助函数（P3 的 `CompressionPipeline.summarize_text` 可复用）：

```python
def summarize_history(history: list, client) -> str:
    """用 LLM 将旧对话历史压缩为摘要"""
    old_text = "\n".join(f"[{m['role']}] {m['content']}" for m in history)
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": f"将以下对话压缩为一段摘要，保留关键信息：\n{old_text}"}],
        max_tokens=200, temperature=0,
    )
    return resp.choices[0].message.content
```

### 成本监控与预警

Token 预算不只是技术问题，也是财务问题。建议在 Agent 中嵌入成本监控：

```python
class CostMonitor:
    """实时成本监控"""

    def __init__(self, input_price: float, output_price: float):
        """price: 每百万 token 的价格（美元）"""
        self.input_price = input_price
        self.output_price = output_price
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    def record(self, input_tokens: int, output_tokens: int):
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens

    @property
    def total_cost(self) -> float:
        return (self.total_input_tokens / 1_000_000 * self.input_price +
                self.total_output_tokens / 1_000_000 * self.output_price)

    def report(self) -> str:
        return (f"输入: {self.total_input_tokens:,} tokens | "
                f"输出: {self.total_output_tokens:,} tokens | "
                f"总成本: ${self.total_cost:.4f}")

# 使用
monitor = CostMonitor(input_price=3.0, output_price=15.0)  # 主力模型价格
# 每次调用后
monitor.record(response.usage.input_tokens, response.usage.output_tokens)
print(monitor.report())
# 输入: 45,000 tokens | 输出: 12,000 tokens | 总成本: $0.3150
```

### 动手 5 分钟

用本节的预算模型给你的 Agent 算一次账。

1. 在纸上或表格里，为你的场景分配六个槽位的 token 预算，总和不得超过窗口的 80%。
2. 用 `tiktoken` 实测每个槽位的真实占用，和你的预算对比。
3. 找出超支最多的槽位，写出降级策略（截断？摘要？改成检索？）。

**验收标准**：输出预留不低于 1000 tokens，且你能说出当历史超预算时，你的代码具体丢弃哪些轮次、保留哪些。

### 要点总结

- Token 预算分配模型：扣掉 System 与输出预留后，剩余按历史 30% / 工具 25% / 检索 30% / 用户 15% 分配
- 最常犯的错误：忘记给输出预留 token，导致回复被截断
- Token 计数必须用目标模型的 tokenizer，OpenAI 和 Anthropic 的 token 数不同
- 超限处理采用逐级降级：删历史 → 截工具 → 减文档 → 摘要替代 → 放弃非核心
- 嵌入成本监控器（CostMonitor），实时追踪每次调用的 token 消耗和费用
- 预算管理是"demo 级 Agent"和"生产级 Agent"的分水岭之一
