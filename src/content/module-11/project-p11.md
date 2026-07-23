## 多 Agent 软件开发团队

M11 五节课讲了多 Agent 拓扑、supervisor 调度、debate 辩论、对话式协作、协调成本与失败模式。P11 把它们组装成一个**多 Agent 软件开发团队**——由 PM、Architect、Coder、Reviewer、Tester 五个角色组成，用**固定主流程 + 架构 debate + 评审闭环**协作，从需求拆解一路到代码交付与评审，并配备病态行为护栏。这是"用 Agent 团队模拟软件开发"的完整闭环。

### 项目目标

组建一个多 Agent 软件开发团队：
- 5 角色分工：PM（需求）/Architect（设计）/Coder（实现）/Reviewer（评审）/Tester（测试）
- 混合拓扑：主流程链式（L11-01），架构阶段局部网状 debate（L11-03），评审局部闭环
- 代码生成 + 评审闭环：Coder 写→Reviewer 审→改→再审直到通过（限 N 轮）
- 病态行为护栏：防死循环/互相恭维/责任推诿（L11-05）
- （进阶）Git 集成：代码提交可追溯

### 验收标准

- [ ] 5 个角色 Agent 各有明确 system message 和职责
- [ ] 主流程固定：需求→架构 debate→实现→评审闭环→测试
- [ ] 架构阶段用 debate（Architect vs Reviewer 对方案辩论 + 裁判）
- [ ] 代码评审闭环：Reviewer 不通过则回 Coder 修改，限 N 轮；超限强制进测试并标注
- [ ] 病态行为护栏：recursion_limit、修改次数上限、强制找茬、TeamGuardrails
- [ ] 输出：需求文档 + 架构方案 + 代码 + 审查记录 + 测试报告
- [ ] 含测试：闭环收敛、debate 防坍缩、护栏触发
- [ ] （进阶可选）动态 Supervisor 调度：对照 L11-02 把固定边换成路由节点

### 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│            多 Agent 软件开发团队 (LangGraph)                  │
│                                                               │
│  START                                                        │
│    ▼                                                          │
│  [PM] 需求拆解 → 需求文档                                      │
│    ▼                                                          │
│  ┌─ debate 子流程 ──────────────────────────┐                 │
│  │ Architect 提方案 ↔ Reviewer 质疑 (2-3轮)  │                 │
│  │      ↓                                    │                 │
│  │ Judge 裁决 → 架构方案                      │                 │
│  └───────────────────────────────────────────┘                 │
│    ▼                                                          │
│  [Coder] 按方案实现代码                                        │
│    ▼                                                          │
│  ┌─ 评审闭环 (限 N 轮) ──────────────────────┐                 │
│  │ Reviewer 审 ──不通过──→ Coder 改 ──→ Reviewer 审 │           │
│  │              └──通过──→ 退出                 │               │
│  │              └──超限──→ 强制进测试（标注）   │               │
│  └───────────────────────────────────────────┘                 │
│    ▼                                                          │
│  [Tester] 测试 → 测试报告                                       │
│    ▼                                                          │
│  END                                                          │
│                                                               │
│  拓扑：链式主流程 + 局部 debate/评审闭环（非全程动态 supervisor）│
│  护栏：max_round / 修改上限 / 强制找茬 / TeamGuardrails         │
└──────────────────────────────────────────────────────────────┘
```

> 为何不用全程 Supervisor？P11 主路径是**可预测流水线**，固定边更清晰、更好测；动态分派见 L11-02，本项目进阶挑战再接。

### 实施步骤

**Step 1：定义状态与角色 Agent**

```python
# team/state.py
from typing import TypedDict

class TeamState(TypedDict):
    requirement: str            # 原始需求
    req_doc: str                # PM 产出的需求文档
    architecture: str           # 架构方案
    code: str                   # Coder 的代码
    review_issues: list[str]    # Reviewer 指出的问题
    review_verdict: str         # pass / revise / forced_ship
    test_report: str            # 测试报告
    revisions: int              # 因评审打回而修改的次数（护栏）
```

```python
# team/agents.py
from openai import OpenAI
import json
client = OpenAI()

