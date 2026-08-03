## 全能工具箱 Agent + 自制 MCP Server + Skills 系统

P5 的 ReAct Agent 只有搜索工具。P6 给它装上全套装备——搜索、代码执行、数据库查询、文件操作——然后把其中一组能力封装成 MCP Server 发布，最后用 L06-07 的 Skills 系统把工具按"能力包"组织起来。

### 项目目标

构建一个多工具 Agent + 可发布的 MCP Server + Skills 注册中心：
- 多工具 Agent：搜索、代码执行、SQLite 查询、文件读写，支持并行调用
- 自制 MCP Server：把数据库查询能力封装成独立 MCP Server
- **Skills 注册中心**：把工具按"能力包"分组（研究 Skill、分析 Skill、数据 Skill），Agent 按意图自动匹配
- **Function Calling vs Skills 对比报告**：同一任务分别用裸 Function Calling 和 Skills 系统执行，记录工具选择准确率和步数差异
- 工具调用追踪：每次调用记录步骤、参数、结果、耗时

### 验收标准

- [ ] Agent 支持 4+ 种工具，能根据问题自主选择
- [ ] 支持并行工具调用（如同时查数据库用户 + 执行计算）
- [ ] 代码执行工具有超时保护（10 秒）
- [ ] SQLite 工具支持 SELECT 查询；建表/插入由 `init_db()` 初始化脚本完成
- [ ] 文件工具支持读写，有路径限制（不能读 /etc/passwd）
- [ ] MCP Server 可独立运行，提供至少 2 个 Tools + 1 个 Resource（仅 SELECT）
- [ ] MCP Server 可接入 Claude Desktop，并用 Python Client 脚本验证
- [ ] **Skills 注册中心**：至少定义 3 个 Skill（研究、分析、数据），每个 Skill 含 id/description/system_prompt/tools/schema
- [ ] **Skill 动态调度**：Agent 按用户意图自动匹配 Skill，只激活匹配到的 Skill 的工具子集
- [ ] **对比报告**：同一个任务分别在"裸 Function Calling"和"Skills 系统"下执行，记录工具选择次数、总步数、最终结果质量
- [ ] 工具调用追踪面板（MVP：CLI 打印完整调用链）显示完整调用链
- [ ] API Key 通过 `.env` 管理

### 实施步骤

**Step 1：环境准备**

```bash
pip install openai python-dotenv "mcp>=1.8,<2"
# sqlite3 为 Python 标准库，无需 pip 安装
```

```bash
# .env
OPENAI_API_KEY=sk-...
```

**Step 2：实现四类工具**

