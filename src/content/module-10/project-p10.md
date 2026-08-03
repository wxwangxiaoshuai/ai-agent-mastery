## 深度研究 Agent（LangGraph 编排 + HITL）

M10 六节课讲了框架选型、LangGraph 状态机、人工介入、CrewAI 协作、流式前端、框架反模式。P10 把核心组装成一个**多步骤深度研究 Agent**：规划→并行搜索→去重→综合→人工审阅→定稿，关键节点支持人工介入，全程状态可持久化、可恢复、可重放，并把过程流式推到前端。这是"看得见、可控、可中断"的研究 Agent。

### 项目目标

用 LangGraph 编排一个深度研究 Agent：
- 多步骤编排：规划→并行搜索→去重→综合→人工审阅→定稿
- 并行搜索多来源 + 去重
- Human-in-the-loop 审阅节点（综合结果要人审才定稿）
- 状态持久化与断点恢复、重放
- 流式前端可视化（token + 步骤）

### 验收标准

- [ ] LangGraph StateGraph 编排 6 个节点，控制流清晰可画
- [ ] 规划节点分解研究问题为多个子查询
- [ ] 并行搜索节点扇出多来源，汇聚去重
- [ ] 综合节点产出研究报告草稿
- [ ] 人工审阅节点用 interrupt 暂停，等 approve/edit/reject 后续跑
- [ ] checkpointer 持久化，失败/中断后从断点恢复
- [ ] 状态历史可重放（get_state_history 调试）
- [ ] SSE 流式推送 token 与步骤事件
- [ ] 前端可视化：实时步骤列表 + 逐字答案 + 中断审核 UI
- [ ] 含测试：HITL 中断恢复、并行汇聚、状态重放

### 架构总览

```
┌─────────────────────────────────────────────────────────┐
│           深度研究 Agent (LangGraph)                      │
│                                                          │
│   START                                                  │
│     │                                                    │
│     ▼                                                    │
│   [plan] 规划：分解为 N 个子查询                          │
│     │ ────扇出───┐                                       │
│     ▼            ▼                                       │
│   [search]   [search]   并行搜索多来源                    │
│     │            │                                       │
│     └────汇聚────┘                                       │
│     ▼                                                    │
│   [dedup] 去重：合并重复结果                              │
│     ▼                                                    │
│   [synthesize] 综合：产出报告草稿                         │
│     ▼                                                    │
│   [review] 人工审阅 ──interrupt 暂停──┐                  │
│     │                                  │                  │
│     │(approve)──────────────► [finalize] 定稿             │
│     │(edit)────────────────► [finalize] 用改后草稿定稿    │
│     │(reject)──────────────► END                          │
│     ▼                                                    │
│   END                                                    │
│                                                          │
│   checkpointer：每节点存 state（SQLite）                 │
│   SSE stream：token + 步骤推前端                         │
└─────────────────────────────────────────────────────────┘
```

### 实施步骤

**Step 1：定义状态与节点**

```python
# research/state.py
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class ResearchState(TypedDict):
    question: str               # 原始研究问题
    sub_queries: list[str]      # 规划出的子查询
    raw_results: Annotated[list, lambda a, b: a + b]  # 并行结果累加
    deduped: list[dict]         # 去重后结果
    draft: str                  # 综合报告草稿
    approval: str               # approve/edit/reject
    final_report: str           # 定稿
```

