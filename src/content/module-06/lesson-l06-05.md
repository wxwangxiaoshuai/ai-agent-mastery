## 构建并发布你自己的 MCP Server

L06-04 讲了 MCP 的概念，这一节动手实战——用 Python MCP SDK 构建一个 MCP Server，把它接入 Claude Desktop 测试。

### 目标：构建一个"知识库查询"MCP Server

我们要构建一个 MCP Server，提供：
- **Tool**：`search_kb`——搜索知识库
- **Tool**：`get_doc`——获取指定文档内容
- **Resource**：`kb://stats`——知识库统计信息
- **Prompt**：`summarize_doc`——文档摘要模板

### 环境准备

```bash
# 示例基于 mcp 1.x low-level Server API；新版本也可用 FastMCP 简化写法
pip install "mcp>=1.8,<2"
```

### 实现 MCP Server

```python
# my_kb_server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool, Resource, Prompt, TextContent,
    GetPromptResult, PromptMessage,
)
from pydantic import AnyUrl
import json
import asyncio

server = Server("knowledge-base")

# --- 模拟知识库 ---
KB = {
    "rag": {
        "title": "RAG 技术概览",
        "content": "RAG（检索增强生成）通过检索外部知识来增强 LLM。流程：分块→Embedding→检索→生成。",
    },
    "agent": {
        "title": "Agent 核心架构",
        "content": "Agent 是能自主感知、推理、行动的系统。核心循环：感知→推理→行动→观察。",
    },
    "mcp": {
        "title": "MCP 协议入门",
        "content": "MCP 是连接 LLM 与外部工具的统一协议。采用 Client-Server 架构。",
    },
}

# --- 注册 Tools ---
@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_kb",
            description="搜索知识库。输入关键词，返回匹配的文档标题和摘要。",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"}
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_doc",
            description="获取指定文档的完整内容。输入文档 ID（如 'rag'、'agent'）。",
            inputSchema={
                "type": "object",
                "properties": {
                    "doc_id": {"type": "string", "description": "文档 ID"}
                },
                "required": ["doc_id"],
            },
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_kb":
        query = arguments.get("query", "").lower()
        results = []
        for doc_id, doc in KB.items():
            if query in doc["title"].lower() or query in doc["content"].lower():
                results.append(f"[{doc_id}] {doc['title']}: {doc['content'][:80]}...")
        if not results:
            return [TextContent(type="text", text=f"未找到与 '{query}' 相关的文档。")]
        return [TextContent(type="text", text="\n".join(results))]

    elif name == "get_doc":
        doc_id = arguments.get("doc_id", "")
        if doc_id in KB:
            doc = KB[doc_id]
            return [TextContent(type="text", text=f"标题: {doc['title']}\n\n{doc['content']}")]
        return [TextContent(type="text", text=f"错误: 文档 '{doc_id}' 不存在。可用: {', '.join(KB.keys())}")]

    return [TextContent(type="text", text=f"错误: 未知工具 '{name}'")]

# --- 注册 Resources ---
@server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="kb://stats",
            name="知识库统计",
            description="知识库的文档数量和列表",
            mimeType="application/json",
        ),
    ]

@server.read_resource()
async def read_resource(uri: AnyUrl) -> str:
    if str(uri) == "kb://stats":
        stats = {
            "total_docs": len(KB),
            "doc_ids": list(KB.keys()),
            "titles": [doc["title"] for doc in KB.values()],
        }
        return json.dumps(stats, ensure_ascii=False, indent=2)
    raise ValueError(f"未知资源: {uri}")

# --- 注册 Prompts ---
@server.list_prompts()
async def list_prompts() -> list[Prompt]:
    return [
        Prompt(
            name="summarize_doc",
            description="生成文档摘要的 Prompt 模板",
            arguments=[
                {"name": "doc_id", "description": "要摘要的文档 ID", "required": True},
            ],
        ),
    ]

@server.get_prompt()
async def get_prompt(name: str, arguments: dict | None) -> GetPromptResult:
    if name == "summarize_doc":
        doc_id = (arguments or {}).get("doc_id", "")
        doc = KB.get(doc_id)
        if doc:
            text = f"请用 3 句话总结以下文档：\n\n标题: {doc['title']}\n内容: {doc['content']}"
        else:
            text = f"错误: 文档 '{doc_id}' 不存在。"
        return GetPromptResult(
            description="文档摘要模板",
            messages=[PromptMessage(role="user", content=TextContent(type="text", text=text))],
        )
    raise ValueError(f"未知 Prompt: {name}")

# --- 启动 Server ---
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

def cli():
    """同步入口，供 PyPI console_scripts 使用"""
    asyncio.run(main())

if __name__ == "__main__":
    cli()
```

