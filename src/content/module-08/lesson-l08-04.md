## 程序记忆与技能库：让 Agent 记住"怎么做"

前两节记的都是"事实"——用户对什么过敏、用户在学什么。但 Agent 还需要记另一类东西：**怎么做某件事**。一个研究 Agent 调研过 50 次，每次都重新想"先搜再筛再综合"——那它没积累任何"经验"。程序记忆让 Agent 把成功流程沉淀成**可复用技能**，下次遇到相似任务直接调用，而不是从零规划。

### 事实记忆 vs 程序记忆

| 维度 | 事实/语义记忆（L08-03） | 程序记忆（本节） |
|------|------------------------|------------------|
| 记什么 | "是什么"（用户过敏原） | "怎么做"（调研的步骤） |
| 形态 | 原子事实 | 步骤序列 + 前置条件 |
| 检索依据 | 话题相关 | 任务意图匹配 |
| 来源 | 对话抽取 | 任务完成后的反思 |
| 复用方式 | 注入到上下文 | 作为可执行流程/工具链 |

**类比**：事实记忆像"知道巴黎是法国首都"，程序记忆像"会骑自行车"——后者是肌肉记忆式的操作流程，记住了就能直接做，不用每次重新学。

### 程序记忆的结构：不只是一串步骤

朴素的程序记忆就是存"步骤 1→2→3"，但那只是个脚本。真正的程序记忆要能**被复用、被适配、被评估**，结构得更完整：

```python
@dataclass
class Skill:
    """一条程序记忆/技能"""
    id: str                      # 技能 ID
    name: str                    # 技能名（如 "tech_research"）
    description: str             # 何时该用（供检索匹配）
    steps: list[dict]            # 步骤序列
    preconditions: list[str]     # 前置条件（什么场景才适用）
    tools: list[str]             # 依赖的工具
    success_criteria: str        # 怎么算成功（供评估）
    example_input: str           # 典型输入示例
    usage_count: int = 0         # 被复用次数
    success_rate: float = 1.0    # 历史成功率
    created_at: str = ""

# 示例：一个"技术调研"技能
research_skill = Skill(
    id="tech_research",
    name="技术调研",
    description="当用户要求调研/对比某项技术时使用。输入是技术名或问题，输出是结构化研究报告。",
    steps=[
        {"action": "search", "tool": "web_search", "params": "query=技术名+特性+对比"},
        {"action": "fetch", "tool": "fetch_page", "params": "抓取 top-3 结果全文"},
        {"action": "extract", "tool": "llm_extract", "params": "从页面抽取关键事实"},
        {"action": "synthesize", "tool": "llm_synthesize", "params": "综合成报告"},
    ],
    preconditions=["任务含'调研/对比/了解'等意图", "目标是一项技术而非具体代码问题"],
    tools=["web_search", "fetch_page", "llm_extract", "llm_synthesize"],
    success_criteria="输出含来源引用的结构化报告，覆盖定义/特性/对比/适用场景",
    example_input="调研 LangGraph 和 CrewAI 的区别",
)
```

**关键字段**：
- `description` + `example_input`：供检索时判断"这个技能适不适合当前任务"。
- `preconditions`：避免误用——任务不满足前置条件就不该调这个技能。
- `success_rate` + `usage_count`：技能也要被评估，长期低成功率的该淘汰（L08-05 遗忘）。

### 技能的抽取：从任务轨迹中沉淀

技能不是手写的，而是**从成功的任务执行中自动沉淀**。思路：Agent 完成一个任务后，反思"这段流程值得复用吗"，值得就抽象成技能存起来。

```python
REFLECT_PROMPT = """你刚完成一个任务。判断这段执行流程是否值得沉淀为可复用技能。

任务：{task}
执行轨迹：{trace}
结果：{result}

判断标准：
1. 这个流程是否可泛化（不是一次性的特定操作）
2. 步骤是否稳定（不是发散、试错的轨迹）
3. 是否可能再次遇到相似任务

如果值得沉淀，输出技能的 JSON（含 name/description/steps/preconditions/success_criteria）。
如果不值得（太特定/太发散/不会复用），返回 {{"save": false}}。

输出："""

from openai import OpenAI
client = OpenAI()

def maybe_learn_skill(task: str, trace: list, result: str) -> Skill | None:
    """任务完成后，尝试沉淀技能"""
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": REFLECT_PROMPT.format(
            task=task, trace=trace, result=result)}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    import json
    data = json.loads(resp.choices[0].message.content)
    if not data.get("save", True):
        return None
    fields = ["name", "description", "steps", "preconditions", "tools",
              "success_criteria", "example_input"]
    payload = {k: data[k] for k in fields if k in data}
    skill_id = data.get("id") or data.get("name", "skill")
    return Skill(id=skill_id, **payload)
```

**反思是关键**：不是所有任务都该沉淀。"帮我把这段代码格式化"是一次性操作，不值得存技能；"调研一项技术"是可泛化流程，值得。Agent 要学会区分——**沉淀过多垃圾技能会污染检索**（L08-05 遗忘机制处理）。

### 技能的检索：意图匹配

技能库大了，怎么找到合适的？和事实记忆不同——技能检索不是按"话题相似"，而是按**"任务意图匹配"**。

