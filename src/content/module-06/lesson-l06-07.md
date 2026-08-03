## Agent Skills 系统：从 Function Calling 到技能注册

M6 前面六节课讲完了 Function Calling 和 MCP 协议——Agent 能调工具了，能连外部世界了。但学到这里你会发现一个问题：**你给 Agent 的工具是一堆平铺的 Function，Agent 要在几十个函数里选该调哪个**。这就像给一个员工一份 50 页的 API 手册然后说"去吧"——能跑，但笨拙。

这节讲一个更高层的抽象：**Skills 系统**。一个 Skill 不是单个工具，而是一个**可复用的 Agent 行为包**。

### 从 Function Calling 到 Skills：一个类比

```
Function Calling 视角：
  你给 Agent 50 个函数：search_web(), fetch_page(), summarize_text(),
  extract_entities(), translate(), format_output()...
  每次 Agent 要做一件事，它要从这 50 个函数里挑出正确的组合。

Skills 视角：
  你给 Agent 3 个 Skill：
  - research_skill：含 search_web + fetch_page + summarize_text
  - analysis_skill：含 extract_entities + classify_sentiment + find_patterns
  - publishing_skill：含 translate + format_output + send_to_cms
  
  Agent 要做"调研 X 技术"，它加载 research_skill，自动获得相关工具。
```

Function Calling 教 Agent **调工具**。Skills 教 Agent **调"能力包"**。

### Skill 的定义结构

一个 Skill 是一个完整的可复用单元，包含以下字段：

```python
from dataclasses import dataclass, field
from typing import Any

@dataclass
class Skill:
    id: str                          # 唯一标识，如 "research"
    name: str                        # 人类可读名称
    description: str                 # 一句话描述，给 Agent 做意图匹配用
    system_prompt: str               # 加载此 Skill 时注入的 System Prompt
    tools: list[str]                 # 此 Skill 可用的工具列表
    input_schema: dict[str, Any]     # 输入 JSON Schema
    output_schema: dict[str, Any]    # 输出 JSON Schema
    preconditions: list[str] = field(default_factory=list)
    # 前置条件：加载此 Skill 前需要满足什么？
    # 例如 research_skill 的前置条件可能是 ["internet_access"]
```

每条字段都是工程上的硬需求：

- **`system_prompt`**：告诉 Agent 在此 Skill 的上下文里应该扮演什么角色。例如 `research_skill` 的 system_prompt 是"你是一个研究助手，擅长搜索、阅读、总结信息。遇到不确定的内容要标注不确定性。"
- **`tools[]`**：限制此 Skill 能调用的工具。这是**权限最小化**——research_skill 不应该能调 delete_database()。
- **`input_schema` / `output_schema`**：明确的输入输出契约，让 Skills 可以像乐高一样组合。A Skill 的输出如果符合 B Skill 的输入 schema，就可以直接串联。
- **`preconditions`**：防止 Skill 在不具备条件时被加载。例如 media_skill 的前置条件是 GPU 可用。

### Skills 与 MCP 的层次关系

这是最容易混淆的一对概念。一句话说清楚：

- **MCP**：连接 Agent 与**外部**工具/数据源。MCP Server 是外部服务暴露的接口。
- **Skills**：封装 Agent 的**内部**能力。Skill 是 Agent 自身的"技能树"。

用建筑类比：

```
MCP  = 水电煤接口（外部基础设施的连接标准）
Skill = 房间功能定义（"厨房"内有哪些设备、能做什么、怎么用）

厨房 Skill 可能会用到 MCP 接入的燃气（gas_mcp_server），
但"厨房"这个概念本身是 Skill 层面的封装。
```

在代码层面：

```python
# MCP 层：连接外部世界
gas_mcp = MCPClient("gas_server")     # 获取燃气能力
water_mcp = MCPClient("water_server") # 获取供水能力

# Skill 层：封装内部能力
kitchen_skill = Skill(
    id="kitchen",
    name="厨房操作",
    system_prompt="你是厨房操作员，负责烹饪相关任务。",
    tools=["gas_mcp:cook", "water_mcp:wash", "internal:recipe_search"],
    # ↑ 工具可以来自 MCP 也可以来自内部
    preconditions=["gas_mcp:connected", "water_mcp:connected"],
)
```

### Skill 注册表（Registry）

Agent 启动时加载所有可用 Skills，运行时按意图匹配：

```python
class SkillRegistry:
    def __init__(self):
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill) -> None:
        self._skills[skill.id] = skill

    def find_by_intent(self, user_intent: str) -> list[Skill]:
        """用 LLM 做意图 → Skill 匹配。返回匹配度最高的 Skill 列表。"""
        # 实际实现：把 user_intent 和所有 Skill 的 description
        # 一起发给 nano 档模型做语义匹配
        pass  # 实际实现：用 LLM 做语义匹配（见上方注释）

    def get_tools_for_skill(self, skill_id: str) -> list[str]:
        """返回加载此 Skill 时应激活的工具列表。"""
        skill = self._skills[skill_id]
        return skill.tools
```

**关键设计决策**：意图匹配用 nano 档模型（gpt-4.1-mini / claude-haiku-4-5），不需要大模型。匹配一个 Skill 的 description 是"一句话就能说清"的窄任务，nano 档完全够用，且延迟和成本都极低（L01-04 的模型选型原则在这里落地）。

### Skills 与 Function Calling 的协作

Skills 不是替代 Function Calling，而是**建立在 Function Calling 之上的更高层抽象**：

