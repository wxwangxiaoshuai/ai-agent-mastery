## 多模态模型能力对比：GPT-4o / Gemini / Claude 视觉

前 11 个模块，你的 Agent 只会读写文本。但真实世界的信息远不止文字——图片、语音、视频承载了人类大部分信息。**多模态 Agent 能看、能听、能说**，能力边界骤然扩大。这一节先把多模态模型的能力地图画清——各家擅长什么、API 怎么传、怎么选型。

### 多模态：从"读文字"到"用感官"

先理解多模态相对纯文本的根本跃迁。纯文本 Agent 的世界是符号化的——它只能处理"已经被写成文字"的信息。多模态让 Agent 直接接收原始感官数据：

```
纯文本 Agent：
  · 输入：用户打的字 / 网页文本 / API 返回的 JSON
  · 局限：图片要靠人先描述成文字（"图里有个红色柱状图..."）→ 信息损失严重
  · 盲区：语音、视频完全处理不了

多模态 Agent：
  · 输入：图片像素 / 音频波形 / 视频帧
  · 直接接收原始数据，不经"文字翻译"→ 信息保真
  · 能力：看图说话、听音转字、看视频理解时序
```

**关键认知**：多模态不是"文本+附件"，而是**模型直接理解非文本模态的原始表征**。这意味着信息保真度大幅提升——一张复杂图表，让模型直接看图，远胜过用人描述"图里有根红线从左下到右上"。

### 三大模态的输入与任务

多模态分三大类，各有典型任务：

| 模态 | 输入 | 典型任务 |
|------|------|---------|
| 视觉 | 图片、PDF、截图 | 物体识别、OCR、图表解析、文档理解 |
| 语音 | 音频 | STT（语音转文本）、说话人识别、情感分析 |
| 视频 | 视频帧序列 | 时序事件理解、关键片段提取、视频摘要 |

**注意**：语音和视频本质是"时序"模态——有时间维度，信息分布在时间上；图片是"空间"模态——信息分布在二维像素。处理时序模态比空间模态更复杂（要考虑帧间关系），这是 L12-04 视频比 L12-02 图片难的原因。

### 主流多模态模型横评

GPT-4o、Gemini、Claude 是当前三大视觉模型，各有侧重。理解差异而非记 API：

| 维度 | GPT-4o | Gemini | Claude |
|------|--------|--------|--------|
| 视觉理解 | 强，图表/文档解析扎实 | 强，长文档/多图擅长 | 强，细节描述/OCR 精细 |
| 多模态原生 | o=omni，原生多模态 | 原生多模态 | 文本+视觉 |
| 语音 | 原生语音输入输出 | 支持 | 主要文本+视觉 |
| 视频输入 | 有限（主要图） | 支持视频帧 | 主要图片 |
| 上下文窗口 | 中（128K） | 大（1M+） | 大（200K） |
| 强项 | 综合均衡、图表数据提取 | 超长文档/多图/视频 | OCR 精细、细节描述 |

**一句话记忆**：
- GPT-4o = 全能选手，图表/数据提取强
- Gemini = 大胃王，超长文档/视频/多图都吃
- Claude = 细节控，OCR 和精细描述强

> 注意：模型能力迭代极快，具体强弱随版本变化。这里讲的是**维度和选型思路**，选型前务必用你的真实数据测一遍——多模态效果对数据敏感，benchmark 不等于你的场景。

### 视觉 API 的输入格式

不管哪家，给模型"看图"都要把图片编码成 API 能接收的形式。三种主流方式：

```
1. base64 内联：图片转 base64 字符串，直接塞进请求
   · 优点：自包含，不依赖外部存储
   · 缺点：增大请求体（base64 比原文件大 ~33%），大图传输慢

2. URL 引用：传图片的公开 URL，模型自己去取
   · 优点：请求小，适合云端图片
   · 缺点：要图片可公开访问，模型要能下载

3. 文件上传：先用 files 接口上传拿 file_id，再引用
   · 优点：适合私有文件、大文件
   · 缺点：多一步上传，要管 file 生命周期
```

```python
# OpenAI 视觉：base64 方式
import base64
from openai import OpenAI
client = OpenAI()

def vision_base64(image_path: str, question: str) -> str:
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": question},
                {"type": "image_url",
                 "image_url": {"url": f"data:image/png;base64,{b64}"}},
            ],
        }],
        temperature=0,
    )
    return resp.choices[0].message.content

# URL 方式（图片已在公网）
def vision_url(image_url: str, question: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        }])
    return resp.choices[0].message.content
```

