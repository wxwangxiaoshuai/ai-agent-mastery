## 模型选型框架

选模型不能只看 benchmark 分数。你需要从四个维度综合评估：

| 维度 | 关键问题 | 典型指标 |
|------|----------|----------|
| 能力 | 模型能完成我的任务吗？ | 准确率、推理能力、工具调用 |
| 成本 | 用得起吗？ | 每百万 token 价格 |
| 延迟 | 用户能等吗？ | 首 token 时间、总生成时间 |
| 隐私 | 数据能交给它吗？ | 是否支持私有部署、数据协议 |

> **注意**：AI 模型迭代极快，以下具体模型名称、价格和性能数据仅供参考。请始终以各厂商官方文档为准，建议在选型时查阅最新信息。

### 主流模型速览（参考）

| 模型 | 厂商 | 特点 | 推荐场景 |
|------|------|------|----------|
| Claude Opus 系列 | Anthropic | 最强推理，200K 窗口 | 复杂 Agent、长文档分析 |
| Claude Sonnet 系列 | Anthropic | 性价比最优，200K 窗口 | 日常 Agent 主力 |
| GPT-4o | OpenAI | 多模态，生态成熟 | 需要图像理解的任务 |
| GPT-4o-mini | OpenAI | 极低成本，速度快 | 简单任务、分类、路由 |
| Gemini 系列 | Google | 超长上下文窗口 | 超长文档处理 |
| DeepSeek | 深度求索 | 开源，性价比高 | 中文场景、私有部署 |
| Qwen | 阿里 | 开源，中文优化 | 中文场景、私有部署 |
| Llama 系列 | Meta | 开源生态最大 | 私有部署、微调 |

### 如何评估模型能力

不要只看 benchmark 分数（MMLU、HumanEval 等），它们与真实任务的表现常有偏差。务实的评估方法：

**1. 构建你的专属评测集**

准备 20-50 个代表你真实业务的输入-期望输出对，用不同模型跑一遍，人工评分。

```python
eval_cases = [
    {"input": "帮我分析这段代码的复杂度", "expected": "输出时间/空间复杂度 + 优化建议"},
    {"input": "从这段文本中提取人名和公司", "expected": "JSON 格式的人名+公司列表"},
    # ... 更多用例
]

def evaluate_model(model_name: str, cases: list) -> float:
    scores = []
    for case in cases:
        response = call_llm(model_name, case["input"])
        score = human_or_llm_judge(response, case["expected"])  # 0-1 评分
        scores.append(score)
    return sum(scores) / len(scores)
```

**2. 关注能力维度而非总分**

不同模型在不同维度上强弱不同：
- **工具调用**：Claude 和 GPT-4o 表现最好
- **长文档理解**：Gemini（1M 窗口）和 Claude（200K）领先
- **中文理解**：DeepSeek、Qwen 在中文场景有优势
- **代码生成**：Claude Sonnet/Opus 和 GPT-4o 是第一梯队
- **指令遵循**：看模型是否能严格按 System Prompt 行事

**3. 延迟实测**

| 模型级别 | 首 token 延迟（典型值） | 适用场景 |
|----------|------------------------|----------|
| 轻量模型（mini/haiku） | 0.3-0.8s | 实时交互、分类、路由 |
| 主力模型（sonnet/4o） | 0.8-2.0s | 常规对话、文档问答 |
| 旗舰模型（opus/pro） | 2.0-5.0s+ | 复杂推理、深度分析 |

> 延迟受网络、请求量、输出长度影响很大，上表仅为数量级参考。生产环境务必自己做基准测试。

### 成本估算实战

Token 计费公式：

```
总成本 = (输入 token 数 × 输入单价) + (输出 token 数 × 输出单价)
```

**示例：一个日常 Agent 的月度成本估算**

假设你的 Agent 每天处理 100 次对话，每次平均：
- 输入 2000 tokens（系统提示词 + 对话历史 + 工具结果）
- 输出 500 tokens（模型回复 + 工具调用）

```
每日 token 消耗：
  输入: 100 × 2000 = 200,000 tokens
  输出: 100 × 500 = 50,000 tokens

月消耗（30天）：
  输入: 6,000,000 tokens
  输出: 1,500,000 tokens

使用主力模型（$3/M 输入，$15/M 输出）：
  = (6 × $3) + (1.5 × $15)
  = $18 + $22.5
  = $40.5/月
```

