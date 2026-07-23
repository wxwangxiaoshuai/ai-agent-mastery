## Mock LLM 与 Agent 回归测试体系

L13-07 提到单元/集成测试要 mock LLM。这一节专门讲清——**怎么 mock 一个 LLM，让"输出不确定"的 Agent 变得可测、可回归**。这是 Agent 测试工程化的核心工具，没有它，前面金字塔的"快多稳"底层根本搭不起来。

### 为什么必须 Mock LLM

先算清用真 LLM 跑测试的代价：

```
真 LLM 跑测试套件：
  · 100 个测试用例 × 每个几次 LLM 调用 = 几百次 API
  · 每次调用 1-3 秒 → 套件跑 10-30 分钟
  · 烧几百到几千 token → 每次跑测试烧钱
  · 输出不确定 → 这次过的下次可能不过（flaky）
  · 网络依赖 → 离线/CI 不稳时全挂

后果：开发者不愿意跑测试 → 测试形同虚设 → 回归没保障
```

**Mock LLM 解决**：
- 快：mock 调用毫秒级，套件几秒跑完
- 省钱：不烧 token
- 确定：同样输入永远同样输出，无 flaky
- 离线：不依赖网络

**代价**：mock 和真实 LLM 有差距，测过绿不代表真实场景都对。所以 mock 要**尽量像真的**（L13-08 后半 record-replay 解决）。

### Mock LLM 的三种形态

按"多像真的"分三档：

```
形态1：硬编码返回（最简）
  mock 对任何输入都返回预设的固定响应
  · 最快最简单
  · 适合：测固定流程（Agent 该走这几步）

形态2：按调用序号返回
  mock 按第 N 次调用返回第 N 个预设响应
  · 能测多步决策的"顺序"
  · 适合：测 Agent Loop 走对工具顺序

形态3：录制-回放（最像真）
  先用真 LLM 跑一遍录下响应，之后测试回放录制
  · 返回和真 LLM 几乎一样
  · 适合：需要真实输出形态的测试（如解析逻辑）
```

### 形态一：硬编码 Mock

最简的 mock——返回固定内容：

```python
class StubLLM:
    """硬编码返回的 mock LLM"""
    def __init__(self, response: str):
        self.response = response
        self.call_count = 0

    def chat(self, messages, **kwargs):
        self.call_count += 1
        # 返回和真实 OpenAI 响应同结构
        return MockResponse(content=self.response, tool_calls=[])

class MockResponse:
    def __init__(self, content, tool_calls):
        self.choices = [MockChoice(content, tool_calls)]
        self.usage = MockUsage()

class MockChoice:
    def __init__(self, content, tool_calls):
        self.message = type("M",(),{"content":content,"tool_calls":tool_calls or None})()

# 用法：测 Agent 不调工具直接回答
def test_agent_direct_answer():
    llm = StubLLM(response="答案是 42")
    agent = Agent(llm=llm)
    assert agent.run("意义是什么") == "答案是 42"
```

**适用**：测 Agent 的简单路径——直接回答、单步决策。**局限**：测不了多步（多步要不同返回）。

### 形态二：按调用序号 Mock

测 Agent 多步决策——每次 LLM 调用返回不同内容（模拟"第1轮决策调工具、第2轮综合"）：

```python
class SequencedMockLLM:
    """按调用序号返回不同响应"""
    def __init__(self, responses: list):
        self.responses = responses
        self.call_count = 0

    def chat(self, messages, **kwargs):
        if self.call_count >= len(self.responses):
            raise RuntimeError(f"mock 响应不够：第{self.call_count}次调用")
        resp = self.responses[self.call_count]
        self.call_count += 1
        return resp   # 每个 resp 是 MockResponse

# 用法：测 Agent 多步走对顺序
def test_agent_search_then_summarize():
    llm = SequencedMockLLM(responses=[
        MockResponse(content="", tool_calls=[   # 第1次：决策调 search
            MockToolCall("search", {"q": "weather"})]),
        MockResponse(content="天气摘要", tool_calls=[]),  # 第2次：输出
    ])
    agent = Agent(llm=llm, tools=[mock_search])
    result = agent.run("查天气并总结")
    assert result == "天气摘要"
    assert llm.call_count == 2   # 验证调了 2 次 LLM（不多不少）
```

**价值**：能断言 Agent 的**多步轨迹**——调了对的工具、顺序对、步数对。这是测 Agent Loop 行为的核心。**如果改了 prompt 导致 Agent 多走一步少走一步，立刻暴露**。

### 形态三：录制-回放

最像真的——先录真 LLM 响应，测试时回放：

```python
import json, os

class RecordReplayLLM:
    """录制-回放 LLM"""
    def __init__(self, mode="replay", fixture_dir="tests/fixtures/llm"):
        self.mode = mode   # "record" 或 "replay"
        self.fixture_dir = fixture_dir
        self.calls = []

    def chat(self, messages, **kwargs):
        key = self._make_key(messages, kwargs)
        fixture = os.path.join(self.fixture_dir, f"{key}.json")

        if self.mode == "record":
            # 用真 LLM 调，存响应
            resp = real_llm.chat(messages, **kwargs)
            with open(fixture, "w") as f:
                json.dump({"content": resp.choices[0].message.content,
                           "tool_calls": ...}, f)
            return resp
        else:   # replay
            with open(fixture) as f:
                data = json.load(f)
            return MockResponse(data["content"], data["tool_calls"])

    def _make_key(self, messages, kwargs):
        # 用 messages 内容生成固定 key（hash）
        # 注意：真实测试要处理 messages 的微小变化（如时间戳）
        import hashlib
        return hashlib.md5(str(messages).encode()).hexdigest()[:16]
```

