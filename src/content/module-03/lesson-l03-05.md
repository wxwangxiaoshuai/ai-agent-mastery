## Prompt Caching 深度解析

如果你的 Agent 每次调用都发送相同的 System Prompt（通常几千 token），你却在为这些重复内容反复付费。Prompt Caching 就是为了解决这个问题——**对重复的前缀内容按缓存价计费，通常只有正常价格的 10-25%**。

### Prompt Caching 的原理

Prompt Caching 基于**前缀匹配**：如果两次 API 调用的 context 前缀完全相同，后一次调用可以复用前一次的缓存，跳过对前缀的重新计算。

```
第 1 次调用：
  [System Prompt 3000 tokens] [用户输入 500 tokens]
  → 全量计算 3500 tokens，但 System Prompt 部分被缓存

第 2 次调用：
  [System Prompt 3000 tokens] [用户输入 800 tokens]  ← System Prompt 完全相同
  → System Prompt 命中缓存！只需计算 800 tokens
  → System Prompt 部分按缓存价计费（约 10% 的价格）
```

**关键约束**：前缀必须**完全一致**——哪怕差一个字符、一个空格，缓存就会失效。

### Claude 的 Prompt Caching

Anthropic 的 Claude API 提供显式的 Prompt Caching 控制，通过 `cache_control` 标记缓存边界：

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "你是一个专业的代码审计助手。" * 100,  # 长文本
            "cache_control": {"type": "ephemeral"}  # 标记此处为缓存边界
        }
    ],
    messages=[
        {"role": "user", "content": "分析这段代码：print(eval(input()))"}
    ],
)

# 查看缓存命中情况
print(f"输入 token: {response.usage.input_tokens}")
print(f"缓存命中 token: {response.usage.cache_read_input_tokens}")
print(f"缓存写入 token: {response.usage.cache_creation_input_tokens}")
```

**Claude 缓存的计费规则**（以官方文档为准，以下为参考比例）：

| 类型 | 价格倍率 | 说明 |
|------|----------|------|
| 正常输入 | 1x | 未命中缓存的输入 token |
| 缓存写入 | 1.25x | 首次缓存写入，比正常输入贵 25% |
| 缓存读取 | 0.1x | 命中缓存的 token，只有正常价格的 10% |

```
示例：System Prompt = 5000 tokens，用户输入 = 500 tokens

不用缓存（1000 次调用）：
  成本 = 1000 × 5500 × $3/M = $16.5

用缓存（首次写入 + 999 次读取）：
  缓存写入: 1 × 5000 × $3.75/M = $0.019
  缓存读取: 999 × 5000 × $0.30/M = $1.499
  正常输入: 1000 × 500 × $3/M = $1.5
  总成本 = $3.018

节省：$16.5 → $3.0 = 节省 82%
```

**缓存有效期**：Claude 的缓存默认有效期为 5 分钟（ephemeral）。如果在 5 分钟内有新请求命中相同前缀，缓存续期。超过 5 分钟无请求则缓存失效。

### OpenAI 的 Prompt Caching

OpenAI 的缓存是**自动的**——不需要显式标记，只要前缀满足最小长度（通常 1024 tokens），就会自动缓存。

```python
# OpenAI 自动缓存，无需特殊代码
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": LONG_SYSTEM_PROMPT},  # 自动缓存
        {"role": "user", "content": "用户问题"},
    ],
)

# 查看缓存命中情况
prompt_tokens = response.usage.prompt_tokens
cached_tokens = response.usage.prompt_tokens_details.cached_tokens
print(f"总输入: {prompt_tokens}, 缓存命中: {cached_tokens}")
```

**OpenAI vs Claude 缓存对比**：

| 维度 | Claude | OpenAI |
|------|--------|--------|
| 触发方式 | 显式标记 `cache_control` | 自动触发 |
| 最小长度 | 1024 tokens | 1024 tokens |
| 缓存有效期 | 5 分钟（可续期） | 动态管理（通常 5-10 分钟） |
| 缓存写入费 | 1.25x 正常价 | 1x 正常价（无额外写入费） |
| 缓存读取费 | 0.1x 正常价 | 0.5x 正常价 |
| 控制粒度 | 可精确控制缓存边界 | 自动判断 |

### 设计"缓存友好"的 Prompt 结构

缓存的核心要求是**前缀稳定**。任何对前缀的微小改动都会导致缓存失效。

**反模式（缓存杀手）**：

```python
# ❌ 反模式 1：动态内容放在 System Prompt 前面
system_prompt = f"当前时间：{datetime.now()}\n你是一个助手..."
# 每秒时间都在变 → 永远命中不了缓存

