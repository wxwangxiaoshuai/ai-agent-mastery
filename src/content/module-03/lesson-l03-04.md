## 上下文压缩

长上下文不仅贵（token 多 = 钱多），而且效果可能更差——模型在超长上下文中会出现"Lost in the Middle"效应：位于上下文中部的信息容易被忽略。上下文压缩的目标是：**用更少的 token 传达同等的信息量**。

### 为什么需要压缩

| 问题 | 不压缩 | 压缩后 |
|------|--------|--------|
| 成本 | 10K token 输入 → $0.03/次 | 3K token 输入 → $0.009/次 |
| 延迟 | 首 token 延迟 2.5s | 首 token 延迟 1.0s |
| 准确率 | 中部信息可能被忽略（Lost in Middle） | 关键信息更集中 |
| 窗口压力 | 占用大量上下文窗口 | 释放空间给其他内容 |

### 方法 1：摘要压缩

最简单也最通用的方法——用 LLM 把长文本压缩成摘要。

```python
def summarize_for_context(text: str, max_tokens: int = 500) -> str:
    """用 LLM 将长文本压缩为摘要"""
    if count_tokens(text) <= max_tokens:
        return text  # 已经够短，不需要压缩

    response = client.chat.completions.create(
        model="gpt-4o-mini",  # 用轻量模型做摘要，省钱
        messages=[{
            "role": "user",
            "content": f"请将以下内容压缩为不超过 {max_tokens} token 的摘要，"
                       f"保留所有关键事实、数据和结论，只删除冗余表达。\n\n{text}",
        }],
        max_tokens=max_tokens,
        temperature=0,
    )
    return response.choices[0].message.content
```

**适用场景**：对话历史压缩、长文档预处理、工具返回结果压缩。

**优点**：通用、理解语义、保留关键信息。

**缺点**：需要额外一次 LLM 调用（成本和延迟）、可能丢失细节、摘要本身可能有误。

### 方法 2：选择性压缩（Selective Context）

不调用 LLM，而是用算法**删除信息量低的句子**，保留高信息量的内容。

```python
import re
from collections import Counter

def selective_compress(text: str, keep_ratio: float = 0.5) -> str:
    """基于词频的选择性压缩：保留信息量高的句子，并保持原文顺序"""
    sentences = re.split(r'(?<=[。！？.!?])\s*', text)

    # 计算每个句子的"信息量"——用罕见词比例衡量
    all_words = re.findall(r'\w+', text.lower())
    word_freq = Counter(all_words)

    scored_sentences = []
    for idx, sent in enumerate(sentences):
        words = re.findall(r'\w+', sent.lower())
        if not words:
            continue
        # 信息量 = 句子中罕见词的平均比例（越罕见信息量越高）
        info_score = sum(1 / word_freq[w] for w in words) / len(words)
        scored_sentences.append((info_score, idx, sent))

    # 按信息量选出 top-k，再按原文下标还原顺序
    scored_sentences.sort(key=lambda x: x[0], reverse=True)
    keep_count = max(1, int(len(scored_sentences) * keep_ratio))
    kept = sorted(scored_sentences[:keep_count], key=lambda x: x[1])
    return " ".join(sent for _, _, sent in kept)
```

**原理**：高频词（"的"、"是"、"在"）信息量低，低频词（具体名词、数据、结论）信息量高。保留含低频词多的句子。

**优点**：不需要额外 LLM 调用、速度快、无信息失真（只是删除，不修改）。

**缺点**：不理解语义、可能删除重要但"用词普通"的句子。

### 方法 3：LLMLingua

