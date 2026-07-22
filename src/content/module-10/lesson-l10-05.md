## 流式输出与前端集成

到这一节，你的 Agent 已经能处理复杂控制流、人工介入、多角色协作。但用户看到的还是"转圈等几十秒，然后一坨结果蹦出来"。这种体验让人焦虑——"它在干嘛？卡住了吗？还要多久？" **流式输出把 Agent 的中间思考过程实时推给前端**，让用户看见"它在想、在查、在写"，从黑盒等待变成可视的智能。这一节做前后端一体的流式集成。

### 为什么流式：体验与信任

先理解流式不是炫技，是体验刚需：

```
非流式（等完才返回）：
  用户提问 ────────────20秒后────────→ 一坨答案
  · 用户焦虑：卡住了？还在跑？
  · 长任务尤其难熬
  · 无法提前发现"跑偏"——等 20 秒才知道答非所问

流式（边跑边推）：
  用户提问 → "正在思考..." → "搜索到3条结果" → "正在综合..." → 逐字答案
  · 用户实时看到进度，不焦虑
  · 能提前发现跑偏，可中断
  · 逐字输出像人打字，体感快很多（首字延迟低）
```

**两层流式**：
1. **token 流**：LLM 生成的回答逐字吐（像 ChatGPT 打字效果）
2. **步骤流**：Agent 的中间步骤（"调了搜索工具""拿到结果""开始综合"）实时推送

生产级体验两者都要——光逐字不够，用户还要知道"它在做什么动作"。

### 后端：token 流与步骤流

**token 流**：LLM streaming，逐 token 推送：

```python
from openai import OpenAI
client = OpenAI()

def stream_llm(messages):
    """流式调 LLM，yield 每个 token"""
    stream = client.chat.completions.create(
        model="gpt-4o-mini", messages=messages, temperature=0,
        stream=True,   # 关键：开启流式
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta   # 逐 token 吐
```

**步骤流**：Agent 执行中间事件（节点开始、工具调用、工具结果）：

```python
def stream_agent(question):
    """Agent 执行，yield 各类事件"""
    yield {"type": "step", "step": "thinking", "content": "正在分析问题"}
    # 调 LLM 决策
    decision = llm_decide(question)
    yield {"type": "tool_call", "tool": "search", "args": decision.args}

    # 调工具
    yield {"type": "step", "step": "searching", "content": "搜索中..."}
    result = search(decision.args)
    yield {"type": "tool_result", "tool": "search", "result_preview": result[:100]}

    # 生成答案时 token 流
    yield {"type": "step", "step": "generating", "content": "正在综合答案"}
    for token in stream_llm(build_final_prompt(result, question)):
        yield {"type": "token", "content": token}

    yield {"type": "done"}
```

**关键**：所有事件用统一格式 `{type, ...}`，前端按 type 分发处理。**事件协议是前后端的契约**——后端发什么 type，前端就要能处理什么 type，不能有"幽灵事件"。

### SSE：单向流式的事实标准

怎么把流式事件从后端推到前端？HTTP 是请求-响应的，天然不支持服务端主动推。**SSE（Server-Sent Events）** 是最常用的方案：

```
SSE 原理：
  前端：EventSource 连后端 /stream 接口
  后端：响应头 Content-Type: text/event-stream
        持续写 "data: {...}\n\n" 格式，前端实时收
  特点：单向（服务端→客户端）、基于 HTTP、自动重连、文本

vs WebSocket：
  SSE：单向、简单、自动重连、走 HTTP（穿透防火墙容易）
  WS：双向、复杂、需心跳保活
  · Agent 场景大多只需服务端→客户端推 → SSE 够用
  · 要双向（如前端实时发指令中断）→ WS 或 SSE+POST 组合
```

**FastAPI + SSE 后端**：

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.get("/stream")
def stream_agent_endpoint(q: str):
    """SSE 端点：流式推 Agent 事件"""
    def event_stream():
        for event in stream_agent(q):
            # SSE 格式：每个事件一行 data: + \n\n
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache",   # 不缓存
                 "X-Accel-Buffering": "no"},      # 关 Nginx 缓冲（防积压）
    )
```

**两个必设的坑**：
1. `Cache-Control: no-cache`：否则中间层缓存，流变成"一坨"
2. `X-Accel-Buffering: no`：Nginx 默认缓冲响应，不关掉 SSE 会被攒着批量发——前端看不到实时流。**这个坑极常见**，部署到 Nginx 后流式失效多半因为这个。

### 前端：消费 SSE 事件

浏览器原生 `EventSource` 消费 SSE：

```jsx
// React 前端消费 SSE
import { useState, useEffect } from "react"

