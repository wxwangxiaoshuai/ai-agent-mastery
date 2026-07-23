## 多 Agent 的协调成本与失败模式

L11-01 到 L11-04 都在讲多 Agent 怎么协作更强大。这一节泼冷水——**Agent 越多越聪明？错，常常越多越笨**。多 Agent 系统有它特有的失败模式：死循环、互相恭维、责任推诿、群体坍缩。这些在单 Agent 里不存在，多 Agent 一上就冒出来。M11 收官这节系统梳理病态行为、护栏、和"边际收益递减"的量化认知。

### Agent 越多越聪明？边际收益递减

先建立最重要的工程直觉——**多 Agent 的收益不是线性的，是递减甚至变负的**：

```
收益随 Agent 数量变化（示意）：
收益
  │         ___________   ← 边际收益递减，逐渐平稳
  │       /
  │      /             \  ← 太多反而下降（协调成本>分工收益）
  │     /                \
  │    /
  │   /
  └──┼──┼──┼──┼──┼──┼──→ Agent 数
     1  2  3  4  7  10
     │  │  │
     最佳区间(2-4)
```

**为什么递减**：
- **分工收益递减**：第 2、3 个 Agent 把核心职责拆开后，再加的边际价值变小（一个团队不需要 5 个 PM）
- **协调成本上升**：每加一个 Agent，通信、对齐、决策的开销都在涨（L11-01 的 O(n²)）
- **失败概率累积**：Agent 多了，任一个出问题影响整体，系统脆弱性上升

**经验区间**：多数生产多 Agent 系统的最佳规模是 **2-4 个 Agent**。超过 5 个，要非常清楚"这第 5、6 个 Agent 带来的具体收益是什么"，否则它只会增加协调成本和失败面。

> 黄金法则：**先问"这个 Agent 能不能去掉"**。如果去掉它、职责合并给别的 Agent，系统仍能工作甚至更简单——那它就是多余的。多 Agent 的设计应该是"必要性的减法"，不是"看起来强的加法"。

### 病态行为一：死循环

多 Agent 最常见的故障——**A 和 B 互相来回，停不下来**：

```
死循环典型场景：
  Coder："代码写好了，你审"
  Reviewer："这有问题，改"
  Coder："改好了，再审"
  Reviewer："还有问题，改"
  Coder："改好了，再审"  ← 无限循环
  → Reviewer 永不满意，或 Coder 永不改对

  debate 死循环：
  正方：A 好
  反方：B 好
  正方：不，A 好
  反方：不，B 好  ← 永远对立，不收敛
```

**根因**：没有"收敛机制"——双方都有继续的理由，但没人能拍板结束。

**护栏**：
1. **硬上限**（必设）：max_round / recursion_limit，到就强制停（L11-04、L10-02）
2. **收敛信号**：明确"什么算完成"，如 Reviewer 说"通过"就结束，而非"再审"
3. **第三方裁决**：循环时引入裁判 Agent 拍板（debate 的 judge）
4. **改动次数限制**：同一内容只允许改 N 次，超了强制"接受现状或上报人工"

```python
# 收敛护栏：限制同一内容的修改轮次
class ConvergenceGuard:
    def __init__(self, max_revisions=3):
        self.revision_counts = {}   # artifact_id -> 次数
        self.max = max_revisions

    def can_revise(self, artifact_id):
        cnt = self.revision_counts.get(artifact_id, 0)
        if cnt >= self.max:
            return False   # 超限，不再改，强制接受或上报
        self.revision_counts[artifact_id] = cnt + 1
        return True
```

### 病态行为二：互相恭维 / 群体坍缩

L11-03 提过的群体思维坍缩，在多 Agent 里更严重——**互相说好话，谁都不批评**：

```
病态：
  Coder："这是我的代码"
  Reviewer："写得真好，很优雅！"
  Coder："谢谢你的认可！"
  Reviewer："我认为可以直接用了"
  → 代码没真正审，Reviewer 成了点赞机

根因：
  · LLM 讨好倾向，倾向认同和表扬
  · Agent 间无对立压力，自然滑向附和
  · 角色虽叫"Reviewer"但没强制的"找茬"职责
```

