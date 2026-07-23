## 重试、退避与超时

重试是 Harness 的第一道防线——API 限流、网络抖动等暂时性故障，等一会儿再试就好了。但"等一会儿"大有学问：等多久？重试几次？哪些错误能重试？做对了叫"弹性"，做错了叫"雪崩"。

### 朴素的（错误的）重试

```python
# ❌ 朴素重试：立即重试，无限重试
while True:
    try:
        return api.call()
    except Exception:
        pass  # 立即重试，永不放弃
```

**问题**：
1. 立即重试 → API 还在限流，你再请求只会火上浇油
2. 无限重试 → 如果是永久错误（如 400 参数错误），重试一万次也不会成功
3. 无超时 → 如果 API 永远不响应，你的 Agent 永远卡在这里

### 正确的重试：指数退避 + Jitter

```python
import time
import random
from functools import wraps

def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable_exceptions: tuple = (Exception,),
):
    """指数退避 + 随机抖动的重试装饰器"""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries + 1):
                try:
                    return fn(*args, **kwargs)
                except retryable_exceptions as e:
                    last_error = e
                    if attempt < max_retries:
                        # 指数退避：1s → 2s → 4s → 8s...
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        # Full jitter：在 [0, delay] 均匀采样，错峰效果最好
                        total_delay = random.uniform(0, delay)
                        print(f"重试 {attempt+1}/{max_retries}，{total_delay:.1f}s 后重试... 错误: {e}")
                        time.sleep(total_delay)
                    else:
                        raise
            raise last_error
        return wrapper
    return decorator

# 使用
@retry_with_backoff(max_retries=3, base_delay=1.0)
def call_llm(messages):
    return client.chat.completions.create(model="gpt-4o-mini", messages=messages)
```

**为什么需要 Jitter？**

```
没有 Jitter（同步重试）：
  客户端 A → 失败 → 等 1s → 重试 → 失败 → 等 2s → 重试
  客户端 B → 失败 → 等 1s → 重试 → 失败 → 等 2s → 重试
  客户端 C → 失败 → 等 1s → 重试 → 失败 → 等 2s → 重试
  → 三个客户端同时重试，API 又被限流 → 雪崩

有 Jitter（错峰重试）：
  客户端 A → 等 1.03s → 重试
  客户端 B → 等 0.97s → 重试
  客户端 C → 等 1.08s → 重试
  → 重试时间错开，API 压力分散
```

### 区分可重试错误与不可重试错误

```python
from openai import (
    RateLimitError, APITimeoutError, APIConnectionError, APIStatusError,
)

# 可重试错误：暂时性故障，等一会儿可能好
RETRYABLE_ERRORS = (
    RateLimitError,       # 429：限流（SDK 直接抛出）
    APITimeoutError,      # 超时：网络抖动
    APIConnectionError,   # 连接失败：DNS/网络问题
    APIStatusError,       # 含 5xx；在 call_llm_safe 内再过滤 4xx
)

# 不可重试错误：永久性故障，重试也没用
NON_RETRYABLE_ERRORS = (
    ValueError,          # 参数错误：你的代码有 bug
    KeyError,            # 键错误：数据结构不对
    # OpenAI 400/401/403：参数错误/认证失败/无权限
)

class NonRetryableAPIError(ValueError):
    """包装不可重试的 4xx，避免被 RETRYABLE_ERRORS 中的 APIStatusError 捕获"""

@retry_with_backoff(
    max_retries=3,
    base_delay=1.0,
    retryable_exceptions=RETRYABLE_ERRORS,
)
def call_llm_safe(messages):
    """只重试可恢复错误；429/超时/连接错误由 SDK 直接抛出并进入重试"""
    try:
        return client.chat.completions.create(
            model="gpt-4o-mini", messages=messages, timeout=30.0,
        )
    except APIStatusError as e:
        if e.status_code >= 500:
            raise  # 5xx：可重试（由装饰器捕获）
        # 4xx（除 429，429 已是 RateLimitError）：不可重试
        raise NonRetryableAPIError(f"不可重试的 API 错误: {e.status_code}") from e
```

