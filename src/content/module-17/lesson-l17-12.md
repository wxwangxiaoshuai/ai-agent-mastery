## 用 AI Coding 交付一个桌面端 Agent 原型

> 本课标注"前端特例"——桌面端涉及 JS/Electron，但 Python 仍是后端 Agent 主语言。

L17-11 讲了桌面端 Agent 的架构设计。这一节用 AI Coding 从零交付一个系统托盘 Agent 原型：后台常驻、快捷键唤醒、剪贴板输入输出。全程用 OpenSpec + Superpowers 工作流。

### 第一步：用 OpenSpec 写规格

在终端里启动 OpenSpec 工作流：

```bash
mkdir clipboard-agent && cd clipboard-agent
openspec init
```

然后 `/opsx:explore` 探索方案：

```text
我要做一个 Clipboard Agent：
- 系统托盘常驻，Ctrl+Shift+Space 唤醒
- 选中文字 → 按快捷键 → Agent 处理 → 结果写回剪贴板
- 技术栈：Electron + Python 后端
- 本地模型用 Ollama 做简单任务，云端模型做复杂推理

请探索技术方案，对比以下两个方向：
1. Electron 主进程直接 spawn Python 子进程
2. Electron 通过 HTTP localhost 与 FastAPI 后端通信
```

经过 `/opsx:explore` 的探索，选择方案 2（HTTP localhost），因为：
- 前后端解耦，可以独立测试
- 后端可以独立升级，不影响 Electron 壳
- 方便后续扩展到 Web 版本

然后是 `/opsx:propose` 生成规格：

```text
# proposal.md
## 动机
需要一个能在任何应用中使用的 AI 助手，不离开当前上下文即可调用。

## 核心功能
1. 系统托盘常驻，右键菜单（设置 / 退出）
2. Ctrl+Shift+Space 唤醒，读取剪贴板
3. 发送到 Python Agent 后端处理
4. 结果写回剪贴板 + 桌面通知
5. 设置面板：选择本地模型/云端模型、API Key 配置

# specs/clipboard-agent.md
## 场景
- 场景1：用户在浏览器里选中一段英文 → 快捷键 → 翻译结果写回剪贴板
- 场景2：用户选中一段代码 → 快捷键 → Agent 解释这段代码 → 结果写回剪贴板
- 场景3：用户选中一段文字 → 快捷键 → Agent 做摘要 → 结果写回剪贴板
- 边界：剪贴板为空时不处理
- 边界：后端未启动时提示用户
- 边界：处理超过 10 秒时显示进度通知

## 验收标准
- [ ] 快捷键在所有应用中可用
- [ ] 处理结果在 3 秒内写回剪贴板（本地模型）
- [ ] 离线时使用本地模型，通知用户当前为离线模式
- [ ] 设置面板可切换模型、配置 API Key
```

### 第二步：用 AI 生成项目骨架

用 `/opsx:apply` 按 tasks.md 逐条实现。先让 AI 生成 Electron 项目骨架：

```bash
# AI 生成的 tasks.md 第一条
# Task 1: 初始化 Electron 项目
mkdir clipboard-agent && cd clipboard-agent
npm init -y
npm install electron --save-dev
```

然后生成 Python 后端骨架：

```python
# agent_server.py —— AI 生成的 FastAPI 后端
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import sys

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Electron 本地访问
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    text: str
    action: str = "auto"  # auto / translate / explain / summarize

class AgentResponse(BaseModel):
    result: str
    model_used: str
    processing_time_ms: int


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/agent/process", response_model=AgentResponse)
async def process(request: AgentRequest):
    import time
    start = time.time()

    # 简单任务分类：用关键词匹配而不是 LLM（省 token）
    action = request.action
    if action == "auto":
        action = classify_action(request.text)

    # 执行对应的处理
    prompt = build_prompt(request.text, action)
    result = await call_llm(prompt)

    elapsed = int((time.time() - start) * 1000)
    return AgentResponse(
        result=result,
        model_used="ollama:llama3.2:3b",
        processing_time_ms=elapsed,
    )


def classify_action(text: str) -> str:
    """简单的关键词分类，避免 LLM 调用的延迟和成本。"""
    text_lower = text.lower()
    # 检测是否为代码
    code_indicators = ["def ", "import ", "function ", "class ", "const ", "let ",
                       "```", "{", "}", "=>", "print(", "console.log"]
    if any(ind in text for ind in code_indicators):
        return "explain"
    # 检测是否包含中文
    if any('一' <= c <= '鿿' for c in text):
        return "translate"  # 中文内容 → 翻译成英文
    # 检测是否超过 200 字
    if len(text.split()) > 200:
        return "summarize"
    return "translate"  # 默认：翻译


def build_prompt(text: str, action: str) -> str:
    prompts = {
        "translate": f"将以下内容翻译成中文，只输出译文：\n\n{text}",
        "explain": f"用中文解释以下代码，说明它做了什么：\n\n{text}",
        "summarize": f"用中文对以下内容做要点摘要，不超过 3 条：\n\n{text}",
    }
    return prompts.get(action, prompts["translate"])


async def call_llm(prompt: str) -> str:
    try:
        import ollama
        response = ollama.chat(
            model="llama3.2:3b",
            messages=[{"role": "user", "content": prompt}],
        )
        return response["message"]["content"]
    except Exception:
        # 离线降级：返回原文
        return f"[离线模式] 无法处理。原文：{prompt[:200]}..."
```

### 第三步：实现 Electron 系统托盘 Agent

让 AI 生成 Electron 主进程代码：

```javascript
// main.js —— AI 生成的 Electron 主进程
const { app, Tray, Menu, globalShortcut, clipboard, Notification } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

let tray = null
let pythonProcess = null

function startPythonBackend() {
  const pythonPath = process.platform === 'win32'
    ? path.join(__dirname, 'resources', 'agent-server.exe')
    : path.join(__dirname, 'resources', 'agent-server')

  pythonProcess = spawn(pythonPath, [], {
    env: { ...process.env, PORT: '19999' },
  })

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python: ${data}`)
  })

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python err: ${data}`)
  })
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'))
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '设置',
      click: () => {
        // 打开设置窗口
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        if (pythonProcess) pythonProcess.kill()
        app.quit()
      },
    },
  ])
  tray.setToolTip('Clipboard Agent')
  tray.setContextMenu(contextMenu)
}