```python
# research/nodes.py
from openai import OpenAI
import json
client = OpenAI()

def plan(state: ResearchState) -> dict:
    """规划：把研究问题分解为子查询"""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini", temperature=0,
        messages=[{"role": "user", "content":
            "把研究问题分解为 3 个子查询（不同角度）。"
            '只输出 JSON 对象，格式：{"queries":["...","...","..."]}。\n'
            f"问题：{state['question']}"}],
        response_format={"type": "json_object"})  # json_object 要求顶层是对象，不能是裸数组
    subs = json.loads(resp.choices[0].message.content)["queries"]
    return {"sub_queries": subs}

def make_search_node(source: str):
    """工厂：为每个来源生成一个并行搜索节点"""
    def search(state: ResearchState) -> dict:
        # 简化：实际调搜索 API（web/arxiv/news）
        results = search_api(state["sub_queries"], source)
        return {"raw_results": [{**r, "source": source} for r in results]}
    return search

def dedup(state: ResearchState) -> dict:
    """去重：按内容相似度合并"""
    seen, deduped = set(), []
    for r in state["raw_results"]:
        key = r["title"][:50]
        if key not in seen:
            seen.add(key); deduped.append(r)
    return {"deduped": deduped}

def synthesize(state: ResearchState) -> dict:
    """综合：基于去重结果产出草稿"""
    context = "\n\n".join(f"[{r['source']}] {r['title']}\n{r['snippet']}" for r in state["deduped"])
    resp = client.chat.completions.create(
        model="gpt-4.1-mini", temperature=0,
        messages=[{"role": "system", "content": "基于资料写研究报告，标注来源。"},
                  {"role": "user", "content": f"问题：{state['question']}\n\n资料：\n{context}"}])
    return {"draft": resp.choices[0].message.content}
```

**Step 2：HITL 审阅节点（L10-03）**

```python
# research/hitl.py
from langgraph.types import interrupt, Command
from langgraph.graph import END

def review(state: ResearchState):
    """人工审阅：暂停等批准/编辑/拒绝"""
    decision = interrupt({
        "type": "report_review",
        "draft": state["draft"],
        "prompt": "审阅研究报告草稿：approve / edit(给修改意见) / reject",
    })
    return {
        "approval": decision["action"],
        "draft": decision.get("draft", state["draft"]),  # edit 时可能改稿
    }

def finalize(state: ResearchState) -> dict:
    """定稿：approve 时格式化输出"""
    return {"final_report": f"# 研究报告\n\n{state['draft']}"}

def route_after_review(state: ResearchState) -> str:
    a = state["approval"]
    if a == "approve":
        return "finalize"
    if a == "edit":
        # 人已改 draft（review 里写回），直接定稿；勿回 synthesize，否则 LLM 会覆盖人工修改
        return "finalize"
    return END                                # reject 直接结束
```

**Step 3：画图 + checkpointer（L10-02）**

```python
# research/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from .state import ResearchState
from .nodes import plan, make_search_node, dedup, synthesize
from .hitl import review, finalize, route_after_review

def build_graph(checkpointer):
    g = StateGraph(ResearchState)
    g.add_node("plan", plan)
    # 并行搜索：3 个来源节点
    g.add_node("search_web", make_search_node("web"))
    g.add_node("search_arxiv", make_search_node("arxiv"))
    g.add_node("search_news", make_search_node("news"))
    g.add_node("dedup", dedup)
    g.add_node("synthesize", synthesize)
    g.add_node("review", review)
    g.add_node("finalize", finalize)

    # 控制流
    g.add_edge(START, "plan")
    # 扇出：plan 并行到 3 个搜索
    g.add_edge("plan", "search_web")
    g.add_edge("plan", "search_arxiv")
    g.add_edge("plan", "search_news")
    # 汇聚：3 个搜索到 dedup
    g.add_edge("search_web", "dedup")
    g.add_edge("search_arxiv", "dedup")
    g.add_edge("search_news", "dedup")
    g.add_edge("dedup", "synthesize")
    g.add_edge("synthesize", "review")
    g.add_conditional_edges("review", route_after_review,
        {"finalize": "finalize", END: END})
    g.add_edge("finalize", END)

    return g.compile(checkpointer=checkpointer)

# SqliteSaver 是上下文管理器：进程生命周期内保持 with，或自行管理连接
# with SqliteSaver.from_conn_string("research.db") as checkpointer:
#     graph_app = build_graph(checkpointer)
```

**Step 4：SSE 流式端点（L10-05）**

