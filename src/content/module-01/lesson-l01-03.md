## 动手调用 LLM API

这一节调通你的第一个 LLM API 调用。目标是跑通**同步调用**和**流式调用**两种模式，覆盖 OpenAI 和 Anthropic 两家主流 API，并建立一个最小的命令行聊天程序。

> **关于语言**：本课程的代码主线是 **Python** —— Agent 领域的框架、SDK、评测工具在 Python 侧生态完整得多，
> 而本课程的重点是 Agent 的架构与工程，不是语言本身。后续章节除了前端集成相关的部分，都只给 Python。

### 环境准备

**Python 版本**：建议 Python 3.11+，本课程所有代码均在此版本下验证。Agent 生态的核心库（LangChain、LangGraph、MCP SDK）都要求 3.10+。

**虚拟环境**：不要直接在系统 Python 里装依赖。用虚拟环境隔离项目依赖，避免版本冲突：

```bash
# 方式一：Python 内置 venv（无需额外安装）
python3 -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# 方式二：uv（推荐，更快更现代）
# 安装 uv：curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv
source .venv/bin/activate
```

**依赖管理**：

```bash
# 方式一：pip + requirements.txt（传统）
pip install openai anthropic python-dotenv

# 方式二：uv + pyproject.toml（推荐）
uv pip install openai anthropic python-dotenv
```

如果使用 uv + pyproject.toml 管理项目：

```toml
# pyproject.toml
[project]
name = "my-first-agent"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "openai>=1.0",
    "anthropic>=0.30",
    "python-dotenv>=1.0",
]

[dependency-groups]
dev = [
    "pytest>=8",
    "ruff>=0.5",
]
```

```bash
uv sync           # 安装所有依赖
uv sync --dev     # 含开发依赖
```

**项目结构建议**：从第一天就养成好习惯，不要把所有代码堆在一个文件里：

```
my-first-agent/
  .venv/              # 虚拟环境（不提交）
  .env                # API Key（不提交）
  .gitignore
  pyproject.toml      # 项目元数据与依赖
  main.py             # 入口
  README.md           # 项目说明
```

**`.gitignore` 最小内容**：

```bash
# .gitignore
.venv/
.env
__pycache__/
*.pyc
.DS_Store
```

**API Key 管理**：永远不要把 API Key 硬编码到代码里。推荐使用 `.env` 文件管理：

```bash
# .env 文件（不要提交到 Git！）
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

```python
# Python：用 python-dotenv 自动加载 .env
from dotenv import load_dotenv
load_dotenv()  # 加载 .env 文件中的环境变量
```

> **安全提醒**：务必将 `.env` 加入 `.gitignore`。API Key 泄露是真实的安全事故。

---

### OpenAI API（Python）

**同步调用**：

```python
from openai import OpenAI

client = OpenAI()  # 自动读取 OPENAI_API_KEY

response = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": "你是一个 AI 技术助手。"},
        {"role": "user", "content": "用一句话介绍什么是 Agent。"},
    ],
    temperature=0.7,
    max_tokens=200,
)

print(response.choices[0].message.content)
```

**流式调用**：

```python
stream = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "写一首关于 AI 的五言绝句。"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()  # 最后换行
```

---

### Anthropic API（Python）

Anthropic 的 API 设计与 OpenAI 略有不同——**System Prompt 不在 messages 数组里，而是单独的参数**。

**同步调用**：

```python
from anthropic import Anthropic

client = Anthropic()  # 自动读取 ANTHROPIC_API_KEY

response = client.messages.create(
    model="claude-sonnet-5",
    system="你是一个 AI 技术助手。",  # system 是独立参数！
    messages=[
        {"role": "user", "content": "用一句话介绍什么是 Agent。"},
    ],
    max_tokens=200,
    temperature=0.7,
)

