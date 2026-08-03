## 工具设计原则：粒度、命名、错误信息

Agent 的能力上限不取决于 LLM 有多聪明，而取决于**工具设计有多好**。同一个 LLM，配好工具的 Agent 能完成复杂任务，配坏工具的 Agent 连简单任务都做不对。好工具让 Agent 聪明，坏工具让 Agent 抓狂。

先用下面的对照器逐项切换设计选择，看同一个工具的 schema 会变成什么样：

::interactive{type="toolSchema"}

### 粒度：不要太粗也不要太细

**太粗的工具**——一个工具干太多事：

```
❌ 差设计：一个 "manage_database" 工具
   参数: {"action": "query|insert|delete|create_table", ...}
   问题: 模型经常混淆 action 参数，该 delete 时调了 insert

✅ 好设计：拆成 4 个独立工具
   - query_database(sql)
   - insert_record(table, data)
   - delete_record(table, condition)
   - create_table(name, schema)
```

**太细的工具**——一个工具只干一件事的极端：

```
❌ 差设计：把搜索拆成 3 步
   - open_browser()
   - navigate_to_search_engine()
   - type_search_query(query)
   问题: 3 次工具调用 = 3 次 LLM 推理 = 3 倍成本和延迟

✅ 好设计：一个 search 工具
   - search(query) → 直接返回结果
```

**粒度原则**：一个工具 = 一个用户心智模型中的"一个动作"。

| 任务 | 用户心智 | 推荐工具数 |
|------|----------|-----------|
| 搜索信息 | "搜一下" | 1 个（search） |
| 数据库操作 | "查/增/删" | 3-4 个（query/insert/delete） |
| 文件操作 | "读/写/删" | 3 个（read/write/delete） |
| 代码执行 | "跑一下" | 1 个（execute_code） |

### 命名：给模型看的名字

工具名和参数名是模型理解工具的唯一线索——它们不是给人看的变量名，而是**给 LLM 看的"指令"**。

```
❌ 差命名（程序员风格）：
   tool_1(op_1: str, op_2: int) → 模型完全不知道这是什么

✅ 好命名（自然语言风格）：
   search_web(query: str, max_results: int) → 模型一眼就懂
```

**命名原则**：
- 工具名用**动词+名词**：`search_web`、`read_file`、`send_email`
- 参数名用**自然语言**：`query` 而非 `q`，`file_path` 而非 `fp`
- description 写**模型能理解的说明**：不是"查询接口"，而是"搜索互联网获取实时信息"

```python
# ❌ 差 description
{"name": "db_q", "description": "DB query interface", ...}

# ✅ 好 description
{"name": "query_database", "description": "从公司数据库中查询数据。输入 SQL 语句，返回查询结果。仅支持 SELECT 查询，不支持修改操作。", ...}
```

### 错误信息：让模型能自我修复

工具调用失败时，返回的错误信息决定了 Agent 能否"自我修复"。

```
❌ 差错误信息：
   {"error": "Exception"}  → 模型不知道哪里错了，只能重试同样的调用

✅ 好错误信息：
   {"error": "城市名 'beijing' 不在数据库中。请使用中文城市名，如'北京'、'上海'。可用城市：北京、上海、成都、广州。"}
   → 模型知道该换成中文城市名重试
```

**错误信息设计原则**：

```python
def get_weather(city: str) -> str:
    weather_db = {"北京": "晴 35°C", "上海": "多云 32°C"}

    if city not in weather_db:
        # 好错误：告诉模型哪里错了 + 怎么修
        available = "、".join(weather_db.keys())
        return f"错误：不支持的城市 '{city}'。请使用以下城市：{available}。"

    return weather_db[city]
```

| 错误类型 | 差返回 | 好返回 |
|----------|--------|--------|
| 参数缺失 | `Error` | `错误：缺少必需参数 'city'。请提供城市名。` |
| 值无效 | `Invalid` | `错误：'beijing' 不支持。可用值：北京、上海。` |
| 权限不足 | `Denied` | `错误：无权限删除记录。需要 admin 角色。` |
| 超时 | `Timeout` | `错误：查询超时（30秒）。建议缩小查询范围或添加筛选条件。` |
| 依赖失败 | `Fail` | `错误：数据库连接失败。请稍后重试，或使用 search_web 作为替代。` |

### 工具描述的"黄金模板"

```python
{
    "name": "search_web",
    "description": (
        "搜索互联网获取实时信息。"
        "适用场景：查询最新新闻、技术文档、天气、股价等需要实时数据的问题。"
        "不适用：数学计算（用 calculate）、代码执行（用 execute_code）。"
        "输入：搜索关键词（中英文均可）。"
        "输出：搜索结果摘要（通常 3-5 条）。"
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词。建议具体明确，如'Python asyncio 教程'而非'Python'。"
            },
            "max_results": {
                "type": "integer",
                "description": "返回结果数量，默认 5。最大 10。",
                "default": 5
            }
        },
        "required": ["query"]
    }
}
```

> Schema 里的 `"default": 5` **不会**由 API 自动填入参数。执行前仍需应用层兜底：`max_results = fn_args.get("max_results", 5)`。

**模板要素**：
1. 一句话说明工具做什么
2. 适用场景 + 不适用场景（帮模型决策）
3. 输入说明 + 输出说明
4. 参数描述包含建议（如"建议具体明确"）

### 工具数量管理

```
工具太少（1-3 个）：Agent 能力受限
工具适中（4-8 个）：最佳区间，模型能合理选择
工具太多（>10 个）：模型选择困难，经常选错工具
```

**工具太多怎么办**：
- 分类组织：按领域分组（搜索类 / 数据类 / 通信类）
- 路由层：先用轻量模型判断"需要哪类工具"，再只传该类工具
- 动态加载：根据用户意图动态选择可用工具子集

```python
# from openai import OpenAI; client = OpenAI()  # 沿用 L06-01
def select_tools(user_input: str, all_tools: dict) -> list:
    """根据用户意图动态选择工具子集"""
    # 用轻量模型分类
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{
            "role": "user",
            "content": f"判断以下问题需要哪类工具（search/data/file/communication）。只输出类别名。\n\n{user_input}",
        }],
        temperature=0,
        max_tokens=10,
    )
    category = response.choices[0].message.content.strip()
    return all_tools.get(category, all_tools["search"])
```

### 动手 5 分钟

把一个"坏工具"改造成"好工具"，用 Agent 的行为验证。

1. 先写一个坏版本：名字叫 `func1`，无描述，出错时抛 `Exception("error")`。
2. 让 Agent 用它完成任务，记录它卡住/瞎猜参数的次数。
3. 改造：语义化命名、写清参数含义与单位、错误信息里带上"你应该怎么改"。

**验收标准**：改造后 Agent 能在一次工具报错后自行修正参数并成功——这就是"错误信息是写给模型看的"的含义。

### 要点总结

- 工具粒度：一个工具 = 用户心智中的一个动作，不要太粗也不要太细
- 命名：动词+名词，自然语言风格，description 写适用场景和不适用场景
- 错误信息：告诉模型"哪里错了 + 怎么修"，让它能自我修复
- 工具数量：4-8 个最佳，超过 10 个需要分类/路由/动态加载
- 工具描述是"给 LLM 看的 API 文档"——写得好，模型选对工具的概率大幅提升
- 好工具设计是 Agent 质量的"隐形杠杆"——同样 LLM + 好工具 vs 坏工具，效果天差地别
