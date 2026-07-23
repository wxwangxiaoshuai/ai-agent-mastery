## 视觉理解 Agent：图片分析、图表解读、OCR、文档理解

L12-01 讲了模型怎么选、图怎么传。这一节真正让 Agent"看懂"图片——从最简单的"图里有什么"，到复杂的"从图表提取数据""读懂文档"。这是多模态工程最常用的一类，也是 P12 的核心模块。

### 视觉理解的能力阶梯

先建立能力地图——"看懂图片"是个阶梯，从易到难：

```
阶梯1：图片描述（这图里有什么）
  · "一张会议桌，4 个人围坐，桌上有笔记本电脑"
  · 难度：低，主流模型都行

阶梯2：细节问答（具体问题）
  · "桌上第 2 个人的杯子是什么颜色？"
  · 难度：中，要精确定位

阶梯3：图表数据提取（把图变数据）
  · 看柱状图，输出各柱数值
  · 难度：高，要量化读图

阶梯4：文档理解（图里有结构化信息）
  · 看发票/表格，提取字段
  · 难度：高，要 OCR+结构化

阶梯5：空间/逻辑推理
  · "这个零件装配到那个位置合适吗？"
  · 难度：极高，要空间推理
```

**工程含义**：别用阶梯5的难度去评估阶梯1的任务，也别指望阶梯1的能力做阶梯4的活。任务分级匹配模型能力。

### 图片描述：最基础也最常用

让 Agent 描述图片内容——这是无障碍、内容审核、图片检索的基础：

```python
import base64
from openai import OpenAI
client = OpenAI()

def describe_image(image_path: str, focus: str = None) -> str:
    """生成图片描述。focus 可指定关注点。"""
    b64 = base64.b64encode(open(image_path, "rb").read()).decode()
    prompt = focus or "详细描述这张图片的内容，包括主体、场景、细节。"
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
        temperature=0,
    )
    return resp.choices[0].message.content

# 用法
describe_image("meeting.jpg")
# → "会议室内，4人围坐椭圆桌，桌上有..."

describe_image("meeting.jpg", focus="数一下图里有几个人，分别拿什么设备")
# → "共4人，分别持有：1台笔记本、1部手机..."
```

**聚焦提问的价值**：泛泛"描述这张图"信息散；带 focus 的提问信息聚焦、可操作。**生产里多用聚焦提问**——你要什么信息就问什么，别让模型泛泛描述。

### 图表数据提取：把图变成结构化数据

Agent 最有商业价值的能力之一——从图表图片提取数值数据。比如把销售报表的柱状图变回 JSON：

```python
import json

def extract_chart_data(image_path: str) -> dict:
    """从图表提取结构化数据"""
    b64 = base64.b64encode(open(image_path, "rb").read()).decode()
    resp = client.chat.completions.create(
        model="gpt-4o",   # 数据提取用更强模型
        messages=[{"role": "user", "content": [
            {"type": "text", "text":
                "分析这张图表。输出 JSON："
                "{chart_type: bar|line|pie, title:..., "
                "x_label:..., y_label:..., "
                "data:[{label:..., value:...}]}。"
                "只输出确定读到的数值，读不准的标 null。"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)

# 用法
data = extract_chart_data("sales_chart.png")
# {"chart_type":"bar","title":"Q3销售",
#  "data":[{"label":"7月","value":120},{"label":"8月","value":150},...]}
```

**关键设计**：
- **结构化输出**：要求 JSON，而非自由描述（M2 的约束）——直接拿到可用的 data 数组
- **不确定标 null**：逼模型在"读不准"时承认，而非瞎编一个数（防视觉幻觉）
- **用更强模型**：数值提取比描述难，GPT-4o 级别更稳

**校验**：提取的数值要和坐标轴/图例交叉验证。比如模型说某柱是 150，但坐标轴顶到 200、该柱高度占 3/4 → 应在 150 附近，对得上才信。

### OCR：从图片识别文字

OCR 是文档理解的基础。两条路：

```
路1：多模态模型直接 OCR
  · 简单、能理解上下文（知道这是发票不是随便的字）
  · 适合：版式清晰、文字清晰的文档

路2：专门 OCR 引擎 + 多模态理解
  · PaddleOCR/Tesseract OCR 精度高
  · 多模态模型做"理解"（这块文字是啥意思、属于哪个字段）
  · 适合：模糊/倾斜/复杂版式的文档
```

```python
# 路1：多模态直接 OCR + 理解
def ocr_understand(image_path: str, schema: dict) -> dict:
    """OCR 并按 schema 提取字段"""
    b64 = base64.b64encode(open(image_path, "rb").read()).decode()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": [
            {"type": "text", "text":
                f"识别图中的文字，按以下 JSON schema 提取：{json.dumps(schema)}。"
                f"认不准的字用 [?] 标注，不要猜。"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)

# 用法：从发票图提取字段
invoice = ocr_understand("invoice.png", {
    "invoice_no": "发票号",
    "date": "日期",
    "seller": "销售方",
    "amount": "金额",
})
# {"invoice_no":"INV12345","date":"2026-07-23","amount":"1,200.00",...}
```

