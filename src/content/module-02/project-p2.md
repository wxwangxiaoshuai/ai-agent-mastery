## 智能文档摘要 & 信息抽取器

P1 解决了"能对话"，P2 解决"能结构化"——让模型把一篇杂乱的长文档变成干净的 JSON 数据。这个项目把 M2 学的 Prompt 工程、Few-shot、结构化输出、Prompt 测试全部串起来，产出一个可回归、可迭代的文档处理工具。

### 项目目标

构建一个能处理任意长文档的 Agent，具备：
- 自动摘要（一段话概括全文核心）
- 关键实体抽取（人名、公司、日期、金额等）
- 按 JSON Schema 稳定输出（可被下游代码直接消费）
- 可回归的 Prompt 测试集（改 Prompt 不怕"改好了 A 改坏了 B"）
- Prompt 版本对比报告（量化 v1 vs v2 谁更好）

### 学完能做什么

- 把"调 Prompt"从玄学变成工程——有测试集、有指标、有版本管理
- 掌握 Function Calling 做结构化输出的实战路径
- 理解"文档处理 Agent"的最小骨架，可扩展到合同分析、简历解析等场景

### 验收标准

- [ ] 输入一篇 Markdown/TXT 文档，输出符合 Schema 的 JSON
- [ ] JSON 包含 `summary`、`entities`、`key_points` 三个字段
- [ ] `entities` 中的人名、公司名准确率 > 90%（在测试集上）
- [ ] 运行 `pytest` 跑通测试集，输出通过率
- [ ] 可以对比两个 Prompt 版本的测试结果，生成对比报告
- [ ] 处理一篇 3000 字文档的耗时 < 10 秒
- [ ] API Key 通过 `.env` 管理

### 实施步骤

**Step 1：环境准备**

```bash
pip install openai python-dotenv pydantic pytest
```

**Step 2：定义输出 Schema**

用 Pydantic 定义你期望的输出结构——这是"结构化输出"的核心：

```python
from pydantic import BaseModel, Field
from enum import Enum

class EntityType(str, Enum):
    person = "person"
    company = "company"
    date = "date"
    amount = "amount"
    location = "location"

class Entity(BaseModel):
    type: EntityType
    value: str = Field(description="实体文本")

class DocumentAnalysis(BaseModel):
    summary: str = Field(description="一句话摘要，不超过 100 字")
    entities: list[Entity] = Field(description="文中出现的命名实体")
    key_points: list[str] = Field(description="3-5 个关键要点")
```

**Step 3：实现基础抽取（Prompt 约束版）**

先用最简单的 Prompt 约束方式，跑通"输入文档 → 输出 JSON"链路：

```python
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

PROMPT_V1 = """分析以下文档，输出 JSON：

{{
  "summary": "一句话摘要",
  "entities": [{{"type": "person|company|date|amount|location", "value": "实体文本"}}],
  "key_points": ["要点1", "要点2", "要点3"]
}}

文档：
{document}

只输出 JSON，不要其他文字。"""

def analyze_document_v1(document: str) -> dict:
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": PROMPT_V1.format(document=document)}],
        temperature=0,
    )
    return json.loads(response.choices[0].message.content)
```

**Step 4：升级到 Function Calling（更可靠）**

Prompt 约束不保证 JSON 合法。用 Function Calling + instructor 库升级：

```python
import instructor
from openai import OpenAI

client = instructor.from_openai(OpenAI())

def analyze_document(document: str) -> DocumentAnalysis:
    """用 Function Calling 做结构化抽取"""
    return client.chat.completions.create(
        model="gpt-4.1-mini",
        response_model=DocumentAnalysis,
        messages=[{
            "role": "user",
            "content": f"分析以下文档，提取摘要、实体和关键要点：\n\n{document}",
        }],
        temperature=0,
        max_tokens=1000,
    )
```

instructor 自动处理 Schema 校验和重试——如果输出不符合 Pydantic 模型，它会自动把错误反馈给模型重试。

**Step 5：构建测试集**

准备 10-20 条测试用例，覆盖不同文档类型：

```python
# tests/test_cases.py
TEST_CASES = [
    {
        "id": "tc_001",
        "input": "2024年3月15日，阿里巴巴集团宣布投资100亿元人民币用于AI研发。CEO吴泳铭表示...",
        "expected": {
            "entities_contains": [
                {"type": "company", "value": "阿里巴巴"},
                {"type": "person", "value": "吴泳铭"},
                {"type": "date", "value": "2024年3月15日"},
                {"type": "amount", "value": "100亿元"},
            ],
            "summary_keywords": ["阿里巴巴", "AI", "投资"],
            "key_points_count_min": 3,
        },
    },
    {
        "id": "tc_002",
        "input": "苹果公司于2024年6月发布Apple Intelligence，库克称将整合ChatGPT...",
        "expected": {
            "entities_contains": [
                {"type": "company", "value": "苹果"},
                {"type": "person", "value": "库克"},
            ],
            "summary_keywords": ["苹果", "Apple Intelligence"],
            "key_points_count_min": 3,
        },
    },
    # 补充更多用例...
    {
        "id": "tc_edge_001",
        "input": "",  # 空文档
        "expected": {
            "entities_contains": [],
            "summary_keywords": [],
            "key_points_count_min": 0,
        },
    },
]
```

**Step 6：编写 pytest 测试**

