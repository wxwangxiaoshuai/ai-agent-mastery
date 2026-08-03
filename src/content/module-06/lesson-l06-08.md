## 构建 Skill 注册中心与动态调度

L06-07 讲了 Skills 是什么。这一节把概念变成代码——实现一个能用的 Skill Registry，并把它接入 P6 的工具箱 Agent。

### 第一步：定义 Skill 的数据结构

```python
from dataclasses import dataclass, field
from typing import Any, Callable
import json

@dataclass
class Skill:
    id: str
    name: str
    description: str
    system_prompt: str
    tools: list[str] = field(default_factory=list)
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    preconditions: list[str] = field(default_factory=list)

    def to_prompt_fragment(self) -> str:
        """生成注入到 System Prompt 的片段。"""
        return f"""[Skill: {self.name}]
{self.system_prompt}

可用工具：{', '.join(self.tools) if self.tools else '无'}
输入格式：{json.dumps(self.input_schema, ensure_ascii=False)}
输出格式：{json.dumps(self.output_schema, ensure_ascii=False)}
"""
```

### 第二步：实现 Skill Registry

```python
import asyncio
from typing import Optional

class SkillRegistry:
    def __init__(self):
        self._skills: dict[str, Skill] = {}
        self._tool_registry: Optional[dict[str, Callable]] = None

    def register(self, skill: Skill) -> None:
        if skill.id in self._skills:
            raise ValueError(f"Skill '{skill.id}' 已注册")
        self._skills[skill.id] = skill

    def set_tool_registry(self, tools: dict[str, Callable]) -> None:
        """绑定工具注册表，用于校验 Skill 声明的工具是否存在。"""
        self._tool_registry = tools

    def list_skills(self) -> list[dict[str, str]]:
        """返回所有 Skill 的摘要，供意图匹配使用。"""
        return [
            {"id": s.id, "name": s.name, "description": s.description}
            for s in self._skills.values()
        ]

    def get_skill(self, skill_id: str) -> Skill:
        if skill_id not in self._skills:
            raise KeyError(f"Skill '{skill_id}' 未注册")
        return self._skills[skill_id]

    def get_tools_for_skill(self, skill_id: str) -> list[str]:
        skill = self.get_skill(skill_id)
        if self._tool_registry:
            for tool_name in skill.tools:
                if tool_name not in self._tool_registry:
                    raise ValueError(
                        f"Skill '{skill_id}' 引用了不存在的工具 '{tool_name}'"
                    )
        return skill.tools

    def validate(self) -> list[str]:
        """校验所有 Skill 的完整性。返回问题列表。"""
        issues = []
        for skill in self._skills.values():
            if not skill.description:
                issues.append(f"Skill '{skill.id}' 缺少 description")
            if not skill.system_prompt:
                issues.append(f"Skill '{skill.id}' 缺少 system_prompt")
            if self._tool_registry:
                for tool_name in skill.tools:
                    if tool_name not in self._tool_registry:
                        issues.append(
                            f"Skill '{skill.id}' 引用了不存在的工具 '{tool_name}'"
                        )
        return issues
```

### 第三步：用 Function Calling 实现 Skill 选择

意图匹配是 Skill 系统的核心——用户输入一句话，Agent 自动选择最合适的 Skill。这里用 Function Calling 而不是字符串匹配：