> 这只是模型调用成本。实际 Agent 还要加上搜索 API、数据库、服务器等成本。

**Prompt Caching 降本**：Anthropic 和 OpenAI 都支持 Prompt Caching——对重复的 System Prompt 和长上下文部分按缓存价计费（通常是正常输入价格的 10-25%）。Agent 场景中 System Prompt 几乎不变，缓存可显著降本。详见 M03-05。

### 模型路由（Model Routing）

不要把所有请求都发给同一个模型。一个简单的路由策略：

```
if 任务 == "简单分类 / 关键词提取 / 格式校验":
    → 轻量模型（成本最低）
elif 任务 == "常规对话 / 文档问答":
    → 主力模型（性价比最优）
elif 任务 == "复杂推理 / 多步骤 Agent / 长文档分析":
    → 旗舰模型（能力最强）
```

**方式一：规则路由**（简单高效）

```python
def route_task(user_input: str) -> str:
    """简单路由：根据关键词和复杂度选择模型"""
    if len(user_input) < 50 and not any(kw in user_input for kw in ["分析", "总结", "推理"]):
        return "gpt-4o-mini"
    elif any(kw in user_input for kw in ["代码", "debug", "架构", "设计"]):
        return "claude-opus-5"
    return "claude-sonnet-5"
```

**方式二：LLM 路由**（更智能，但有额外成本）

用一个轻量模型先判断任务复杂度，再路由到合适的模型：

```python
def smart_route(user_input: str) -> str:
    """用轻量模型做任务分类"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # 用最便宜的模型做分类
        messages=[
            {"role": "system", "content": "判断用户输入的任务复杂度。只输出 simple/standard/complex。"},
            {"role": "user", "content": user_input},
        ],
        temperature=0,
        max_tokens=10,
    )
    level = response.choices[0].message.content.strip()
    return {"simple": "gpt-4o-mini", "standard": "claude-sonnet-5", "complex": "claude-opus-5"}.get(level, "claude-sonnet-5")
```

> **工程权衡**：LLM 路由更准确，但每次请求多一次轻量模型调用（增加延迟和成本）。规则路由零额外成本但不够灵活。建议从规则路由开始，随着场景复杂化再升级为 LLM 路由。

### 模型版本管理

模型会持续更新。生产环境需要注意**别名**与**快照 ID**的区别：
- 别名（如 `claude-sonnet-5`、`gpt-4o`）：始终指向该系列当前默认版本，方便试用，但可能被厂商无声升级
- 快照 ID（如 `gpt-4o-2024-08-06`、`claude-sonnet-4-20250514`）：钉死具体版本，行为更稳定

**版本固定**：生产环境建议固定到快照 ID，避免厂商更新模型后行为变化导致线上故障。

```python
# 不推荐：使用别名，模型可能在某天被无声升级
model = "gpt-4o"

# 推荐：固定到具体版本（以官方支持的版本号为准）
model = "gpt-4o-2024-08-06"
```

**版本迁移**：当需要升级模型版本时：
1. 在评测集上对比新旧版本的输出
2. 灰度发布：先切 5% 流量到新版本
3. 监控关键指标（成功率、延迟、用户反馈）
4. 确认无回归后逐步全量切换

### 选型决策树

```
开始
├─ 需要看图片？ → GPT-4o / Gemini / Claude
├─ 超长文档（>100K tokens）？ → Gemini / Claude（200K）
├─ 中文场景为主？ → DeepSeek / Qwen / Claude
├─ 需要私有部署？ → DeepSeek / Qwen / Llama
├─ 预算有限？ → GPT-4o-mini / DeepSeek
├─ 复杂 Agent 推理？ → Claude Opus 系列
└─ 默认选择 → Claude Sonnet 系列（性价比最优）
```

### 要点总结

- 选型从能力、成本、延迟、隐私四个维度评估，不要只看 benchmark
- 务实评估方法：构建专属评测集 + 分维度评估 + 延迟实测
- 成本估算要算"输入+输出"的总 token 消耗，Prompt Caching 可显著降本
- 模型路由是降本增效的关键手段——从规则路由开始，需要时升级为 LLM 路由
- 生产环境固定模型版本号，迁移时灰度发布 + 评测对比
- 默认选主力模型（如 Claude Sonnet），需要时升级到旗舰或降级到轻量模型
- 关注开源模型进展，它们在某些场景下性价比极高