print(response.content[0].text)
```

**流式调用**：

```python
with client.messages.stream(
    model="claude-sonnet-5",
    messages=[{"role": "user", "content": "写一首关于 AI 的五言绝句。"}],
    max_tokens=500,
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
print()
```

**OpenAI vs Anthropic 关键差异**：

| 差异点 | OpenAI | Anthropic |
|--------|--------|-----------|
| System Prompt | 在 messages 数组中 `{"role": "system"}` | 独立的 `system` 参数 |
| 响应取值 | `response.choices[0].message.content` | `response.content[0].text` |
| 流式 API | `stream=True` + 迭代 chunks | `client.messages.stream()` 上下文管理器 |
| 最大 token | 可不设（有默认值） | **必填** `max_tokens` |

> **工程建议**：如果你希望代码同时兼容两家 API，可以封装一个统一接口。后续 M5 的 Agent Loop 会用到这个思路。
>
> **模型名说明**：本节示例使用别名（如 `gpt-5`、`claude-sonnet-5`），方便上手。生产环境建议钉死快照 ID（见 L01-04），避免厂商无声升级导致行为变化。

---

### 最小命令行聊天程序（Python，含错误处理）

```python
import os
from dotenv import load_dotenv
from openai import OpenAI, RateLimitError, APIStatusError, APITimeoutError

load_dotenv()
client = OpenAI(timeout=30.0)  # 设置 30 秒超时

SYSTEM_PROMPT = "你是一个友好的 AI 助手，简洁地回答用户问题。"

def chat():
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    print("AI 聊天助手已启动（输入 quit 退出）")

    while True:
        try:
            user_input = input("\n你: ")
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            break

        if user_input.lower().strip() == "quit":
            print("再见！")
            break

        if not user_input.strip():
            continue

        messages.append({"role": "user", "content": user_input})

        try:
            stream = client.chat.completions.create(
                model="gpt-5",
                messages=messages,
                stream=True,
                timeout=30.0,
            )

            print("AI: ", end="", flush=True)
            reply = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    print(text, end="", flush=True)
                    reply += text
            print()

            messages.append({"role": "assistant", "content": reply})

        except APITimeoutError:
            print("\n[超时] 请求超过 30 秒，请重试。")
            messages.pop()  # 移除未成功的用户消息，避免历史污染
        except RateLimitError:
            print("\n[限流] 请求过于频繁，请稍后再试。")
            messages.pop()
        except APIStatusError as e:
            print(f"\n[错误] API 调用失败: {e}")
            messages.pop()

if __name__ == "__main__":
    chat()
```

注意这个版本相比最小版本增加了：
- **超时设置**：`timeout=30.0`，防止请求永远挂起
- **错误处理**：捕获超时、限流、API 错误，打印友好提示
- **历史回滚**：失败时 `messages.pop()` 移除未成功的用户消息，避免错误历史污染后续对话
- **空输入过滤**：忽略空行输入
- **优雅退出**：支持 Ctrl+C / Ctrl+D 退出

---

### 速率限制与重试

API 调用最常见的两类错误是**速率限制（429）**和**服务端错误（5xx）**。生产环境必须处理：

```python
import time, random
from openai import OpenAI, RateLimitError, APIStatusError

client = OpenAI(timeout=30.0)

def call_with_retry(messages, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model="gpt-5",
                messages=messages,
                timeout=30.0,
            )
        except RateLimitError:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.random()  # 指数退避 + jitter
                print(f"速率限制，{delay:.1f}s 后重试...")
                time.sleep(delay)
            else:
                raise
        except APIStatusError as e:  # APIStatusError 有 .status_code；APIConnectionError 等不可重试
            if e.status_code >= 500:
                if attempt < max_retries - 1:
                    time.sleep(base_delay + random.random())
                else:
                    raise
            else:
                raise  # 4xx 错误（除 429）不重试
```

**重试策略要点**：
- **指数退避 + jitter**：`delay = base_delay * (2 ** attempt) + random.random()`，避免多个客户端同时重试导致"惊群"
- **只重试可恢复错误**：429（限流）和 5xx（服务端错误）可重试；400（参数错误）不可重试
- **设上限**：最多重试 3 次，避免无限循环
- **设超时**：每次调用都设 timeout，防止永久挂起

### 动手 5 分钟

把本节的最小聊天程序补上一个"成本计价器"。

1. 在每次 API 调用后，从响应的 `usage` 字段读出 `input_tokens` 和 `output_tokens`。
2. 维护一个会话累计值，在每轮回复末尾打印 `本轮 $0.0012 | 累计 $0.0187`。
3. 故意把 `max_tokens` 调到 4096 再聊三轮，对比累计成本的变化。

**验收标准**：程序断网时不崩溃（走你写的重试与错误分支），且退出前能打印出本次会话的总 token 与总成本。

### 要点总结

- OpenAI 和 Anthropic 的 API 设计有差异（System Prompt 位置、响应结构、流式接口）
- 始终用 `.env` 文件管理 API Key，加入 `.gitignore`
- 同步调用适合简单场景，流式调用适合需要"打字效果"的交互
- 生产环境必须设置 timeout、处理速率限制和服务端错误
- 指数退避是标准的重试策略，但只重试可恢复错误（429 / 5xx）
- 失败时要回滚消息历史，避免错误上下文污染后续对话
- 从命令行聊天程序开始，这是后续 Agent 开发的起点
