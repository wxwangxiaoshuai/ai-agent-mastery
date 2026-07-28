## 何时该用 Agent，何时不该用

Agent 是 M5 全章的高潮——但也是最危险的一课。学完 ReAct、Plan-Execute、Reflection 后，你可能恨不得把所有任务都交给 Agent。**这一节的目标是给你泼冷水：Agent 不是银弹，大多数场景不该用 Agent。**

### 残酷的真相：90% 的"Agent"需求其实是 Workflow

```
用户说："我要一个能自动回复邮件的 Agent"
实际需求：邮件 → 分类 → 模板回复 → 发送
→ 这是 Workflow，不是 Agent

用户说："我要一个能做数据分析的 Agent"
实际需求：读 Excel → 生成图表 → 写报告
→ 这是 Workflow，不是 Agent

用户说："我要一个能调研竞品的 Agent"
实际需求：搜索竞品 → 整理信息 → 生成报告
→ 这个可能是 Agent（需要自主决定搜什么）
```

**判断标准**：如果任务步骤是固定的（即使步骤很多），用 Workflow。如果步骤需要根据中间结果动态决定，才用 Agent。

### Agent 的隐性成本

引入 Agent 不只是"多调几次 LLM"——它带来一整层隐性成本：

| 成本类型 | 具体表现 | 量化 |
|----------|----------|------|
| 延迟 | 每步都要等 LLM 推理 | 5 步 Agent：10-25 秒 vs Workflow：< 3 秒 |
| 金钱 | 每步都消耗 token | 5 步 Agent：~$0.05/次 vs Workflow：~$0.01/次 |
| 不可预测性 | 同一输入可能走不同路径 | 测试困难、回归困难 |
| 可靠性 | 模型可能走偏、循环、幻觉 | 需要 Harness 保护（M7） |
| 调试难度 | 链式调用难以定位问题 | 需要 Tracing 工具（M13） |
| 安全风险 | Agent 自主调用工具 | 需要权限控制（M13） |

**一句话**：Agent 的能力越强，你需要投入的工程保障也越多。

### 决策树：该不该用 Agent

```
你的任务：
  ↓
步骤是否固定？
  ├─ 是 → 用 Workflow（不需要 Agent）
  └─ 否 → 步骤是否需要 LLM 决策？
            ├─ 否 → 用规则路由（不需要 Agent）
            └─ 是 → 决策频率高吗？
                      ├─ 低（1-2 次决策）→ 用 RAG + 简单路由（轻量 Agent）
                      ├─ 中（3-5 次决策）→ 用 ReAct Agent
                      └─ 高（>5 次或需要规划）→ 用 Plan-Execute Agent
```

### 典型反模式

**反模式 1：Agent 做分类**

```
❌ 用 Agent 判断邮件是"工作"还是"私人"
✅ 用一次 LLM 调用（甚至用小模型）做分类
```

分类是单步任务，不需要循环。用 Agent 做分类就像用卡车送一封信。

**反模式 2：Agent 做固定流程**

```
❌ 用 Agent 做"读文档→提取→存库→发通知"的固定流程
✅ 用 Workflow（LangChain Chain 或普通 Python 代码）
```

固定流程不需要 LLM 决定"下一步做什么"——每步都是确定的。

**反模式 3：Agent 里套 Agent**

```
❌ 外层 Agent 调用内层 Agent，内层又调用更内层
✅ 扁平化设计，一层 Agent + 工具
```

嵌套 Agent 的调试和成本都是指数级增长的。

**反模式 4：用 Agent 因为"酷"**

```
❌ "我们用 Agent 做这个功能因为 AI 是趋势"
✅ 先用最简方案（规则/Workflow/RAG），不够再升级
```

### 成本对比实例

同一个任务"总结一篇 5000 字文章"的三种方案：

| 方案 | LLM 调用次数 | 延迟 | 成本 | 质量 |
|------|-------------|------|------|------|
| 直接调 LLM | 1 次 | 3 秒 | $0.01 | 80 分 |
| RAG 分段总结 | 3 次 | 8 秒 | $0.03 | 85 分 |
| ReAct Agent | 5-8 次 | 20-40 秒 | $0.05-0.08 | 82 分 |

**结论**：对于"总结文章"这种步骤固定的任务，直接调 LLM 就够了。Agent 不仅没提升质量，反而增加了 5 倍成本和 10 倍延迟。

### 从 Workflow 到 Agent 的渐进式升级

不要一上来就上 Agent。推荐渐进式路径：

```
Level 0: 纯代码
  → 如果能用规则/代码解决，不用 LLM

Level 1: 单次 LLM 调用
  → 一步到位，最简方案

Level 2: RAG + 单次 LLM
  → 需要知识库但步骤固定

Level 3: 固定 Chain（Workflow）
  → 多步骤但顺序确定

Level 4: 轻量 Agent（1-2 次决策）
  → 偶尔需要 LLM 决定分支

Level 5: ReAct Agent
  → 需要自主探索和多步决策

Level 6: Plan-Execute Agent
  → 需要规划长流程
```

**升级原则**：只在前一级不够用时才升级。每升级一级，成本和复杂度翻倍。

### 量化 Agent 的"额外代价"

如果你决定用 Agent，先量化它带来的额外代价：

```python
def estimate_agent_cost(steps: int, tokens_per_step: int = 2000,
                        input_price: float = 0.15, output_price: float = 0.60) -> dict:
    """估算 Agent 的成本和延迟"""
    total_tokens = steps * tokens_per_step
    cost = total_tokens / 1e6 * (input_price + output_price) / 2
    latency = steps * 3  # 每步约 3 秒

    return {
        "steps": steps,
        "total_tokens": total_tokens,
        "cost_per_call": f"${cost:.4f}",
        "latency": f"~{latency}s",
        "monthly_cost_100_calls_day": f"${cost * 100 * 30:.2f}",
    }

# 对比：Workflow（1 步） vs Agent（5 步）
print("Workflow:", estimate_agent_cost(steps=1))
# {'cost_per_call': '$0.0008', 'latency': '~3s', 'monthly_cost_100_calls_day': '$2.34'}

print("Agent:", estimate_agent_cost(steps=5))
# {'cost_per_call': '$0.0038', 'latency': '~15s', 'monthly_cost_100_calls_day': '$11.25'}
```

### 动手 5 分钟

把一个"Agent 化"的需求拆回 Workflow，看看还剩多少必须用 Agent。

1. 找一个你觉得非 Agent 不可的任务，把它的实际执行路径画成流程图。
2. 数一数：多少个节点是固定顺序？多少个是真正需要模型临场决策的？
3. 把固定部分写成代码，只在真正的分支点调用 LLM。

**验收标准**：改造后 LLM 调用次数下降，且你能指出剩下的调用中哪几次是无法用规则替代的——那才是 Agent 的真正价值区。

### 要点总结

- 90% 的"Agent"需求其实是 Workflow——步骤固定就不需要 Agent
- Agent 的隐性成本：延迟 5x、金钱 5x、不可预测性、调试难度、安全风险
- 决策树：步骤固定→Workflow，步骤动态→Agent，决策少→轻量 Agent，决策多→ReAct/Plan-Execute
- 四个反模式：Agent 做分类、Agent 做固定流程、Agent 套 Agent、用 Agent 因为"酷"
- 渐进式升级：纯代码 → 单次 LLM → RAG → Chain → 轻量 Agent → ReAct → Plan-Execute
- 升级原则：只在前一级不够用时才升级，每升级一级成本和复杂度翻倍
- **能不用 Agent 就不用 Agent**——这是工程成熟度的标志
