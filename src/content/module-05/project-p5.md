## 自主研究 Agent：ReAct 研究助手

这是你从零手写的**第一个真正的 Agent**——不依赖任何 Agent 框架（不用 LangChain、不用 CrewAI），用纯 Python 实现 ReAct 范式。它会自主决定"搜什么、读什么、怎么总结"，像一个初级研究助理。

### 项目目标

不使用任何 Agent 框架，从零实现一个能自主搜索、阅读、总结的研究 Agent：
- ReAct 循环内核（Thought → Action → Observation → ... → Final Answer）
- 可插拔的 Tool 接口（搜索、抓取、总结三个工具）
- 步数上限与发散保护（防止无限循环和重复搜索）
- 结构化研究报告输出

### 学完能做什么

- 真正理解 Agent 的内核——不是调框架，而是从零写循环
- 掌握 ReAct 范式的工程实现，包括工具接口、循环控制、失败保护
- 产出一个可运行的研究 Agent，能自主完成"调研 X 技术"这类开放任务

### 验收标准

- [ ] 输入"调研 XXX"，Agent 自主搜索 2-4 次，输出结构化研究报告
- [ ] 报告包含：概述、核心特点、应用场景、参考来源
- [ ] 不使用 LangChain / CrewAI / AutoGen 等框架
- [ ] 有步数上限保护（默认 10 步）
- [ ] 有重复检测（同一搜索词不调第二次）
- [ ] 有发散保护（偏离主题时系统提示回到主题）
- [ ] 工具接口可插拔（新增工具只需注册，不改 Agent 内核）
- [ ] API Key 通过 `.env` 管理

### 实施步骤

**Step 1：环境准备**

```bash
pip install openai python-dotenv requests beautifulsoup4
```

**Step 2：实现工具集**

```python
import json
import re
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

class ToolRegistry:
    """工具注册表"""
    def __init__(self):
        self._tools = {}

    def register(self, name, description, params, fn):
        self._tools[name] = {
            "name": name, "description": description,
            "params": params, "fn": fn,
        }

    def get(self, name):
        return self._tools.get(name)

    def list_for_prompt(self):
        lines = []
        for t in self._tools.values():
            params = json.dumps(t["params"], ensure_ascii=False)
            lines.append(f"- {t['name']}: {t['description']}（参数: {params}）")
        return "\n".join(lines)

    def list_for_api(self):
        return [{
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        k: {"type": "string", "description": v}
                        for k, v in t["params"].items()
                    },
                    "required": list(t["params"].keys()),
                },
            },
        } for t in self._tools.values()]


tools = ToolRegistry()

def _search(query: str) -> str:
    """模拟搜索（实际可接入 SerpAPI / Tavily / DuckDuckGo）"""
    # 这里用模拟数据演示。生产环境接入真实搜索 API
    mock_db = {
        "react": "ReAct (Reason+Act) 是一种让 LLM 交替推理和行动的范式，由 Yao et al. 2022 提出。核心思想：模型在每一步先生成推理过程(Thought)，再决定行动(Action)，观察结果后继续推理。",
        "mcp": "MCP (Model Context Protocol) 是 Anthropic 提出的连接 LLM 与外部工具/数据源的统一协议。采用 Client-Server 架构，提供 Tools、Resources、Prompts 三类原语。",
        "rag": "RAG (Retrieval-Augmented Generation) 通过检索外部知识来增强 LLM 的生成质量。流程：文档分块→Embedding→向量检索→上下文组装→LLM 生成。",
        "agent": "AI Agent 是能自主感知、推理、行动的系统。核心循环：感知→推理→行动→观察。主流范式包括 ReAct、Plan-and-Execute、Reflection。",
    }
    query_lower = query.lower()
    for key, val in mock_db.items():
        if key in query_lower:
            return val
    return f"搜索 '{query}' 未找到相关结果。建议换个关键词。"

def _fetch(url: str) -> str:
    """抓取网页内容"""
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        # 提取正文（去掉 script、style）
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return text[:2000]  # 截断到 2000 字
    except Exception as e:
        return f"抓取失败: {e}"

def _summarize(content: str) -> str:
    """用 LLM 总结文本"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"用 3 句话总结以下内容：\n\n{content[:1000]}"}],
        temperature=0,
        max_tokens=200,
    )
    return response.choices[0].message.content

# 通过 ToolRegistry.register 注册，不要直接改 _tools
tools.register(
    name="search",
    description="搜索互联网获取信息。输入搜索关键词，返回搜索结果摘要。",
    params={"query": "搜索关键词"},
    fn=_search,
)
tools.register(
    name="fetch",
    description="抓取指定 URL 的网页内容。输入完整 URL，返回页面文本。",
    params={"url": "要抓取的网页 URL"},
    fn=_fetch,
)
tools.register(
    name="summarize",
    description="总结长文本。输入文本内容，返回 3 句话摘要。",
    params={"content": "要总结的文本内容"},
    fn=_summarize,
)
```