def call_llm(system, user, json_out=False, model="gpt-4o-mini"):
    kwargs = {"model": model, "temperature": 0,
              "messages": [{"role": "system", "content": system},
                            {"role": "user", "content": user}]}
    if json_out: kwargs["response_format"] = {"type": "json_object"}
    r = client.chat.completions.create(**kwargs)
    return json.loads(r.choices[0].message.content) if json_out else r.choices[0].message.content

# —— 5 个角色的 system message ——
PM_PROMPT = "你是产品经理。把模糊需求拆成清晰功能点，输出需求文档（含验收标准）。简洁，不发散。"
ARCH_PROMPT = "你是架构师。基于需求设计技术方案，输出架构、接口、技术选型理由。要具体可落地。"
CODER_PROMPT = "你是程序员。按架构方案实现核心代码。只写必要代码+简要注释，不啰嗦。"
REVIEWER_PROMPT = """你是代码审查员。职责：
1. 找出至少 3 个具体问题（bug/性能/安全/可维护性），给位置和修改建议
2. 输出 JSON：{"issues":[...], "verdict":"pass"|"revise"}
3. 找不够 3 个要说明为何；不能空泛说'写得不错'"""
ARCH_REVIEWER_PROMPT = """你是架构质疑方（非代码审查）。职责：
找出方案至少 2 个风险或漏洞（可扩展性/复杂度/安全/落地成本），具体反驳，禁止空泛附和。"""
TESTER_PROMPT = "你是测试工程师。基于需求和代码写测试用例并运行，输出测试报告（通过/失败/覆盖）。"
JUDGE_PROMPT = "你是架构评审裁判。综合 Architect 方案和 Reviewer 质疑，给最终架构结论，标注采纳/否定了哪些。"
```

**Step 2：主流程节点（PM/Coder/Tester）**

```python
# team/nodes.py
from .agents import call_llm, PM_PROMPT, CODER_PROMPT, TESTER_PROMPT

def pm_node(state):
    doc = call_llm(PM_PROMPT, f"需求：{state['requirement']}")
    return {"req_doc": doc}

def coder_node(state):
    """首次实现或按评审意见修改；仅在 revise 打回时累加 revisions"""
    issues = state.get("review_issues") or []
    user = (f"需求文档：{state['req_doc']}\n架构方案：{state['architecture']}\n请实现核心代码。")
    if state.get("review_verdict") == "revise" and issues:
        user += f"\n请按审查意见修改：{issues}"
    code = call_llm(CODER_PROMPT, user)
    rev = state.get("revisions", 0)
    if state.get("review_verdict") == "revise":
        rev += 1
    # 清空 verdict，迫使下一跳再进 reviewer（避免带着旧 revise 死循环）
    return {"code": code, "revisions": rev, "review_verdict": ""}

def tester_node(state):
    note = ""
    if state.get("review_verdict") == "forced_ship":
        note = "\n注意：代码未通过评审，因修改次数达上限强制交付，请在报告中标注风险。"
    report = call_llm(TESTER_PROMPT,
        f"需求：{state['req_doc']}\n代码：{state['code']}{note}\n请测试并出报告。")
    return {"test_report": report}
```

**Step 3：Debate 子流程（架构阶段，L11-03）**

```python
# team/debate.py
from .agents import call_llm, ARCH_PROMPT, ARCH_REVIEWER_PROMPT, JUDGE_PROMPT

def debate_architecture(state):
    """Architect vs Reviewer 辩论方案，Judge 裁决"""
    question = state["req_doc"]
    history = []   # 辩论历史（带说话人标签的字符串）
    args = {"architect": [], "reviewer": []}

    for round_idx in range(2):   # 2 轮：亮观点 + 反驳
        arch_msg = call_llm(ARCH_PROMPT + ("\n第2轮：回应质疑，可修正方案。" if round_idx else "\n第1轮：亮你的方案。"),
                            f"需求：{question}\n已有辩论：{history}")
        args["architect"].append(arch_msg)
        history.append(f"[Architect] {arch_msg}")
        rev_msg = call_llm(ARCH_REVIEWER_PROMPT + "\n尽力反驳，禁止附和。",
                           f"需求：{question}\nArchitect方案：{arch_msg}\n已有辩论：{history}")
        args["reviewer"].append(rev_msg)
        history.append(f"[Reviewer] {rev_msg}")

    # 裁判综合（用更强模型，呼应 L11-03）
    verdict = call_llm(JUDGE_PROMPT,
        f"辩题：{question}\n\nArchitect论点：{args['architect']}\n\nReviewer质疑：{args['reviewer']}",
        model="gpt-4o")
    return {"architecture": verdict}