[LLMLingua](https://github.com/microsoft/LLMLingua) 是微软开源的 Prompt 压缩工具，用小模型评估每个 token 的"重要性"，删除不重要的 token。

```python
# pip install llmlingua
from llmlingua import PromptCompressor

llm_lingua = PromptCompressor(
    model_name="microsoft/llmlingua-2-bert-base-multilingual-c7-meetingbank",
    use_llmlingua2=True,
)

def compress_with_llmlingua(text: str, rate: float = 0.5) -> str:
    """用 LLMLingua 压缩文本，rate=0.5 表示压缩到原来的 50%"""
    compressed = llm_lingua.compress_prompt(
        text,
        rate=rate,
        force_tokens=['\n', '?', '.', ','],  # 保留标点
    )
    return compressed["compressed_prompt"]
```

**原理**：用小模型（如 BERT）计算每个 token 的困惑度（perplexity）。困惑度低 = 可预测 = 信息量低 → 删除。困惑度高 = 不可预测 = 信息量高 → 保留。

**效果**：通常能压缩 2-5 倍，且对模型理解影响很小。

**优点**：压缩比高、保留语义、不调用大模型。

**缺点**：需要加载额外模型、首次加载有延迟、中文压缩效果略差于英文。

### 三种方法对比

| 维度 | 摘要压缩 | 选择性压缩 | LLMLingua |
|------|----------|------------|-----------|
| 压缩比 | 高（可达 10:1） | 中（2-3:1） | 高（2-5:1） |
| 语义保留 | 中（可能失真） | 低（只删不改） | 高（保留关键 token） |
| 额外成本 | 需要一次 LLM 调用 | 无 | 需要加载小模型 |
| 速度 | 慢（LLM 调用） | 快（纯算法） | 中等（小模型推理） |
| 适用场景 | 对话历史、长文档 | 结构化文本、日志 | Prompt、工具结果 |
| 中文支持 | 好 | 一般 | 一般 |

### 混合压缩管道

生产环境推荐混合使用多种方法：

```python
class CompressionPipeline:
    """混合压缩管道：先选择性压缩，再 LLMLingua，最后摘要"""

    def __init__(self, target_ratio: float = 0.3):
        self.target_ratio = target_ratio

    def compress(self, text: str) -> str:
        original_tokens = count_tokens(text)
        target_tokens = int(original_tokens * self.target_ratio)

        # Stage 1：如果已经够短，直接返回
        if original_tokens <= target_tokens:
            return text

        # Stage 2：选择性压缩——删除低信息量句子（快速、无额外成本）
        text = selective_compress(text, keep_ratio=0.7)
        if count_tokens(text) <= target_tokens:
            return text

        # Stage 3：LLMLingua 压缩——token 级压缩（中等成本）
        try:
            rate = target_tokens / count_tokens(text)
            text = compress_with_llmlingua(text, rate=rate)
            if count_tokens(text) <= target_tokens:
                return text
        except Exception:
            pass  # LLMLingua 不可用时降级到摘要

        # Stage 4：摘要压缩——最后的手段（最激进但有失真风险）
        return summarize_for_context(text, max_tokens=target_tokens)
```

### 对话历史压缩的特殊策略

对话历史是 Agent 中增长最快的部分。专门的压缩策略：

```python
def compress_history(history: list, max_tokens: int = 2000) -> list:
    """对话历史压缩：保留最近的 + 摘要旧的"""
    if count_tokens(str(history)) <= max_tokens:
        return history

    # 保留最近 3 轮完整对话
    recent = history[-6:]  # 最近 3 轮（每轮 2 条消息）

    # 摘要旧历史
    old = history[:-6]
    if old:
        old_text = "\n".join(f"{m['role']}: {m['content']}" for m in old)
        summary = summarize_for_context(old_text, max_tokens=500)
        summary_msg = {"role": "system", "content": f"[之前对话摘要]\n{summary}"}
        return [summary_msg] + recent

    return recent
```

**策略**：最近 3 轮完整保留 + 旧历史用摘要替代。这平衡了"近期细节"和"长期记忆"。

### 要点总结

- 上下文压缩的目标：用更少 token 传达同等信息量，同时缓解"Lost in the Middle"效应
- 三种方法各有适用场景：摘要压缩（通用但有失真）、选择性压缩（快速但粗粒度）、LLMLingua（精细但需额外模型）
- 生产环境推荐混合管道：选择性压缩 → LLMLingua → 摘要压缩，逐级降级
- 对话历史用特殊策略：近期完整保留 + 旧历史摘要替代
- 压缩是"信息保真度 vs token 成本"的权衡——没有免费午餐