**Step 3：实现 ReAct Agent 内核**

```python
class ReActAgent:
    """从零实现的 ReAct Agent"""

    def __init__(self, tools: ToolRegistry, max_steps: int = 10):
        self.tools = tools
        self.max_steps = max_steps
        self._search_history = set()  # 重复检测

        self.system_prompt = f"""你是一个自主研究助手。你可以使用以下工具来帮助回答问题：

{tools.list_for_prompt()}

使用工具的格式：
Thought: 你对下一步的思考
Action: 工具名
Action Input: {{"参数名": "参数值"}}

当你已经收集到足够信息时，使用：
Thought: 我已经收集到足够信息
Final Answer: 结构化研究报告

报告格式：
## 概述
（一句话介绍）

## 核心特点
- 特点 1
- 特点 2

## 应用场景
- 场景 1

## 参考来源
- [1] 来源描述

注意：
- 每次搜索使用不同的关键词，不要重复搜索
- 至少搜索 2 次后再给最终答案
- 不要编造信息，只基于搜索结果回答
"""

    def _parse_action_input(self, text: str) -> str | None:
        """优先提取 Action Input 后的 JSON 对象，避免贪婪匹配吞掉后续内容。"""
        json_match = re.search(r"Action Input:\s*(\{[\s\S]*?\})", text)
        if json_match:
            return json_match.group(1)
        line_match = re.search(r"Action Input:\s*(.+)", text)
        return line_match.group(1).strip() if line_match else None

    def _check_divergence(self, original_question: str, recent_thoughts: list) -> bool:
        """检查 Agent 是否偏离主题"""
        if len(recent_thoughts) < 2:
            return False
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"判断以下思考是否与原问题相关。输出 yes 或 no。\n\n"
                    f"原问题：{original_question}\n\n最近思考：{recent_thoughts[-1]}"
                ),
            }],
            temperature=0,
            max_tokens=5,
        )
        return "no" in response.choices[0].message.content.lower()

    def run(self, question: str) -> str:
        """运行 Agent"""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": question},
        ]

        for step in range(self.max_steps):
            print(f"\n{'='*40}")
            print(f"Step {step + 1}/{self.max_steps}")
            print(f"{'='*40}")

            # LLM 推理
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0,
                max_tokens=500,
            )
            text = response.choices[0].message.content
            print(f"模型输出:\n{text}")
            messages.append({"role": "assistant", "content": text})

            # 检查是否给出最终答案
            final_match = re.search(r"Final Answer:\s*(.+)", text, re.DOTALL)
            if final_match:
                return final_match.group(1).strip()

            # 发散保护：偏离主题时拉回（仅在尚未给出最终答案时）
            assistant_thoughts = [m["content"] for m in messages if m["role"] == "assistant"]
            if self._check_divergence(question, assistant_thoughts):
                messages.append({
                    "role": "user",
                    "content": "Observation: 你似乎偏离了研究主题。请回到原问题。",
                })
                continue

            # 解析行动
            action_match = re.search(r"Action:\s*(\w+)", text)
            if not action_match:
                messages.append({"role": "user", "content": "请使用 Action: 工具名 或 Final Answer: 回答。"})
                continue

            tool_name = action_match.group(1)
            tool = self.tools.get(tool_name)
            if not tool:
                available = ", ".join(self.tools._tools.keys())
                messages.append({
                    "role": "user",
                    "content": f"Observation: 错误 - 未知工具 '{tool_name}'。可用工具: {available}",
                })
                continue

            # 解析参数（优先 JSON 对象）
            raw_input = self._parse_action_input(text)
            if not raw_input:
                messages.append({"role": "user", "content": "Observation: 未找到 Action Input。请提供 JSON 格式的参数。"})
                continue

            try:
                tool_input = json.loads(raw_input)
            except json.JSONDecodeError:
                tool_input = {"query": raw_input}

            # 重复检测
            input_str = json.dumps(tool_input, ensure_ascii=False)
            if tool_name == "search" and input_str in self._search_history:
                messages.append({"role": "user", "content": "Observation: 这个搜索词已经搜过了，请换一个关键词或给出最终答案。"})
                continue
            self._search_history.add(input_str)

            # 执行工具
            try:
                result = tool["fn"](**tool_input)
            except Exception as e:
                result = f"工具执行错误: {e}"

            print(f"工具结果: {result[:200]}")
            messages.append({"role": "user", "content": f"Observation: {result}"})

        return "达到最大步数限制，未能完成研究。"
```

