## Agent 弹性框架

M7 五节课分别讲了重试、超时、Checkpoint、熔断、降级。P7 把它们全部组装成一个**可即插即用的弹性中间件**——任何 Agent Loop 都能通过一行装饰器获得生产级可靠性。

### 项目目标

封装一套 Agent 健壮性中间件：
- 指数退避重试 + Jitter
- Circuit Breaker 故障隔离
- 状态 Checkpointing 与断点恢复
- 多级降级链（模型 → 工具 → 静态兜底）
- 压力测试与故障注入报告

### 验收标准

- [ ] 任何函数加 `@resilient` 装饰器即获得重试 + 熔断 + 降级能力
- [ ] Agent Loop 可保存 Checkpoint 并从断点恢复
- [ ] 模型降级链：主模型失败自动切备用模型
- [ ] 工具降级链：主工具失败自动切备用工具
- [ ] 所有故障有日志记录
- [ ] 包含压力测试脚本（模拟 429/503/超时）
- [ ] 包含故障注入测试（验证降级链触发）

### 实施步骤

**Step 1：实现核心装饰器**

```python
import time, random, json, logging, concurrent.futures
from functools import wraps
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resilient")

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

@dataclass
class CircuitBreaker:
    """与 L07-04 对齐的三态熔断器"""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    half_open_max_calls: int = 1
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: float = 0
    half_open_calls: int = 0

    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                logger.info("CircuitBreaker: Open → Half-Open")
            else:
                return False
        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls < self.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False
        return False

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            logger.info("CircuitBreaker: Half-Open → Closed")
        self.failure_count = 0
        self.half_open_calls = 0

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            logger.warning("CircuitBreaker: Half-Open → Open（试探失败）")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"CircuitBreaker: → Open (失败 {self.failure_count} 次)")


def resilient(
    max_retries: int = 3,
    base_delay: float = 1.0,
    timeout: float = 30.0,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0,
    fallback=None,
    retryable_exceptions: tuple = (TimeoutError, ConnectionError, OSError),
):
    """弹性装饰器：超时 + 重试 + 熔断 + 降级"""
    breaker = CircuitBreaker(failure_threshold, recovery_timeout)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not breaker.can_execute():
                logger.warning(f"CircuitBreaker 熔断中: {fn.__name__}")
                if fallback:
                    return fallback(*args, **kwargs)
                raise Exception(f"CircuitBreaker 熔断: {fn.__name__}")

            last_error = None
            for attempt in range(max_retries + 1):
                try:
                    # 用线程池落实 timeout（教学示例；生产可用 SDK 原生 timeout）
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                        fut = ex.submit(fn, *args, **kwargs)
                        result = fut.result(timeout=timeout)
                    breaker.record_success()
                    return result
                except concurrent.futures.TimeoutError as e:
                    last_error = TimeoutError(f"{fn.__name__} 超时 ({timeout}s)")
                    logger.info(f"超时: {last_error}")
                except retryable_exceptions as e:
                    last_error = e
                except Exception as e:
                    # 不可重试：记一次失败后尝试 fallback
                    last_error = e
                    breaker.record_failure()
                    logger.error(f"不可重试错误: {fn.__name__} - {e}")
                    if fallback:
                        return fallback(*args, **kwargs)
                    raise

                if attempt < max_retries:
                    delay = random.uniform(0, min(base_delay * (2 ** attempt), 30))
                    logger.info(f"重试 {attempt+1}/{max_retries} ({delay:.1f}s): {fn.__name__} - {last_error}")
                    time.sleep(delay)
                else:
                    logger.error(f"重试耗尽: {fn.__name__} - {last_error}")

            # 全部重试用尽后才计入熔断
            breaker.record_failure()
            if fallback:
                logger.warning(f"降级到 fallback: {fn.__name__}")
                return fallback(*args, **kwargs)
            raise last_error
        return wrapper
    return decorator
```

**Step 2：实现 Checkpoint 管理**

```python
@dataclass
class Checkpoint:
    agent_id: str
    step: int
    messages: list
    tool_results: list
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

class CheckpointManager:
    def __init__(self, base_dir: str = "./checkpoints"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)

    def save(self, cp: Checkpoint):
        path = self.base_dir / f"{cp.agent_id}.json"
        path.write_text(json.dumps(cp.__dict__, ensure_ascii=False, indent=2))
        logger.info(f"Checkpoint 保存: agent={cp.agent_id}, step={cp.step}")

    def load(self, agent_id: str) -> Checkpoint | None:
        path = self.base_dir / f"{agent_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        logger.info(f"Checkpoint 恢复: agent={agent_id}, step={data['step']}")
        return Checkpoint(**data)

    def delete(self, agent_id: str):
        path = self.base_dir / f"{agent_id}.json"
        if path.exists():
            path.unlink()
```

