## Circuit Breaker 与并发控制

当外部 API 挂了，你的 Agent 会怎样？如果没有保护，它会反复重试 → 每次等 30 秒超时 → 耗尽线程池 → 整个系统卡死。Circuit Breaker（熔断器）就是防止这种"级联故障"的——**当某个服务连续失败到一定程度，直接停止调用它，给它"休息"的时间**。

用监控面板再看一遍三态转换（可把故障率调高，观察 Closed → Open → Half-Open）：

::interactive{type="harnessMonitor"}

### Circuit Breaker：三态转换

```
    成功率高           连续失败 ≥ 阈值
  ┌──────────┐      ┌──────────────→
  │  Closed  │      │
  │ (正常放行) │      │
  └──────────┘      │
       ↑             ↓
       │      ┌──────────┐
       │      │   Open   │  ← 直接拒绝请求，不调用外部 API
       │      │ (熔断中)  │
       │      └──────────┘
       │             │
       │    等待冷却时间后
       │             ↓
       │      ┌──────────┐
       │      │Half-Open │  ← 放行一个请求试探
       └──────┤ (半开)    │
     试探成功   └──────────┘
                │
              试探失败
                ↓
            回到 Open
```

### 实现 Circuit Breaker

```python
import time
from enum import Enum
from dataclasses import dataclass, field

class CircuitState(Enum):
    CLOSED = "closed"      # 正常：放行请求
    OPEN = "open"          # 熔断：拒绝请求
    HALF_OPEN = "half_open" # 半开：放行一个试探请求

@dataclass
class CircuitBreaker:
    """熔断器"""
    failure_threshold: int = 5        # 连续失败多少次触发熔断
    recovery_timeout: float = 60.0    # 熔断后等待多少秒才半开
    half_open_max_calls: int = 1      # 半开时最多放行几个请求

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0
    half_open_calls: int = 0

    def can_execute(self) -> bool:
        """判断是否允许执行"""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # 检查是否到了冷却时间
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                print("[CircuitBreaker] Open → Half-Open（冷却结束，试探中）")
                # 落入下方 HALF_OPEN 分支统一计数，避免多放行 1 次
            else:
                return False  # 熔断中，拒绝

        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls < self.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False  # 半开名额用完

        return False

    def record_success(self):
        """记录成功"""
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            print("[CircuitBreaker] Half-Open → Closed（恢复正常）")
        else:
            self.failure_count = 0  # 重置失败计数

    def record_failure(self):
        """记录失败"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            print("[CircuitBreaker] Half-Open → Open（试探失败，重新熔断）")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            print(f"[CircuitBreaker] Closed → Open（连续失败 {self.failure_count} 次）")


# 使用：给 LLM 调用加熔断
llm_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

def call_llm_with_breaker(messages):
    if not llm_breaker.can_execute():
        raise Exception("CircuitBreaker 已熔断，请稍后重试")

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini", messages=messages, timeout=30
        )
        llm_breaker.record_success()
        return response
    except Exception as e:
        llm_breaker.record_failure()
        raise
```

### 限流：令牌桶算法

熔断器防止"服务挂了"的情况，限流器防止"请求太多"的情况。

```python
import time
import threading

class TokenBucket:
    """令牌桶限流器"""

    def __init__(self, rate: float, capacity: int):
        """
        rate: 每秒生成的令牌数
        capacity: 桶容量（允许突发）
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self.lock = threading.Lock()

    def acquire(self, tokens: int = 1) -> bool:
        """尝试获取令牌，返回是否成功"""
        with self.lock:
            now = time.time()
            # 按时间差补充令牌
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def wait(self, tokens: int = 1):
        """获取令牌，不够就等"""
        while not self.acquire(tokens):
            time.sleep(0.1)

# 使用：限制 LLM 调用频率为每秒 2 次
bucket = TokenBucket(rate=2, capacity=5)  # 2 令牌/秒，桶容量 5（允许短暂突发）

def call_llm_rate_limited(messages):
    bucket.wait()  # 等待令牌
    return client.chat.completions.create(model="gpt-4o-mini", messages=messages)
```

