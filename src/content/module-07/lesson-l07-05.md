## 优雅降级与 Fallback 链

重试、熔断、限流都是在"同一服务内"做弹性。但当一个服务彻底不可用时（比如 OpenAI API 大面积宕机），你需要切换到**备用方案**——这就是降级。最好的故障处理是**用户完全感知不到故障发生了**。

### 降级 vs 重试 vs 熔断

```
重试：同一个服务，等一会儿再试
熔断：同一个服务，失败太多就暂停调用
降级：换一个服务/模型/方案，不调用原来的了
```

| 机制 | 适用场景 | 恢复方式 |
|------|----------|----------|
| 重试 | 暂时性故障（429、网络抖动） | 自动恢复 |
| 熔断 | 连续失败（服务端不稳定） | 冷却后自动试探 |
| 降级 | 服务完全不可用 | 手动切换或自动 Fallback |

### 三层降级链

```
Layer 1: 模型降级（Opus → Sonnet → Haiku → 本地模型）
  ↓ 全部不可用
Layer 2: 工具降级（主工具 → 备用工具 → 静态答案）
  ↓ 全部不可用
Layer 3: 静态兜底（预设回复 + 人工转接）
```

### Layer 1：模型降级链

```python
class ModelFallbackChain:
    """模型降级链：主模型 → 备用模型 → 轻量模型"""

    def __init__(self):
        self.chain = [
            {"model": "claude-sonnet-4-20250514", "timeout": 30, "label": "主力模型"},
            {"model": "gpt-4o", "timeout": 30, "label": "备用模型"},
            {"model": "gpt-4o-mini", "timeout": 15, "label": "轻量模型"},
            {"model": "local-fallback", "timeout": 5, "label": "本地兜底"},
        ]

    def call(self, messages: list, tools: list = None) -> tuple[str, bool]:
        """按降级链依次尝试。返回 (内容, degraded)：degraded=True 表示已落到静态兜底。"""
        for i, config in enumerate(self.chain):
            try:
                if config["model"] == "local-fallback":
                    return self._static_fallback(messages), True

                response = client.chat.completions.create(
                    model=config["model"],
                    messages=messages,
                    tools=tools,
                    timeout=config["timeout"],
                    temperature=0,
                )
                if i > 0:
                    print(f"[降级] 使用 {config['label']} 成功（第 {i+1} 个）")
                return response.choices[0].message.content, False

            except Exception as e:
                print(f"[降级] {config['label']} 失败: {e}")
                continue

        return self._static_fallback(messages), True

    def _static_fallback(self, messages: list) -> str:
        """最后的静态兜底"""
        return ("抱歉，AI 服务暂时不可用。"
                "您的请求已记录，系统恢复后会自动处理。"
                "紧急问题请联系人工客服。")
```

### Layer 2：工具降级链

```python
class ToolFallbackChain:
    """工具降级链：主工具 → 备用工具 → 静态答案"""

    def __init__(self):
        self.chains = {
            "search": [
                {"fn": self._search_tavily, "label": "Tavily API"},
                {"fn": self._search_serpapi, "label": "SerpAPI"},
                {"fn": self._search_cache, "label": "缓存搜索"},
                {"fn": self._search_static, "label": "静态回复"},
            ],
            "weather": [
                {"fn": self._weather_primary, "label": "天气 API"},
                {"fn": self._weather_backup, "label": "备用天气 API"},
                {"fn": self._weather_static, "label": "静态回复"},
            ],
        }

    def execute(self, tool_name: str, **kwargs) -> str:
        """执行工具，按降级链依次尝试"""
        chain = self.chains.get(tool_name, [])
        for i, config in enumerate(chain):
            try:
                result = config["fn"](**kwargs)
                if i > 0:
                    print(f"[工具降级] {tool_name}: 使用 {config['label']}（第 {i+1} 个）")
                return result
            except Exception as e:
                print(f"[工具降级] {config['label']} 失败: {e}")
                continue

        return f"工具 '{tool_name}' 暂时不可用，请稍后重试。"

    # 具体工具实现（示例）
    def _search_tavily(self, query): ...
    def _search_serpapi(self, query): ...

    def _search_cache(self, query):
        """从缓存中搜索（降级：可能不是最新数据）"""
        return f"[缓存] 关于 '{query}' 的历史搜索结果（可能不是最新）"

    def _search_static(self, query):
        """静态回复（最后的兜底）"""
        return f"搜索服务暂时不可用。建议直接访问 https://www.google.com/search?q={query}"

    def _weather_primary(self, city): ...
    def _weather_backup(self, city): ...

    def _weather_static(self, city):
        """静态天气回复"""
        return f"天气服务暂时不可用。建议查看天气预报应用获取 {city} 的实时天气。"
```

