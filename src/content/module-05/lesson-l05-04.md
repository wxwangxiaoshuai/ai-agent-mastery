## Plan-and-Execute 与任务分解

ReAct 是"边想边做"——每步都重新推理。但有些任务需要 10+ 步，每步都推理既慢又贵。Plan-and-Execute 是另一种范式：**先规划全部步骤，再依次执行**——规划只调一次 LLM，执行阶段可以批量处理。

### 为什么需要 Plan-and-Execute

```
任务："对比 2024 年中国和美国在 AI 领域的主要政策"

ReAct 的做法（6 步，6 次 LLM 推理）：
  Thought → Action(搜索中国AI政策) → Obs
  Thought → Action(搜索美国AI政策) → Obs
  Thought → Action(搜索中美对比) → Obs
  Thought → Action(补充搜索) → Obs
  Thought → Action(补充搜索) → Obs
  Thought → Final Answer

Plan-and-Execute 的做法（1 次规划 + 4 次执行 + 1 次综合）：
  Plan:
    1. 搜索 2024 年中国 AI 政策
    2. 搜索 2024 年美国 AI 政策
    3. 对比两国政策差异
    4. 生成结构化报告
  Execute 1 → 搜索中国 → 结果
  Execute 2 → 搜索美国 → 结果
  Execute 3 → 对比 → 结果
  Execute 4 → 报告 → 最终答案
```

**核心优势**：规划阶段调一次 LLM 生成完整计划，执行阶段每个步骤可以并行或批量处理。

### Plan-and-Execute 的三阶段

```
阶段 1：规划（Planner）
  用户目标 → LLM → 生成步骤列表

阶段 2：执行（Executor）
  逐步执行计划，每步可以调工具

阶段 3：重规划（Replanner）
  如果某步失败或发现新信息 → LLM 重新规划剩余步骤
```

### 实现 Plan-and-Execute

```python
import json
from openai import OpenAI

client = OpenAI()

def plan_and_execute(goal: str, max_replans: int = 2) -> str:
    """Plan-and-Execute Agent"""

    # 阶段 1：规划
    plan = generate_plan(goal)
    print(f"初始计划: {json.dumps(plan, ensure_ascii=False, indent=2)}")

    results = {}
    replan_count = 0

    while plan and replan_count <= max_replans:
        # 阶段 2：逐步执行
        for i, step in enumerate(plan):
            print(f"\n执行步骤 {i+1}/{len(plan)}: {step}")

            # 判断是工具调用还是直接回答
            if "搜索" in step or "查找" in step:
                result = execute_step(step)
                results[step] = result
                print(f"结果: {result[:100]}...")
            else:
                result = execute_step(step, context=results)
                results[step] = result
                print(f"结果: {result[:100]}...")

        # 阶段 3：检查是否完成
        remaining = check_completion(goal, plan, results)
        if not remaining:
            break

        # 重规划
        if replan_count < max_replans:
            print(f"\n重规划（第 {replan_count+1} 次）...")
            plan = generate_plan(goal, completed=plan, results=results)
            replan_count += 1
        else:
            break

    # 生成最终答案
    return synthesize(goal, results)


def generate_plan(goal: str, completed: list = None, results: dict = None) -> list:
    """用 LLM 生成执行计划"""
    context = ""
    if completed and results:
        context = f"\n已完成步骤及结果：\n"
        for step in completed:
            context += f"- {step}: {results.get(step, '无结果')[:200]}\n"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""把以下任务分解为 3-6 个具体步骤。每步一句话。
{context}
任务：{goal}

输出 JSON 对象，格式必须为：
{{"steps": ["步骤1", "步骤2", "步骤3"]}}""",
        }],
        temperature=0,
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    # json_object 模式顶层必须是对象；统一从 steps / plan 字段取列表
    steps = data.get("steps", data.get("plan", []))
    return steps if isinstance(steps, list) else []


def execute_step(step: str, context: dict = None) -> str:
    """执行单个步骤"""
    context_str = ""
    if context:
        context_str = "\n已知信息：\n" + "\n".join(f"- {k}: {v[:200]}" for k, v in context.items())

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"执行以下任务步骤，给出简洁结果。{context_str}\n\n步骤：{step}",
        }],
        temperature=0,
        max_tokens=300,
    )
    return response.choices[0].message.content


def check_completion(goal: str, plan: list, results: dict) -> list:
    """检查是否有未完成的步骤"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""判断以下任务是否已完成。
任务：{goal}
已执行步骤：{json.dumps(plan, ensure_ascii=False)}
结果摘要：{json.dumps({k: v[:100] for k, v in results.items()}, ensure_ascii=False)}

如果已完成，输出 "DONE"。如果未完成，输出还需要执行的步骤（JSON 数组）。""",
        }],
        temperature=0,
        max_tokens=200,
    )
    text = response.choices[0].message.content.strip()
    if "DONE" in text.upper():
        return []
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return []


def synthesize(goal: str, results: dict) -> str:
    """综合所有结果生成最终答案"""
    summary = "\n\n".join(f"### {step}\n{result}" for step, result in results.items())
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"基于以下信息，回答任务目标。\n\n任务：{goal}\n\n信息：\n{summary}",
        }],
        temperature=0,
        max_tokens=500,
    )
    return response.choices[0].message.content
```