```python
# research/service.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from langgraph.checkpoint.sqlite import SqliteSaver
from .graph import build_graph
import json

api = FastAPI()  # 勿命名为 app：下面 graph_app 才是 LangGraph 编译结果

# 生产里用 lifespan 打开/关闭 checkpointer；此处示意模块级持有
_checkpointer_cm = SqliteSaver.from_conn_string("research.db")
checkpointer = _checkpointer_cm.__enter__()
graph_app = build_graph(checkpointer)

@api.get("/research")
def research_endpoint(q: str, thread_id: str):
    """流式研究：先跑到 review 暂停，等前端 resume"""
    def event_stream():
        config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 30}
        # 第一次流：跑到 review interrupt
        for ev in graph_app.stream({"question": q}, config=config, stream_mode="updates"):
            for node, update in ev.items():
                if node == "__interrupt__":
                    continue
                yield f"data: {json.dumps({'type':'step','node':node}, ensure_ascii=False)}\n\n"
                # synthesize 产出的 draft 可一并推（完整 token 流见进阶：stream_mode=messages）
                if isinstance(update, dict) and update.get("draft"):
                    yield f"data: {json.dumps({'type':'token','content': update['draft']}, ensure_ascii=False)}\n\n"
        # 暂停在 review，告知前端待审
        draft = graph_app.get_state(config).values.get("draft", "")
        yield f"data: {json.dumps({'type':'await_review','draft': draft}, ensure_ascii=False)}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@api.post("/research/resume")
def resume(thread_id: str, action: str, edit: str = None):
    """前端审完后续跑（必须 POST；GET 不适合带决策体）"""
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 30}
    def event_stream():
        decision = {"action": action}
        if edit:
            decision["draft"] = edit
        for ev in graph_app.stream(Command(resume=decision), config=config, stream_mode="updates"):
            for node, update in ev.items():
                yield f"data: {json.dumps({'type':'step','node':node}, ensure_ascii=False)}\n\n"
                if isinstance(update, dict) and update.get("final_report"):
                    yield f"data: {json.dumps({'type':'token','content': update['final_report']}, ensure_ascii=False)}\n\n"
        final = graph_app.get_state(config).values.get("final_report", "")
        yield f"data: {json.dumps({'type':'done','report': final}, ensure_ascii=False)}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

**Step 5：前端可视化（React + SSE）**

```jsx
// frontend/ResearchAgent.jsx
import { useState, useRef } from "react"

export function ResearchAgent() {
  const [steps, setSteps] = useState([])
  const [draft, setDraft] = useState("")
  const [report, setReport] = useState("")
  const [awaiting, setAwaiting] = useState(false)
  const esRef = useRef(null)
  const threadId = useRef(crypto.randomUUID())

  function run(q) {
    setSteps([]); setDraft(""); setReport(""); setAwaiting(false)
    const es = new EventSource(`/research?q=${encodeURIComponent(q)}&thread_id=${threadId.current}`)
    esRef.current = es
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      if (ev.type === "step") setSteps(s => [...s, `节点: ${ev.node}`])
      else if (ev.type === "await_review") { setDraft(ev.draft); setAwaiting(true); es.close() }
    }
  }

  function resume(action) {
    setAwaiting(false)
    fetch(`/research/resume?thread_id=${threadId.current}&action=${action}` +
      (action === "edit" ? `&edit=${encodeURIComponent(draft)}` : ""),
      { method: "POST" })
      .then(r => r.body.getReader())
      // 简化：实际解析 SSE 流
  }

  return (
    <div>
      <button onClick={() => run("LangGraph vs CrewAI 选型")}>开始研究</button>
      <div>步骤：{steps.map((s,i)=><div key={i}>{s}</div>)}</div>
      {awaiting && (
        <div>
          <h3>待审核草稿：</h3><textarea value={draft} onChange={e=>setDraft(e.target.value)} />
          <button onClick={()=>resume("approve")}>批准</button>
          <button onClick={()=>resume("edit")}>改后批准</button>
          <button onClick={()=>resume("reject")}>拒绝</button>
        </div>
      )}
      <div>报告：{report}</div>
    </div>
  )
}
```

**Step 6：测试（HITL + 并行 + 重放）**

```python
# tests/test_research.py
import pytest
from langgraph.checkpoint.memory import InMemorySaver
from research.graph import build_graph