### 接入 Claude Desktop

在 Claude Desktop 配置文件（`~/Library/Application Support/Claude/claude_desktop_config.json`）中添加你的 Server：

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "python",
      "args": ["/path/to/my_kb_server.py"]
    }
  }
}
```

重启 Claude Desktop 后，你可以在对话中使用：
- "搜索知识库中关于 RAG 的内容" → 触发 `search_kb` 工具
- "获取 agent 文档" → 触发 `get_doc` 工具
- "知识库统计" → 读取 `kb://stats` 资源

### 用 Python MCP Client 测试

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def test_server():
    # 连接 MCP Server
    server_params = StdioServerParameters(
        command="python",
        args=["/path/to/my_kb_server.py"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 列出可用工具
            tools = await session.list_tools()
            print("可用工具:", [t.name for t in tools.tools])

            # 调用搜索工具
            result = await session.call_tool("search_kb", {"query": "agent"})
            print("搜索结果:", result.content[0].text)

            # 读取资源
            resources = await session.list_resources()
            print("可用资源:", [r.uri for r in resources.resources])

            stats = await session.read_resource("kb://stats")
            print("知识库统计:", stats.contents[0].text)

            # 获取 Prompt
            prompts = await session.list_prompts()
            print("可用 Prompt:", [p.name for p in prompts.prompts])

            prompt = await session.get_prompt("summarize_doc", {"doc_id": "rag"})
            print("摘要 Prompt:", prompt.messages[0].content.text)

# 运行测试
import asyncio
asyncio.run(test_server())
```

### 发布到 MCP 生态

如果你的 Server 想让别人也能用：

1. **发布到 PyPI**（Python 包）：
```bash
# pyproject.toml 中添加入口点（指向同步 cli，不要指向 async main）
[project.scripts]
my-kb-server = "my_kb_server:cli"
```

2. **提交到 MCP Server 目录**：
   - 官方目录：https://github.com/modelcontextprotocol/servers
   - 社区目录：https://mcp.so

3. **写 README**（注意：下面 JSON 配置请单独复制，勿嵌套进 Markdown 代码块）：

```markdown
# Knowledge Base MCP Server

## 安装
pip install my-kb-server

## 配置
在 Claude Desktop 的 mcpServers 中加入：
{"mcpServers": {"kb": {"command": "my-kb-server"}}}

## 工具
- search_kb: 搜索知识库
- get_doc: 获取文档内容
```

### 动手 5 分钟

把你自己的 MCP Server 交给别人跑一次。

1. 在你的 Server 上补齐 README：依赖、启动命令、配置片段、三个可直接复制的示例请求。
2. 找一台干净环境（新虚拟环境或同事的机器）按 README 从零跑通。
3. 记录卡住的每一步，回头补进 README。

**验收标准**：第二个人不问你任何问题就能跑通——分发能力是 MCP 相对私有工具格式的核心价值。

### 要点总结

- MCP Server 用 Python SDK 实现：注册 Tools + Resources + Prompts，通过 stdio 通信
- 三类原语各司其职：Tools（模型调用）、Resources（模型读取）、Prompts（快捷模板）
- 接入 Claude Desktop 只需在配置文件中添加一行——零代码集成
- 用 Python MCP Client 可以程序化测试 Server，不需要启动 Claude Desktop
- 发布到 PyPI + MCP 目录后，任何 MCP 客户端都能使用你的 Server
- MCP Server 是 Agent 生态的"插件"——一次实现，处处可用
