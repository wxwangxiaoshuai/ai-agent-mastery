## 思维链（CoT）与推理增强

LLM 直接从问题跳到答案，就像学生不写过程直接交卷——正确率取决于题目难度。Chain-of-Thought（CoT）的核心思想是：**让模型先展示推理过程，再给出最终答案**。

### 标准回答 vs CoT 回答

**标准 Prompt**：
```
一个农场有 15 只鸡和 8 只兔子，一共有多少条腿？
```

模型可能直接输出 `62`——对或错，你不知道它是怎么算的。

**CoT Prompt**：
```
一个农场有 15 只鸡和 8 只兔子，一共有多少条腿？
请一步步思考，写出推理过程。
```

模型输出：
```
鸡有 2 条腿，15 只鸡 = 15 × 2 = 30 条腿
兔子有 4 条腿，8 只兔子 = 8 × 4 = 32 条腿
总共 = 30 + 32 = 62 条腿
```

CoT 的效果在数学推理、逻辑推理、多步规划等任务上提升显著。在 GSM8K（小学数学题）上，CoT 将 GPT-3 的准确率从 ~18% 提升到 ~58%。

### 触发 CoT 的方式

**方式 1：显式指令**
```
请一步步思考，写出推理过程。
Let's think step by step.
```

**方式 2：Few-shot CoT**
```
问题：小明有 5 个苹果，他吃了 2 个，又买了 3 个，现在有几个？
推理：小明最初有 5 个苹果。吃了 2 个，剩下 5 - 2 = 3 个。又买了 3 个，现在有 3 + 3 = 6 个。
答案：6 个苹果。

问题：一个班级有 30 个学生，其中 18 个喜欢数学，12 个喜欢语文，6 个两门都喜欢。问只喜欢数学的有多少人？
推理：喜欢数学的有 18 人，其中 6 人两门都喜欢，所以只喜欢数学的 = 18 - 6 = 12 人。
答案：12 人。
```

在 Few-shot 示例中展示推理过程，模型会自动模仿这种"先推理、后回答"的模式。

**方式 3：Zero-shot CoT**

只加一句 `Let's think step by step.` 就能触发推理链。这是最简单但最有效的 CoT 技巧。

### Self-Consistency（自一致性）

CoT 有一个问题：**单次推理可能出错**。Self-Consistency 的解法是：让模型多次推理（使用 temperature > 0），然后投票选出最一致的答案。

```
同一个问题，跑 5 次 CoT（temperature=0.7）：

推理 1：A → B → C → 答案：42
推理 2：A → B → D → 答案：42
推理 3：A → E → 答案：37
推理 4：A → B → C → 答案：42
推理 5：A → B → C → 答案：42

投票结果：42（4票）> 37（1票）→ 最终答案：42
```

Self-Consistency 的代价是计算量翻倍（5 次推理 = 5 倍 Token 消耗），但换来了显著的准确性提升。在 GSM8K 上，Self-Consistency 将 CoT 的准确率进一步提升了 10-15 个百分点。

```python
import re

def extract_final_answer(response: str) -> str:
    """从 CoT 推理文本中提取最终答案"""
    match = re.search(r'(?:答案|Answer)[:\s]*(.+?)(?:\n|$)', response)
    return match.group(1).strip() if match else response.strip()[-20:]

def self_consistency(question: str, n_samples: int = 5) -> str:
    """多次采样 + 多数投票"""
    answers = []
    for _ in range(n_samples):
        response = call_llm(
            prompt=f"{question}\n\nLet's think step by step. 最后用 '答案：' 开头给出最终答案。",
            temperature=0.7,
        )
        answer = extract_final_answer(response)
        answers.append(answer)
    return max(set(answers), key=answers.count)
```

> **适用场景**：Self-Consistency 适合有明确答案的推理任务（数学、逻辑题）。对开放性任务（如创意写作）不适用。

### ReAct：Reason + Act

ReAct 是 CoT 的进化版——把"推理"和"行动"交织在一起。它是 Agent 的核心范式，我们在模块 5（Agent 核心架构）会深入讲解。

```
Question: 2024 年诺贝尔物理学奖得主是谁？

Thought: 我需要搜索 2024 年诺贝尔物理学奖的信息。
Action: search("2024 诺贝尔物理学奖")
Observation: 2024 年诺贝尔物理学奖授予 John Hopfield 和 Geoffrey Hinton...

Thought: 我找到了答案。
Answer: 2024 年诺贝尔物理学奖授予 John Hopfield 和 Geoffrey Hinton。
```

