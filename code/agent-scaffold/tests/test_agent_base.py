import pytest
from unittest.mock import MagicMock, patch

from src.agent_base import AgentHarness, CircuitBreaker, with_retry


class TestCircuitBreaker:
    def test_closed_initial_state(self):
        cb = CircuitBreaker(threshold=3, cooldown_seconds=10)
        assert cb._state == "closed"

    def test_opens_after_threshold_failures(self):
        cb = CircuitBreaker(threshold=2, cooldown_seconds=10)
        failing = MagicMock(side_effect=ConnectionError("down"))

        for _ in range(2):
            with pytest.raises(ConnectionError):
                cb.call(failing)
        assert cb._state == "open"

    def test_rejects_when_open(self):
        cb = CircuitBreaker(threshold=1, cooldown_seconds=60)
        with pytest.raises(ConnectionError):
            cb.call(MagicMock(side_effect=ConnectionError("down")))

        assert cb._state == "open"
        with pytest.raises(RuntimeError, match="Circuit breaker is open"):
            cb.call(MagicMock())

    def test_half_open_recovers(self):
        cb = CircuitBreaker(threshold=1, cooldown_seconds=0)
        with pytest.raises(ConnectionError):
            cb.call(MagicMock(side_effect=ConnectionError("down")))

        # cooldown=0, so next call is half-open
        result = cb.call(MagicMock(return_value="ok"))
        assert result == "ok"
        assert cb._state == "closed"


class TestAgentHarness:
    def test_retries_and_succeeds(self):
        harness = AgentHarness(max_retries=2, base_delay=0.01)
        func = MagicMock(
            side_effect=[ConnectionError("fail"), ConnectionError("fail"), "success"]
        )
        result = harness.call_with_protection(func)
        assert result == "success"
        assert func.call_count == 3

    def test_raises_after_exhausting_retries(self):
        harness = AgentHarness(max_retries=1, base_delay=0.01)
        func = MagicMock(side_effect=ConnectionError("fail"))
        with pytest.raises(ConnectionError):
            harness.call_with_protection(func)
        assert func.call_count == 2

    def test_non_retryable_raises_immediately(self):
        harness = AgentHarness(max_retries=3, base_delay=0.01)
        func = MagicMock(side_effect=ValueError("bad input"))
        with pytest.raises(ValueError):
            harness.call_with_protection(func)
        assert func.call_count == 1

    def test_with_retry_decorator(self):
        harness = AgentHarness(max_retries=1, base_delay=0.01)

        @with_retry(harness)
        def unstable(x: int) -> int:
            return x + 1

        result = unstable(41)
        assert result == 42