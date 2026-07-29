## Agent 桌面端应用架构

> 本课标注"前端特例"——桌面端涉及 JS/Electron，但 Python 仍是后端 Agent 主语言。

M17 的主题是"用 AI 造软件"。Web 应用是最常见的形态，但有一种形态被严重低估：**桌面端 Agent 应用**。一个常驻系统托盘的 Agent，快捷键唤醒，直接读写剪贴板，本地模型做常规任务——这种体验是浏览器里跑不出来的。

### 为什么桌面端 Agent 值得做

Web 应用的本质限制是**沙箱**——浏览器不允许你访问文件系统、剪贴板、系统快捷键、屏幕截图。桌面端 Agent 天然拥有这些能力：

| 能力 | Web 应用 | 桌面端应用 |
|------|---------|-----------|
| 剪贴板读写 | 有限（需用户主动粘贴） | 完全控制 |
| 全局快捷键 | 不支持 | 支持 |
| 文件系统 | 有限（File API） | 完全访问 |
| 屏幕截图 | 不支持 | 支持 |
| 后台常驻 | Service Worker（受限） | 系统托盘 |
| 离线运行 | 有限（PWA） | 完全支持 |
| 本地模型推理 | 不现实 | 完全支持 |

**离线优先**是桌面端 Agent 最大的差异化优势。用户数据不出本机，敏感任务用本地模型，复杂任务才走云端。这在隐私敏感场景（医疗、法律、财务）是刚需。

### 技术选型：Electron vs Tauri

| 维度 | Electron | Tauri |
|------|----------|-------|
| 运行时 | Chromium + Node.js | 系统 WebView + Rust |
| 包体积 | ~150MB+ | ~5-15MB |
| 内存占用 | ~200MB+ | ~50MB |
| 前端生态 | 完全兼容 npm | 完全兼容 npm |
| 后端语言 | Node.js | Rust |
| Python 集成 | 通过 child_process / HTTP | 通过 sidecar / HTTP |
| 成熟度 | 极高，生态最大 | 快速成长，文档完善中 |

**推荐**：Agent 桌面应用选 **Electron**。原因：
1. Electron 生态最成熟，AI Coding 生成 Electron 代码的准确率远高于 Tauri
2. Python 后端通过 `child_process` 或 HTTP localhost 通信就够了，不需要 Rust 的极致性能
3. 包体积在这种场景下不是主要矛盾——用户下载一个 150MB 的 Agent 应用完全可以接受
4. 如果你更看重包体积和内存，Tauri 是更好的选择，但 AI 生成的 Tauri+Rust 代码质量参差不齐

### 架构设计：Electron + Python 后端

```
┌─────────────────────────────────────────┐
│ Electron 壳（TypeScript/JS）              │
│  ┌─────────────────────────────────────┐│
│  │ 渲染进程（React 前端）               ││
│  │  - 设置面板                          ││
│  │  - 对话界面                          ││
│  │  - 通知/Toast                        ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ 主进程（Node.js）                    ││
│  │  - 系统托盘                           ││
│  │  - 全局快捷键                         ││
│  │  - 剪贴板读写                         ││
│  │  - 窗口管理                           ││
│  │  - Python 进程管理                    ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              │ HTTP localhost:19999
              │ (或 stdin/stdout JSON-RPC)
              ▼
┌─────────────────────────────────────────┐
│ Python Agent 后端进程                    │
│  ┌─────────────────────────────────────┐│
│  │ Agent 核心                           ││
│  │  - ReAct Loop / LangGraph            ││
│  │  - Skill Registry                    ││
│  │  - 工具执行                          ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ 本地模型推理（可选）                  ││
│  │  - Ollama 集成                       ││
│  │  - llama.cpp Python binding          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**通信方式**：Electron 主进程通过 HTTP（localhost）或 stdin/stdout JSON-RPC 与 Python 后端通信。HTTP 最简单，JSON-RPC 更结构化。

```python
# agent_server.py —— Python 后端的最小 HTTP 接口
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class AgentRequest(BaseModel):
    user_input: str
    skill_id: str | None = None

class AgentResponse(BaseModel):
    output: str
    tool_calls: list[str]
    model_used: str

@app.post("/agent/run", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    # 实际实现：加载 Skill → 执行 Agent Loop → 返回结果
    ...
```

### 本地模型推理

桌面端 Agent 可以做 Web 应用做不到的事：**本地推理**。用 Ollama 或 llama.cpp 在用户本机跑模型：

```python
# 方案 A：Ollama（推荐，最简单）
import ollama

def call_local_model(prompt: str, model: str = "llama3.2:3b") -> str:
    response = ollama.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response["message"]["content"]


# 方案 B：llama.cpp Python binding
from llama_cpp import Llama

llm = Llama(
    model_path="./models/qwen2.5-7b-instruct-q4.gguf",
    n_ctx=4096,
    n_threads=4,
)

def call_local_model_llamacpp(prompt: str) -> str:
    output = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
    )
    return output["choices"][0]["message"]["content"]
