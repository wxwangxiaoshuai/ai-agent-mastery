## 全链路可观测性：Trace、Span、Token

L13-02 的评测是"上线前测"。但上线后呢？Agent 在生产里跑，你怎么知道某次回答为什么慢、为什么贵、为什么错？没有可观测性，生产 Agent 是黑盒——出了问题只能猜。这一节用 OpenTelemetry 思路给 Agent 接全链路 tracing，让每一步推理、每个工具调用都可追溯。

### 为什么 Agent 需要专门的可观测性

普通服务的可观测性看指标（QPS/延迟/错误率）。Agent 不一样：

```
普通服务：
  · 监控：请求耗时、错误率、CPU/内存
  · 够用：因为逻辑确定，慢了就是机器问题

Agent：
  · 单次请求内有多步：LLM调用 → 工具 → LLM → 工具 → ...
  · 每步都可能慢/贵/错，但都算在一次请求里
  · 总耗时 30s，是哪步慢？总花 2万token，是哪步花的？答错，是哪步决策错？
  · 指标级监控（总延迟）不够 → 要链路级（每步span）
```

**核心需求**：不只看"这次请求咋样"，要看**这次请求内部每一步咋样**。这是 Agent 可观测性区别于普通服务的本质。

### Trace、Span、Token 三层

可观测性的三个粒度，从粗到细：

```
Trace（链路）：一次完整的 Agent 请求
  ├─ Span 1：LLM 调用 1（决策）
  │    · input/output、耗时、token、模型
  ├─ Span 2：工具调用（search）
  │    · 工具名、参数、返回、耗时
  ├─ Span 3：LLM 调用 2（综合）
  │    · ...
  └─ Span 4：工具调用（format）
       · ...
  Trace 汇总：总耗时、总 token、总成本
```

| 粒度 | 看什么 | 定位什么问题 |
|------|--------|-------------|
| Trace | 整体请求 | 这请求总咋样（慢/贵/错） |
| Span | 每一步 | 哪步慢/哪步贵/哪步错 |
| Token | 每步的 token | 成本花在哪、上下文怎么长的 |

> 关键认知：**Span 是 Agent 可观测性的核心**。只有 Span 级，你才能定位"30 秒里 LLM 调用 5 秒、工具 20 秒、是工具慢"。指标级只告诉你"30 秒"，没用。

### 用 OpenTelemetry 接入 Agent

OpenTelemetry（OTel）是可观测性的事实标准。思路——在 Agent 的关键步骤埋 span：

```python
# pip install opentelemetry-api opentelemetry-sdk
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, BatchSpanProcessor

# 初始化 tracer
provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("agent")

# 给 Agent 每步埋 span
def llm_call(messages, model="gpt-4o-mini"):
    """带 span 的 LLM 调用"""
    with tracer.start_as_current_span("llm_call") as span:
        span.set_attribute("llm.model", model)
        span.set_attribute("llm.input_messages", len(messages))
        resp = client.chat.completions.create(model=model, messages=messages)
        span.set_attribute("llm.output_tokens", resp.usage.completion_tokens)
        span.set_attribute("llm.input_tokens", resp.usage.prompt_tokens)
        span.set_attribute("llm.latency_ms", ...)   # 实际测
        return resp

def tool_call(tool_name, args):
    """带 span 的工具调用"""
    with tracer.start_as_current_span(f"tool:{tool_name}") as span:
        span.set_attribute("tool.name", tool_name)
        span.set_attribute("tool.args", str(args))
        result = TOOL_MAP[tool_name](**args)
        span.set_attribute("tool.result_size", len(str(result)))
        return result
```

**埋 span 的要点**：
- **命名语义化**：`llm_call`、`tool:search`、`tool:execute_code`——看 span 名就懂哪步
- **记录关键属性**：模型名、token 数、工具参数、结果大小、耗时——定位问题要的数据
- **嵌套关系**：工具调用在 LLM 决策 span 内——span 嵌套天然反映 Agent Loop 结构

### Token 与成本追踪

Agent 的成本不在传统指标里——要在 span 记 token：

```python
def run_agent(question: str):
    """完整 Agent 请求，一个 Trace"""
    with tracer.start_as_current_span("agent_run") as trace_span:
        trace_span.set_attribute("agent.input", question)
        total_tokens = 0
        messages = [system, user(question)]

        for step in range(MAX_STEPS):
            resp = llm_call(messages)   # 子 span
            total_tokens += resp.usage.total_tokens

            if not resp.tool_calls:
                trace_span.set_attribute("agent.total_tokens", total_tokens)
                trace_span.set_attribute("agent.steps", step + 1)
                return resp.content

            for tc in resp.tool_calls:
                result = tool_call(tc.function.name, ...)  # 子 span
                messages.append(tool_msg(result))

        trace_span.set_attribute("agent.max_steps_reached", True)
```