```python
class SkillLibrary:
    """程序记忆/技能库"""
    def __init__(self):
        self.skills: list[Skill] = []

    def add(self, skill: Skill):
        self.skills.append(skill)

    def retrieve(self, task: str, top_k: int = 3) -> list[Skill]:
        """按任务意图匹配技能"""
        scored = []
        for skill in self.skills:
            # 1. 检查前置条件（硬过滤）
            if not self._check_preconditions(task, skill):
                continue
            # 2. 计算意图相似度（description + example_input 与任务匹配）
            score = self._intent_similarity(task, skill)
            # 3. 加权历史成功率（好技能优先复用）
            score *= (0.7 + 0.3 * skill.success_rate)
            scored.append((score, skill))
        scored.sort(reverse=True, key=lambda x: x[0])
        return [s for _, s in scored[:top_k]]

    def _check_preconditions(self, task: str, skill: Skill) -> bool:
        """示意：生产可用关键词规则或小模型硬过滤；此处恒 True 仅演示流程"""
        return True

    def _intent_similarity(self, task: str, skill: Skill) -> float:
        """用 embedding 算任务与技能描述的意图相似度"""
        import numpy as np
        def emb(text): return client.embeddings.create(
            model="text-embedding-3-small", input=text).data[0].embedding
        v1, v2 = np.array(emb(task)), np.array(emb(skill.description))
        return float(v1 @ v2 / (np.linalg.norm(v1) * np.linalg.norm(v2)))
```

**检索三要素**：前置条件过滤（不该用的直接排除）→ 意图相似度（该用的排序）→ 历史成功率加权（好技能优先）。第三点让技能库**自我进化**——用得越多、成功率越准，排序越靠谱。

### 技能的复用：不是机械重放

检索到技能后，怎么用？**不是机械地按步骤重放**——任务总有差异，技能要被适配。两种复用模式：

```
模式1：技能作为"参考流程"（软复用）
  Agent 看到技能，作为"以前怎么做这类任务"的参考
  → 仍然自己重新规划，但借鉴技能的步骤思路
  → 灵活，但没省掉规划开销

模式2：技能作为"可执行脚本"（硬复用）
  技能直接变成一个组合工具，Agent 调用它一步完成
  → 省规划开销、执行稳定
  → 但适应性差，任务稍有不同就失效
```

**推荐软复用**：把技能描述和步骤注入 prompt，让 Agent "参考着做"，而非机械执行。这样既复用了经验，又保留了适应能力。

```python
def use_skill_as_reference(task: str, skill: Skill) -> str:
    """把技能作为参考流程注入 prompt（软复用）"""
    steps_str = "\n".join(f"  {i+1}. {s['action']}（用 {s['tool']}）"
                          for i, s in enumerate(skill.steps))
    return (
        f"你之前处理过相似任务，经验如下（参考但不照搬，按当前任务调整）：\n"
        f"技能：{skill.name}\n"
        f"适用场景：{skill.description}\n"
        f"参考步骤：\n{steps_str}\n"
        f"成功标准：{skill.success_criteria}\n\n"
        f"当前任务：{task}"
    )
```

### 技能库的演进

技能库不是静态的，要随使用演进：

```python
def record_skill_outcome(skill: Skill, success: bool):
    """记录技能使用结果，更新成功率"""
    skill.usage_count += 1
    # 滑动平均更新成功率
    alpha = 0.3
    skill.success_rate = (1 - alpha) * skill.success_rate + alpha * (1.0 if success else 0.0)
```

**淘汰机制**（L08-05 详谈）：成功率长期低于阈值、或长期不被检索的技能，该被遗忘。否则技能库膨胀，检索噪声变大，反而拖慢 Agent。

### 程序记忆在 Agent Loop 中的位置

技能库如何融入 M5 的 Agent Loop：

```
用户任务
   │
   ├─→ [技能库] retrieve(task) → 找到相似技能？
   │        ├─ 是 → 注入参考流程 → 减少规划开销
   │        └─ 否 → 走正常 ReAct 规划
   │
   ├─→ Agent Loop（感知-推理-行动）
   │
   └─→ 任务完成 → maybe_learn_skill() → 沉淀新技能
```

**与 M5 ReAct 的关系**：程序记忆不是替代 ReAct，而是**给 ReAct 提供先验**。有技能参考时，Agent 不必从零探索，规划更快更稳；没技能时退回标准 ReAct。这是 Agent 从"新手"变"老手"的机制。

### 动手 5 分钟

从一次成功任务里手工沉淀出一条技能，再复用它。

1. 完整记录一次成功任务的轨迹（步骤、工具、参数、判断依据）。
2. 抽象成技能：写清适用条件、步骤模板、参数占位、失败信号。
3. 换一个同类但细节不同的任务，让 Agent 检索到这条技能并适配执行。

**验收标准**：复用时 Agent 做了适配而不是机械重放（比如换了搜索关键词），且步骤数明显少于第一次从零规划。

### 要点总结

- 程序记忆记的是"怎么做"——步骤序列+前置条件，区别于记"是什么"的事实记忆
- 技能结构不只步骤，还要 description（供检索）、preconditions（防误用）、success_rate（供评估淘汰）
- 技能靠"任务后反思"自动沉淀——判断是否可泛化、步骤是否稳定、是否会复用，避免存垃圾技能
- 检索三要素：前置条件过滤 → 意图相似度排序 → 历史成功率加权（让技能库自我进化）
- 复用推荐"软复用"——技能作为参考流程注入，而非机械重放，保留适应能力
- 技能库要演进：记录成功率淘汰低质技能，否则库膨胀、检索噪声变大
- 程序记忆给 ReAct 提供先验——有技能参考时规划更快更稳，这是 Agent 从"新手"变"老手"的机制
- 下一节 L08-05 讲所有记忆（事实+程序）都要面对的难题：冲突与遗忘
