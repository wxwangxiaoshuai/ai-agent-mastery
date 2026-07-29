"""
Agent 基础设施：重试、退避、超时、熔断、日志。

使用方式：
    from agent_base import AgentHarness, with_retry

    harness = AgentHarness()

    @with_retry(harness)
    def call_api(prompt: str) -> str: ...

    # 或直接使用 harness 方法
    result = harness.call_with_protection(api_func, arg1, arg2)
"""

import logging
import random
import time
from collections import defaultdict
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable, TypeVar

from openai import APIError, APITimeoutError, RateLimitError

from .config import (
    BASE_DELAY,
    CIRCUIT_BREAKER_COOLDOWN,
    CIRCUIT_BREAKER_THRESHOLD,
    MAX_RETRIES,
    TIMEOUT,
)

logger = logging.getLogger("agent")

T = TypeVar("T")

# 可重试异常：暂时性故障，等一会儿再试
RETRYABLE = (APITimeoutError, RateLimitError, APIError, ConnectionError, TimeoutError)
# 不可重试异常：参数错误、认证失败等，重试也没用
NON_RETRYABLE = (ValueError, TypeError, KeyError, AttributeError)


@dataclass
class CircuitBreaker:
    """熔断器：连续失败达阈值后熔断，冷却后进入半开状态试探。"""

    threshold: int = CIRCUIT_BREAKER_THRESHOLD
    cooldown_seconds: float = CIRCUIT_BREAKER_COOLDOWN

    _failure_count: int = 0
    _last_failure_time: float = 0.0
    _state: str = "closed"  # closed | open | half_open

    def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        if self._state == "open":
            if time.monotonic() - self._last_failure_time >= self.cooldown_seconds:
                self._state = "half_open"
                logger.info("Circuit breaker: open → half-open")
            else:
                raise RuntimeError("Circuit breaker is open — call rejected")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception:
            self._on_failure()
            raise

    def _on_success(self) -> None:
        self._failure_count = 0
        if self._state == "half_open":
            self._state = "closed"
            logger.info("Circuit breaker: half-open → closed")

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._failure_count >= self.threshold:
            self._state = "open"
            logger.warning(
                f"Circuit breaker: closed → open ({self._failure_count} failures)"
            )


@dataclass
class AgentHarness:
    """Agent 生产级基础设施：重试、退避、超时、熔断、日志。"""

    max_retries: int = MAX_RETRIES
    base_delay: float = BASE_DELAY
    timeout: float = TIMEOUT
    circuit_breaker: CircuitBreaker = field(default_factory=CircuitBreaker)

    def call_with_protection(
        self, func: Callable[..., T], *args: Any, **kwargs: Any
    ) -> T:
        """带重试+退避+熔断的安全调用。"""
        return self.circuit_breaker.call(
            self._retry_loop, func, *args, **kwargs
        )

    def _retry_loop(
        self, func: Callable[..., T], *args: Any, **kwargs: Any
    ) -> T:
        last_exception: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except NON_RETRYABLE:
                raise
            except RETRYABLE as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = self._backoff(attempt)
                    logger.warning(
                        f"Attempt {attempt + 1}/{self.max_retries + 1} failed "
                        f"({type(e).__name__}), retrying in {delay:.1f}s"
                    )
                    time.sleep(delay)
                else:
                    logger.error(f"All {self.max_retries + 1} attempts exhausted")
        raise last_exception  # type: ignore[misc]

    def _backoff(self, attempt: int) -> float:
        """指数退避 + 随机抖动（防雪崩）。"""
        return self.base_delay * (2**attempt) + random.uniform(0, 1)


def with_retry(harness: AgentHarness):
    """装饰器：为函数添加重试+退避+熔断保护。"""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            return harness.call_with_protection(func, *args, **kwargs)

        return wrapper

    return decorator


def setup_logging(level: int = logging.INFO) -> None:
    """配置 Agent 日志：输出到 stdout + 文件。"""
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("agent.log", encoding="utf-8"),
        ],
    )