**trace_span 记整体**：总 token、总步数、是否到步数上限。**子 span 记每步**。这样一次请求的"花了多少、走了几步、哪步最贵"全可查。

### 可视化调用链

光有 span 数据不够，要可视化。把 trace 导到可观测平台：

```
主流方案：
  · LangSmith / Langfuse：Agent 专用，trace 天然适配 LLM 调用
  · Arize Phoenix：开源，Agent 友好
  · Jaeger / Tempo：通用 OTel 后端，但需自己适配 LLM 语义
  · 自建：OTel collector + 自己的 UI
```

可视化后看到的调用链（概念）：

```
agent_run (总 8.5s, 3200 tokens)
 ├─ llm_call [gpt-4o-mini] 1.2s, 800 tok ✓
 ├─ tool:search 5.0s ←── 慢！外部搜索 API 拖累
 │    └─ args: "天气 北京"
 ├─ tool:fetch 0.8s ✓
 ├─ llm_call 1.0s, 1800 tok ✓
 └─ llm_call 0.5s, 600 tok ✓

一眼看出：5 秒慢在 search 工具，优化它而非换模型
```

**价值**：没有可视化，你看 span 数据是一堆 JSON，难理清。可视化把调用链画成树，**一眼定位瓶颈**——这是 trace 相比日志的最大优势。

### 定位延迟与成本瓶颈

tracing 最实用的两个场景——找慢和找贵：

```
延迟定位：
  · 总慢 → 看哪个 span 慢 → 是 LLM 慢还是工具慢
  · LLM 慢 → 换快模型 / 缩短 prompt / 流式提前返回
  · 工具慢 → 优化工具 / 加缓存 / 并行调用（L06 并行工具）
  · 多步 → 看是否冗余步（不该调的工具调了）

成本定位：
  · 总贵 → 哪个 span token 多
  · LLM 调用 token 多 → 输入长（上下文没压缩 M3）/ 输出冗长
  · 多次小调用累积 → 合并调用 / 缓存（Prompt Caching M3）
  · 工具结果太大塞进上下文 → 裁剪工具结果
```

> 黄金法则：**先 trace 定位，再优化**。别凭感觉换模型/缩 prompt——trace 告诉你瓶颈在哪，对症下药。很多"慢"不是 LLM 慢，是某个外部工具 API 慢；很多"贵"不是模型贵，是上下文没压缩、工具结果太大。

### 生产监控指标

除了 trace，生产 Agent 还要监控的指标（和传统服务叠加）：

```
质量指标（最难但最重要）：
  · 用户反馈率（赞/踩）
  · LLM-as-Judge 抽样评分（线上随机抽测）
  · 幻觉率（关键事实校验）

行为指标（Agent 特有）：
  · 平均步数（步数暴涨=可能发散）
  · 工具调用成功率
  · 工具选择准确率（选对工具占比）
  · 触发护栏次数

成本/性能指标：
  · 平均 token / 请求
  · p50/p99 延迟
  · 每请求成本
  · 错误率（429/超时/工具失败）
```

**告警**：基于这些指标设��警——p99 延迟突涨、平均步数飙升、护栏触发激增——都该触发告警人工介入。

### 与 L13-02 评测、L13-04 护栏的关系

```
评测（L13-02）：上线前 —— 静态测，质量门禁
tracing（L13-03）：运行时 —— 动态看，定位问题
护栏（L13-04）：运行时 —— 动态拦，阻止越界

三者构成 Agent 的"质量保障铁三角"：
  上线前评测把质量门，运行时 trace 看问题，运行时护栏防越界
```

> 评测告诉你"能不能上"，trace 告诉你"上线后咋样"，护栏告诉你"出格时拦住"。缺任何一个，Agent 生产化都不完整。

### 要点总结

- Agent 可观测性区别普通服务：单请求内有多步，指标级不够，要 span 级链路追溯
- 三层粒度：Trace（整体请求）、Span（每一步）、Token（每步成本）——Span 是核心
- 用 OpenTelemetry 埋 span：语义化命名、记录关键属性（模型/token/工具/耗时）、嵌套反映 Loop 结构
- trace_span 记整体（总token/步数），子 span 记每步——一次请求的花费/步数/瓶颈全可查
- 可视化调用链：LangSmith/Langfuse/Arize 把 span 画成树，一眼定位瓶颈
- 延迟/成本定位：先 trace 再优化——别凭感觉，trace 告诉你是 LLM 慢还是工具慢
- 生产监控叠加：质量指标（反馈/LLM-Judge/幻觉率）+行为指标（步数/工具成功率）+成本性能
- 与评测(L02)/护栏(L04)构成质量保障铁三角：上线前评测+运行时trace+运行时护栏
- 下一节 L13-04：护栏系统——运行时动态阻止 Agent 越界