### Layer 3：静态兜底

当模型和工具全部不可用时，最后的防线：

```python
class StaticFallback:
    """静态兜底：预设回复 + 人工转接"""

    RESPONSES = {
        "default": (
            "抱歉，AI 服务暂时不可用。\n"
            "您的问题已记录，以下是可选方案：\n"
            "1. 稍后重试（通常 1-2 分钟恢复）\n"
            "2. 联系人工客服：support@example.com\n"
            "3. 查看常见问题：https://help.example.com"
        ),
        "search_unavailable": (
            "搜索服务暂时不可用。\n"
            "建议直接访问：\n"
            "- Google: https://google.com\n"
            "- 百度: https://baidu.com"
        ),
        "code_execution_unavailable": (
            "代码执行服务暂时不可用。\n"
            "建议使用在线 IDE：\n"
            "- Replit: https://replit.com\n"
            "- Google Colab: https://colab.research.google.com"
        ),
    }

    @classmethod
    def get(cls, scenario: str = "default") -> str:
        return cls.RESPONSES.get(scenario, cls.RESPONSES["default"])
```

### 组装完整的降级系统

```python
class ResilientAgent:
    """带完整降级链的 Agent"""

    def __init__(self):
        self.model_chain = ModelFallbackChain()
        self.tool_chain = ToolFallbackChain()
        self.llm_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

    def run(self, question: str) -> str:
        messages = [{"role": "user", "content": question}]

        try:
            # 检查熔断状态
            if not self.llm_breaker.can_execute():
                return StaticFallback.get("default")

            # 使用模型降级链调用 LLM
            response, degraded = self.model_chain.call(messages)
            if degraded:
                # 全模型失败落到静态兜底：记失败，便于熔断统计
                self.llm_breaker.record_failure()
            else:
                self.llm_breaker.record_success()

            # 如果 LLM 需要调工具，使用工具降级链
            if not degraded and "需要搜索" in response:
                search_result = self.tool_chain.execute("search", query=question)
                messages.append({"role": "assistant", "content": response})
                messages.append({"role": "user", "content": f"搜索结果: {search_result}"})
                response, degraded = self.model_chain.call(messages)
                if degraded:
                    self.llm_breaker.record_failure()

            return response

        except Exception as e:
            self.llm_breaker.record_failure()
            return StaticFallback.get("default")
```

### 降级的工程原则

1. **核心路径尽量无感，有损降级需透明**——能自动切备用服务时用户可无感；落到静态兜底或能力明显变弱时，应告知「可能不够好」
2. **降级要可观测**——每次降级都要记录日志和告警，不能"静默降级"
3. **降级链不要太长**——3-4 层足够，太多层增加复杂度且最后一层差别不大
4. **静态兜底永远要有**——即使所有服务都挂了，用户也要收到一个友好回复
5. **降级后要自动恢复**——当主服务恢复时，自动切回主方案

### 要点总结

- 降级 = 换方案，重试 = 等一等，熔断 = 停一下——三者互补
- 三层降级链：模型降级（示例：Sonnet→GPT-4o→mini→静态；可按实际换成 Opus→Sonnet→Haiku→本地）→ 工具降级（主→备→缓存→静态）→ 静态兜底
- 核心路径可无感降级；有损/静态兜底要让用户感知并记录可观测指标
- 降级是有损的——备用方案一定弱于主方案
- 静态兜底永远要有——所有服务挂了也要给用户一个友好回复
- 降级后自动恢复——主服务恢复后切回主方案，不要"永久降级"