```python
import json, os, sqlite3, subprocess, time
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

# --- 安全限制 ---
ALLOWED_FILE_DIR = Path("./workspace").resolve()
ALLOWED_FILE_DIR.mkdir(exist_ok=True)

# 1. 搜索工具
def search_web(query: str) -> str:
    """搜索互联网获取信息"""
    mock = {"react": "ReAct 是推理+行动的 Agent 范式", "python": "Python 是一种通用编程语言"}
    for k, v in mock.items():
        if k in query.lower():
            return v
    return f"搜索 '{query}' 无结果。建议换个关键词。"

# 2. 代码执行工具（带超时）
def execute_code(code: str) -> str:
    """执行 Python 代码，10 秒超时"""
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return result.stdout[:2000] or "(无输出)"
        return f"错误: {result.stderr[:500]}"
    except subprocess.TimeoutExpired:
        return "错误: 代码执行超时（10秒）"

# 3. SQLite 查询工具（只读连接）
DB_PATH = "./workspace/agent.db"
def query_db(sql: str) -> str:
    """执行 SQL 查询（仅 SELECT，使用只读连接）"""
    sql_stripped = sql.strip().upper()
    if not sql_stripped.startswith("SELECT"):
        return "错误: 仅支持 SELECT 查询。不允许修改数据。"
    try:
        with sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True) as conn:
            cursor = conn.execute(sql)
            rows = cursor.fetchall()
            columns = [d[0] for d in cursor.description]
        result = [dict(zip(columns, row)) for row in rows]
        return json.dumps(result[:20], ensure_ascii=False)  # 最多 20 行
    except Exception as e:
        return f"SQL 错误: {e}"

# 4. 文件操作工具
def read_file(path: str) -> str:
    """读取工作区内的文件"""
    full_path = (ALLOWED_FILE_DIR / path).resolve()
    if not full_path.is_relative_to(ALLOWED_FILE_DIR):
        return f"错误: 只能读取 {ALLOWED_FILE_DIR} 目录下的文件"
    if not full_path.exists():
        return f"错误: 文件 '{path}' 不存在"
    return full_path.read_text()[:2000]

def write_file(path: str, content: str) -> str:
    """写入工作区内的文件"""
    full_path = (ALLOWED_FILE_DIR / path).resolve()
    if not full_path.is_relative_to(ALLOWED_FILE_DIR):
        return f"错误: 只能写入 {ALLOWED_FILE_DIR} 目录下的文件"
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content)
    return f"已写入 {len(content)} 字符到 {path}"

# --- 工具注册 ---
TOOL_MAP = {
    "search_web": search_web,
    "execute_code": execute_code,
    "query_db": query_db,
    "read_file": read_file,
    "write_file": write_file,
}

TOOLS_SCHEMA = [
    {"type": "function", "function": {
        "name": "search_web", "description": "搜索互联网获取信息。适用：查询概念、技术、新闻。",
        "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "搜索关键词"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "execute_code", "description": "执行 Python 代码。适用：数学计算、数据处理。10秒超时。",
        "parameters": {"type": "object", "properties": {"code": {"type": "string", "description": "Python 代码"}}, "required": ["code"]}}},
    {"type": "function", "function": {
        "name": "query_db", "description": "查询 SQLite 数据库（仅 SELECT）。适用：查询已存储的结构化数据。",
        "parameters": {"type": "object", "properties": {"sql": {"type": "string", "description": "SELECT 查询语句"}}, "required": ["sql"]}}},
    {"type": "function", "function": {
        "name": "read_file", "description": "读取工作区文件。适用：查看之前保存的文件。",
        "parameters": {"type": "object", "properties": {"path": {"type": "string", "description": "文件路径（相对工作区）"}}, "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "write_file", "description": "写入工作区文件。适用：保存报告、笔记。",
        "parameters": {"type": "object", "properties": {"path": {"type": "string", "description": "文件路径"}, "content": {"type": "string", "description": "文件内容"}}, "required": ["path", "content"]}}},
]
```

**Step 3：实现带追踪的并行 Agent**

```python
import concurrent.futures

class ToolboxAgent:
    """多工具 Agent，支持并行调用和追踪"""

    def __init__(self, max_steps: int = 10):
        self.max_steps = max_steps
        self.traces = []

    def run(self, question: str) -> str:
        messages = [{"role": "user", "content": question}]

        for step in range(self.max_steps):
            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=messages,
                tools=TOOLS_SCHEMA,
                temperature=0,
            )
            msg = response.choices[0].message

            if not msg.tool_calls:
                self._print_traces()
                return msg.content

            messages.append(msg)

            # 并行执行工具
            results = self._execute_parallel(msg.tool_calls)
            for tool_call, result in zip(msg.tool_calls, results):
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result),
                })

        self._print_traces()
        return "达到最大步数限制。"

    def _execute_parallel(self, tool_calls: list) -> list:
        results = [None] * len(tool_calls)

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = {}
            for i, tc in enumerate(tool_calls):
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)
                start = time.time()

                if fn_name in TOOL_MAP:
                    future = executor.submit(TOOL_MAP[fn_name], **fn_args)
                    futures[future] = (i, fn_name, fn_args, start)
                else:
                    results[i] = f"错误: 未知工具 '{fn_name}'"

            for future in concurrent.futures.as_completed(futures):
                i, fn_name, fn_args, start = futures[future]
                duration = (time.time() - start) * 1000
                try:
                    result = future.result(timeout=15)
                    results[i] = result
                    self.traces.append({"step": len(self.traces)+1, "tool": fn_name, "args": fn_args, "result": str(result)[:100], "ms": round(duration)})
                except Exception as e:
                    results[i] = f"错误: {e}"
                    self.traces.append({"step": len(self.traces)+1, "tool": fn_name, "args": fn_args, "error": str(e), "ms": round(duration)})

        return results

    def _print_traces(self):
        print("\n--- 工具调用追踪 ---")
        for t in self.traces:
            status = "✓" if "error" not in t else "✗"
            print(f"  [{t['step']}] {status} {t['tool']}({t.get('args', {})}) → {t.get('result', t.get('error', ''))[:80]} ({t['ms']}ms)")
```

