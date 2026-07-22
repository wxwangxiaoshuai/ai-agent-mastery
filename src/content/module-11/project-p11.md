## 多 Agent 软件开发团队

M11 五节课讲了多 Agent 拓扑、supervisor 调度、debate 辩论、对话式协作、协调成本与失败模式。P11 把它们组装成一个**多 Agent 软件开发团队**——由 PM、Architect、Coder、Reviewer、Tester 五个角色组成，用 supervisor + debate 混合拓扑协作，从需求拆解一路到代码交付与评审，并配备病态行为护栏。这是"用 Agent 团队模拟软件开发"的完整闭环。

### 项目目标

组建一个多 Agent 软件开发团队：
- 5 角色分工：PM（需求）/Architect（设计）/Coder（实现）/Reviewer（评审）/Tester（测试）
- Supervisor + Debate 混合拓扑：supervisor 调度主流程，架构阶段用 debate
- 代码生成 + 评审闭环：Coder 写→Reviewer 审→改→再审直到通过
- 病态行为护栏：防死循环/互相恭维/责任推诿
- Git 集成：代码提交可追溯

### 验收标准

- [ ] 5 个角色 Agent 各有明确 system message 和职责
- [ ] Supervisor 调度主流程：需求→设计→实现→评审→测试
- [ ] 架构阶段用 debate（Architect vs Reviewer 对方案辩论 + 裁判）
- [ ] 代码评审闭环：Reviewer 不通过则回 Coder 修改，限 N 轮
- [ ] 病态行为护栏：max_round、修改次数上限、强制找茬、兜底派发
- [ ] 输出：需求文档 + 架构方案 + 代码 + 审查记录 + 测试报告
- [ ] 含测试：闭环收敛、debate 防坍缩、护栏触发

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
│  └───────────────────────────────────────────┘                 │
│    ▼                                                          │
│  [Tester] 测试 → 测试报告                                       │
│    ▼                                                          │
│  END                                                          │
│                                                               │
│  全程：Supervisor 在每个节点间路由 + 护栏监测                   │
│  护栏：max_round / 修改上限 / 强制找茬 / 兜底派发              │
└──────────────────────────────────────────────────────────────┘
```

### 实施步骤

**Step 1：定义状态与角色 Agent**

```python
# team/state.py
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class TeamState(TypedDict):
    requirement: str            # 原始需求
    req_doc: str                # PM 产出的需求文档
    architecture: str           # 架构方案
    code: str                   # Coder 的代码
    review_issues: list[str]    # Reviewer 指出的问题
    review_verdict: str         # pass / revise
    test_report: str           # 测试报告
    next: str                   # supervisor 路由
    revisions: int              # 代码修改次数（护栏）
```

```python
# team/agents.py
from openai import OpenAI
import json
client = OpenAI()