**Step 3：实现降级链（模型 → 工具 → 静态）**

```python
class FallbackChain:
    """通用降级链"""

    def __init__(self, name: str):
        self.name = name
        self.providers = []

    def add(self, fn, label: str):
        self.providers.append({"fn": fn, "label": label})
        return self

    def execute(self, *args, **kwargs):
        for i, provider in enumerate(self.providers):
            try:
                result = provider["fn"](*args, **kwargs)
                if i > 0:
                    logger.info(f"[{self.name}] 降级到: {provider['label']}")
                return result
            except Exception as e:
                logger.warning(f"[{self.name}] {provider['label']} 失败: {e}")
                continue
        raise RuntimeError(f"[{self.name}] 所有方案不可用")


def _call_model(model: str, messages: list, **kw):
    from openai import OpenAI
    client = OpenAI()
    resp = client.chat.completions.create(model=model, messages=messages, timeout=30, temperature=0)
    return resp.choices[0].message.content

def _static_reply(**kw):
    return "AI 服务暂时不可用，请稍后重试。"

# 模型降级链
model_chain = FallbackChain("model")
model_chain.add(lambda **kw: _call_model("gpt-4o", **kw), "GPT-4o")
model_chain.add(lambda **kw: _call_model("gpt-4o-mini", **kw), "GPT-4o-mini")
model_chain.add(_static_reply, "静态兜底")

# 工具降级链（示例：搜索）
tool_search_chain = FallbackChain("search")
tool_search_chain.add(lambda **kw: _search_primary(**kw), "主搜索")
tool_search_chain.add(lambda **kw: _search_backup(**kw), "备用搜索")
tool_search_chain.add(lambda **kw: "搜索服务暂不可用，请稍后重试。", "静态兜底")

def _search_primary(query: str, **kw):
    raise ConnectionError("模拟主搜索不可用")

def _search_backup(query: str, **kw):
    return f"[备用搜索] {query}: ReAct 是 Reason+Act 范式"
```

**Step 4：组装弹性 Agent**

```python
@resilient(max_retries=3, base_delay=0.5, timeout=30.0, fallback=_static_reply)
def call_llm_resilient(messages: list) -> str:
    """带 @resilient 的 LLM 调用（重试+熔断+降级）"""
    return model_chain.execute(messages=messages)

@resilient(max_retries=2, base_delay=0.2, timeout=10.0,
           fallback=lambda query, **kw: "搜索暂不可用")
def call_search_resilient(query: str) -> str:
    return tool_search_chain.execute(query=query)

class ResilientAgent:
    """弹性 Agent：@resilient + Checkpoint + 模型/工具降级"""

    def __init__(self, system_prompt: str, max_steps: int = 10):
        self.system_prompt = system_prompt
        self.max_steps = max_steps
        self.checkpoint_mgr = CheckpointManager()

    def run(self, question: str, agent_id: str = None) -> str:
        agent_id = agent_id or f"agent_{int(time.time())}"

        cp = self.checkpoint_mgr.load(agent_id)
        if cp:
            messages, tool_results, start_step = cp.messages, cp.tool_results, cp.step
            logger.info(f"从第 {start_step + 1} 步恢复 agent={agent_id}")
        else:
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": question},
            ]
            tool_results, start_step = [], 0

        for step in range(start_step, self.max_steps):
            try:
                response = call_llm_resilient(messages)
                messages.append({"role": "assistant", "content": response})

                if "FINAL:" in response:
                    self.checkpoint_mgr.delete(agent_id)
                    return response.replace("FINAL:", "").strip()

                if "SEARCH:" in response:
                    query = response.split("SEARCH:", 1)[1].strip()
                    result = call_search_resilient(query)
                    tool_results.append({"tool": "search", "query": query, "result": result})
                    messages.append({"role": "user", "content": f"搜索结果: {result}"})

                self.checkpoint_mgr.save(Checkpoint(
                    agent_id=agent_id, step=step + 1,
                    messages=messages, tool_results=tool_results,
                ))

            except Exception as e:
                logger.error(f"Step {step+1} 失败: {e}")
                return f"Agent 在第 {step+1} 步失败: {e}。恢复 ID: {agent_id}"

        return "达到最大步数限制。"
```

**Step 5：压力测试与故障注入**

建议结构：`p7/resilient.py`、`p7/agent.py`、`p7/tests/test_resilient.py`、`p7/stress_test.py`

