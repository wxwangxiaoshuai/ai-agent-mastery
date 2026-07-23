## 分块策略全解

分块（Chunking）是 RAG 的基石——文档怎么切，直接决定了检索的质量。切太大，一个 chunk 里混入多个话题，检索精度下降；切太小，上下文断裂，模型无法理解完整含义。

### 为什么分块很重要

```
文档（10000 字）
  ↓ 分块策略 A（500 字/块）→ 20 个 chunk → 检索精度 75%
  ↓ 分块策略 B（200 字/块）→ 50 个 chunk → 检索精度 82%
  ↓ 分块策略 C（语义分块）  → 35 个 chunk → 检索精度 88%
```

同一个文档、同一个 Embedding 模型，仅仅改变分块策略，检索精度就差 13 个百分点。

### 策略 1：固定大小分块

最简单的方式——按固定字符数切割，可加重叠区避免信息断裂。

```python
def fixed_size_chunk(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """固定大小分块，带重叠区"""
    if overlap >= chunk_size:
        raise ValueError("overlap 必须小于 chunk_size，否则会死循环")
    chunks = []
    start = 0
    step = chunk_size - overlap
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += step
    return chunks

# 示例
text = "这是第一段内容。这是第二段内容。" * 100
chunks = fixed_size_chunk(text, chunk_size=500, overlap=50)
# 产出 ~22 个 chunk，每个 500 字，相邻 chunk 有 50 字重叠
```

**优点**：实现简单、速度极快、chunk 大小一致（便于批处理）。

**缺点**：在句子中间切断，破坏语义完整性。

**适用场景**：快速原型、格式统一的日志/流水文本。

### 策略 2：语义分块

不按字数切，而是按语义边界切——在句子、段落或主题切换处分块。

```python
import re

def semantic_chunk(text: str, min_size: int = 200, max_size: int = 800) -> list[str]:
    """按段落+句子边界分块"""
    # 先按段落分割
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current = ""

    for para in paragraphs:
        # 如果当前块加上新段落超长，先保存当前块
        if len(current) + len(para) > max_size and current:
            chunks.append(current.strip())
            current = para
        else:
            current = current + "\n\n" + para if current else para

        # 如果当前块已经够大，保存
        if len(current) >= max_size:
            chunks.append(current.strip())
            current = ""

    if current.strip():
        chunks.append(current.strip())

    # 过滤太短的块（合并到前一个）
    merged = []
    for chunk in chunks:
        if merged and len(chunk) < min_size:
            merged[-1] += "\n\n" + chunk
        else:
            merged.append(chunk)

    return merged
```

**优点**：保持语义完整性、不在句子中间断开。

**缺点**：chunk 大小不均匀、对文档格式有要求（需要段落标记）。

**适用场景**：Markdown 文档、文章、报告、技术文档。

### 策略 3：递归分块（层级分块）

递归地按不同粒度的分隔符切分——先按章节，再按段落，再按句子。LangChain 的 `RecursiveCharacterTextSplitter` 用的就是这种策略。

```python
def recursive_chunk(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """递归分块：按层级分隔符逐步切分，切完后再做滑动重叠"""
    if overlap >= chunk_size:
        raise ValueError("overlap 必须小于 chunk_size")
    separators = ["\n## ", "\n### ", "\n\n", "\n", "。", "！", "？", ".", "!", "?", " "]

    def split_text(text: str, separators: list, chunk_size: int) -> list[str]:
        if len(text) <= chunk_size:
            return [text] if text.strip() else []

        # 找到能切分的分隔符
        for i, sep in enumerate(separators):
            if sep in text:
                parts = text.split(sep)
                chunks = []
                current = ""
                for part in parts:
                    candidate = current + sep + part if current else part
                    if len(candidate) <= chunk_size:
                        current = candidate
                    else:
                        if current:
                            chunks.append(current)
                        # 递归用更细的分隔符切分过长的 part
                        if len(part) > chunk_size:
                            chunks.extend(split_text(part, separators[i+1:], chunk_size))
                        else:
                            current = part
                if current:
                    chunks.append(current)
                return chunks

        # 没有分隔符能切，硬切
        return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

    raw = split_text(text, separators, chunk_size)
    if overlap <= 0 or len(raw) <= 1:
        return raw

    # 在相邻块之间补重叠：把前一块尾部拼到后一块开头
    overlapped = [raw[0]]
    for i in range(1, len(raw)):
        prev_tail = raw[i - 1][-overlap:]
        overlapped.append(prev_tail + raw[i])
    return overlapped
```

**优点**：自适应文档结构、在最佳位置切分、保持语义层级。

**缺点**：实现复杂、处理时间稍长。

**适用场景**：混合格式文档、技术文档、含标题层级的 Markdown。

### 策略 4：Agentic 分块（LLM 驱动）

让 LLM 决定怎么切——它能理解语义，在"话题转换"处分块。

```python
def agentic_chunk(text: str, target_chunks: int = 5) -> list[str]:
    """用 LLM 识别语义边界进行分块"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""将以下文档分成约 {target_chunks} 个语义完整的段落。
在每个段落的边界处插入 "---CHUNK---" 分隔符。
保持原文不变，只添加分隔符。

文档：
{text}""",
        }],
        temperature=0,
        max_tokens=4000,
    )
    result = response.choices[0].message.content
    return [c.strip() for c in result.split("---CHUNK---") if c.strip()]
```

**优点**：语义质量最高、在真正的"话题转换"处分块。

**缺点**：成本高（每次分块都调 LLM）、速度慢、不适合实时处理。

**适用场景**：高质量离线索引、文档量不大但精度要求高的场景。

### 四种策略对比

| 策略 | 实现复杂度 | 语义质量 | 速度 | 成本 | 适用场景 |
|------|-----------|----------|------|------|----------|
| 固定大小 | 极低 | 低 | 极快 | 零 | 原型验证、日志 |
| 语义分块 | 中 | 中 | 快 | 零 | 文档、文章 |
| 递归分块 | 高 | 中高 | 中 | 零 | 技术文档、Markdown |
| Agentic | 低 | 高 | 慢 | 高 | 高精度离线索引 |

**选型建议**：
- 起步用**递归分块**（效果和速度的平衡点）
- 精度不够时升级到 **Agentic 分块**（离线索引，一次性成本）
- 格式统一的简单文档用**语义分块**就够了

### 分块参数调优

无论哪种策略，三个关键参数需要调优：

```python
# 参数对检索质量的影响
chunk_size = 500    # 太大→精度低，太小→上下文不足
overlap = 50        # 太大→冗余，太小→信息断裂
min_chunk_size = 100  # 太小→噪声 chunk，太大→合并过度
```

**经验值**：
| 文档类型 | 推荐 chunk_size | 推荐 overlap |
|----------|----------------|-------------|
| 技术文档 | 400-600 | 50-100 |
| 法律合同 | 300-500 | 50 |
| 新闻文章 | 500-800 | 100 |
| 代码文件 | 按函数/类分块 | 0 |
| FAQ 问答 | 按问答对分块 | 0 |

### 要点总结

- 分块是 RAG 的基石——同一文档换个分块策略，检索精度可差 10%+
- 四种策略从简到精：固定大小 → 语义分块 → 递归分块 → Agentic 分块
- 递归分块是性价比最高的默认选择（LangChain 默认策略）
- 关键参数：chunk_size（建议 300-800）、overlap（建议 50-100）
- 代码文件按函数/类分块，FAQ 按问答对分块——不要用固定大小
- 分块策略的选型最终要靠 RAG 评估来验证（L04-05 详解）