async function processClipboard() {
  const text = clipboard.readText()
  if (!text || text.trim().length === 0) {
    new Notification({ title: 'Clipboard Agent', body: '剪贴板为空' }).show()
    return
  }

  try {
    const response = await fetch('http://localhost:19999/agent/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, action: 'auto' }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    clipboard.writeText(data.result)
    new Notification({
      title: 'Clipboard Agent',
      body: `已处理（${data.model_used}，${data.processing_time_ms}ms）`,
    }).show()
  } catch (err) {
    new Notification({
      title: 'Clipboard Agent',
      body: `处理失败：${err.message}`,
    }).show()
  }
}

app.whenReady().then(() => {
  startPythonBackend()
  createTray()

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    processClipboard()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (pythonProcess) pythonProcess.kill()
})
```

### 第四步：用 Superpowers 做 review 和验证

在 `/opsx:apply` 过程中，Superpowers 自动触发：

- **Gate 4（Review 门禁）**：`requesting-code-review` skill 检查代码质量
  - Python 后端：检查 FastAPI 路由是否正确、异常处理是否完整
  - Electron 主进程：检查进程管理是否正确、快捷键注销是否遗漏
- **Gate 5（完成门禁）**：`verification-before-completion` skill 逐条检查
  - 快捷键在所有应用中可用？
  - 剪贴板为空时是否提示？
  - 后端未启动时是否提示？
  - 处理超时是否有进度通知？

### 打包与分发

```bash
# 1. 打包 Python 后端
pyinstaller --onefile --name agent-server agent_server.py

# 2. 复制到 Electron 资源目录
cp dist/agent-server electron-app/resources/

# 3. 打包 Electron 应用
cd electron-app
npx electron-builder --mac --win --linux
```

打包后的 macOS 应用结构：
```
ClipboardAgent.app/
  Contents/
    MacOS/
      ClipboardAgent          # Electron 可执行文件
    Resources/
      agent-server            # pyinstaller 打包的 Python 后端
      icon.png
```

### 动手 5 分钟

1. 用 OpenSpec 为 Clipboard Agent 写一份完整的 spec（proposal.md + specs/ + design.md + tasks.md）。
2. 用 AI 生成 Electron 脚手架 + Python FastAPI 后端骨架。
3. 实现快捷键 → 剪贴板读取 → HTTP 请求 → 结果写回剪贴板的最小闭环。
4. 用 Superpowers 的 `verification-before-completion` 逐条检查验收标准。

**验收标准**：在任何应用里选中文字 → 按 Ctrl+Shift+Space → 3 秒内收到通知，剪贴板内容已被 Agent 处理。如果离线，能优雅降级并告知用户。

### 要点总结

- **用 OpenSpec 写桌面端 Agent 的规格时，重点写两个文件**：proposal.md（动机 + 核心功能）+ specs/（场景 + 边界 + 验收标准）。
- **技术选型在 `/opsx:explore` 阶段定**：Electron + Python 后端用 HTTP localhost 通信，前后端解耦、独立测试、独立升级。
- **AI 生成 Electron 代码时，三个关键点要检查**：进程管理（spawn/kill 是否正确）、快捷键注册与注销（app.on('will-quit') 是否遗漏）、错误处理（后端未启动、剪贴板为空、处理超时）。
- **用 Superpowers 做 review 和验证**：Gate 4（code-review）检查质量，Gate 5（verification）逐条检查验收标准。
- **打包分两步**：pyinstaller 打包 Python 后端 → electron-builder 打包前端。注意平台差异（macOS 签名、Windows 安装包）。
- **桌面端 Agent 的体验优势**：全程不离开当前应用，Ctrl+Shift+Space 一按即用。这就是 Web 应用做不到的"无缝嵌入工作流"。