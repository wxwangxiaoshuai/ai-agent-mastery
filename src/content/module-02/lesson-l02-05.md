## Prompt 测试与版本管理

代码要测试，Prompt 也一样。一个"感觉变好了"的 Prompt 改动，可能在某些边界情况下反而退化了。Prompt 测试的目的就是：**用量化指标替代直觉判断**。

### 为什么 Prompt 需要测试

典型场景：你调了一个 Prompt，感觉输出质量提升了。但上线后才发现——它在 80% 的情况下确实变好了，但在另外 20% 的情况下完全失效了。

Prompt 测试的价值：
- 改 Prompt 时，跑一遍测试就知道有没有"退化"
- 团队协作时，新成员不会因为不懂"历史包袱"而改坏 Prompt
- 模型升级时，测试集可以帮你判断新模型是否真的更好

### 构建测试集

测试集 = 一组输入 + 期望输出 + 评估标准。

```python
test_cases = [
    {
        "id": "tc_001",
        "input": "这个产品的功能很强大，但价格太贵了。",
        "expected": {
            "sentiment": "neutral",
            "keywords": ["功能强大", "价格贵"],
        },
        "description": "混合情感应分类为中性",
    },
    {
        "id": "tc_002",
        "input": "非常好用，推荐！",
        "expected": {
            "sentiment": "positive",
        },
        "description": "纯正面评价",
    },
    {
        "id": "tc_003",
        "input": "",  # 空输入
        "expected": {
            "sentiment": "neutral",
            "keywords": [],
        },
        "description": "空输入边界情况",
    },
]
```

测试集的构建原则：
- 覆盖正常输入（Happy Path）
- 覆盖边界情况（空输入、超长输入、特殊字符）
- 覆盖失败案例（历史上出过错的输入）
- 每组 20-50 条测试用例即可起步

### 评估指标

Prompt 的评估通常分为两类：**客观指标**和**主观指标**。

**客观指标**（可自动计算）：
- 格式合法性：输出是否为合法 JSON
- 字段完整性：是否包含所有必需字段
- 字段类型：字段值类型是否正确
- 枚举匹配：分类结果是否在预期的枚举值中

**主观指标**（需要人工或 LLM 评判）：
- 准确性：回答是否正确
- 相关性：回答是否与问题相关
- 完整性：是否覆盖了所有要点
- 简洁性：是否有冗余信息

**LLM-as-Judge**：用另一个模型（通常是更强的模型）做裁判，对输出打分。

```python
def llm_judge(question: str, answer: str, reference: str) -> dict:
    """用 LLM 评估回答质量"""
    judge_prompt = f"""你是一个严格的评审。请评估以下回答的质量。

问题：{question}
参考答案：{reference}
待评估回答：{answer}

请从以下维度打分（1-5 分）：
1. 准确性：回答是否与参考答案一致
2. 完整性：是否覆盖了所有关键点
3. 简洁性：是否有冗余信息

输出 JSON：
{{"accuracy": 1-5, "completeness": 1-5, "conciseness": 1-5, "total": 1-5, "comment": "简要评语"}}
"""
    return call_llm(judge_prompt)
```

**LLM-as-Judge 的已知偏差及规避**：

| 偏差 | 表现 | 规避方法 |
|------|------|----------|
| 位置偏差 | 倾向于给靠前的答案更高分 | 随机打乱答案顺序，多次评估取平均 |
| 冗长偏差 | 倾向于给更长的回答更高分 | 在 Judge Prompt 中明确"长度不作为评分依据" |
| 自我偏好 | 模型倾向于给自己的输出更高分 | 用不同模型做 Judge（如用 Claude 评估 GPT 的输出） |
| 过于宽容 | Judge 倾向于给高分 | 设定严格评分标准，要求"只有完全正确才给 5 分" |

### 处理 Flaky Test（不稳定的测试）

LLM 输出具有非确定性——同一个 Prompt 跑两次可能得到不同结果。这会导致测试"时过时不过"（flaky）。