**护栏**：
1. **强制找茬 prompt**：Reviewer 的 system message 明确"你的职责是找出至少 N 个问题，没找到就重审"
2. **对抗性角色**：专门设"魔鬼代言人"，永远反对（L11-03）
3. **质量门槛**：Reviewer 必须输出结构化审查清单（而非泛泛"不错"），不达标打回

```python
# 强制找茬的 Reviewer
REVIEWER_PROMPT = """你是代码审查员。职责：
1. 找出至少 3 个潜在问题（bug/性能/安全/可维护性）
2. 每个问题给出具体位置和修改建议
3. 输出 JSON：{issues: [...], verdict: "pass"|"revise"}
4. 找不够 3 个问题，说明为何没有（不能空泛说"写得不错"）
"""
```

> 这是多 Agent 质量的关键——**默认 Agent 会互相表扬**，你要用 prompt 和结构化输出强行制造"批判压力"。否则多 Agent 退化成互相点赞的捧场会。

### 病态行为三：责任推诿

多个 Agent 分工后，容易出"这事不归我"：

```
病态：
  任务：处理一个边缘情况
  Coder："这是架构问题，该 Architect 定"
  Architect："这是实现细节，该 Coder 处理"
  → 来回推，没人做，任务卡死

根因：
  · 角色边界有模糊地带，谁都倾向"不归我"
  · 没有兜底机制（没人接管的就真没人管）
```

**护栏**：
1. **明确职责边界**：每个 Agent 的 system message 写清"你负责什么"，并标注**模糊地带归谁**
2. **兜底 supervisor**：没人认领的任务，supervisor 强制派给最相关者（L11-02）
3. **"默认执行"原则**：宁可多做也别推诿——角色 prompt 里"遇到边界任务，默认你来做并说明"

```python
# supervisor 兜底处理推诿
def supervisor_route(state):
    if state.get("unclaimed_task"):
        # 没人认领的任务，强制派给最相关角色
        return assign_to_most_relevant(state["unclaimed_task"])
    # 正常路由
    return llm_route(state["messages"], options=[...])
```

### 病态行为四：发散 / 无限讨论

对话式（L11-04）的特有病态——聊起来没完：

```
病态：
  PM："我们讨论下方案"
  Architect："我觉得可以用微服务..."
  Coder："微服务太重了吧..."
  Architect："那也可以用模块化单体..."
  Coder："其实单体也有问题..."
  → 讨论了一小时没结论

根因：没有收敛压力，讨论本身成了目的
```

**护栏**（L11-04 详谈过）：
1. **max_round 硬上限**（必设）
2. **结构化产出**：每轮必须产出明确物（决策/代码），不许泛泛讨论
3. **manager 引导收敛**：跑题时拉回，有结论时喊停
4. **时限**：给讨论一个时间预算，超了强制现有最佳方案

### 病态行为五：串行化 / 无并行

非病态但低效——本该并行的 Agent 被串行化了：

```
低效：
  supervisor 串行派：A做完→B做→C做
  三个本独立的子任务，串行跑 3 倍时间

根因：supervisor 没识别可并行性，或图定义成串行
```

**护栏**：
1. **识别独立子任务**：supervisor 拆任务时标注"可并行"
2. **用并行拓扑**：LangGraph 扇出（L10-02）、CrewAI 支持
3. **依赖图分析**：任务间无依赖的并行跑，有依赖的才串行

### 护栏的统一框架：监测 + 限制 + 降级

把所有病态应对凝练成一个三层护栏框架：

