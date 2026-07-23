## 生成参数全景

LLM 的"创造力"和"稳定性"由三个核心采样参数控制：**temperature**、**top_p** 和 **top_k**。理解它们不是背公式，而是建立"什么场景用什么参数"的工程直觉。

### Temperature

Temperature（温度）控制输出概率分布的"平滑度"。

```
temperature = 0:  总是选概率最高的 token（确定性输出）
temperature = 0.3: 概率分布轻微平滑，偶有变化
temperature = 0.7: 平衡创造性和一致性
temperature = 1.0: 原始概率分布，输出更丰富
temperature = 2.0: 概率分布高度平滑，输出高度随机
```

::interactive{type="temperature"}

**工程建议**：
- 代码生成、数学计算、数据提取：temperature = 0 或接近 0
- 创意写作、头脑风暴：temperature = 0.7-1.0
- 常规对话、客服：temperature = 0.3-0.5

### Top-p（Nucleus Sampling）

Top-p 不是直接改温度，而是**限制候选 token 的范围**。只从累计概率达到 p 的最小 token 集合中采样。

```
词表概率排序: [A: 0.50, B: 0.30, C: 0.15, D: 0.04, E: 0.01]

top_p = 0.8 → 从 {A, B} 中采样（累计概率 0.50+0.30=0.80 ≥ 0.8）
top_p = 0.9 → 从 {A, B, C} 中采样（累计概率 0.95 ≥ 0.9，而 {A,B}=0.8 不够）
top_p = 1.0 → 从全部候选采样
```

简单理解：top_p = 0.9 意味着「只从累计概率达到 90% 的最小 token 集合里选」，把那些极低概率的「噪声 token」直接排除。

**关键区别**：
- Temperature 改变概率分布本身（把概率"拉平"或"锐化"）
- Top-p 在采样前截断候选集（不改概率，改可选项）
- 两者正交，可以组合使用

### Top-k

Top-k 是最简单粗暴的截断——只保留概率最高的 k 个 token。现代模型较少单独使用 top-k，更多是 top-p 的补充。

### Greedy vs Sampling

**Greedy Decoding**（temperature=0）：每步选择概率最高的 token。优点是确定性和可复现性，缺点是容易陷入重复循环。

**Sampling**（temperature>0）：按概率分布随机采样。优点是输出多样，缺点是结果不可复现。

实际工程中，大多数场景使用 **temperature>0 但较低** 的采样策略——既保证一定的确定性，又保留输出的自然度。

### 其他常用生成参数

除 temperature / top_p / top_k 外，API 还提供几个实用参数：

**max_tokens** — 限制模型最多生成多少 token。这不是"建议"而是"硬截断"——超过就截断，即使句子没说完。

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "解释 RAG 的原理"}],
    max_tokens=500,    # 最多生成 500 token
    temperature=0.7,
    top_p=0.9,
)
```

**工程建议**：始终设置 max_tokens。不设的话，模型可能"滔滔不绝"直到撞上 API 硬上限，浪费成本。Agent 开发中，通常给工具调用留 500-1000 tokens，给最终回复留 1000-2000 tokens。

**frequency_penalty**（频率惩罚）— 已出现过的 token 越多，下次出现的概率越低。解决"模型反复说同一句话"的重复问题。范围 -2.0 到 2.0，0 = 不惩罚。

**presence_penalty**（存在惩罚）—— 只要 token 出现过就降权，鼓励模型谈论新话题。适合需要"覆盖多个方面"的场景。

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "列出 5 种编程语言的优缺点"}],
    temperature=0.7,
    frequency_penalty=0.5,   # 减少重复用词
    presence_penalty=0.3,    # 鼓励引入新话题
)
```

**seed**（随机种子）—— 让相同输入 + 相同 seed 产生可复现的输出。适合测试和调试。

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "生成一个测试用例"}],
    temperature=0.7,
    seed=42,             # 相同 seed + 相同输入 → 可复现输出
)
```

> **注意**：seed 的可复现性并非 100%——模型版本更新、API 内部优化都可能影响输出。它更适合"大致复现"而非"严格一致"。

### 参数组合策略

学完上述参数后，用一张表把常见场景串起来：

| 场景 | temperature | top_p | frequency_penalty | max_tokens | 理由 |
|------|------------|-------|-------------------|------------|------|
| 代码生成 | 0-0.2 | 0.95 | 0 | 1000-2000 | 确定性优先，但保留少量纠错空间 |
| 数据提取/JSON 输出 | 0 | 1.0 | 0 | 500-1000 | 完全确定性，不需要多样性 |
| 闲聊对话 | 0.5-0.7 | 0.9 | 0.3 | 500-1000 | 平衡自然度和一致性 |
| 创意写作 | 0.8-1.0 | 0.95 | 0.5 | 2000-4000 | 鼓励多样性，但过滤尾部噪声 |
| 多角度分析 | 0.7 | 0.9 | 0.3 | 1500-3000 | 需要覆盖多方面，presence_penalty 也可调高 |
| 测试/调试 | 0 | 1.0 | 0 | 按需 | 确定性 + 可复现 |

### 要点总结

- Temperature 控制"创造力"，0=确定，1=原始，2=疯狂
- Top-p 限制候选 token 范围，从概率最高处截断
- 温度改分布，top-p 改候选集，两者正交
- max_tokens 是硬截断，不设可能导致成本浪费
- frequency_penalty 抑制重复，presence_penalty 鼓励新话题
- seed 用于可复现输出，适合测试场景
- 生产环境代码生成用 temperature=0，对话用 0.3-0.7
- 参数选择没有"正确"答案，只有"更适合场景"的答案