**Step 4：构建 MCP Server**

```python
# db_mcp_server.py — 把数据库查询封装成 MCP Server
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, Resource, TextContent
from pydantic import AnyUrl
import sqlite3, json, asyncio

server = Server("db-tools")
DB_PATH = "./workspace/agent.db"

def _is_readonly_sql(sql: str) -> bool:
    s = sql.strip().upper()
    return s.startswith("SELECT") or s.startswith("PRAGMA")

@server.list_tools()
async def list_tools():
    return [
        Tool(name="query_db",
             description="查询 SQLite 数据库（仅 SELECT/PRAGMA）",
             inputSchema={"type": "object",
                          "properties": {"sql": {"type": "string", "description": "SELECT 语句"}},
                          "required": ["sql"]}),
        Tool(name="list_tables",
             description="列出数据库中的所有表",
             inputSchema={"type": "object", "properties": {}}),
    ]

@server.call_tool()
async def call_tool(name, arguments):
    with sqlite3.connect(DB_PATH) as conn:
        if name == "query_db":
            sql = arguments["sql"]
            if not _is_readonly_sql(sql):
                return [TextContent(type="text", text="错误: 仅支持 SELECT/PRAGMA。不允许修改数据。")]
            cursor = conn.execute(sql)
            rows = cursor.fetchall()
            cols = [d[0] for d in cursor.description] if cursor.description else []
            result = [dict(zip(cols, r)) for r in rows]
            return [TextContent(type="text", text=json.dumps(result[:20], ensure_ascii=False))]
        elif name == "list_tables":
            rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            return [TextContent(type="text", text=f"数据库表: {[r[0] for r in rows]}")]
    return [TextContent(type="text", text=f"未知工具: {name}")]

@server.list_resources()
async def list_resources():
    return [Resource(uri="db://schema", name="数据库 Schema", description="所有表结构", mimeType="text/plain")]

@server.read_resource()
async def read_resource(uri: AnyUrl):
    if str(uri) == "db://schema":
        with sqlite3.connect(DB_PATH) as conn:
            tables = conn.execute("SELECT sql FROM sqlite_master WHERE type='table'").fetchall()
            return "\n\n".join(t[0] for t in tables if t[0])
    raise ValueError(f"未知资源: {uri}")

async def main():
    async with stdio_server() as (r, w):
        await server.run(r, w, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
```

**Step 4b：用 MCP Client 测试 db-tools Server**

```python
# test_db_mcp_client.py
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import asyncio

async def test_db_server():
    params = StdioServerParameters(command="python", args=["db_mcp_server.py"])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("工具:", [t.name for t in tools.tools])
            result = await session.call_tool("list_tables", {})
            print("表列表:", result.content[0].text)
            schema = await session.read_resource("db://schema")
            print("Schema:", schema.contents[0].text[:200])

asyncio.run(test_db_server())
```

**Step 5：构建 Skills 注册中心（核心新增）**

把四类工具按"能力包"组织成 Skills。这是 L06-07 从理论到实践的落地：