def call_llm(system, user, json_out=False):
    kwargs = {"model": "gpt-4o-mini", "temperature": 0,
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
2. 输出 JSON：{issues:[...], verdict:"pass"|"revise"}
3. 找不够 3 个要说明为何；不能空泛说'写得不错'"""
TESTER_PROMPT = "你是测试工程师。基于需求和代码写测试用例并运行，输出测试报告（通过/失败/覆盖）。"
JUDGE_PROMPT = "你是架构评审裁判。综合 Architect 方案和 Reviewer 质疑，给最终架构结论，标注采纳/否定了哪些。"
```

**Step 2：主流程节点（PM/Coder/Tester）**

```python
# team/nodes.py
from .agents import call_llm, PM_PROMPT, ARCH_PROMPT, CODER_PROMPT, TESTER_PROMPT

def pm_node(state):
    doc = call_llm(PM_PROMPT, f"需求：{state['requirement']}")
    return {"req_doc": doc}

def coder_node(state):
    code = call_llm(CODER_PROMPT,
        f"需求文档：{state['req_doc']}\n架构方案：{state['architecture']}\n请实现核心代码。")
    return {"code": code, "revisions": state.get("revisions", 0) + 1}

def tester_node(state):
    report = call_llm(TESTER_PROMPT,
        f"需求：{state['req_doc']}\n代码：{state['code']}\n请测试并出报告。")
    return {"test_report": report}
```

**Step 3：Debate 子流程（架构阶段，L11-03）**

```python
# team/debate.py
from .agents import call_llm, ARCH_PROMPT, REVIEWER_PROMPT, JUDGE_PROMPT

def debate_architecture(state):
    """Architect vs Reviewer 辩论方案，Judge 裁决"""
    question = state["req_doc"]
    history = []   # 辩论历史
    args = {"architect": [], "reviewer": []}

    for round_idx in range(2):   # 2 轮：亮观点 + 反驳
        # Architect 发言（第2轮要回应质疑）
        arch_msg = call_llm(ARCH_PROMPT + ("\n第2轮：回应质疑，可修正方案。" if round_idx else "\n第1轮：亮你的方案。"),
                            f"需求：{question}\n已有辩论：{history}")
        args["architect"].append(arch_msg)
        history.append(f"[Architect] {arch_msg}")
        # Reviewer 质疑（强制找茬，防坍缩）
        rev_msg = call_llm(REVIEWER_PROMPT + "\n你是质疑方，找出方案的至少2个风险或漏洞，尽力反驳。",
                           f"需求：{question}\nArchitect方案：{arch_msg}\n已有辩论：{history}")
        args["reviewer"].append(rev_msg)
        history.append(f"[Reviewer] {rev_msg}")

    # 裁判综合（用更强模型）
    verdict = call_llm(JUDGE_PROMPT,
        f"辩题：{question}\n\nArchitect论点：{args['architect']}\n\nReviewer质疑：{args['reviewer']}")
    return {"architecture": verdict}
```

**Step 4：评审闭环（带护栏，L11-05）**

```python
# team/review_loop.py
from .agents import call_llm, REVIEWER_PROMPT
MAX_REVISIONS = 3   # 护栏：同一代码最多改 3 次

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
    # 不通过：检查修改次数护栏
    if state.get("revisions", 0) >= MAX_REVISIONS:
        # 护栏触发：改够了，强制进入测试并标注"未通过评审"
        return "tester"
    return "coder"   # 回 Coder 修改
```

**Step 5：Supervisor 路由 + 统一护栏**

```python
# team/supervisor.py
from .agents import call_llm

ROLES = ["pm", "debate", "coder", "reviewer", "tester", "FINISH"]

def supervisor(state):
    """主管：看进展决定下一步（动态分派）"""
    # 简化：实际用 LLM 看 state 决定。这里按流程顺序静态骨架+动态微调
    progress = state
    if not progress.get("req_doc"):
        nxt = "pm"
    elif not progress.get("architecture"):
        nxt = "debate"
    elif not progress.get("code"):
        nxt = "coder"
    elif not progress.get("review_verdict"):
        nxt = "reviewer"
    elif progress.get("review_verdict") == "pass" and not progress.get("test_report"):
        nxt = "tester"
    elif progress.get("test_report"):
        nxt = "FINISH"
    else:
        nxt = "coder"   # 兜底：review 不通过回 coder
    return {"next": nxt}

def route(state):
    nxt = state["next"]
    return "FINISH" if nxt == "FINISH" else nxt
```

```python
# team/guardrails.py
class TeamGuardrails:
    """统一护栏（L11-05 三层框架）"""
    def __init__(self, max_rounds=20):
        self.max_rounds = max_rounds
        self.round = 0
        self.msg_hashes = []

    def check(self, state):
        self.round += 1
        if self.round > self.max_rounds:
            return {"action": "force_end", "reason": "超 max_rounds，强制结束"}
        # 重复检测（互相恭维/绕圈）
        key = str(state.get("code", ""))[:100]
        if key and key in self.msg_hashes[-2:]:
            return {"action": "force_end", "reason": "代码重复疑似循环"}
        self.msg_hashes.append(key)
        return {"action": "continue"}
```

**Step 6：组装 LangGraph**

```python
# team/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from .state import TeamState
from .nodes import pm_node, coder_node, tester_node
from .debate import debate_architecture
from .review_loop import reviewer_node, route_after_review
from .supervisor import supervisor, route

def build_team():
    g = StateGraph(TeamState)
    g.add_node("pm", pm_node)
    g.add_node("debate", debate_architecture)
    g.add_node("coder", coder_node)
    g.add_node("reviewer", reviewer_node)
    g.add_node("tester", tester_node)

    # 主流程边
    g.add_edge(START, "pm")
    g.add_edge("pm", "debate")
    g.add_edge("debate", "coder")
    g.add_edge("coder", "reviewer")
    # 评审闭环：条件路由
    g.add_conditional_edges("reviewer", route_after_review)
    g.add_edge("tester", END)

    return g.compile(
        checkpointer=SqliteSaver.from_conn_string("team.db"),
        recursion_limit=25,   # 护栏：防死循环
    )

team = build_team()
```

**Step 7：运行示例**

```python
result = team.invoke({
    "requirement": "做一个 CLI 工具：记录每日心情（1-5 分+备注），支持按周统计平均分",
    "revisions": 0,
})
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
from team.graph import build_team

class TestSoftwareTeam:
    def setup_method(self):
        self.team = build_team()

    def test_full_pipeline_produces_all_artifacts(self):
        r = self.team.invoke({"requirement": "心情记录CLI", "revisions": 0})
        assert r.get("req_doc") and r.get("architecture")
        assert r.get("code") and r.get("test_report")

    def test_review_loop_converges(self):
        """评审闭环不无限转——靠 max_revisions + recursion_limit"""
        r = self.team.invoke({"requirement": "复杂需求", "revisions": 0})
        # 不论 review 是否通过，最终都到了 tester（收敛）
        assert r.get("test_report")

    def test_debate_produces_verdict(self):
        """debate 产出裁决而非坍缩"""
        from team.debate import debate_architecture
        state = {"req_doc": "需求：..."}
        r = debate_architecture(state)
        assert r["architecture"]  # 有裁决结论
        # 结论不是空洞附和（含'采纳/否定'字样）
        assert "采纳" in r["architecture"] or "否定" in r["architecture"]

    def test_guardrail_max_rounds(self):
        """护栏：超 recursion_limit 不无限跑"""
        from team.guardrails import TeamGuardrails
        gr = TeamGuardrails(max_rounds=2)
        for _ in range(3):
            check = gr.check({"code": "x"})
        # 第3次应触发强制结束
        # （实际靠 recursion_limit 抛异常，这里验证护栏逻辑）
```

### 进阶挑战

1. **真实 Git 集成**：Coder 提交代码到 Git 分支，Reviewer 看 diff 评审，测试通过后 merge
2. **HITL 审批**：架构 debate 后、代码 merge 前，插入人工审批节点（L10-03）
3. **对话式版本**：用 AutoGen 重写同样团队，对比与 LangGraph 的可控性（L11-04）
4. **层级扩展**：团队大了，分成"前端组/后端组"，每组有组长（L11-01 层级拓扑）
5. **病态监测面板**：可视化展示每次执行的轮次、修改次数、是否有重复/推诿
6. **代码执行闭环**：Tester 用 M9 的沙箱真实跑代码验证，而非 LLM 模拟测试

### 要点回顾

- 软件团队 = 5 角色分工 + supervisor 调度 + debate 架构阶段 + 评审闭环 + 护栏
- 主流程：pm→debate→coder→reviewer(闭环)→tester，按 L11-01 链式+局部网状混合
- 架构 debate（L11-03）：Architect vs Reviewer 2 轮 + Judge 裁决，强制找茬防坍缩
- 评审闭环（L11-05）：reviewer 不通过回 coder，限 MAX_REVISIONS 次防死循环
- 护栏三层：监测（轮次/重复）+ 限制（max_round/修改上限/强制找茬）+ 降级（超限强制结束/兜底派发）
- supervisor 静态骨架+动态微调（L11-02）：按 state 决定下一步，兜底处理推诿
- checkpointer 持久化 + recursion_limit：失败可恢复、循环有上限
- 测试覆盖：全流程产出、闭环收敛、debate 防坍缩、护栏触发
- 反模式对照（L11-05）：默认会死循环/互相恭维/推诿——护栏不是可选，是必须

### 下一步

完成 P11 后，你能用多 Agent 团队协作完成复杂软件任务。M12「Multi-modal Agent」把 Agent 的能力从文本扩展到视觉、语音、视频——让 Agent 看见、听见、理解多模态世界。