export function AgentChat() {
  const [answer, setAnswer] = useState("")      // 累积的答案
  const [steps, setSteps] = useState([])       // 中间步骤
  const [status, setStatus] = useState("idle")

  function ask(question) {
    setAnswer(""); setSteps([]); setStatus("running")
    const es = new EventSource(`/stream?q=${encodeURIComponent(question)}`)
    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      switch (event.type) {
        case "step":
          setSteps(s => [...s, event.content])
          break
        case "tool_call":
          setSteps(s => [...s, `🔧 调用 ${event.tool}(${JSON.stringify(event.args)})`])
          break
        case "token":
          setAnswer(a => a + event.content)   // 逐字累积
          break
        case "done":
          setStatus("done"); es.close()
          break
      }
    }
    es.onerror = () => { setStatus("error"); es.close() }
  }

  return (
    <div>
      <div>状态：{status}</div>
      <div>步骤：{steps.map((s,i) => <div key={i}>{s}</div>)}</div>
      <div>答案：{answer}</div>
      <button onClick={() => ask("调研 LangGraph")}>提问</button>
    </div>
  )
}
```

**前端处理要点**：
- **token 累积**：每次 `token` 事件把 content 追加到 answer，形成打字效果
- **步骤列表**：每个 `step`/`tool_call` 加到 steps 列表，用户看见 Agent 在干嘛
- **状态机**：`idle→running→done/error`，UI 按状态切换（转圈/结果/错误）

### 可中断的流式交互

流式不只要"推"，还要能"停"。用户发现 Agent 跑偏了，想中断重来。两种中断：

**前端中断**（断开连接）：

```jsx
const esRef = useRef(null)
function stop() {
  esRef.current?.close()   // 关 SSE 连接
  setStatus("stopped")
}
// 但这只断了前端收，后端 Agent 可能还在跑 → 浪费算力
```

**后端中断**（真停 Agent）：

```python
# 给每个会话一个 task_id，前端中断时 POST /cancel
running_tasks = {}   # task_id -> cancel flag

@app.get("/stream")
def stream(q: str, task_id: str):
    def event_stream():
        running_tasks[task_id] = {"cancel": False}
        for event in stream_agent(q):
            if running_tasks[task_id]["cancel"]:
                yield f"data: {json.dumps({'type':'cancelled'})}\n\n"
                return   # 被取消，停止
            yield f"data: {json.dumps(event)}\n\n"
        running_tasks.pop(task_id, None)
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/cancel")
def cancel(task_id: str):
    if task_id in running_tasks:
        running_tasks[task_id]["cancel"] = True
    return {"cancelled": True}
```

**生产中断要落到 Agent 框架层**——LangGraph/CrewAI 都支持中途取消（基于 checkpointer 的 thread 状态）。只断 HTTP 连接是假中断，后端仍在烧 token。

### LangGraph 的流式

LangGraph 原生支持流式输出两种东西：state 变化和 token：

```python
# 流式：每个节点执行后推 state 增量
for event in app.stream(input, config=config, stream_mode="updates"):
    # event = {节点名: 该节点返回的 state 更新}
    yield {"type": "node_update", "node": list(event.keys())[0]}

# 流式 token（生成节点的输出）
for chunk in app.stream(input, config=config, stream_mode="messages"):
    # chunk 含 LLM 的 token
    yield {"type": "token", "content": chunk.content}
```

`stream_mode` 选项：`updates`（节点 state 变化）、`messages`（LLM token）、`values`（完整 state）。**用 `updates` 做"步骤流"，用 `messages` 做 token 流**——和前面的两层流式对应。

### 流式的陷阱

常见坑，逐个防：

```
坑1：缓冲导致不"流"
  Nginx/网关默认缓冲 → 前端看不到实时流
  → 设 X-Accel-Buffering: no + Cache-Control: no-cache

坑2：JSON 拼接分块错乱
  token 流式时把多个 token 拼进一个 data 行 → 前端解析错
  → 每个 token 一个 data: 行，别合并

坑3：连接泄漏
  前端关了页面但后端 SSE 还在跑 → 累积连接
  → 后端检测连接断开（yield 时抛异常）就停

坑4：跨域
  前端和后端不同域 → EventSource 需配 CORS
  → FastAPI 加 CORSMiddleware，allow origins

坑5：token 太碎
  逐字推太碎，网络抖动就卡顿 → 合并相邻 token（攒 5 个再发）
  → 但别攒太多（超过 100ms 用户能感知延迟）
```

### 要点总结

- 流式是体验刚需：从"等 20 秒一坨"变"实时看 Agent 在想/查/写"，降焦虑、可早发现跑偏
- 两层流式：token 流（逐字打字）+ 步骤流（中间动作），生产级两者都要
- 事件统一格式 `{type, ...}`，前后端按 type 契约分发——不能有幽灵事件
- SSE 是单向流式事实标准：基于 HTTP、自动重连；双向才需 WebSocket
- 两个必设坑：Cache-Control: no-cache + X-Accel-Buffering: no（防网关缓冲致流失效）
- 前端 EventSource 消费：token 累积、步骤入列表、状态机切换 UI
- 可中断：前端关 SSE 是假停，后端用 cancel flag / 框架 thread 取消才真停（省算力）
- LangGraph stream_mode：updates（步骤流）+ messages（token 流），对应两层
- 坑：缓冲、JSON 分块、连接泄漏、跨域、token 过碎——分别对策
- 下一节 L10-06：框架用多了的代价——反模式与何时退回手写