class TestResearchAgent:
    def setup_method(self):
        self.app = build_graph(InMemorySaver())  # 测试用内存 checkpointer
        self.config = {"configurable": {"thread_id": "test_1"}, "recursion_limit": 30}

    def test_runs_until_review_interrupt(self):
        result = self.app.invoke({"question": "测试问题"}, config=self.config)
        # 应停在 review；result["__interrupt__"] 有待审 payload
        assert result.get("__interrupt__")
        state = self.app.get_state(self.config)
        assert state.values.get("draft")  # 草稿已生成

    def test_parallel_search_merges(self):
        """并行搜索结果汇聚到 dedup"""
        self.app.invoke({"question": "测试"}, config=self.config)
        state = self.app.get_state(self.config)
        # raw_results 来自 3 个搜索节点（reducer 累加）
        assert len(state.values.get("raw_results", [])) > 0  # 并行搜索应有结果汇聚

    def test_hitl_resume_approve(self):
        """审阅 approve 后到 finalize"""
        self.app.invoke({"question": "测试"}, config=self.config)
        from langgraph.types import Command
        result = self.app.invoke(Command(resume={"action": "approve"}), config=self.config)
        state = self.app.get_state(self.config)
        assert state.values.get("final_report")  # 已定稿

    def test_hitl_resume_edit_keeps_draft(self):
        """审阅 edit 后保留人工改稿并定稿（不回 synthesize 覆盖）"""
        self.app.invoke({"question": "测试"}, config=self.config)
        from langgraph.types import Command
        self.app.invoke(Command(resume={"action": "edit", "draft": "改后的草稿"}), config=self.config)
        state = self.app.get_state(self.config)
        assert "改后的草稿" in state.values.get("final_report", "")

    def test_state_history_replay(self):
        """状态历史可重放"""
        self.app.invoke({"question": "测试"}, config=self.config)
        history = list(self.app.get_state_history(self.config))
        assert len(history) > 0   # 有多个 checkpoint
```

### 进阶挑战

1. **CrewAI 版本**：用 CrewAI 的多角色（研究员/编辑/审阅者）重写同样流程，对比与 LangGraph 的取舍（L10-04）
2. **真实搜索集成**：接入 Tavily/Serper API 做真实 web 搜索，arxiv 接学术 API
3. **token 流**：synthesize 节点用 stream，把报告逐字推前端（L10-05 的 messages 模式）
4. **细粒度 HITL**：不只审最终稿，搜索结果质量差时也暂停让人审（L10-03 思路）
5. **重放调试 UI**：把 get_state_history 做成可视化，点任意 checkpoint 回放当时 state
6. **并发限制**：并行搜索太多会触发 API 限流，加信号量限并发（M7 限流思维）

### 要点回顾

- 深度研究 Agent = LangGraph 编排 + 并行搜索 + HITL 审阅 + 持久化 + 流式前端
- 控制流：plan 扇出→并行 search 汇聚→dedup→synthesize→review(interrupt)→finalize（approve/edit 均定稿）
- 并行用扇出+汇聚，reducer 累加多节点结果（L10-02）；去重在汇聚后
- HITL 用 interrupt 暂停在 review，前端审完 POST resume，Command(resume=...) 续跑；edit 保留人工稿，勿回 synthesize 覆盖
- 状态持久化靠 checkpointer：失败/中断从断点恢复，get_state_history 可重放调试
- 流式：SSE 推 step + token，X-Accel-Buffering:no 防网关缓冲
- 前端三态：跑（看步骤）→ 待审（看草稿+批准按钮）→ 完成（看报告）
- 测试覆盖：interrupt 暂停、并行汇聚、HITL resume 的 approve/edit 分支、历史重放
- 反模式对照（L10-06）：节点保持纯函数、recursion_limit 显式、别过度抽象

### 下一步

完成 P10 后，你能用框架驾驭复杂控制流的单/多 Agent。M11「多智能体系统」更进一步——探讨 Agent 团队的拓扑、协作、监督与辩论，并直面多 Agent 的协调成本与失败模式。