# ❌ 反模式 2：随机 ID 或 timestamp 放在最前面
system_prompt = f"会话ID：{uuid.uuid4()}\n你是一个助手..."
# 每次调用 UUID 不同 → 缓存失效

# ❌ 反模式 3：用户信息穿插在 System Prompt 中
system_prompt = f"你是一个助手。当前用户是{username}，偏好{language}。规则..."
# 不同用户 → 前缀不同 → 缓存失效
```

**正确模式**：

```python
# ✅ 正确：静态内容在前，动态内容在后
def build_messages(system_static: str, user_context: dict, user_input: str):
    return [
        # 静态部分（可被缓存）
        {"role": "system", "content": system_static},

        # 动态部分（放在 system 之后，不破坏前缀缓存）
        {"role": "system", "content": f"当前用户：{user_context['name']}，偏好：{user_context['language']}"},

        # 用户输入（每次不同，但只影响自己的 token，不影响前面的缓存）
        {"role": "user", "content": user_input},
    ]
```

**Claude 的分段缓存**：

Claude 支持在多个位置标记缓存边界，实现更精细的缓存控制：

```python
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[
        # 缓存段 1：静态 System Prompt（几乎永不变）
        {"type": "text", "text": SYSTEM_RULES, "cache_control": {"type": "ephemeral"}},
    ],
    messages=[
        # 缓存段 2：文档知识（同一会话内不变，跨会话可变）
        {"role": "user", "content": [
            {"type": "text", "text": DOCUMENTS, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": user_input},
        ]},
    ],
)
```

这样设计后：
- System Rules 缓存命中率最高（几乎永远不变）
- Documents 缓存命中率中等（同一会话内命中）
- User Input 不缓存（每次不同）

### 量化缓存效果

```python
class CacheMetrics:
    """缓存效果追踪器"""

    def __init__(self, input_price: float, cache_write_price: float, cache_read_price: float):
        self.input_price = input_price
        self.cache_write_price = cache_write_price
        self.cache_read_price = cache_read_price

    def calculate_savings(self, calls: int, prefix_tokens: int, suffix_tokens: int) -> dict:
        """计算缓存带来的节省"""
        # 不用缓存
        cost_without = calls * (prefix_tokens + suffix_tokens) / 1e6 * self.input_price

        # 用缓存（1 次写入 + calls-1 次读取）
        cache_write_cost = prefix_tokens / 1e6 * self.cache_write_price
        cache_read_cost = (calls - 1) * prefix_tokens / 1e6 * self.cache_read_price
        normal_cost = calls * suffix_tokens / 1e6 * self.input_price
        cost_with = cache_write_cost + cache_read_cost + normal_cost

        return {
            "without_cache": cost_without,
            "with_cache": cost_with,
            "savings": cost_without - cost_with,
            "savings_ratio": 1 - cost_with / cost_without,
        }

# 示例：1000 次调用，5000 token 前缀 + 500 token 后缀
metrics = CacheMetrics(input_price=3.0, cache_write_price=3.75, cache_read_price=0.3)
result = metrics.calculate_savings(calls=1000, prefix_tokens=5000, suffix_tokens=500)
print(f"不用缓存: ${result['without_cache']:.2f}")
print(f"用缓存: ${result['with_cache']:.2f}")
print(f"节省: ${result['savings']:.2f} ({result['savings_ratio']:.0%})")
# 不用缓存: $16.50
# 用缓存: $3.02
# 节省: $13.48 (82%)
```

### 动手 5 分钟

把一段命中不了缓存的 Prompt 改到能命中。

1. 写一个反模式版本：把当前时间戳和用户 ID 放在 System Prompt 最前面，连续调 10 次。
2. 从响应的 usage 里读缓存命中 token 数，确认接近 0。
3. 重排结构：静态 System Prompt 在前、缓存标记、动态内容在后，再调 10 次。

**验收标准**：第 2 次及以后的调用出现非零的缓存读取 token，且你能算出这 10 次调用省下的具体金额。

### 要点总结

- Prompt Caching 对重复前缀按缓存价计费（Claude 10%、OpenAI 50%），可节省 50-80% 输入成本
- 缓存要求前缀**完全一致**——差一个字符就失效
- Claude 用 `cache_control` 显式标记缓存边界；OpenAI 自动缓存
- 设计缓存友好的 Prompt：静态内容在前，动态内容在后
- 用分段缓存（Claude）实现精细控制：System Rules > Documents > User Input
- 缓存有效期约 5 分钟，高频调用场景效果最好；低频场景可能频繁 miss
- 量化缓存效果：用 CacheMetrics 计算实际节省比例，决定是否值得优化
