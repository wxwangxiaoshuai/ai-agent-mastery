# Agent 项目脚手架

从 M7 Harness 工程化开始，所有 Agent 项目都应该自带重试、退避、超时、熔断。
本项目是开箱即用的基础设施，学完 M7 后可以直接复制到新项目里使用。

## 环境准备

```bash
# 推荐用 uv
uv sync
uv sync --group dev   # 安装开发依赖（pytest、ruff、mypy）

# 或 pip
pip install -e ".[dev]"
```

在项目根目录创建 `.env`（不要提交到 Git）：

```bash
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o
MAX_RETRIES=3
TIMEOUT=30.0
```

## 核心模块

| 模块 | 说明 |
|------|------|
| `src/config.py` | 环境变量 + 所有配置项，单点修改 |
| `src/agent_base.py` | Harness 基础设施：重试、退避、熔断、日志 |

## 使用方式

```python
from src.agent_base import AgentHarness, setup_logging, with_retry

setup_logging()
harness = AgentHarness()

# 方式 1：直接调用
result = harness.call_with_protection(your_api_func, arg1, arg2)

# 方式 2：装饰器
@with_retry(harness)
def call_llm(prompt: str) -> str:
    ...

# 方式 3：自定义参数
harness = AgentHarness(
    max_retries=5,
    base_delay=2.0,
    timeout=60.0,
)
```

## 运行测试

```bash
pytest
```

## 与课程对应关系

- M7 L07-02：重试、退避、超时 → `agent_base.py` 的 `_retry_loop` + `_backoff`
- M7 L07-04：Circuit Breaker → `agent_base.py` 的 `CircuitBreaker` 类
- M7 L07-05：日志与可观测性 → `setup_logging()` + 结构化日志
- M17：AI Coding 工作流 → `CLAUDE.md` 的项目约定可被 AI 消费