```
第一层：监测（detect）
  · 步数/轮次计数器（防死循环）
  · 重复内容检测（防互相恭维/绕圈）
  · 推诿/卡住检测（防责任推诿）
  · 时长监控（防发散）

第二层：限制（constrain）
  · max_round / recursion_limit（硬上限）
  · 修改次数上限
  · 角色职责边界明确
  · 强制对立 prompt（防坍缩）

第三层：降级（degrade）
  · 超限强制终止，输出当前最佳
  · 循环不止则上报人工（L10-03 HITL）
  · 退回单 Agent 或 supervisor 兜底
  · 记录失败模式供后续优化
```

```python
# 统一护栏中间件（简化示意）
class MultiAgentGuardrails:
    def __init__(self, max_rounds=6, max_revisions=3):
        self.max_rounds = max_rounds
        self.convergence = ConvergenceGuard(max_revisions)
        self.round = 0
        self.history_hashes = []

    def check(self, state):
        self.round += 1
        # 限制：轮次上限
        if self.round > self.max_rounds:
            return {"action": "force_end", "reason": "超 max_rounds"}
        # 监测：内容重复（互相恭维/绕圈）
        h = hash(str(state["messages"][-1:])[:100])
        if h in self.history_hashes[-3:]:
            return {"action": "force_end", "reason": "内容重复疑似循环"}
        self.history_hashes.append(h)
        # 限制：修改次数（ConvergenceGuard 按 artifact 计数）
        artifact_id = state.get("artifact_id", "default")
        if state.get("wants_revise") and not self.convergence.can_revise(artifact_id):
            return {"action": "force_end", "reason": "超修改次数上限"}
        return {"action": "continue"}
```

### 何时该退回单 Agent

最重要的一句话——**很多时候，单 Agent 比多 Agent 好**。多 Agent 的成本在某些场景根本不值：

```
该退回单 Agent 的信号：
  ✓ 任务简单，一个 Agent 能搞定 → 多了是累赘
  ✓ 任务高度耦合，无法真正分工 → 多 Agent 互相等待
  ✓ 多 Agent 反复出现病态，护栏都压不住 → 架构错了
  ✓ 协调成本（调试/通信）明显超过分工收益
  ✓ 没有明确的角色对立需求（不需审/不需辩）

坚持多 Agent 的信号：
  ✓ 有明确角色对立（写代码 vs 审代码，正方 vs 反方）
  ✓ 子任务可并行且独立
  ✓ 需要 debate 式多视角补盲
  ✓ 单 Agent 上下文压力太大需拆分
```

> 最清醒的认知：M5 手写的单 Agent Loop 是**可靠的默认选择**。多 Agent 是"当单 Agent 明显不够时"的升级，不是"显得更强"的装饰。能用单 Agent 解决的，别上多 Agent——更简单、更可控、更便宜。L10-06 的"何时退回手写"精神在这里延续为"何时退回单 Agent"。

### 要点总结

- 多 Agent 收益递减甚至变负：分工收益递减、协调成本上升、失败概率累积——最佳规模常是 2-4 个
- 黄金法则：先问"这个 Agent 能不能去掉"，多 Agent 是必要性的减法不是加法
- 病态一死循环：无收敛机制→A/B 来回停不下；护栏=硬上限+收敛信号+第三方裁决+修改次数限制
- 病态二互相恭维/群体坍缩：LLM 讨好→互相点赞；护栏=强制找茬 prompt+对抗角色+结构化审查清单
- 病态三责任推诿：边界模糊→都不认领；护栏=明确职责+模糊地带归属+supervisor 兜底
- 病态四发散：无收敛压力→聊没完；护栏=max_round+结构化产出+manager引导+时限
- 病态五串行化：本并行却串行；护栏=识别并行子任务+扇出+依赖图分析
- 统一护栏三层：监测（计数/重复/推诿/时长）+ 限制（上限/边界/对立prompt）+ 降级（终止/上报/退回兜底）
- 何时退回单 Agent：任务简单/高度耦合/病态压不住/协调成本超收益——单 Agent Loop 是可靠默认，多 Agent 是"单 Agent 明显不够"时才升级
- M11 收官：从单 Agent（M5）到多 Agent 团队，你已能构建协作系统；M12 进入多模态，扩展 Agent 的感官