### 限流：滑动窗口（可选替代）

令牌桶适合「平滑速率 + 允许突发」；若需要「任意连续窗口内请求数不超过 N」，用滑动窗口：

```python
from collections import deque

class SlidingWindowRateLimiter:
    """固定长度时间窗口内最多 max_requests 次"""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window = window_seconds
        self.timestamps: deque[float] = deque()
        self.lock = threading.Lock()

    def acquire(self) -> bool:
        with self.lock:
            now = time.time()
            while self.timestamps and now - self.timestamps[0] >= self.window:
                self.timestamps.popleft()
            if len(self.timestamps) >= self.max_requests:
                return False
            self.timestamps.append(now)
            return True

# 对比：令牌桶允许突发填满桶；滑动窗口更精确限制「过去 1 秒内不超过 N 次」
```

### 并发控制

```python
import concurrent.futures

class AgentConcurrencyController:
    """Agent 并发控制器"""

    def __init__(self, max_concurrent: int = 5, rate_limit: int = 10):
        self.semaphore = threading.Semaphore(max_concurrent)
        self.bucket = TokenBucket(rate=rate_limit, capacity=max_concurrent)

    def execute(self, fn, *args, **kwargs):
        """受控执行：并发限制 + 速率限制"""
        with self.semaphore:  # 并发数限制
            self.bucket.wait()  # 速率限制
            return fn(*args, **kwargs)

# 使用：最多同时 5 个 Agent，每秒最多 10 次 LLM 调用
controller = AgentConcurrencyController(max_concurrent=5, rate_limit=10)

# 批量执行 Agent
questions = ["调研 RAG", "调研 MCP", "调研 ReAct", "调研 LangGraph", "调研 CrewAI"]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(controller.execute, agent.run, q) for q in questions]
    results = [f.result() for f in futures]
```

### 任务队列：峰值保护

当请求量突然暴增（如产品被热搜），直接处理会导致系统过载。任务队列把请求"排队"处理：

```python
import queue
import threading

class AgentTaskQueue:
    """Agent 任务队列"""

    def __init__(self, max_workers: int = 3, max_queue_size: int = 100):
        self.task_queue = queue.Queue(maxsize=max_queue_size)
        self.workers = []
        self.max_workers = max_workers

    def start(self):
        """启动 worker 线程"""
        for i in range(self.max_workers):
            t = threading.Thread(target=self._worker, args=(i,), daemon=True)
            t.start()
            self.workers.append(t)

    def submit(self, task: dict, timeout: float = 30) -> bool:
        """提交任务到队列"""
        try:
            self.task_queue.put(task, timeout=timeout)
            return True
        except queue.Full:
            return False  # 队列满了

    def _worker(self, worker_id: int):
        """worker 线程：循环处理任务"""
        while True:
            task = self.task_queue.get()
            try:
                result = agent.run(task["question"])
                task.get("callback", lambda r: None)(result)
            except Exception as e:
                print(f"[Worker {worker_id}] 任务失败: {e}")
            finally:
                self.task_queue.task_done()
```

### 要点总结

- Circuit Breaker 三态：Closed（正常）→ Open（熔断）→ Half-Open（试探）→ Closed/Open
- 熔断器防止级联故障——服务连续失败时直接拒绝请求，给它"休息"时间
- 令牌桶限流：平滑请求速率，允许短暂突发；滑动窗口更适合「任意连续窗口内不超过 N 次」
- 并发控制 = 信号量（并发数限制）+ 令牌桶（速率限制）
- 任务队列：峰值保护——请求排队处理，不会压垮系统
- 这四个组件组合使用：熔断（防故障扩散）+ 限流（防过载）+ 并发控制（防资源耗尽）+ 队列（防峰值）
