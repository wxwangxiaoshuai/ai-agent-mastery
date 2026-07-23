## RAG 评估体系：RAGAS

RAG 系统搭建完成后，你怎么知道它"好不好"？靠人工试几个问题"感觉不错"是不够的——改了分块策略后到底变好了还是变差了？换了 Embedding 模型效果如何？你需要一套**可量化、可回归**的评估体系。

### 为什么需要 RAG 评估

没有评估的 RAG 就像没有测试的代码——你以为它能跑，但不知道哪里会崩。

```
RAG 优化的闭环：
  改参数 → 跑评估 → 看指标 → 判断是否改进 → 继续迭代
              ↑
          没有评估 = 盲目调参
```

### RAGAS：RAG 专用评估框架

[RAGAS](https://github.com/explodinggradients/ragas) 是目前最流行的 RAG 评估框架，它定义了四个核心指标：

| 指标 | 评估什么 | 范围 | 直觉解释 |
|------|----------|------|----------|
| Faithfulness（忠实度） | 回答是否基于检索到的文档 | 0-1 | 模型有没有"编造"文档中没有的内容 |
| Context Precision（上下文精度） | 检索到的文档是否相关 | 0-1 | 检索结果中"噪声"多不多 |
| Context Recall（上下文召回率） | 回答所需信息是否都被检索到 | 0-1 | 该检索到的有没有漏掉 |
| Answer Relevancy（回答相关性） | 回答是否切题 | 0-1 | 有没有答非所问 |

```
完整的 RAG 评估数据流：

用户问题 ──→ 检索到的文档 ──→ 模型回答
   │              │               │
   │              ├─ Context Precision（文档准不准）
   │              ├─ Context Recall（文档全不全）
   │              │
   ├──────────────┼─ Faithfulness（回答有没有忠于文档）
   │
   └─ Answer Relevancy（回答切不切题）
```

### 准备评估数据集

RAGAS 需要三类数据：`question`（问题）、`answer`（RAG 生成的回答）、`contexts`（检索到的文档）。可选：`ground_truth`（标准答案，用于计算 Context Recall）。

```python
# 评估数据集
eval_dataset = [
    {
        "question": "公司的差旅报销上限是多少？",
        "ground_truth": "国内出差住宿上限为一线城市 500 元/晚，其他城市 400 元/晚。",
        # 以下由 RAG 系统生成：
        "answer": "",       # RAG 生成的回答
        "contexts": [],     # RAG 检索到的文档
    },
    {
        "question": "年假怎么申请？",
        "ground_truth": "年假需提前 3 个工作日在 OA 系统提交申请，由直属上级审批。",
        "answer": "",
        "contexts": [],
    },
    # ... 20-50 条测试用例
]
```

**构建评估集的原则**：
- 覆盖不同难度：简单事实题、多步推理题、需要对比的题
- 覆盖边界情况：文档中没有答案的问题（测"拒答"能力）
- 每条用例有 `ground_truth`——没有标准答案的用例只能评估 Faithfulness 和 Answer Relevancy

### 运行 RAGAS 评估

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    context_precision,
    context_recall,
    answer_relevancy,
)
from datasets import Dataset

# 注意：ragas API 迭代较快。若 import 失败，请查阅官方文档——
# 新版可能改为 Faithfulness() 类实例，数据集字段也可能从 ground_truth 改为 reference。

def run_rag_evaluation(test_cases: list, rag_fn) -> dict:
    """运行完整的 RAG 评估"""
    results = []
    for tc in test_cases:
        # 用 RAG 系统生成回答
        answer, contexts = rag_fn(tc["question"])

        results.append({
            "question": tc["question"],
            "answer": answer,
            "contexts": contexts,
            "ground_truth": tc.get("ground_truth", ""),
        })

    # 转为 HuggingFace Dataset
    dataset = Dataset.from_list(results)

    # 运行 RAGAS 评估
    scores = evaluate(
        dataset,
        metrics=[
            faithfulness,
            context_precision,
            context_recall,
            answer_relevancy,
        ],
    )

    return scores