```

**Step 4：评审闭环（带护栏，L11-05）**

```python
# team/review_loop.py
from .agents import call_llm, REVIEWER_PROMPT
MAX_REVISIONS = 3   # 护栏：因评审打回最多改 3 次

def reviewer_node(state):
    """审查代码，强制找茬"""
    result = call_llm(REVIEWER_PROMPT,
        f"需求：{state['req_doc']}\n代码：{state['code']}", json_out=True)
    return {"review_issues": result.get("issues", []),
            "review_verdict": result.get("verdict", "revise")}

def route_after_review(state):
    """审查后路由：通过则去测试，否则回 Coder 改（限次数）"""
    if state["review_verdict"] == "pass":
        return "tester"
    if state.get("revisions", 0) >= MAX_REVISIONS:
        return "force_ship"   # 改够了：先标 forced_ship 再进测试
    return "coder"
```

```python
# team/nodes.py（续）
def force_ship_node(state):
    """护栏：超修改上限，标注后强制交付测试"""
    return {"review_verdict": "forced_ship"}
```

**Step 5：统一护栏**

```python
# team/guardrails.py
class TeamGuardrails:
    """统一护栏（L11-05 三层框架）——在 invoke 包装层每步检查"""
    def __init__(self, max_rounds=20):
        self.max_rounds = max_rounds
        self.round = 0
        self.msg_hashes = []

    def check(self, state):
        self.round += 1
        if self.round > self.max_rounds:
            return {"action": "force_end", "reason": "超 max_rounds，强制结束"}
        key = str(state.get("code", ""))[:100]
        if key and key in self.msg_hashes[-2:]:
            return {"action": "force_end", "reason": "代码重复疑似循环"}
        if key:
            self.msg_hashes.append(key)
        return {"action": "continue"}
```

**Step 6：组装 LangGraph**

```python
# team/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.memory import InMemorySaver
from .state import TeamState
from .nodes import pm_node, coder_node, tester_node, force_ship_node
from .debate import debate_architecture
from .review_loop import reviewer_node, route_after_review

def build_team(checkpointer=None):
    g = StateGraph(TeamState)
    g.add_node("pm", pm_node)
    g.add_node("debate", debate_architecture)
    g.add_node("coder", coder_node)
    g.add_node("reviewer", reviewer_node)
    g.add_node("force_ship", force_ship_node)
    g.add_node("tester", tester_node)

    # 固定主流程边（链式 + 局部闭环）
    g.add_edge(START, "pm")
    g.add_edge("pm", "debate")
    g.add_edge("debate", "coder")
    g.add_edge("coder", "reviewer")
    g.add_conditional_edges("reviewer", route_after_review,
        {"tester": "tester", "coder": "coder", "force_ship": "force_ship"})
    g.add_edge("force_ship", "tester")
    g.add_edge("tester", END)

    return g.compile(checkpointer=checkpointer or InMemorySaver())

# 生产持久化：SqliteSaver.from_conn_string 是上下文管理器
# with SqliteSaver.from_conn_string("team.db") as checkpointer:
#     team = build_team(checkpointer)
```

**Step 7：运行示例（含护栏包装）**

```python
from team.graph import build_team
from team.guardrails import TeamGuardrails

team = build_team()
config = {"configurable": {"thread_id": "cli_mood_1"}, "recursion_limit": 25}
gr = TeamGuardrails(max_rounds=20)

