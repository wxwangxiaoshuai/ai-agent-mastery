## 动手调用 LLM API

我们同时用 Python 和 TypeScript 调通第一个 LLM API 调用。目标是跑通**同步调用**和**流式调用**两种模式，覆盖 OpenAI 和 Anthropic 两家主流 API，并建立一个最小的命令行聊天程序。

### 环境准备

**Python 环境**：

```bash
pip install openai anthropic python-dotenv
```

**TypeScript 环境**：

```bash
npm install openai @anthropic-ai/sdk dotenv
# 或
pnpm add openai @anthropic-ai/sdk dotenv
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

```typescript
// TypeScript：用 Node.js 的 dotenv
import 'dotenv/config'  // 自动加载 .env
```

> **安全提醒**：务必将 `.env` 加入 `.gitignore`。API Key 泄露是真实的安全事故。

---

### OpenAI API（Python）

**同步调用**：

```python
from openai import OpenAI

client = OpenAI()  # 自动读取 OPENAI_API_KEY

response = client.chat.completions.create(
    model="gpt-4o",
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
    model="gpt-4o",
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
> **模型名说明**：本节示例使用别名（如 `gpt-4o`、`claude-sonnet-5`），方便上手。生产环境建议钉死快照 ID（见 L01-04），避免厂商无声升级导致行为变化。

---

### TypeScript 调用示例

**OpenAI 同步调用**：

```typescript
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "你是一个 AI 技术助手。" },
    { role: "user", content: "用一句话介绍什么是 Agent。" },
  ],
  temperature: 0.7,
  max_tokens: 200,
});

console.log(response.choices[0].message.content);
```

**Anthropic 流式调用**：

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = await client.messages.stream({
  model: "claude-sonnet-5",
  max_tokens: 500,
  messages: [{ role: "user", content: "写一首关于 AI 的五言绝句。" }],
});

for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    process.stdout.write(event.delta.text);
  }
}
console.log();
```

---

### 最小命令行聊天程序（Python，含错误处理）

```python
import os
from dotenv import load_dotenv
from openai import OpenAI, RateLimitError, APIError, APITimeoutError

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
                model="gpt-4o",
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
        except APIError as e:
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
from openai import OpenAI, RateLimitError, APIError

client = OpenAI(timeout=30.0)

def call_with_retry(messages, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model="gpt-4o",
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
        except APIError as e:
            if e.status_code and e.status_code >= 500:
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

### 要点总结

- OpenAI 和 Anthropic 的 API 设计有差异（System Prompt 位置、响应结构、流式接口）
- 始终用 `.env` 文件管理 API Key，加入 `.gitignore`
- 同步调用适合简单场景，流式调用适合需要"打字效果"的交互
- 生产环境必须设置 timeout、处理速率限制和服务端错误
- 指数退避是标准的重试策略，但只重试可恢复错误（429 / 5xx）
- 失败时要回滚消息历史，避免错误上下文污染后续对话
- 从命令行聊天程序开始，这是后续 Agent 开发的起点
