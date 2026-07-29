# 项目级 AI Coding 约定

## 技术栈

- Python 3.11+，类型注解必写
- 依赖管理：uv（pyproject.toml）
- 代码风格：ruff（E/F/I/N/W/UP/B/SIM 规则）
- 类型检查：mypy --strict
- 测试：pytest + pytest-asyncio

## 代码约定

- 所有公开函数必须有类型注解和 docstring
- 调用外部 API 必须穿 Harness（重试 + 超时 + 熔断）
- 不可重试错误（ValueError、TypeError 等）直接抛出，不吞
- 日志用 `logging.getLogger(__name__)`，不 print
- 配置从环境变量读取，不硬编码

## 禁止事项

- 禁止 `except Exception: pass` 或 `return None` 吞异常
- 禁止无限重试——必须设 max_retries 上限
- 禁止不设超时的网络调用
- 禁止在代码中硬编码 API key 或 secret
- 禁止为单一用途创建抽象层（工厂、策略接口等），先写平铺直叙的代码

## 项目结构

```
src/
  config.py       # 环境变量 + 配置
  agent_base.py   # Harness 基础设施
  agent.py         # 你的 Agent 逻辑
tests/
  test_agent_base.py
  test_agent.py
```

## 测试约定

- 单元测试不调真实 LLM——mock 掉 API 调用
- 集成测试用真实 LLM，但只跑在 nightly / 发布前
- 测试函数名描述场景：`test_<what>_<when>_<then>`