```

### 解读评估结果

```
RAGAS 评估报告：
─────────────────────────────
faithfulness:          0.82   ← 82% 的回答内容有文档支撑
context_precision:     0.75   ← 75% 的检索文档是相关的
context_recall:        0.68   ← 只有 68% 的必要信息被检索到
answer_relevancy:      0.90   ← 90% 的回答切题
─────────────────────────────
```

**诊断指南**：

| 指标低 | 问题出在 | 优化方向 |
|--------|----------|----------|
| Context Precision 低 | 检索不准（噪声多） | 加 Reranking、调 top-k、换 Embedding |
| Context Recall 低 | 检索不全（漏信息） | 增大 top-k、改分块策略、加查询改写 |
| Faithfulness 低 | 模型"编造" | 加强 Prompt 约束（"只基于资料回答"）、换更强模型 |
| Answer Relevancy 低 | 答非所问 | 改 Prompt、加 Few-shot 示例、检查查询改写 |

### 用评估驱动优化

```
优化循环示例：

第 1 轮（基线）：
  分块：固定 500 字 | Embedding：3-small | 检索：纯向量 top-5
  → Faithfulness: 0.82 | Context Precision: 0.75 | Context Recall: 0.68

第 2 轮（加 Reranking）：
  分块：不变 | Embedding：不变 | 检索：混合 top-20 → Rerank top-5
  → Faithfulness: 0.85 | Context Precision: 0.88 ↑ | Context Recall: 0.72 ↑

第 3 轮（改分块策略）：
  分块：递归 400 字 | 其他不变
  → Faithfulness: 0.87 | Context Precision: 0.90 ↑ | Context Recall: 0.81 ↑

第 4 轮（加查询改写）：
  → Faithfulness: 0.89 | Context Precision: 0.91 | Context Recall: 0.85 ↑
```

每轮只改一个变量，用评估数据判断改动是否有效——和 A/B 测试的逻辑一样。

### 自动化评估流水线

```python
def evaluation_pipeline(rag_fn, eval_dataset, output_file="eval_report.json"):
    """一键评估 + 生成报告"""
    scores = run_rag_evaluation(eval_dataset, rag_fn)

    # 保存结果
    import json
    report = {
        "metrics": {k: float(v) for k, v in scores.items()},
        "details": scores.to_pandas().to_dict("records"),
    }
    with open(output_file, "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # 打印摘要
    print("RAGAS 评估报告：")
    for k, v in report["metrics"].items():
        print(f"  {k}: {v:.2f}")

    # 诊断建议
    for metric, value in report["metrics"].items():
        if value < 0.7:
            suggestions = {
                "faithfulness": "→ 加强 Prompt 中'只基于资料回答'的约束",
                "context_precision": "→ 增加 Reranking 步骤或减小 top-k",
                "context_recall": "→ 增大 top-k、改进分块策略或加查询改写",
                "answer_relevancy": "→ 优化 Prompt 或加 Few-shot 示例",
            }
            print(f"  ⚠️ {metric} 偏低 {suggestions.get(metric, '')}")

    return report
```

### 要点总结

- RAG 评估是 RAG 优化的前提——没有评估就是盲目调参
- RAGAS 四个核心指标：忠实度（没编造）、上下文精度（检索准）、上下文召回（检索全）、回答相关性（切题）
- 评估集需要 20-50 条用例，覆盖不同难度和边界情况
- 每轮优化只改一个变量，用评估数据判断效果——科学实验方法
- 指标诊断：Precision 低加 Reranking，Recall 低调分块和 top-k，Faithfulness 低加 Prompt 约束
- 把评估做成 CI 流水线——改代码/改 Prompt 后自动跑评估，不通过不合并
