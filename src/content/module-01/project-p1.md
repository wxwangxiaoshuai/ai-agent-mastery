## CLI 个人助手 v0

这是你的第一个 LLM 应用——一个命令行 AI 助手。它会是后续所有 Agent 项目的起点。先别追求花哨功能，把"能对话、能流式、能记住历史"这三件事做扎实。

### 项目目标

打造一个可在命令行运行的 AI 助手，支持：
- 多轮对话（记住之前聊了什么）
- 流式输出（一个字一个字"打"出来）
- 角色切换（在不同 System Prompt 之间切换）
- 历史持久化（关闭程序后再打开还能看到之前的对话）
- 错误处理（API 失败时优雅降级，不崩溃）

### 学完能做什么

- 跑通你的第一个 LLM 应用，理解 API 调用的完整生命周期
- 掌握同步调用与流式调用的差异和工程取舍
- 理解"对话历史"是 Agent 的最简记忆形式
- 学会用环境变量管理敏感配置、用本地文件做简单持久化

### 验收标准

完成后的程序应该满足以下所有条件：

- [ ] 在终端输入 `python assistant.py` 可以启动助手
- [ ] 输入文字后能看到流式打字效果
- [ ] 多轮对话——助手能"记住"前几轮说了什么
- [ ] 输入 `quit` 或 `exit` 退出
- [ ] 输入 `/role <名称>` 切换角色（如 `/role coder`）
- [ ] 输入 `/clear` 清空当前对话历史
- [ ] 输入 `/history` 查看完整对话记录
- [ ] 重新启动程序后能加载上次保存的对话
- [ ] 网络错误时打印友好提示而不是崩溃
- [ ] API Key 通过环境变量或 `.env` 文件读取，不硬编码

### 实施步骤

按以下顺序增量开发，每步独立可运行。

**Step 1：环境准备**

```bash
# Python 方案
pip install openai python-dotenv

# TypeScript 方案
npm install openai
npm install -D @types/node dotenv tsx
```

创建 `.env` 文件（记得加进 `.gitignore`）：

```bash
OPENAI_API_KEY=sk-...
```

**Step 2：最小可运行版本（同步调用）**

目标是跑通"输入 → 调用 → 输出"的最简链路。

```python
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

while True:
    user_input = input("\n你: ").strip()
    if user_input.lower() in ("quit", "exit"):
        break
    if not user_input:
        continue

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": user_input}],
    )
    print(f"AI: {response.choices[0].message.content}")
```

**Step 3：升级到流式调用**

把 `stream=True` 加上，迭代 `chunk` 打印：

```python
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": user_input}],
    stream=True,
)
print("AI: ", end="", flush=True)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()
```

**Step 4：加入多轮对话**

在内存中维护 `messages` 列表，每轮把用户和助手的回复都追加进去：

```python
messages = []
while True:
    user_input = input("\n你: ").strip()
    if user_input.lower() in ("quit", "exit"):
        break
    if not user_input:
        continue

    messages.append({"role": "user", "content": user_input})
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )
    print("AI: ", end="", flush=True)
    full_reply = ""
    for chunk in stream:
        if chunk.choices[0].delta.content:
            text = chunk.choices[0].delta.content
            print(text, end="", flush=True)
            full_reply += text
    print()
    messages.append({"role": "assistant", "content": full_reply})
```

**Step 5：加入角色系统**

预定义几个 System Prompt，用 `/role` 命令切换：

```python
ROLES = {
    "default": "你是一个友好的 AI 助手。",
    "coder": "你是一位资深 Python 工程师，擅长代码审查和性能优化。回答简洁直接。",
    "translator": "你是一位专业的中英翻译，所有回复都用英文。",
    "teacher": "你是一位耐心的编程老师，用通俗语言解释概念，配合代码示例。",
}

current_role = "default"

while True:
    user_input = input("\n你: ").strip()
    if user_input.startswith("/role "):
        role_name = user_input[6:].strip()
        if role_name in ROLES:
            current_role = role_name
            print(f"已切换到角色: {role_name}")
        else:
            print(f"未知角色: {role_name}，可选: {', '.join(ROLES.keys())}")
        continue
    # ... 原有逻辑，并在 messages 开头插入 system
```