```python
# tests/test_resilient.py
import time
import pytest
from unittest.mock import patch
from resilient import resilient, CircuitBreaker, FallbackChain

class TestRetry:
    def test_retry_succeeds_on_second_attempt(self):
        calls = {"count": 0}
        @resilient(max_retries=3, base_delay=0.01)
        def flaky():
            calls["count"] += 1
            if calls["count"] < 2:
                raise ConnectionError("模拟故障")
            return "成功"
        assert flaky() == "成功"
        assert calls["count"] == 2

class TestCircuitBreaker:
    def test_opens_after_threshold(self):
        breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=60)
        breaker.record_failure()
        breaker.record_failure()
        assert breaker.state.value == "open"
        assert breaker.can_execute() is False

    def test_half_open_after_recovery(self):
        breaker = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05, half_open_max_calls=1)
        breaker.record_failure()
        assert breaker.state.value == "open"
        time.sleep(0.06)
        assert breaker.can_execute()  # 进入 half_open 并占用 1 个试探名额
        assert breaker.can_execute() is False  # 名额用尽

    def test_half_open_failure_reopens(self):
        breaker = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        breaker.record_failure()
        time.sleep(0.02)
        assert breaker.can_execute()
        breaker.record_failure()
        assert breaker.state.value == "open"

class TestFallback:
    def test_chain_falls_through(self):
        chain = FallbackChain("demo")
        chain.add(lambda: (_ for _ in ()).throw(ConnectionError("fail")), "A")
        chain.add(lambda: "ok", "B")
        assert chain.execute() == "ok"
```

```python
# stress_test.py — 故障注入报告（模拟 429/503/超时）
import time, random, statistics
from collections import Counter

def inject_call(fail_rate=0.4, fail_kinds=("429", "503", "timeout")):
    if random.random() < fail_rate:
        kind = random.choice(fail_kinds)
        if kind == "timeout":
            raise TimeoutError("模拟超时")
        raise ConnectionError(f"模拟 {kind}")
    return "ok"

def run_stress(n=100):
    stats = Counter()
    latencies = []
    @resilient(max_retries=3, base_delay=0.01, timeout=1.0,
               failure_threshold=10, fallback=lambda: "DEGRADED")
    def protected():
        return inject_call()

    for _ in range(n):
        t0 = time.time()
        out = protected()
        latencies.append((time.time() - t0) * 1000)
        stats["degraded" if out == "DEGRADED" else "ok"] += 1

    print("=== 故障注入报告 ===")
    print(f"请求数: {n}")
    print(f"成功: {stats['ok']} | 降级: {stats['degraded']}")
    print(f"P50 延迟: {statistics.median(latencies):.1f}ms")
    print(f"P95 延迟: {sorted(latencies)[int(n*0.95)-1]:.1f}ms")

if __name__ == "__main__":
    run_stress()
```

可把以下用例一并放入 `test_resilient.py`：

```python
def test_retry_exhausted():
    @resilient(max_retries=2, base_delay=0.01)
    def always_fail():
        raise ConnectionError("持续故障")
    with pytest.raises(ConnectionError):
        always_fail()

def test_fallback_on_exhaustion():
    @resilient(max_retries=2, base_delay=0.01, fallback=lambda: "降级回复")
    def always_fail():
        raise ConnectionError("持续故障")
    assert always_fail() == "降级回复"
```

### 进阶挑战

1. **Redis Checkpoint**：用 Redis 替代文件存储，支持分布式恢复
2. **Prometheus 指标**：暴露重试次数、熔断状态、降级频率等指标
3. **自适应退避**：根据历史成功率动态调整退避时间
4. **多模型负载均衡**：在多个可用模型间轮询，而非固定降级顺序
5. **故障自愈**：检测到持续故障时自动切换到降级模式，恢复后自动切回
6. **限流与任务队列**：接入 L07-04 的 TokenBucket / AgentTaskQueue（本项目核心交付不含并发控制）

### 要点回顾

- 弹性框架 = 重试 + 超时 + 熔断 + Checkpoint + 降级，一键装饰器即插即用
- `@resilient`：超时包装 → 指数退避重试 → **重试用尽后**记熔断失败 → fallback
- Checkpoint：每步保存状态，失败后从断点恢复
- 降级链：模型 → 工具 → 静态兜底；有损降级需可观测
- 压力测试验证：模拟 429/503/超时，输出成功/降级率与延迟分位
- 这个框架是后续所有生产级 Agent 的基础设施

### 下一步

完成 P7 后，你的 Agent 已经有了"盔甲"。P8「有记忆的私人知识管家」会给 Agent 加上"长期记忆"——跨会话记住用户偏好，结合 RAG 做私有知识问答。