**错误分类指南**：

| HTTP 状态码 | 类型 | 可重试？ | 原因 |
|-------------|------|---------|------|
| 429 | 限流 | ✅ | 等一会儿就解除 |
| 500/502/503 | 服务端错误 | ✅ | 暂时性故障 |
| 408/504 | 超时 | ✅ | 网络抖动 |
| 400 | 参数错误 | ❌ | 你的代码 bug |
| 401/403 | 认证/权限 | ❌ | 配置问题 |
| 404 | 不存在 | ❌ | 资源真不存在 |

### 超时控制：防止永久挂起

```python
# ❌ 没有超时：如果 API 永远不响应，Agent 永远卡住
response = client.chat.completions.create(model="gpt-4o-mini", messages=messages)

# ✅ 有超时：30 秒不响应就报错，交给重试逻辑处理
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    timeout=30.0,  # 30 秒超时
)
```

### Deadline Propagation：超时在调用链中的传导

Agent 的一步操作可能涉及多层调用：Agent → LLM API → 工具 → 外部 API。超时应该**从顶层传导到底层**：

```python
import time

class Deadline:
    """超时预算管理器"""
    def __init__(self, total_seconds: float):
        self.deadline = time.time() + total_seconds

    @property
    def remaining(self) -> float:
        return max(0, self.deadline - time.time())

    @property
    def is_expired(self) -> bool:
        return time.time() >= self.deadline

    def child(self, max_seconds: float) -> 'Deadline':
        """创建子 deadline：不超过父剩余时间"""
        return Deadline(min(max_seconds, self.remaining))

# 使用：Agent 一步操作的总超时是 60 秒
def agent_step(deadline: Deadline):
    # LLM 调用：最多用 30 秒（但不超过 deadline 剩余时间）
    llm_deadline = deadline.child(30)
    response = call_llm(timeout=llm_deadline.remaining)

    if deadline.is_expired:
        raise TimeoutError("步数总时间耗尽")

    # 工具调用：用剩余时间
    tool_deadline = deadline.child(deadline.remaining)
    result = call_tool(timeout=tool_deadline.remaining)
```

### 完整的重试 + 超时工具

```python
import random
from openai import RateLimitError, APITimeoutError, APIConnectionError, APIStatusError

def robust_call(fn, *args, max_retries=3, timeout=30, base_delay=1.0, **kwargs):
    """带重试 + 超时的通用调用封装"""
    for attempt in range(max_retries + 1):
        try:
            return fn(*args, timeout=timeout, **kwargs)
        except (APITimeoutError, RateLimitError, APIConnectionError) as e:
            if attempt < max_retries:
                delay = random.uniform(0, min(base_delay * (2 ** attempt), 30))
                print(f"[重试 {attempt+1}/{max_retries}] {delay:.1f}s 后重试: {e}")
                time.sleep(delay)
            else:
                raise
        except APIStatusError as e:
            if e.status_code >= 500 and attempt < max_retries:
                delay = random.uniform(0, min(base_delay * (2 ** attempt), 30))
                print(f"[重试 {attempt+1}/{max_retries}] 5xx，{delay:.1f}s 后重试: {e}")
                time.sleep(delay)
            else:
                raise
        except Exception:
            # 不可重试错误，直接抛出
            raise

# Agent 中的使用
response = robust_call(
    client.chat.completions.create,
    model="gpt-4o-mini",
    messages=messages,
    max_retries=3,
    timeout=30,
)
```

### 要点总结

- 重试不是"立即重试"——用指数退避（1s→2s→4s）+ 随机抖动（防雪崩）
- 区分可重试错误（429/5xx/超时）和不可重试错误（400/401/404）——只重试前者
- 所有 API 调用必须设超时——没有超时的调用等于无限等待
- Deadline Propagation：超时从顶层传导到底层，子调用不超过父调用的剩余时间
- 生产环境标配：max_retries=3、base_delay=1s、timeout=30s、只重试暂时性错误