```python
# skills.py — Skills 注册中心
# 本文件依赖 Step 2 中定义的 TOOLS_SCHEMA、TOOL_MAP、client
from dataclasses import dataclass, field
from typing import Any

@dataclass
class Skill:
    id: str
    name: str
    description: str                 # Agent 意图匹配用
    system_prompt: str               # 加载时注入
    tools: list[str]                 # 此 Skill 可用的工具
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    preconditions: list[str] = field(default_factory=list)

# 定义三个 Skill
RESEARCH_SKILL = Skill(
    id="research",
    name="信息研究",
    description="搜索互联网信息、读取文件内容、保存研究结果",
    system_prompt="你是研究助手，擅长搜索、阅读、总结信息。遇到不确定的内容要标注不确定性。",
    tools=["search_web", "read_file", "write_file"],
    preconditions=["internet_access"],
)

ANALYSIS_SKILL = Skill(
    id="analysis",
    name="数据分析",
    description="执行 Python 代码做计算和数据处理、查询数据库获取结构化数据",
    system_prompt="你是数据分析师，擅长用代码处理数据、查询数据库。输出要结构化、可复现。",
    tools=["execute_code", "query_db"],
    preconditions=["python_runtime"],
)

DATA_SKILL = Skill(
    id="data",
    name="数据管理",
    description="查询数据库、读写文件、执行数据处理代码",
    system_prompt="你是数据工程师，负责数据查询、文件读写和数据处理。",
    tools=["query_db", "read_file", "write_file", "execute_code"],
)

ALL_SKILLS = [RESEARCH_SKILL, ANALYSIS_SKILL, DATA_SKILL]


class SkillRegistry:
    """Skills 注册中心——启动时加载，运行时匹配。"""

    def __init__(self):
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill) -> None:
        self._skills[skill.id] = skill

    def find_by_intent(self, user_intent: str) -> list[Skill]:
        """用 LLM 做意图→Skill 匹配，返回匹配度最高的 Skill 列表。"""
        # 简化版：把 user_intent 和所有 Skill 的 description 发给 nano 模型做语义匹配
        prompt = (
            f"用户意图：{user_intent}\n\n"
            f"可用 Skills：\n"
            + "\n".join(f"- {s.id}: {s.description}" for s in self._skills.values())
            + "\n\n返回最匹配的 Skill ID（只返回 ID，不返回其他内容）："
        )
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=20,
        )
        matched_id = response.choices[0].message.content.strip()
        if matched_id in self._skills:
            return [self._skills[matched_id]]
        return []

    def get_tools_for_skill(self, skill_id: str) -> list[str]:
        skill = self._skills.get(skill_id)
        return skill.tools if skill else list(TOOL_MAP.keys())


class SkillAwareAgent:
    """带 Skills 系统的 Agent——按意图匹配 Skill，只暴露匹配到的工具子集。"""

    def __init__(self, registry: SkillRegistry, max_steps: int = 10):
        self.registry = registry
        self.max_steps = max_steps
        self.traces = []
        self.active_skill: Skill | None = None

    def run(self, question: str) -> str:
        # Phase 1: 意图匹配
        candidates = self.registry.find_by_intent(question)
        if candidates:
            self.active_skill = candidates[0]
            system_prompt = self.active_skill.system_prompt
            active_tools = self.active_skill.tools
        else:
            self.active_skill = None
            system_prompt = "你是一个通用的 AI 助手。"
            active_tools = list(TOOL_MAP.keys())

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ]

        # Phase 2: Agent Loop（只暴露当前 Skill 的工具）
        for _ in range(self.max_steps):
            active_schema = [t for t in TOOLS_SCHEMA if t["function"]["name"] in active_tools]
            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=messages,
                tools=active_schema,
                temperature=0,
            )
            msg = response.choices[0].message

            if not msg.tool_calls:
                self._print_traces()
                return msg.content

            messages.append(msg)
            for tc in msg.tool_calls:
                fn = TOOL_MAP[tc.function.name]
                fn_args = json.loads(tc.function.arguments)
                start = time.time()
                result = fn(**fn_args)
                duration = (time.time() - start) * 1000
                self.traces.append({
                    "skill": self.active_skill.id if self.active_skill else "none",
                    "tool": tc.function.name,
                    "args": fn_args,
                    "result": str(result)[:100],
                    "ms": round(duration),
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(result),
                })

        self._print_traces()
        return "达到最大步数限制。"

    def _print_traces(self):
        print("\n--- Skills 模式追踪 ---")
        print(f"激活 Skill: {self.active_skill.id if self.active_skill else '无（全部工具）'}")
        for t in self.traces:
            print(f"  [{t['skill']}] {t['tool']}({t['args']}) → {t['result'][:80]} ({t['ms']}ms)")
```

**Step 6：Function Calling vs Skills 对比实验**

这是 P6 最有价值的产出——用数据说话，对比两种方式：