```

### 离线优先架构

桌面端 Agent 的核心设计理念：**本地模型做常规任务，云端模型做复杂推理**。

```python
class HybridAgent:
    """离线优先 Agent：本地模型兜底，云端模型增强。"""

    def classify_task(self, user_input: str) -> str:
        """用 nano 档本地模型做任务分类。"""
        return call_local_model(
            f"分类以下任务：{user_input}"
            f"选项：simple（简单查询/翻译/摘要）| complex（推理/规划/多步骤）"
        )

    async def run(self, user_input: str):
        task_type = self.classify_task(user_input)

        if task_type == "simple":
            # 本地模型处理，数据不出本机
            return call_local_model(user_input)
        else:
            # 云端模型处理复杂推理
            if not self._check_internet():
                # 离线降级：用本地模型尝试，但告知用户结果可能不够好
                return call_local_model(
                    f"{user_input}\n\n注意：当前离线，结果可能不够准确。"
                )
            return await self._call_cloud_model(user_input)
```

**离线优先的三个原则**：
1. 能本地就一定不用云端——用户数据不出本机
2. 离线时优雅降级——告知用户当前是离线模式，结果可能不够好
3. 用户可选——设置面板里允许用户选择"只用本地模型"

### 系统级能力

桌面端 Agent 能做 Web 应用做不到的事：

```typescript
// Electron 主进程 —— 系统托盘 + 全局快捷键
import { app, Tray, Menu, globalShortcut, clipboard } from 'electron'

let tray: Tray

app.whenReady().then(() => {
  // 系统托盘
  tray = new Tray('icon.png')
  tray.setToolTip('AI Agent')

  // 全局快捷键：Ctrl+Shift+Space 唤醒
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    // 读取剪贴板 → 发给 Agent → 结果写回剪贴板
    const text = clipboard.readText()
    if (text) {
      // 发送给 Python Agent 后端
      fetch('http://localhost:19999/agent/run', {
        method: 'POST',
        body: JSON.stringify({ user_input: text }),
      })
        .then((r) => r.json())
        .then((data) => {
          clipboard.writeText(data.output)
          // 显示通知
          new Notification({ title: 'Agent', body: '结果已写入剪贴板' }).show()
        })
    }
  })
})
```

**典型使用场景**：你在任何应用里选中一段文字 → 按 Ctrl+Shift+Space → Agent 处理 → 结果自动写回剪贴板 → 粘贴。全程不需要离开当前应用。

### 打包与分发

```bash
# Python 后端打包
pyinstaller --onefile --name agent-server agent_server.py

# Electron 前端打包
npx electron-builder --mac --win --linux
```

打包后的目录结构：
```
my-agent-app/
  ├── MyAgent.app/          # macOS .app
  ├── MyAgent Setup.exe     # Windows 安装包
  └── resources/
      └── agent-server      # pyinstaller 打包的 Python 可执行文件
```

### 动手 5 分钟

1. 用 Electron 脚手架创建一个最小桌面应用（`npm init electron-app`），验证能跑起来。
2. 写一个 Python 脚本（`agent_server.py`），用 FastAPI 暴露一个 `/agent/run` 端点，返回"Hello from Agent"。
3. 让 Electron 主进程启动时自动 spawn Python 进程，并在退出时 kill 它。
4. 注册一个全局快捷键，读取剪贴板，发给 Python 后端，结果写回剪贴板。

**验收标准**：按 Ctrl+Shift+Space 后，选中文字被 Agent 处理过的结果替换。功能简单没关系——关键是跑通 Electron ↔ Python 的通信链路。

### 要点总结

- **桌面端 Agent 拥有 Web 应用没有的能力**：全局快捷键、剪贴板读写、文件系统访问、本地模型推理、离线运行。这些是隐私敏感场景的刚需。
- **技术选型推荐 Electron**：生态最成熟，AI Coding 生成 Electron 代码的准确率远高于 Tauri。Python 后端通过 HTTP localhost 通信。
- **架构模式**：Electron 壳（主进程 + 渲染进程）+ Python Agent 后端进程。通信用 HTTP localhost 或 stdin/stdout JSON-RPC。
- **离线优先**：本地模型做常规任务（Ollama / llama.cpp），云端模型做复杂推理。离线时优雅降级，用户可选"只用本地模型"。
- **系统托盘 Agent 的典型场景**：任何应用里选中文字 → 快捷键唤醒 → Agent 处理 → 结果写回剪贴板。全程不离开当前应用。
- **打包**：pyinstaller 打包 Python 后端，electron-builder 打包前端。分发时注意平台差异（macOS 签名、Windows 安装包）。