```
用户输入："帮我研究一下 WebAssembly 的现状"
  ↓
Skill Registry → 意图匹配 → 匹配到 research_skill
  ↓
加载 research_skill 的 system_prompt + 工具列表
  ↓
Agent 在 research_skill 的上下文中使用 Function Calling
  → 调用 search_web() → 调用 fetch_page() → 调用 summarize_text()
  ↓
最终输出：结构化研究报告
```

Function Calling 仍然是底层机制——Agent 调用工具的方式没变。Skills 改变的是**Agent 能看到哪些工具**和**Agent 以什么角色去调用它们**。

### Skill 的生命周期

一个 Skill 在 Agent 运行时有四个阶段：

```
注册 → 匹配 → 激活 → 卸载

1. 注册：Agent 启动时，SkillRegistry 加载所有已定义 Skill
2. 匹配：用户输入到来，Registry 用 nano 模型做意图→Skill 匹配
3. 激活：匹配到的 Skill 的 system_prompt 注入上下文，工具列表激活
4. 卸载：任务完成或切换任务时，Skill 的 system_prompt 移除，工具列表回收
```

**激活和卸载是 Skills 系统的关键**。如果没有卸载，Agent 的上下文会越来越长（每个 Skill 的 system_prompt 都留在里面），工具列表会越来越臃肿，最终回到"50 个函数平铺"的状态。

```python
class SkillAwareAgent:
    """带 Skill 注册表的 Agent——运行时按意图加载/卸载 Skill。"""

    def __init__(self, registry: SkillRegistry, max_steps: int = 10):
        self.registry = registry
        self.max_steps = max_steps
        self.active_skill: Skill | None = None
        self.base_system_prompt = "你是一个通用的 AI 助手。"

    def run(self, user_input: str) -> str:
        # Phase 1: Skill 匹配
        candidates = self.registry.find_by_intent(user_input)
        if candidates:
            self.active_skill = candidates[0]
            system_prompt = self.active_skill.system_prompt
            active_tools = self.active_skill.tools
        else:
            self.active_skill = None
            system_prompt = self.base_system_prompt
            active_tools = list(TOOL_MAP.keys())

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]

        # Phase 2: Agent Loop（只暴露当前 Skill 的工具）
        for _ in range(self.max_steps):
            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=messages,
                tools=[t for t in TOOLS_SCHEMA if t["function"]["name"] in active_tools],
                temperature=0,
            )
            msg = response.choices[0].message
            if not msg.tool_calls:
                return msg.content
            messages.append(msg)
            for tc in msg.tool_calls:
                fn = TOOL_MAP[tc.function.name]
                result = fn(**json.loads(tc.function.arguments))
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(result),
                })

        return "达到最大步数限制。"

    def reset_skill(self):
        """任务完成后卸载 Skill，回收上下文和工具列表。"""
        self.active_skill = None
```

**关键设计点**：

- `active_tools` 在匹配到 Skill 后只包含该 Skill 的工具——不是全部 50 个函数。这是权限最小化在代码层面的落地。
- `reset_skill()` 在任务完成后清理——防止上下文膨胀和工具泄漏。
- 没有匹配到 Skill 时 fallback 到全部工具——保证在"不知道用什么 Skill"时 Agent 仍能工作。

### Skills 与 P6 项目的结合

P6 项目要求构建一个多工具 Agent。学完这节后，你应该在 P6 的基础上做一次 Skills 重构：

1. 把 P6 的四类工具（搜索、代码执行、数据库查询、文件操作）按"能力包"分组
2. 为每个组定义 Skill 结构（id、description、system_prompt、tools、schema）
3. 实现 SkillRegistry 和 SkillAwareAgent
4. 对比重构前后：Agent 在"研究类任务"和"数据分析类任务"上的工具选择准确率是否有提升

这个重构是 P6 进阶挑战的一部分——从"能调工具"到"聪明地调工具"。

### 动手 5 分钟

1. 列出你 P6 项目中的全部工具（搜索、代码执行、数据库查询、文件操作等），把它们按"能力包"分组——每个组就是一个 Skill 的雏形。
2. 为每个组写 `description`（一句话，Agent 用来做意图匹配）和 `system_prompt`（加载此 Skill 时 Agent 该扮演什么角色）。
3. 检查：有没有工具出现在了多个 Skill 里？如果有，这是合理复用还是设计问题？

**验收标准**：每个 Skill 的 description 能让一个没见过你项目的人准确判断"什么时候该用这个 Skill"。如果 description 模糊到"万能"，说明你的 Skill 划分还不够细。

### 要点总结

- **Skills 是比 Function Calling 更高层的抽象**——一个 Skill 是可复用的 Agent 行为包，包含 System Prompt、工具集、Schema、前置条件。Function Calling 教 Agent 调工具，Skills 教 Agent 调"能力包"。
- **Skill 定义结构**：id + name + description + system_prompt + tools[] + input_schema + output_schema + preconditions。
- **MCP 连接外部工具，Skills 封装内部能力**。MCP 是水电煤接口，Skill 是房间功能定义。一个 Skill 可以同时使用 MCP 工具和内部工具。
- **Skill Registry 做意图匹配用 nano 档模型**——"匹配一个 Skill 的 description"是窄任务，nano 档完全够用，且延迟和成本最低。
- **Skills 不替代 Function Calling**——Function Calling 仍是底层机制。Skills 改变的是 Agent 能看到哪些工具、以什么角色调用它们。
- **权限最小化**：每个 Skill 只暴露完成其任务所需的最小工具集。research_skill 不应该能调 delete_database()。