```python
SKILL_SELECTION_TOOL = {
    "type": "function",
    "function": {
        "name": "select_skill",
        "description": "根据用户意图选择最合适的 Skill。"
                       "如果用户意图不明确，选择多个候选 Skill。"
                       "如果没有合适的 Skill，返回空列表。",
        "parameters": {
            "type": "object",
            "properties": {
                "skill_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "选中的 Skill ID 列表，按匹配度降序排列"
                },
                "reasoning": {
                    "type": "string",
                    "description": "选择理由，一句话解释为什么选这些 Skill"
                },
            },
            "required": ["skill_ids", "reasoning"],
        },
    },
}


async def match_skills(
    user_input: str,
    registry: SkillRegistry,
    llm_call: Callable,
) -> tuple[list[Skill], str]:
    """用 LLM 做意图匹配，返回匹配的 Skill 列表和选择理由。"""
    skills_summary = registry.list_skills()

    system_prompt = f"""你是 Skill 选择器。根据用户输入，从可用 Skill 列表中选择最合适的 Skill。

可用 Skill：
{json.dumps(skills_summary, ensure_ascii=False, indent=2)}

选择原则：
1. 优先匹配用户意图最明确的 Skill
2. 如果用户意图不明确，可以返回多个候选
3. 如果没有合适的 Skill，返回空列表
4. 不要为了"至少选一个"而选不相关的 Skill
"""

    response = await llm_call(
        system_prompt=system_prompt,
        user_message=user_input,
        tools=[SKILL_SELECTION_TOOL],
        tool_choice="required",
    )

    args = json.loads(response.tool_calls[0].function.arguments)
    skills = [registry.get_skill(sid) for sid in args["skill_ids"]]
    return skills, args["reasoning"]
```

### 第四步：Skill 级别的上下文隔离

每个 Skill 加载时，Agent 获得独立的 System Prompt + 工具集。这是 Skills 系统最核心的工程价值——**上下文隔离**：

```python
class SkillAwareAgent:
    def __init__(self, registry: SkillRegistry, base_system_prompt: str):
        self.registry = registry
        self.base_system_prompt = base_system_prompt
        self.active_skill: Optional[Skill] = None

    def activate_skill(self, skill_id: str) -> str:
        """激活一个 Skill，返回合并后的 System Prompt。"""
        skill = self.registry.get_skill(skill_id)
        self.active_skill = skill

        # 基座 Prompt + Skill Prompt 合并
        return f"""{self.base_system_prompt}

{skill.to_prompt_fragment()}

重要：你当前正在执行 {skill.name} Skill 的任务。
只使用上述 Skill 声明的工具，不要超出范围。
"""

    def deactivate_skill(self) -> str:
        """卸载 Skill，回到基座 Prompt。"""
        self.active_skill = None
        return self.base_system_prompt

    def get_active_tools(self) -> list[str]:
        """返回当前 Skill 允许的工具列表。"""
        if self.active_skill is None:
            return []  # 基座状态不暴露任何工具
        return self.registry.get_tools_for_skill(self.active_skill.id)
```

**上下文隔离的三个好处**：
1. **权限最小化**：每个 Skill 只看得到自己的工具，Agent 不会"不小心"调了不该调的工具
2. **Prompt 聚焦**：Agent 的 System Prompt 是"基座 + Skill 专属"，不会因为工具太多而分散注意力
3. **组合安全**：多个 Skill 可以并列存在，Agent 在不同 Skill 之间切换，但不会混淆

### 第五步：Skill 组合——一个任务触发多个 Skill

真实场景中，一个用户请求可能触发多个 Skill 的协作：

```python
async def execute_with_skills(
    user_input: str,
    agent: SkillAwareAgent,
    registry: SkillRegistry,
    llm_call: Callable,
) -> dict:
    """完整的 Skill 调度流程：匹配 → 激活 → 执行 → 卸载。"""
    result = {}

    # 1. 匹配 Skill
    skills, reasoning = await match_skills(user_input, registry, llm_call)
    if not skills:
        return {"error": "没有匹配的 Skill", "reasoning": reasoning}

    # 2. 逐个激活并执行
    for skill in skills:
        # 检查前置条件
        if skill.preconditions:
            # 实际实现中检查前置条件是否满足
            pass

        # 激活 Skill
        system_prompt = agent.activate_skill(skill.id)

        # 执行任务
        response = await llm_call(
            system_prompt=system_prompt,
            user_message=user_input,
            tools=agent.get_active_tools(),
        )

        result[skill.id] = {
            "output": response.content,
            "tool_calls": [
                tc.function.name for tc in (response.tool_calls or [])
            ],
        }

        # 卸载 Skill
        agent.deactivate_skill()

    return result
```

### 实战：把 P6 的工具箱 Agent 重构为 Skills 架构

P6 原设计是"多工具 Agent"——一个 Agent 注册了所有工具，直接从 Function Calling 选工具。现在用 Skills 重构：