**策略 1：用 temperature=0 降低随机性**

```python
response = call_llm(prompt, temperature=0, seed=42)  # 尽可能确定性
```

**策略 2：多次运行取多数结果**

```python
def stable_test(prompt: str, expected: str, n_runs: int = 3) -> bool:
    """跑 n 次，超过半数通过才算通过"""
    passed = sum(1 for _ in range(n_runs) if check_output(call_llm(prompt), expected))
    return passed >= n_runs // 2 + 1
```

**策略 3：只测格式，不测内容**

对于创造性输出，只校验格式（是否为合法 JSON、是否包含必需字段），不校验具体内容——因为内容本身没有唯一正确答案。

### 现成工具推荐

不必从零搭建测试框架，以下工具已经解决了 Prompt 测试的大部分痛点：

| 工具 | 特点 | 适用场景 |
|------|------|----------|
| [promptfoo](https://promptfoo.dev) | CLI 工具，支持多模型对比、批量测试、CI 集成 | 快速搭建 Prompt 评测流水线 |
| [DSPy](https://dspy.ai) | 自动优化 Prompt，把 Prompt 工程变成"编译"问题 | 系统性优化 Prompt 参数 |
| [LangSmith](https://smith.langchain.com) | LangChain 生态的评测平台，可视化 trace + 评测 | 使用 LangChain 的项目 |
| [promptflow](https://promptflow.azure.com) | 微软出品，可视化 Prompt 开发流水线 | 企业级 Prompt 生命周期管理 |

> **建议起步路径**：先用 promptfoo 搭建最小评测流水线（30 分钟内可以跑通），随着项目复杂化再考虑迁移到更重的平台。

### 完整测试运行器

把上面的测试逻辑封装成一个可复用的测试运行器：

```python
import json

def run_prompt_tests(prompt_template: str, test_cases: list[dict]) -> dict:
    """对 Prompt 模板运行完整的测试套件"""
    results = {"passed": 0, "failed": 0, "details": []}
    
    for tc in test_cases:
        # 1. 渲染 Prompt
        prompt = prompt_template.format(**tc.get("variables", {}))
        
        # 2. 调用模型
        response = call_llm(prompt)
        
        # 3. 解析输出
        try:
            output = json.loads(response)
        except json.JSONDecodeError:
            results["failed"] += 1
            results["details"].append({
                "id": tc["id"],
                "status": "FAIL",
                "reason": "JSON 解析失败",
                "raw": response[:200],
            })
            continue
        
        # 4. 逐字段校验
        failures = []
        for field, expected in tc["expected"].items():
            if field not in output:
                failures.append(f"缺少字段 '{field}'")
            elif output[field] != expected:
                failures.append(f"字段 '{field}': 期望 {expected}, 实际 {output[field]}")
        
        if failures:
            results["failed"] += 1
            results["details"].append({
                "id": tc["id"],
                "status": "FAIL",
                "reasons": failures,
            })
        else:
            results["passed"] += 1
            results["details"].append({
                "id": tc["id"],
                "status": "PASS",
            })
    
    results["pass_rate"] = results["passed"] / len(test_cases)
    return results
```

### Prompt 版本管理

把 Prompt 当作代码，用 Git 管理。

**推荐的文件结构**：
```
prompts/
  sentiment_analysis/
    v1.0.json        # Prompt 版本 1.0
    v1.1.json        # 改进版
    test_cases.json  # 测试用例
    eval_results.md  # 各版本评估对比
```

**Prompt 文件格式**（JSON 或 YAML）：
```json
{
  "name": "sentiment_analysis",
  "version": "1.1",
  "created": "2025-07-22",
  "author": "zhangsan",
  "model": "claude-sonnet-4-20250514",
  "system_prompt": "你是一个情感分析专家。分析用户输入的情感倾向...",
  "user_prompt_template": "请分析以下文本的情感：\n\n{text}",
  "parameters": {
    "temperature": 0.0,
    "max_tokens": 200
  },
  "changelog": "v1.1: 修复了混合情感被误判为 negative 的问题，增加了 neutral 的判定规则"
}
```

**版本对比**：
```
                    v1.0    v1.1
准确率              85%     92%
JSON 解析成功率      95%     98%
平均 Token 消耗      320     280
混合情感误判率       12%     3%
```

### CI/CD 集成

把 Prompt 测试集成到 CI 流水线中：

```yaml
# .github/workflows/prompt-test.yml
name: Prompt Tests

on:
  pull_request:
    paths:
      - 'prompts/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Prompt Tests
        run: python scripts/test_prompts.py
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      - name: Check Pass Rate
        run: |
          PASS_RATE=$(cat results.json | jq '.pass_rate')
          if (( $(echo "$PASS_RATE < 0.90" | bc -l) )); then
            echo "Pass rate $PASS_RATE below 90% threshold"
            exit 1
          fi
```

> 把 Prompt 测试作为 PR 的 CI 检查项。改 Prompt 必须通过测试，不通过测试的改动不能合并。

### 模型升级时的回归测试

当你切换模型版本（如 `gpt-4o` → `gpt-4o-2024-11-20`，或从 OpenAI 切到 Anthropic），**必须重跑测试集**——新模型可能改变输出习惯（格式、语气、JSON 字段顺序），导致原本通过的 Prompt 退化。

```python
def regression_test_on_model_switch(
    prompt: str,
    test_cases: list[dict],
    old_model: str,
    new_model: str,
) -> dict:
    """模型切换时的回归测试"""
    old_results = run_prompt_tests_with_model(prompt, test_cases, old_model)
    new_results = run_prompt_tests_with_model(prompt, test_cases, new_model)
    
    report = {
        "old_model": old_model,
        "new_model": new_model,
        "old_pass_rate": old_results["pass_rate"],
        "new_pass_rate": new_results["pass_rate"],
        "regressions": [
            d for d in new_results["details"]
            if d["status"] == "FAIL"
            and any(o["id"] == d["id"] and o["status"] == "PASS" for o in old_results["details"])
        ],
    }
    if report["regressions"]:
        print(f"⚠️ 发现 {len(report['regressions'])} 个回归用例！")
    return report
```

**建议流程**：
1. 新模型上线前，用测试集跑一轮回归
2. 对比新旧模型的通过率
3. 如果有回归用例，逐个分析原因，调整 Prompt
4. 确认全部通过后再切换

### 动手 5 分钟

把本节的测试运行器接进 CI，让 Prompt 改动无法蒙混过关。

1. 建 10 条测试用例（含 2 条边界、1 条已知会失败的），写进 `tests/test_cases.py`。
2. 设一个通过阈值（如"准确率 ≥ 80% 才算通过"），低于阈值时 exit 1。
3. 加一个 GitHub Actions workflow，在 PR 修改 `prompts/` 目录时自动触发。

**验收标准**：你把 Prompt 里的一句关键约束删掉并提 PR，CI 变红并在日志里指出是哪几条用例挂了。

### 要点总结

- Prompt 测试用量化指标替代直觉判断，防止"改好了 A 但改坏了 B"
- 测试集覆盖正常输入、边界情况（空输入/超长输入/特殊字符）、历史失败案例
- LLM-as-Judge 用于评估主观指标（准确性、完整性、简洁性），但需注意位置偏差、冗长偏差、自我偏好、过于宽容等已知问题——用随机打乱顺序、交叉模型评估、严格评分标准来规避
- LLM 的非确定性导致测试 flaky——用 temperature=0、多次运行取多数、只测格式不测内容来缓解
- 用 Git 管理 Prompt 版本，记录每次改动的 changelog 和评估结果
- 推荐用 promptfoo 快速搭建评测流水线，不必从零开始
- 把 Prompt 测试集成到 CI，设置通过率阈值（如 90%）作为质量门禁
- **模型升级时必须重跑测试集**——新模型可能改变输出习惯，导致旧 Prompt 退化