注意：切换角色时，应该清空对话历史（因为旧历史是针对旧角色的）。

**Step 6：加入历史持久化**

把 `messages` 序列化为 JSON 存到本地文件。注意：只持久化 user/assistant 消息，**不要把 system 写进文件**——system 在每次请求时按当前角色动态拼上。

```python
import json
from pathlib import Path

HISTORY_FILE = Path.home() / ".cli_assistant_history.json"

def load_history() -> list:
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text())
    return []

def save_history(messages: list):
    HISTORY_FILE.write_text(json.dumps(messages, ensure_ascii=False, indent=2))

def clear_history():
    save_history([])
```

启动时 `messages = load_history()`，每轮成功后 `save_history(messages)`，`/clear` 和切换角色时调用 `clear_history()`。

**Step 7：加入错误处理**

```python
from openai import APIError, APITimeoutError, RateLimitError

try:
    stream = client.chat.completions.create(...)
    # ... 处理流式响应
except APITimeoutError:
    print("\n[超时] 请求超过 30 秒，请重试。")
    messages.pop()  # 移除最后一条用户消息
except RateLimitError:
    print("\n[限流] 请求过于频繁，请稍后再试。")
    messages.pop()
except APIError as e:
    print(f"\n[错误] API 调用失败: {e}")
    messages.pop()
```

### 完整参考代码（Python）

```python
import json
from pathlib import Path

from dotenv import load_dotenv
from openai import APIError, APITimeoutError, OpenAI, RateLimitError

load_dotenv()
client = OpenAI(timeout=30.0)

ROLES = {
    "default": "你是一个友好的 AI 助手。",
    "coder": "你是一位资深 Python 工程师，擅长代码审查和性能优化。回答简洁直接。",
    "translator": "你是一位专业的中英翻译，所有回复都用英文。",
    "teacher": "你是一位耐心的编程老师，用通俗语言解释概念，配合代码示例。",
}

HISTORY_FILE = Path.home() / ".cli_assistant_history.json"


def load_history() -> list:
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text())
    return []


def save_history(messages: list):
    HISTORY_FILE.write_text(json.dumps(messages, ensure_ascii=False, indent=2))


def clear_history():
    save_history([])


def chat():
    current_role = "default"
    messages = load_history()  # 启动时加载上次对话

    print("=" * 50)
    print("CLI AI 助手已启动（输入 quit 退出）")
    print("命令: /role <name> | /clear | /history | quit")
    if messages:
        print(f"已加载 {len(messages)} 条历史消息")
    print("=" * 50)

    while True:
        try:
            user_input = input("\n你: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit"):
            print("再见！")
            break

        if user_input == "/clear":
            messages = []
            clear_history()  # 同步清空本地文件
            print("对话历史已清空。")
            continue

        if user_input == "/history":
            if not messages:
                print("  （暂无历史）")
            for m in messages:
                print(f"  [{m['role']}] {m['content'][:80]}")
            continue

        if user_input.startswith("/role "):
            role_name = user_input[6:].strip()
            if role_name in ROLES:
                current_role = role_name
                messages = []
                clear_history()  # 切换角色清空历史
                print(f"已切换到角色: {role_name}（历史已清空）")
            else:
                print(f"未知角色: {role_name}，可选: {', '.join(ROLES.keys())}")
            continue

        messages.append({"role": "user", "content": user_input})
        # system 按当前角色动态拼接，不写入历史文件
        full_messages = [{"role": "system", "content": ROLES[current_role]}] + messages

        try:
            stream = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=full_messages,
                stream=True,
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
            save_history(messages)  # 只存 user/assistant，不含 system

        except APITimeoutError:
            print("\n[超时] 请重试。")
            messages.pop()
        except RateLimitError:
            print("\n[限流] 请稍后再试。")
            messages.pop()
        except APIError as e:
            print(f"\n[错误] {e}")
            messages.pop()


if __name__ == "__main__":
    chat()
```