**重构前**（Function Calling 直接选工具）：

```python
# 原架构：所有工具平铺
agent = Agent(
    tools=[
        "search_web", "fetch_page", "summarize_text",
        "execute_python", "query_db", "read_file", "write_file",
        "send_email", "translate", "format_output",
    ]
)
```

**重构后**（Skills 架构）：

```python
# 定义 Skills
research_skill = Skill(
    id="research",
    name="研究调研",
    description="搜索互联网信息、阅读网页、提取关键信息并生成结构化摘要",
    system_prompt="你是研究助手。对每个搜索结果的可靠性做判断，不确定的信息要标注。",
    tools=["search_web", "fetch_page", "summarize_text"],
)

data_skill = Skill(
    id="data_analysis",
    name="数据分析",
    description="执行 Python 代码分析数据、查询数据库、读写文件",
    system_prompt="你是数据分析师。所有分析结果要有数据支撑，不凭空推断。",
    tools=["execute_python", "query_db", "read_file", "write_file"],
)

publishing_skill = Skill(
    id="publishing",
    name="内容发布",
    description="格式整理、翻译、邮件发送",
    system_prompt="你是内容编辑。格式整理后检查一遍再发送，不要发出半成品。",
    tools=["translate", "format_output", "send_email"],
)

# 注册
registry = SkillRegistry()
for skill in [research_skill, data_skill, publishing_skill]:
    registry.register(skill)

# Agent 使用 Skills
agent = SkillAwareAgent(
    registry=registry,
    base_system_prompt="你是通用助手。根据用户需求自动选择合适的 Skill 来完成任务。",
)
```

**重构的核心收益**（量级示意，实际效果因工具数量和 Skill 设计而异）：
- 从 10 个平铺工具变成 3 个 Skill，Agent 做选择时工具候选范围从 10 个降到 3-4 个（缩小约 60-70%），选择噪音显著下降
- 每个 Skill ��能看到 3-4 个工具，权限范围清晰
- 新增功能只需新增 Skill，不影响已有 Skill
- 每个 Skill 有独立的 System Prompt，Agent 在不同任务中切换角色

### 动手 5 分钟

1. 把你 P6 项目的所有工具列出来，按"能力包"分组（如 search 组、code 组、data 组、output 组）。
2. 为每个组写一个 Skill 定义（含 description + system_prompt + tools 列表）。
3. 实现 `SkillRegistry` 的 `register` 和 `validate` 方法，跑一遍 `validate()` 确保没有工具引用错误。
4. （进阶）用你熟悉的 LLM SDK 实现 `match_skills` 函数，用 Function Calling 做一个真实的意图匹配。

**验收标准**：你的 Skills 注册中心能通过 `validate()` 检查，且每个 Skill 的 `description` 能准确描述它解决什么问题。如果两个 Skill 的 description 看起来差不多，说明你的划分需要再细化。

### 要点总结

- **Skill Registry 是 Skills 系统的核心**：注册、发现、匹配、校验。`validate()` 方法在注册阶段就发现工具引用错误，而不是运行时才报。
- **意图匹配用 Function Calling 而非字符串匹配**——让 LLM 自己判断"这个意图最匹配哪个 Skill 的 description"，这是 nano 档模型就能做好的窄任务。
- **上下文隔离是 Skills 的工程价值所在**：每个 Skill 激活时注入独立的 System Prompt + 工具集，Agent 权限最小化、注意力聚焦、组合安全。
- **Skill 可以组合**：一个用户请求可能触发多个 Skill 的协作。Agent 依次激活、执行、卸载，每个 Skill 在独立的上下文中运行。
- **P6 重构的核心收益**：10 个平铺工具 → 3 个 Skill，工具候选范围从 10 个降到 3-4 个，选择噪音显著下降，权限范围清晰，新增功能只需新增 Skill。
- **Function Calling vs Skills 的架构差异**：Function Calling 是"Agent 在工具箱里挑工具"，Skills 是"Agent 先选技能包，再在技能包里挑工具"。后者在工具数量增长时复杂度可控。