### 任务分解策略

好的计划是 Plan-and-Execute 成功的关键。常见的分解策略：

**策略 1：按信息维度分解**

```
任务："分析竞品 X 的优势和劣势"
计划：
  1. 搜索竞品 X 的产品功能
  2. 搜索竞品 X 的用户评价
  3. 搜索竞品 X 的定价策略
  4. 综合分析优势和劣势
```

**策略 2：按时间线分解**

```
任务："梳理 AI Agent 的发展历程"
计划：
  1. 搜索 2022 年前的 Agent 研究
  2. 搜索 2023 年的 Agent 突破
  3. 搜索 2024-2025 年的 Agent 产品
  4. 按时间线综合
```

**策略 3：MECE 分解（互斥且穷尽）**

```
任务："调研 RAG 技术栈"
计划：
  1. 调研 RAG 索引技术（分块、Embedding）
  2. 调研 RAG 检索技术（向量、BM25、混合）
  3. 调研 RAG 生成技术（Prompt、后处理）
  4. 调研 RAG 评估技术（RAGAS）
  5. 综合对比
```

### 重规划的触发条件

不是所有计划都能一次成功。以下情况需要重规划：

- **信息不足**：某步搜索结果为空，需要换个角度
- **发现新方向**：搜索结果暴露了计划中没考虑的维度
- **步骤失败**：工具调用出错，需要替代方案
- **计划过于笼统**：初始计划太模糊，需要细化

```python
# 重规划示例
if "未找到" in result or "无相关结果" in result:
    new_plan = generate_plan(
        goal,
        completed=plan[:i],  # 已完成的步骤
        results=results,     # 已获得的结果
    )
    plan = new_plan  # 用新计划替换剩余步骤
```

### ReAct vs Plan-and-Execute 选型

| 维度 | ReAct | Plan-and-Execute |
|------|-------|-----------------|
| 适合任务 | 开放探索、不确定几步 | 明确目标、多步骤流程 |
| LLM 调用 | 每步一次（5-15 次） | 规划 1 次 + 执行 N 次 + 综合 1 次 |
| 灵活性 | 高（每步可调整） | 中（需重规划才能调整） |
| 可预测性 | 低 | 高（有明确计划） |
| 成本 | 高 | 中 |
| 最佳实践 | 研究、调研 | 报告生成、批处理 |

**混合策略**：生产环境常用"Plan-Execute + ReAct 兜底"——先规划，如果某步遇到开放性问题，在该步内部用 ReAct 探索。

### 要点总结

- Plan-and-Execute = 先规划全部步骤，再依次执行
- 三阶段：规划（Planner）→ 执行（Executor）→ 重规划（Replanner）
- 适合明确目标的多步骤任务，比 ReAct 省 LLM 调用次数
- 任务分解策略：按信息维度、按时间线、MECE 互斥穷尽
- 重规划触发条件：信息不足、发现新方向、步骤失败、计划过于笼统
- ReAct vs Plan-Execute：开放探索用 ReAct，固定流程用 Plan-Execute，生产环境常用混合策略