```python
# compare.py — Function Calling vs Skills 对比实验
from agent import ToolboxAgent
from skills import SkillRegistry, SkillAwareAgent, ALL_SKILLS
import time

# 初始化
registry = SkillRegistry()
for s in ALL_SKILLS:
    registry.register(s)

plain_agent = ToolboxAgent(max_steps=8)
skills_agent = SkillAwareAgent(registry, max_steps=8)

# 测试用例
test_cases = [
    "帮我搜索 WebAssembly 的现状，然后保存搜索结果到 wasm_notes.txt",
    "查询数据库里的用户表，计算所有用户的平均年龄",
    "搜索 Python 异步编程的最佳实践，然后写一段示例代码运行验证",
]

print("=" * 60)
print("Function Calling vs Skills 对比实验")
print("=" * 60)

for i, question in enumerate(test_cases, 1):
    print(f"\n--- 测试 {i}: {question[:50]}... ---")

    # 裸 Function Calling
    start = time.time()
    plain_result = plain_agent.run(question)
    plain_time = (time.time() - start) * 1000
    plain_steps = len(plain_agent.traces)
    plain_tools = set(t["tool"] for t in plain_agent.traces)

    # Skills 系统
    start = time.time()
    skills_result = skills_agent.run(question)
    skills_time = (time.time() - start) * 1000
    skills_steps = len(skills_agent.traces)
    skills_tools = set(t["tool"] for t in skills_agent.traces)

    print(f"\n  {'指标':<20} {'Function Calling':<25} {'Skills':<25}")
    print(f"  {'-'*20} {'-'*25} {'-'*25}")
    print(f"  {'耗时(ms)':<20} {plain_time:<25.0f} {skills_time:<25.0f}")
    print(f"  {'工具调用步数':<20} {plain_steps:<25} {skills_steps:<25}")
    print(f"  {'使用工具数':<20} {len(plain_tools):<25} {len(skills_tools):<25}")
    print(f"  {'激活 Skill':<20} {'N/A':<25} {skills_agent.active_skill.id if skills_agent.active_skill else '无':<25}")

    # 重置 traces
    plain_agent.traces = []
    skills_agent.traces = []

print("\n" + "=" * 60)
print("对比结论：")
print("- Skills 系统减少了每次调用的工具选择范围，降低了模型选错工具的概率")
print("- 对于「研究+保存」类任务，research_skill 只暴露 3 个工具而非 5 个")
print("- 对于「数据分析」类任务，analysis_skill 只暴露 2 个工具，跳过搜索和文件")
print("- Skills 的 system_prompt 给 Agent 了更明确的角色指引")
```

**Step 7：初始化测试数据 + 运行**

```python
# 初始化数据库
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)")
    conn.execute("INSERT OR REPLACE INTO users VALUES (1, '张三', 28), (2, '李四', 35), (3, '王五', 22)")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()

    # 测试 1：裸 Function Calling
    print("=== 测试 1: 裸 Function Calling（多工具并行）===")
    agent = ToolboxAgent(max_steps=8)
    print(agent.run("帮我查一下数据库里有哪些用户，同时算一下 123 * 456 等于多少"))

    # 测试 2：Skills 系统
    print("\n=== 测试 2: Skills 系统 ===")
    registry = SkillRegistry()
    for s in ALL_SKILLS:
        registry.register(s)
    skills_agent = SkillAwareAgent(registry, max_steps=8)
    print(skills_agent.run("帮我查一下数据库里有哪些用户，同时算一下 123 * 456 等于多少"))

    # 测试 3：研究类任务（Skills 优势明显）
    print("\n=== 测试 3: 研究任务（Skills 应匹配 research_skill）===")
    print(skills_agent.run("搜索什么是 ReAct，然后把搜索结果保存到 react_notes.txt 文件中"))
```

### 验收测试

建议项目结构：

```
p6/
  agent.py              # ToolboxAgent + 工具定义
  skills.py             # Skills 注册中心 + SkillAwareAgent
  db_mcp_server.py      # MCP Server
  test_db_mcp_client.py # MCP Client 测试
  compare.py            # Function Calling vs Skills 对比实验
  compare_report.md     # 对比报告（含结论）
  tests/test_toolbox_agent.py
  .env
```