**关键 prompt 技巧**：`认不准的字用 [?] 标注，不要猜`——逼模型诚实标注不确定，而非幻觉一个似是而非的字。这是防 OCR 错误传染的关键。

### 文档理解：完整链路

真实文档理解不只 OCR——要处理多页、版式、表格、印章。完整链路：

```
PDF/图片文档
   │
   ├─→ 1. 预处理：PDF 转图片（每页一张）、去噪、矫正倾斜
   ├─→ 2. 版式分析：识别标题/段落/表格/图片区域
   ├─→ 3. OCR/识别：每个区域提取文字或数据
   ├─→ 4. 结构化：按 schema 把识别内容填进字段
   └─→ 5. 校验：必填字段缺失/格式不对则标记存疑
```

```python
def understand_document(pdf_path: str, schema: dict) -> dict:
    """多页文档理解"""
    # 1. PDF 转每页图片（用 pdf2image / PyMuPDF）
    page_images = pdf_to_images(pdf_path)   # [page1.png, page2.png, ...]

    # 2. 多页一起送多模态模型（Gemini 多图强项）
    content = [{"type": "text", "text":
        f"理解这份多页文档，按 schema 提取：{json.dumps(schema)}。"
        "标注每个字段的来源页码。认不准标 [?]。"}]
    for img in page_images:
        b64 = base64.b64encode(open(img, "rb").read()).decode()
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"}})

    resp = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": content}],
        temperature=0, response_format={"type": "json_object"})
    return json.loads(resp.choices[0].message.content)
```

**多页处理的要点**：
- 多页一起送 vs 逐页送：一起送让模型跨页理解（如表格跨页），但 token 多；逐页省 token 但跨页关系丢失。**有跨页结构时一起送**。
- 来源标注：要求标"字段来自第几页"，便于溯源和校验。
- 多模态文档（含图片/表格的文档）：版式分析要能区分"这是图""这是表"，分别用不同提取策略。

### 把视觉理解做成 Agent 工具

L06 讲过工具工程——视觉理解最好封装成 Agent 可调用的工具：

```python
# 用 function calling 把视觉能力暴露给 Agent
tools = [{
    "type": "function",
    "function": {
        "name": "analyze_image",
        "description": "分析图片。需要图片路径和分析重点。",
        "parameters": {
            "type": "object",
            "properties": {
                "image_path": {"type": "string"},
                "task": {"type": "string", "description": "描述/提取数据/OCR"},
            },
            "required": ["image_path", "task"],
        }},
}]

def execute_analyze_image(args):
    if "提取数据" in args["task"]:
        return extract_chart_data(args["image_path"])
    elif "OCR" in args["task"] or "识别" in args["task"]:
        return ocr_understand(args["image_path"], {})
    else:
        return describe_image(args["image_path"], args["task"])

# Agent 自己决定何时调视觉工具、调哪种
```

**价值**：Agent 不是"每次都调视觉"，而是"需要看图时才调"（M6 的工具决策）。比如用户问"这张发票多少钱"，Agent 调 OCR 工具提取 amount；问"图里有几个人"，调描述工具。**按需调用省成本**。

### 视觉理解的成本与延迟

视觉调用比文本贵且慢——清醒算账：

```
成本：
  · 图片 token 远多于文字（一张图 ~1000-2000 token，等价几百字文本）
  · 多模态模型通常比纯文本模型贵

延迟：
  · 图片 base64 编码 + 上传 + 模型处理视觉
  · 比"同样的文本"慢 2-5 倍

优化：
  · 图片预处理：缩放/压缩到够用即可（别发 4K 原图）
  · 按需调用：不是每轮都要看图，需要时才调
  · 缓存：同一张图重复问，缓存首次结果
  · 轻量版：GPT-4o-mini 够用就别上 4o
```

> 反模式：**每轮对话都把图片重发一遍**。用户问完"图里有几人"再问"都拿什么设备"，第二轮不必重发图——多模态模型支持多轮对话中"记住"之前的图（部分模型）。即便要重发，也该缓存而非重新编码。

### 要点总结

- 视觉理解五阶梯：描述→细节问答→图表数据→文档结构化→空间推理；任务难度匹配模型能力
- 图片描述用聚焦提问（你要什么问什么），泛泛描述信息散；结构化提取要求 JSON + 不确定标 null
- 图表数据提取要校验：数值和坐标轴/图例交叉验证，防视觉幻觉
- OCR 两路：多模态直接 OCR（清晰文档）vs 专门 OCR+多模态理解（模糊复杂）；认不准标 [?] 不猜
- 文档理解链路：预处理→版式分析→OCR/提取→结构化→校验；有跨页结构的多页一起送，标来源页码
- 视觉能力封装成 Agent 工具（M6），Agent 按需调用而非每轮都看图
- 成本延迟优化：图片预处理压缩、按需调用、缓存、轻量版优先；别每轮重发重编码图片
- 下一节 L12-03：语音模态——STT→LLM→TTS 实时流水线
