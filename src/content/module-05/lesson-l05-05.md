## Reflection 与自我反思

Agent 的一个核心能力是**从错误中学习**。ReAct 和 Plan-Execute 都是"向前走"的范式——执行、观察、继续。Reflection 是"向后看"的范式——**做完之后回头审视自己的输出，发现问题并改进**。

### 人类是怎么做的

你写完一篇文章后不会直接提交——你会**重读一遍**，发现不通顺的地方修改。这种"自我审查 + 修订"就是 Reflection。

```
草稿 → 审视（发现"这段逻辑不通"）→ 修订 → 再审视 → 定稿
```

Agent 也可以做同样的事——让 LLM 扮演"评审"角色，批评自己的输出，然后基于批评修订。

### Self-Refine：批评-修订循环

[Self-Refine](https://arxiv.org/abs/2303.17651) 是最简单的 Reflection 实现：

```
Step 1: 生成初始输出
Step 2: LLM 审视输出，生成批评意见
Step 3: LLM 基于批评意见修订输出
Step 4: 重复 2-3 直到满意或达到上限
```

```python
from openai import OpenAI
client = OpenAI()

def self_refine(task: str, max_iterations: int = 3) -> str:
    """Self-Refine：自我批评与修订"""

    # Step 1: 生成初始输出
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": task}],
        temperature=0.7,
    )
    current_output = response.choices[0].message.content
    print(f"初始输出:\n{current_output[:200]}...\n")

    for i in range(max_iterations):
        # Step 2: 生成批评
        critique_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "你是一个严格的评审。审视以下输出，指出具体问题（不准确、不完整、不清晰）。如果没有问题，输出 'LGTM'。"},
                {"role": "user", "content": f"任务：{task}\n\n输出：\n{current_output}"},
            ],
            temperature=0,
        )
        critique = critique_response.choices[0].message.content
        print(f"第 {i+1} 轮批评: {critique[:200]}")

        if "LGTM" in critique:
            print("评审通过，停止迭代。")
            break

        # Step 3: 修订
        refine_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "根据评审意见修订输出。只输出修订后的内容。"},
                {"role": "user", "content": f"任务：{task}\n\n当前输出：\n{current_output}\n\n评审意见：\n{critique}"},
            ],
            temperature=0.3,
        )
        current_output = refine_response.choices[0].message.content
        print(f"第 {i+1} 轮修订: {current_output[:200]}...\n")

    return current_output
```

**效果**：在文本摘要、代码优化、数学推理等任务上，Self-Refine 通常能提升 5-15% 的质量——代价是 2-4 倍的 LLM 调用次数。

### Reflexion：从失败中记住教训

[Reflexion](https://arxiv.org/abs/2303.11366) 比 Self-Refine 更进一步——它把失败的经验存入"情景记忆"（Episodic Memory），在下次尝试时参考。

```
尝试 1：执行任务 → 失败
  ↓ 反思
  "我失败的原因是 XX，下次应该 YY"
  ↓ 存入记忆

尝试 2：执行任务（参考记忆中的教训）→ 可能成功
  ↓ 反思
  "这次进步了但还有 ZZ 问题"
  ↓ 更新记忆

尝试 3：执行任务（参考全部记忆）→ 成功
```

```python
def reflexion_agent(task: str, max_attempts: int = 3) -> str:
    """Reflexion Agent：从失败中学习"""

    reflections = []  # 情景记忆：存历次反思

    for attempt in range(max_attempts):
        # 构建包含历史反思的上下文
        reflection_context = ""
        if reflections:
            reflection_context = "\n\n过去的经验教训：\n"
            for i, r in enumerate(reflections):
                reflection_context += f"第 {i+1} 次尝试：{r}\n"

        # 执行任务（带历史反思）
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"{task}{reflection_context}",
            }],
            temperature=0.5,
        )
        output = response.choices[0].message.content
        print(f"\n第 {attempt+1} 次尝试:\n{output[:200]}...")

        # 评估结果
        eval_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"评估以下输出是否正确完成了任务。输出 PASS 或 FAIL + 原因。\n\n任务：{task}\n\n输出：{output}",
            }],
            temperature=0,
        )
        evaluation = eval_response.choices[0].message.content

        if "PASS" in evaluation:
            print("任务完成！")
            return output

        # 反思失败原因
        reflection_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"你尝试完成以下任务但失败了。分析失败原因，给出下次应改进的策略（一句话）。\n\n任务：{task}\n\n输出：{output}\n\n评估：{evaluation}\n\n失败分析：",
            }],
            temperature=0,
        )
        reflection = reflection_response.choices[0].message.content
        reflections.append(reflection)
        print(f"反思: {reflection}")

    return output  # 返回最后一次尝试的结果
```

### Self-Refine vs Reflexion

| 维度 | Self-Refine | Reflexion |
|------|-------------|-----------|
| 核心思想 | 审视→修订（单次任务内） | 失败→反思→重试（多次尝试） |
| 记忆 | 无（每次独立） | 有（情景记忆积累教训） |
| 适合任务 | 写作、代码、摘要（质量提升） | 推理、解题（从错误中学习） |
| 成本 | 2-4x LLM 调用 | 3-6x LLM 调用 |
| 效果 | 质量提升 5-15% | 成功率提升 10-30% |

### Reflection 的成本与收益

Reflection 不是免费的——每次反思都是一次额外的 LLM 调用。

```
不用 Reflection：
  1 次调用 → 质量 75 分 → 成本 $0.01

用 Self-Refine（3 轮）：
  4 次调用（1 生成 + 3 审视+修订）→ 质量 88 分 → 成本 $0.04
  质量提升 13 分，成本增加 3 倍

用 Reflexion（3 次尝试）：
  9 次调用（3×(生成+评估+反思)）→ 质量 90 分 → 成本 $0.09
  质量提升 15 分，成本增加 8 倍
```

**何时值得用 Reflection**：
- 高价值任务（如代码生成、重要报告）→ 值得，质量比成本重要
- 批量低价值任务（如分类、标注）→ 不值得，成本比质量重要
- 一次性任务 → Self-Refine 够了
- 可重试任务 → Reflexion 更有效

### 将 Reflection 集成到 Agent Loop

Reflection 不只是独立技术——它可以集成到 ReAct 或 Plan-Execute 的 Agent Loop 中：

```python
def react_with_reflection(question: str, max_steps: int = 10) -> str:
    """带 Reflection 的 ReAct Agent"""
    answer = react_loop(question, max_steps)  # 先正常执行 ReAct

    # 对最终答案做 Self-Refine
    refined = self_refine(f"基于问题'{question}'，优化以下回答：\n{answer}")
    return refined
```

或者在 Agent Loop 内部，每执行 N 步做一次中途反思：

```python
for step in range(max_steps):
    # ... 正常 ReAct 步骤 ...

    # 每 3 步做一次中途反思
    if (step + 1) % 3 == 0 and step < max_steps - 1:
        reflection = reflect_on_progress(question, history)
        if reflection.suggests_replan:
            # 反思建议调整策略
            adjust_plan(reflection)
```

### 动手 5 分钟

测一次 Reflection 的边际收益，避免"反思上瘾"。

1. 挑一个有明确质量标准的输出任务（如"写一段符合 PEP8 且有类型标注的函数"）。
2. 跑 0 轮 / 1 轮 / 2 轮 / 3 轮反思，每轮后记录质量得分与累计 token。
3. 找出得分不再上升的那一轮。

**验收标准**：你能定出你场景的反思轮次上限，并给循环加上"两轮之间改动小于阈值就提前退出"的条件。

### 要点总结

- Reflection = 让 Agent 回头审视自己的输出，发现问题并改进
- Self-Refine：审视→修订循环，适合单次任务的质量提升（5-15%）
- Reflexion：失败→反思→重试 + 情景记忆，适合从错误中学习（成功率提升 10-30%）
- Reflection 不是免费的——每次反思都是额外 LLM 调用，高价值任务才值得
- 可以集成到 ReAct/Plan-Execute 中：中途反思调整策略，或终点反思优化输出
- 生产建议：高价值任务用 Self-Refine，可重试任务用 Reflexion，批量任务不用