# 逐步跑可用 stream；此处示意 invoke 前后检查
inputs = {
    "requirement": "做一个 CLI 工具：记录每日心情（1-5 分+备注），支持按周统计平均分",
    "revisions": 0,
}
# 护栏可挂在自定义节点包装或 stream 循环里；测试见 Step 8
result = team.invoke(inputs, config=config)
print("需求文档：", result["req_doc"])
print("架构方案：", result["architecture"])
print("代码：", result["code"])
print("审查结论：", result["review_verdict"])
print("测试报告：", result["test_report"])
```

**Step 8：测试（护栏 + 闭环 + debate）**

```python
# tests/test_team.py
import pytest
from langgraph.checkpoint.memory import InMemorySaver
from team.graph import build_team
from team.guardrails import TeamGuardrails

class TestSoftwareTeam:
    def setup_method(self):
        self.team = build_team(InMemorySaver())
        self.config = {"configurable": {"thread_id": "test_1"}, "recursion_limit": 25}

    def test_full_pipeline_produces_all_artifacts(self):
        r = self.team.invoke({"requirement": "心情记录CLI", "revisions": 0}, config=self.config)
        assert r.get("req_doc") and r.get("architecture")
        assert r.get("code") and r.get("test_report")

    def test_review_loop_converges(self):
        """评审闭环不无限转——靠 MAX_REVISIONS + recursion_limit"""
        r = self.team.invoke({"requirement": "复杂需求", "revisions": 0}, config=self.config)
        assert r.get("test_report")  # 不论是否通过评审，最终到 tester

    def test_debate_produces_verdict(self):
        """debate 产出裁决而非坍缩"""
        from team.debate import debate_architecture
        r = debate_architecture({"req_doc": "需求：..."})
        assert r["architecture"]
        assert "采纳" in r["architecture"] or "否定" in r["architecture"]

    def test_guardrail_max_rounds(self):
        """护栏：超 max_rounds 强制结束"""
        gr = TeamGuardrails(max_rounds=2)
        assert gr.check({"code": "a"})["action"] == "continue"
        assert gr.check({"code": "b"})["action"] == "continue"
        third = gr.check({"code": "c"})
        assert third["action"] == "force_end"
        assert "max_rounds" in third["reason"]
```

### 进阶挑战

1. **动态 Supervisor**：把固定边换成 L11-02 的 supervisor 路由节点（注意 revise 后清 verdict、FINISH→END）
2. **真实 Git 集成**：Coder 提交代码到 Git 分支，Reviewer 看 diff 评审，测试通过后 merge
3. **HITL 审批**：架构 debate 后、代码 merge 前，插入人工审批节点（L10-03）
4. **对话式版本**：用 AutoGen 重写同样团队，对比与 LangGraph 的可控性（L11-04）
5. **层级扩展**：团队大了，分成"前端组/后端组"，每组有组长（L11-01 层级拓扑）
6. **病态监测面板**：可视化展示每次执行的轮次、修改次数、是否有重复/推诿
7. **代码执行闭环**：Tester 用 M9 的沙箱真实跑代码验证，而非 LLM 模拟测试

### 要点回顾

- 软件团队 = 5 角色分工 + 链式主流程 + debate 架构阶段 + 评审闭环 + 护栏
- 主流程：pm→debate→coder→reviewer(闭环)→tester，按 L11-01 链式+局部网状混合
- 架构 debate（L11-03）：Architect vs Reviewer 2 轮 + 更强模型 Judge 裁决，强制找茬防坍缩
- 评审闭环（L11-05）：reviewer 不通过回 coder，限 MAX_REVISIONS；超限 force_ship 再测
- 护栏三层：监测（轮次/重复）+ 限制（recursion_limit/修改上限/强制找茬）+ 降级（超限强制交付）
- checkpointer 用上下文管理器打开；invoke 必带 thread_id；recursion_limit 放在 config
- 动态 supervisor 作进阶（L11-02），本项目先把固定流水线跑通、测稳
- 反模式对照（L11-05）：默认会死循环/互相恭维/推诿——护栏不是可选，是必须

### 下一步

完成 P11 后，你能用多 Agent 团队协作完成复杂软件任务。M12「Multi-modal Agent」把 Agent 的能力从文本扩展到视觉、语音、视频——让 Agent 看见、听见、理解多模态世界。