**CoT 与 ReAct 的区别**：
- CoT：只推理，不行动（适合纯思考任务）
- ReAct：推理 + 行动交织（适合需要外部信息的任务）

### CoT 的 Token 成本

CoT 让模型"展示推理过程"，这意味着更多的输出 token——直接增加成本和延迟。

```
不用 CoT：
  输入: "15 只鸡 8 只兔子共多少条腿？"
  输出: "62"                          → ~3 token

用 CoT：
  输入: "15 只鸡 8 只兔子共多少条腿？请一步步思考。"
  输出: "鸡有2条腿，15只=30条腿..."     → ~80 token
```

**成本对比**：同一个问题，CoT 的输出 token 约为不用 CoT 的 10-30 倍。对于需要批量处理的场景（如分类 1000 条文本），这个成本差异是显著的。

**工程建议**：对简单任务（分类、提取、翻译）不用 CoT；对复杂推理任务用 CoT 但设置合理的 `max_tokens` 上限，防止推理链无限发散。

### Tree of Thoughts（ToT）

CoT 是线性推理——一条路走到底。Tree of Thoughts 把推理组织成**树形结构**，允许模型在多个分支上并行推理，再选择最优路径。

```
CoT（线性）：           ToT（树形）：
A → B → C → 答案        A → B → C → 答案 X
                        A → B → D → 答案 Y  ← 选最优
                        A → E → F → 答案 Z
```

ToT 适合需要"探索多个方案再选最优"的场景（如数学证明、博弈推理），但成本是 CoT 的数倍。日常 Agent 开发中 CoT 足够，ToT 是前沿研究方向的了解性内容。

### Auto-CoT：自动构建思维链

Few-shot CoT 需要手写推理示例，成本高且容易有偏差。Auto-CoT（Zhang et al. 2022）的思路是：**让模型自己生成推理示例**——先用 Zero-shot CoT 对一批问题生成推理链，再聚类去重，自动选出代表性示例。

```
Auto-CoT 流程：
1. 准备一批问题（无需人工标注答案）
2. 对每个问题用 Zero-shot CoT 生成推理链
3. 按推理链的相似度聚类
4. 每个聚类选一个代表作为 Few-shot 示例
5. 用自动选出的示例做 Few-shot CoT
```

Auto-CoT 的效果接近人工挑选的 Few-shot CoT，但几乎不需要人工投入。对于需要大规模批量推理的场景（如处理成千上万条数据），这是一个实用的自动化方案。

### CoT 的使用场景与限制

**适合 CoT 的场景**：
- 数学计算、逻辑推理
- 多步规划（如旅行路线规划）
- 代码调试（推理 bug 原因）
- 复杂决策（需要权衡多个因素）

**不适合 CoT 的场景**：
- 简单事实问答（"巴黎是哪个国家的首都？"）
- 创意写作（推理过程会破坏创意流畅性）
- 对延迟要求极高的场景（CoT 增加 Token 消耗和响应时间）

**CoT 的局限**：
- 推理过程可能是"事后合理化"而非"真实推理"
- 模型可能编造看似合理但实际错误的推理步骤
- 长推理链容易发散或自相矛盾
- CoT 效果与模型规模相关——小模型可能无法受益

### 动手 5 分钟

亲手验证 CoT 不是万能的。

1. 准备两类问题各 5 道：一类需要多步推理（多位数乘法、逻辑谜题），一类是纯事实查询（某国首都、某年份）。
2. 每道题跑"直接回答"和"让我们一步步思考"两版。
3. 记录：准确率变化、输出 token 数变化、延迟变化。

**验收标准**：你的数据能证明——推理类问题上 CoT 涨分，事实类问题上 CoT 只涨成本不涨分，甚至因为"过度推理"把正确答案改错。

### 要点总结

- CoT 让模型先展示推理过程再给答案，大幅提升复杂推理准确率
- `Let's think step by step.` 是最简单的 Zero-shot CoT 技巧
- CoT 的 token 成本是不用 CoT 的 10-30 倍，需权衡
- Self-Consistency 通过多次采样 + 投票进一步提升准确性
- Tree of Thoughts 是 CoT 的树形扩展，适合多方案探索但成本更高
- Auto-CoT 可自动生成 Few-shot 推理示例，减少人工标注成本
- ReAct 是 CoT 的进化版，将推理和行动交织在一起（M5 详解）
- CoT 不适合简单任务和创意写作，成本需要权衡