**工作流**：

```python
# 1. 录制阶段（偶尔跑，用真 LLM）
@pytest.mark.record
def test_record():
    llm = RecordReplayLLM(mode="record")
    agent = Agent(llm=llm)
    agent.run("测试问题")   # 真 LLM 调用，响应存盘

# 2. 回放阶段（日常跑）
def test_replay():
    llm = RecordReplayLLM(mode="replay")   # 不调真 LLM
    agent = Agent(llm=llm)
    result = agent.run("测试问题")   # 回放录的响应
    assert "预期内容" in result
```

**record-replay 的价值**：
- **像真**：回放的是真 LLM 的真实输出形态，测解析/处理逻辑最准
- **快省**：日常回放不调真 LLM
- **可重放**：录一次，CI 无限次回放

**注意**：录制要定期重录——模型版本变了，旧录制可能不反映新行为。把"重录录制"纳入模型升级流程。

### 用 Mock 测 Agent 轨迹

把形态二用起来，测 Agent 真正的行为——轨迹对不对：

```python
def test_agent_trajectory():
    """测 Agent 轨迹：选对工具、走对顺序、正确终止"""
    llm = SequencedMockLLM([
        MockResponse(tool_calls=[MockToolCall("search", {"q":"X"})]),  # 调 search
        MockResponse(tool_calls=[MockToolCall("fetch", {"url":"y"})]),# 调 fetch
        MockResponse(content="综合答案", tool_calls=[]),               # 输出
    ])
    agent = Agent(llm=llm, tools=[mock_search, mock_fetch])

    result = agent.run("调研 X")

    # 断言轨迹
    assert result == "综合答案"
    assert llm.call_count == 3               # 走了 3 步
    assert mock_search.called_with({"q":"X"})  # search 被对参数调用
    assert mock_fetch.called                   # fetch 也被调
    # 测终止：第3步无 tool_calls，Agent 应停（不继续调 LLM）
```

> 这是 Mock LLM 最有价值的用法——**测"Agent 的行为模式"而非"输出文本"**。轨迹对了，Agent 的"流程"就稳了；输出文本质量靠 E2E+LLM-Judge（L13-01/07）。

### 搭持续回归流水线

把 Mock 测试 + 真测试分层集成进 CI：

```yaml
# .github/workflows/test.yml
jobs:
  unit:   # 每次 push，秒级
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/unit/ --cov --cov-fail-under=80
  integration:   # 每次 PR，秒级（全 mock）
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/integration/   # 全用 Mock/Replay LLM
  e2e:   # nightly，慢
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/e2e/   # 真 LLM，只在夜间
```

**分层的关键**：
- **单元/集成用 mock/replay**——秒级、不烧 token、每次都跑
- **E2E 用真 LLM**——慢、贵，nightly 跑
- **回归保障**：日常靠 mock 套件拦住"流程回归"（Agent 多走/少走步、调错工具），nightly 真测拦住"质量回归"

### Mock 的边界：别 mock 太假

```
Mock 太假的风险：
  · mock 返回结构真实 LLM 不会产生 → 测过绿但真实解析崩
  · mock 只测 happy path → 边界回归
  · mock 不随模型版本变 → 模型升级后 mock 失效但测试还绿（假象）

对策：
  · mock 用真实录制的形态（record-replay）
  · mock 覆盖边界：空返回、错误、超长、格式异常
  · 模型升级时重录 fixture，别用旧 mock 跑新模型
  · 定期用真 LLM 跑一遍对照 mock 结果，看差距
```

> 最后清醒认知：**Mock 让测试快而稳，但 mock 本身要像真**。过假的 mock 给虚假的安全感——测试全绿但线上崩。record-replay + 定期重录 + 边界覆盖，让 mock 既快又可信。

### 要点总结

- 必须 Mock LLM：真 LLM 跑测试慢贵不稳 flaky → mock 让快省确定离线
- Mock 三形态：硬编码（最简，测单步）、按序号（测多步轨迹）、录制-回放（最像真，测解析）
- 硬编码 Mock：返回固定内容，测简单路径
- 按序号 Mock：第N次调用返回第N响应，能断言多步走对工具顺序——测 Agent Loop 行为核心
- record-replay：先录真 LLM 响应再回放，像真+快省+可重放；定期重录防模型升级后失效
- Mock 最有价值用法：测"Agent 行为模式"（轨迹对不对）而非"输出文本"——流程稳靠它，文本质量靠E2E+Judge
- CI 分层：单元/集成用mock秒级每次跑、E2E真LLM nightly；日常拦流程回归、夜间拦质量回归
- Mock 边界：别 mock 太假——用真实录制形态、覆盖边界、模型升级重录、定期真 LLM 对照
- M13 收官：评估(L01-02)+可观测(L03)+护栏(L04)+安全(L05-06)+测试(L07-08)构成生产质量保障体系；P13 综合落地