```python
# tests/test_extraction.py
import pytest
from src.analyzer import analyze_document
from tests.test_cases import TEST_CASES

def check_entities(result, expected_entities):
    """检查抽取的实体是否包含所有期望实体"""
    result_entities = [{"type": e.type, "value": e.value} for e in result.entities]
    for exp in expected_entities:
        matched = any(
            exp["type"] == e["type"] and exp["value"] in e["value"]
            for e in result_entities
        )
        if not matched:
            return False, f"缺失实体: {exp}"
    return True, ""

def check_summary(result, expected_keywords):
    """检查摘要是否包含期望关键词"""
    summary = result.summary
    for kw in expected_keywords:
        if kw not in summary:
            return False, f"摘要缺少关键词: {kw}"
    return True, ""

@pytest.mark.parametrize("tc", TEST_CASES)
def test_document_analysis(tc):
    if not tc["input"].strip():
        # 空文档：验证系统不崩溃且返回空结果
        result = analyze_document(tc["input"])
        assert len(result.entities) == 0, f"[{tc['id']}] 空文档应返回空实体列表"
        assert len(result.key_points) == 0, f"[{tc['id']}] 空文档应返回空关键要点"
        return

    result = analyze_document(tc["input"])
    exp = tc["expected"]

    # 检查实体
    ok, msg = check_entities(result, exp.get("entities_contains", []))
    assert ok, f"[{tc['id']}] {msg}"

    # 检查摘要关键词
    ok, msg = check_summary(result, exp.get("summary_keywords", []))
    assert ok, f"[{tc['id']}] {msg}"

    # 检查关键要点数量
    assert len(result.key_points) >= exp.get("key_points_count_min", 0)
```

**Step 7：Prompt 版本对比报告**

```python
# scripts/compare_versions.py
import json
from src.analyzer import analyze_document_v1, analyze_document
from tests.test_cases import TEST_CASES

def run_version(name: str, analyze_fn, cases: list) -> dict:
    results = {"passed": 0, "failed": 0, "details": []}
    for tc in cases:
        if not tc["input"].strip():
            continue
        try:
            result = analyze_fn(tc["input"])
            # 根据返回类型区分 v1（dict）和 v2（Pydantic 模型）
            if hasattr(result, 'entities'):  # Pydantic 模型 (v2)
                result_entities = [e.value for e in result.entities]
            else:  # dict (v1)
                result_entities = [e["value"] for e in result.get("entities", [])]
            expected_values = [e["value"] for e in tc["expected"].get("entities_contains", [])]
            hit = sum(1 for v in expected_values if any(v in r for r in result_entities))
            rate = hit / len(expected_values) if expected_values else 1.0
            results["passed" if rate >= 0.8 else "failed"] += 1
            results["details"].append({"id": tc["id"], "entity_hit_rate": rate})
        except Exception as e:
            results["failed"] += 1
            results["details"].append({"id": tc["id"], "error": str(e)})
    results["pass_rate"] = results["passed"] / (results["passed"] + results["failed"])
    return results

if __name__ == "__main__":
    v1 = run_version("v1", analyze_document_v1, TEST_CASES)
    v2 = run_version("v2", analyze_document, TEST_CASES)
    print(f"v1 (Prompt约束):     通过率 {v1['pass_rate']:.0%}")
    print(f"v2 (Function Call):  通过率 {v2['pass_rate']:.0%}")
```

### 验收测试

```bash
# 运行测试集
pytest tests/ -v

# 对比 Prompt 版本
python scripts/compare_versions.py
```

手工测试：
```bash
# 准备一篇测试文档
echo "2024年10月，Anthropic发布Claude 3.5 Sonnet更新版..." > test_doc.txt

# 运行抽取
python -c "from src.analyzer import analyze_document; import json; print(json.dumps(analyze_document(open('test_doc.txt').read()).model_dump(), ensure_ascii=False, indent=2))"
```

### 进阶挑战

1. **批量处理**：支持传入一个目录，批量处理所有 .md/.txt 文件
2. **多文档对比**：输入两篇文档，输出差异对比报告
3. **Prompt Caching**：对重复的 System Prompt 启用缓存，量化成本节省
4. **流式摘要**：摘要部分用流式输出，其他部分保持结构化
5. **多模型对比**：同一文档分别用 GPT-4o-mini 和 Claude Sonnet 处理，对比抽取质量

### 常见问题

**Q: 为什么用 instructor 而不直接用 OpenAI 的 response_format?**
A: instructor 封装了 Pydantic 校验 + 自动重试，比 `response_format` 更可靠。`response_format` 保证 JSON 合法但不保证 Schema 正确，instructor 两者都保证。

**Q: 测试集要做多少条？**
A: 起步 10 条够用（覆盖正常+边界）。随着线上发现的 bug，持续补充——每次 bug 修复都加一条对应的测试用例，防止回归。

**Q: temperature=0 为什么还有时结果不一样？**
A: 模型的非确定性不完全由 temperature 控制。即使 temperature=0，不同批次推理可能有微小差异。用 Self-Consistency（跑 3 次取多数）可以缓解。

### 要点回顾

- 结构化输出用 Function Calling + instructor 比纯 Prompt 约束可靠得多
- Prompt 测试集是"Prompt 工程"区别于"Prompt 玄学"的关键
- Pydantic 模型既定义 Schema 又做校验，一石二鸟
- 版本对比报告让 Prompt 迭代有数据支撑，不再是"感觉变好了"

### 下一步

完成 P2 后，你已经掌握了"让模型稳定输出结构化数据"的能力。P3「Context 预算管理器」会进入更底层的上下文工程——不只关注输出，还关注输入怎么组装。