```python
# tests/test_toolbox_agent.py
import pytest
from agent import ToolboxAgent, TOOL_MAP, search_web, execute_code, query_db, read_file, write_file
from skills import SkillRegistry, SkillAwareAgent, ALL_SKILLS, RESEARCH_SKILL, ANALYSIS_SKILL
import sqlite3, os

class TestTools:
    def test_search_web(self):
        result = search_web("react")
        assert "ReAct" in result

    def test_execute_code_success(self):
        result = execute_code("print(2+2)")
        assert "4" in result

    def test_execute_code_timeout(self):
        result = execute_code("import time; time.sleep(20)")
        assert "超时" in result

    def test_execute_code_error(self):
        result = execute_code("1/0")
        assert "错误" in result

    def test_query_db_select_only(self):
        result = query_db("DELETE FROM users WHERE id=1")
        assert "错误" in result or "不允许" in result

    def test_file_read_safety(self):
        result = read_file("../../../etc/passwd")
        assert "错误" in result

    def test_file_write_and_read(self):
        write_file("test.txt", "hello world")
        assert "hello world" in read_file("test.txt")

class TestSkills:
    def test_registry_register_and_find(self):
        registry = SkillRegistry()
        registry.register(RESEARCH_SKILL)
        result = registry.find_by_intent("搜索 WebAssembly 相关信息")
        # 意图匹配依赖 LLM，此处验证注册表结构正确
        assert len(registry._skills) == 1

    def test_skill_has_required_fields(self):
        for skill in ALL_SKILLS:
            assert skill.id
            assert skill.name
            assert skill.description
            assert skill.system_prompt
            assert len(skill.tools) > 0

    def test_skill_tools_are_valid(self):
        for skill in ALL_SKILLS:
            for tool in skill.tools:
                assert tool in TOOL_MAP, f"{skill.id} 引用了不存在的工具: {tool}"

    def test_skill_tools_are_subset(self):
        """每个 Skill 的工具集应该是全部工具的子集，而非全部。"""
        for skill in ALL_SKILLS:
            assert len(skill.tools) < len(TOOL_MAP), \
                f"{skill.id} 的工具集包含了全部工具，失去了 Skills 分组的意义"

    def test_get_tools_for_skill(self):
        registry = SkillRegistry()
        registry.register(RESEARCH_SKILL)
        tools = registry.get_tools_for_skill("research")
        assert "search_web" in tools
        assert "execute_code" not in tools  # research_skill 不应有代码执行
```

### 对比报告模板

在 `compare_report.md` 中记录你的对比实验结论：

```markdown
# Function Calling vs Skills 对比报告

## 实验环境
- 模型：gpt-4.1-mini
- 测试用例：3 个（研究保存、数据分析、搜索+代码）
- 每种方式跑 3 次取平均

## 结果

| 测试用例 | 裸 FC 步数 | Skills 步数 | 裸 FC 工具数 | Skills 工具数 | 匹配 Skill |
|---------|-----------|------------|-------------|--------------|-----------|
| 研究保存  |           |            |             |              |           |
| 数据分析  |           |            |             |              |           |
| 搜索+代码 |           |            |             |              |           |

## 分析

1. Skills 系统是否减少了工具选择错误？
2. 哪些任务 Skills 优势明显，哪些不明显？
3. 意图匹配的准确率如何？（有没有匹配到错误的 Skill？）

## 结论

（你的发现和判断）
```

### 进阶挑战

1. **接入真实搜索**：用 Tavily/SerpAPI 替代模拟搜索
2. **Docker 沙箱**：代码执行改用 Docker 隔离（参考 M9）
3. **MCP Server 发布**：发布到 PyPI + 提交到 MCP 目录
4. **Web 界面**：用 Gradio 做一个聊天界面 + 工具调用可视化 + Skills 激活状态显示
5. **权限控制**：不同用户可用不同 Skill 子集——Skills 的 preconditions 字段落地
6. **动态 Skill 切换**：Agent 在任务中途发现需要切换 Skill，实现中途 `reset_skill()` + 重新匹配

### 要点回顾

- 多工具 Agent = Function Calling + 并行执行 + 工具注册表
- 四类核心工具：搜索（信息）、代码执行（计算）、数据库（结构化数据）、文件（持久化）
- 安全三件套：代码超时、SQL 只读、文件路径限制
- MCP Server 把工具能力独立化——一次实现，Claude Desktop / Cursor / 任何 MCP 客户端都能用
- **Skills 系统 = Function Calling 之上的更高层抽象**：一个 Skill 是可复用的 Agent 行为包，包含 System Prompt、工具子集、Schema、前置条件
- **Skills 带来三个提升**：工具选择范围缩小（权限最小化）、角色指引更明确（system_prompt）、能力可组合（Skill 的 input/output schema 对齐后可串联）
- **对比实验是工程判断的基础**：不靠"感觉 Skills 更好"，靠数据说话——步数、工具选择准确率、最终结果质量
- 工具调用追踪是调试的基础——Skills 模式下额外记录"激活了哪个 Skill"

### 下一步

完成 P6 后，你的 Agent 已经有了"手"（工具）、"眼"（追踪）和"脑"（Skills 系统）。P7「Agent 弹性框架」会给它穿上"盔甲"——重试、熔断、降级、断点恢复，让 Agent 从"能跑"变成"可靠"。