**Step 4：运行你的研究 Agent**

```python
if __name__ == "__main__":
    agent = ReActAgent(tools, max_steps=10)

    # 测试用例
    questions = [
        "调研 ReAct 范式是什么，有什么应用场景？",
        "调研 MCP 协议的核心架构和设计理念",
        "调研 RAG 技术的发展趋势",
    ]

    for q in questions:
        print(f"\n{'#'*60}")
        print(f"研究任务: {q}")
        print(f"{'#'*60}")

        report = agent.run(q)
        print(f"\n{'='*60}")
        print(f"研究报告:")
        print(f"{'='*60}")
        print(report)
```

**Step 5：发散保护已接入 Loop**

Step 3 的 `ReActAgent` 已包含 `_check_divergence`，并在每次模型输出后调用：若判定偏离主题，会注入纠正 Observation 并 `continue`，而不是只写在注释里。生产环境可按成本把检测频率改为「每 N 步一次」，或换成关键词/embedding 相似度等廉价启发式。

### 验收测试

```python
# tests/test_react_agent.py
import pytest
from src.agent import ReActAgent, ToolRegistry

class TestReActAgent:
    def setup_method(self):
        self.tools = ToolRegistry()
        self.tools.register(
            name="search",
            description="搜索",
            params={"query": "关键词"},
            fn=lambda query: f"搜索结果: {query}",
        )
        self.agent = ReActAgent(self.tools, max_steps=5)

    def test_agent_returns_answer(self):
        result = self.agent.run("什么是 ReAct？")
        assert isinstance(result, str)
        assert len(result) > 10

    def test_max_steps_protection(self):
        """测试步数上限保护"""
        agent = ReActAgent(self.tools, max_steps=2)
        result = agent.run("复杂问题需要很多步")
        assert "最大步数" in result or len(result) > 10

    def test_duplicate_search_detection(self):
        """测试重复搜索检测"""
        assert len(self.agent._search_history) == 0
        self.agent._search_history.add('{"query": "react"}')
        assert '{"query": "react"}' in self.agent._search_history

    def test_tool_not_found(self):
        """测试调用不存在的工具"""
        tool = self.tools.get("nonexistent")
        assert tool is None
```

### 进阶挑战

1. **接入真实搜索**：用 Tavily API 或 SerpAPI 替代模拟搜索，处理真实搜索结果
2. **并行搜索**：一次生成多个搜索查询，并行执行（参考 M06-03 并行工具调用）
3. **引用溯源**：搜索结果记录来源 URL，报告中标注
4. **多轮研究**：支持用户追问，Agent 在已有研究基础上深入
5. **Plan-Execute 模式**：加一个 Planner 模块，先规划搜索策略再执行
6. **Reflection**：研究报告生成后做一轮 Self-Refine（参考 L05-05）

### 常见问题

**Q: 为什么不用 Function Calling 代替文本解析？**
A: P5 的目的是让你理解 Agent 内核。文本解析最透明——你能看到模型每步的完整输出。理解了原理后，可以改用 Function Calling（更可靠），L05-03 有完整代码。

**Q: Agent 总是搜不到结果怎么办？**
A: 检查三个点：1) 搜索关键词是否太宽泛（"AI"）或太窄（"ReAct 论文第三章第二节"）；2) 模拟数据是否覆盖了测试关键词；3) System Prompt 是否要求"换不同关键词搜索"。

**Q: Agent 走偏了怎么办？**
A: 发散保护（Step 5）可以检测并纠正。更根本的解法是在 System Prompt 中强调"只搜索与原问题直接相关的内容"，以及设置较小的 max_steps（5-8 步通常够用）。

### 要点回顾

- 从零实现 ReAct Agent = while 循环 + LLM 推理 + 工具执行 + 观察
- 工具接口统一设计：注册表 + 可插拔
- 三个必须的保护：步数上限、重复检测、发散保护
- 文本解析方式让你看清 Agent 的完整运行过程
- 这个 Agent 是后续所有项目的基础——P7（LangGraph）、P10（深度研究）都基于这个内核

### 下一步

完成 P5 后，你已经能从零构建一个自主 Agent。P6「全能工具箱 Agent + MCP Server」会扩展 Agent 的"手"——让它能调用搜索、代码执行、数据库查询等多种工具，并把工具封装成 MCP Server 发布。