**选哪种**：
- 图片小且私有 → base64（自包含）
- 图片已在公网 → URL（省带宽）
- 图片大/私有 → 文件上传

> 坑：base64 大图会让请求体超过 API 限制（通常几 MB）。生产里大图要先压缩/缩放再编码，别直接 base64 一张 10MB 原图。

### 多图输入与对比

多模态模型支持一次输入多张图——这让"对比""多页文档"成为可能：

```python
def analyze_multiple(images: list[str], question: str) -> str:
    """多图分析（如对比两张图、理解多页文档）"""
    content = [{"type": "text", "text": question}]
    for img_path in images:
        b64 = base64.b64encode(open(img_path,"rb").read()).decode()
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"}})
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": content}])
    return resp.choices[0].message.content

# 用法：对比两张 UI 设计图
analyze_multiple(["ui_v1.png", "ui_v2.png"], "对比这两版设计的差异，指出改进点")
```

**多图的典型场景**：多页 PDF（每页一张图，L12-05）、UI 对比、前后变化分析。**Gemini 在多图/长文档上尤其强**，超多页文档优先考虑。

### 选型决策框架

按任务特征选模型，而非迷信某个：

```
你的多模态任务是什么？
├─ 图表数据提取（柱状图/折线图的数值）→ GPT-4o（数据提取扎实）
├─ OCR / 精细文字识别 → Claude（OCR 细节强）或专门 OCR 引擎
├─ 超长多页文档 → Gemini（大窗口+多图）
├─ 视频时序理解 → Gemini（原生视频支持）或自己采样帧+图片模型
├─ 实时语音对话 → GPT-4o（原生语音）或 STT+LLM+TTS 流水线（L12-03）
├─ 私有数据合规要求 → 看哪家满足数据驻留（企业版条款）
└─ 成本敏感 → GPT-4o-mini / Gemini Flash 等轻量版
```

**务实建议**：
1. **别只看 benchmark**：多模态效果对数据极敏感，官方 benchmark 用的图未必像你的图。选型前用你的真实样本跑 A/B。
2. **混合使用**：不同任务用不同模型，用模型路由（M1 讲过）按模态/任务分流。图表用 GPT-4o，OCR 用 Claude，长文档用 Gemini。
3. **轻量版优先试**：GPT-4o-mini、Gemini Flash 成本低很多，先试能不能满足，不行再上旗舰。

### 多模态的失败模式

多模态不是万能，有它特有的坑：

```
失败1：视觉幻觉
  · 图里没有的东西，模型"看"出来了（说图里有只猫，其实没有）
  · 对��：要求模型只描述确定看到的，不确定就明说"未在图中看到"

失败2：图表数值不准
  · 柱状图高度估错、坐标轴读偏
  · 对策：关键数值要校验（如和图例/坐标对不上则存疑）

失败3：OCR 漏字/错字
  · 模糊/倾斜的文字识别错
  · 对策：重要文档用专门 OCR（PaddleOCR/Tesseract）+ 多模态复核

失败4：长视频信息丢失
  · 视频太长，采样帧太少 → 漏关键事件
  · 对策：L12-04 的智能采样策略
```

> 多模态幻觉比文本幻觉更难发现——文本幻觉你能读出来错，视觉幻觉你可能信了。**关键信息要交叉验证**：模型说图里有数据 X，最好有别的来源印证，别单凭模型"一眼"。

### 要点总结

- 多模态让模型直接接收原始感官数据（像素/波形/帧），不经文字翻译，信息保真度大幅提升
- 三大模态：视觉（空间）、语音（时序）、视频（时序）；时序模态处理更复杂（帧间关系）
- 三模型横评：GPT-4o 全能+图表强、Gemini 大胃王+视频、Claude OCR 细节强——选型别信 benchmark，用真实数据测
- 视觉输入三格式：base64（小/私有，自包含）、URL（公网，省带宽）、文件上传（大/私有）
- base64 大图要压缩再编码，否则超 API 限制；多图输入支持对比/多页文档，Gemini 在多图长文档强
- 选型：图表数据→GPT-4o、OCR→Claude、长文档→Gemini、语音→GPT-4o原生或STT+LLM+TTS流水线
- 失败模式：视觉幻觉（无中生有）、数值不准、OCR 错字、长视频漏事件——关键信息要交叉验证
- 后续：L12-02 视觉理解 → L12-03 语音 → L12-04 视频 → L12-05 复杂文档深度解析