### 验收测试

手工测试清单——按这个走一遍：

```bash
# 1. 启动
python assistant.py

# 2. 基本对话
你: 你好
AI: 你好！有什么可以帮助你的吗？
你: 我刚才说了什么？
AI: 你刚才说"你好"。

# 3. 角色切换
你: /role coder
已切换到角色: coder
你: 这段代码有什么问题：def f(): return eval(input())
AI: eval() 是高危函数...

# 4. 历史查询
你: /history
  [user] 你好
  [assistant] 你好！有什么可以帮助你的吗？
  ...

# 5. 重启程序，历史仍在（先不要 /clear）
[Ctrl+D 退出]
python assistant.py
[输入] /history
  [应能看到上次保存的对话]

# 6. 清空历史
你: /clear
对话历史已清空。
[再重启一次]
python assistant.py
[输入] /history
  （暂无历史）

# 7. 错误处理（断网测试）
[断网后输入问题]
你: test
AI: [等待几秒后]
[超时] 请重试。
```

### 进阶挑战（可选）

完成基础功能后，尝试以下扩展：

1. **Token 统计**：每次显示本次输入/输出消耗了多少 token
2. **多模型切换**：在 `default`/`coder`/`translator` 之外加入 `gpt-4o`、`claude-sonnet-5` 等模型选项
3. **对话导出**：输入 `/export` 把当前对话导出为 Markdown 文件
4. **多会话管理**：支持创建/切换/删除多个独立对话
5. **成本计算**：根据模型价格计算本次会话累计花费
6. **Rich 美化**：用 `rich` 库做彩色输出、加载动画、Markdown 渲染

### 常见问题

**Q1: 为什么用 `gpt-4o-mini` 而不是 `gpt-4o`？**
A: 这个项目的核心是"跑通流程"而不是"追求质量"，用 mini 成本低、速度快、足够支撑调试。完成后再切到主力模型测试效果差异。

**Q2: 历史文件存哪里？什么时候存？**
A: 课程参考代码默认存到 `~/.cli_assistant_history.json`；仓库 `code/` 示例存到 `code/memory/history.json`。每轮对话成功后立即保存（也可以改成退出时统一保存）。只存 user/assistant，不存 system。生产环境建议加密存储——这里存的是本地明文。

**Q3: 切换角色时为什么要清空历史？**
A: 不同角色的 System Prompt 含义不同，混在一起会让模型困惑。例如 `coder` 角色下的"如何优化这段代码"对话，切换到 `translator` 角色后上下文就完全不搭了。

**Q4: 报错时为什么要 `messages.pop()`？**
A: 如果调用失败，用户的输入并没有得到成功回复。如果不 pop，下一轮重试时模型会看到"用户问了 X，助手没回复"这种不完整历史，影响后续生成。

### 要点回顾

- 这个项目奠定了 Agent 开发的最小骨架：调用 → 记忆 → 持久化 → 错误处理
- 多轮对话的本质是"把历史作为 Context 的一部分发给模型"（详见 M3 上下文工程）
- 角色切换本质是"修改 System Prompt"，所有"角色"在 Agent 看来只是不同的 System Prompt
- 完成这个项目后，**你已经在调用 LLM 这件事上和 90% 的 AI 应用开发者站在同一起跑线**——剩下的只是加更多功能（工具、记忆、规划）

### 下一步

完成 P1 后，你已经具备做 P2 的能力：
- P2「智能文档摘要 & 信息抽取器」会用到 P1 的所有技能 + 知识到 L02-04 的结构化输出
