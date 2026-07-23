## 视觉 Agent 专项实战：复杂图表与文档的深度解析

L12-02 讲了视觉理解基础。这一节深入最难的两个视觉场景——**复杂图表**和**文档深度解析**。真实世界的图表不是干净的单根柱状图，文档也不是一页清晰文字：混合图表、多页 PDF、嵌套表格、手写标注……这些才是企业视觉 AI 的主战场。这节把它们拿下。

### 为什么单图 OCR 不够：真实文档的复杂性

先把"难"量化——真实文档比 L12-02 举的例复杂得多：

```
L12-02 的理想文档：单页、清晰、单一图表
  → 多模态模型一眼搞定

真实文档的复杂性：
  · 多页：30 页 PDF，跨页表格、跨页图表
  · 混合图表：一张图里柱状图+折线图+饼图，多个 Y 轴
  · 嵌套表格：表中有表，合并单元格
  · 手写/印章：打印文字+手写批注+盖章叠加
  · 版式复杂：多栏、图文混排、页眉页脚干扰
  · 质量：扫描模糊、倾斜、阴影
```

**工程含义**：不能指望"一张图丢给模型就完事"。真实文档理解要**分而治之**——先拆解成可处理的单元（页/区域/图表/表格），逐个处理，再综合。这是本节的主线。

### 多页 PDF 文档的结构化理解

L12-02 提过多页一起送。但超长 PDF（几十上百页）一起送会超 token 限制。策略：

```
短文档（<10页）：全部一起送，跨页理解
长文档（>10页）：分批 + 跨页关系单独处理
  · 按章节/逻辑块分批
  · 跨页的表格/图形单独切出来完整送
  · 综合各批结果
```

```python
import fitz  # PyMuPDF
import json

def parse_long_pdf(pdf_path: str, schema: dict, batch_size: int = 5) -> dict:
    """长 PDF 分批理解"""
    doc = fitz.open(pdf_path)
    all_pages = [render_page_image(doc, i) for i in range(len(doc))]
    results = []

    # 分批：每 batch_size 页一批
    for i in range(0, len(all_pages), batch_size):
        batch = all_pages[i:i+batch_size]
        batch_result = understand_batch(batch, schema, page_offset=i)
        results.append(batch_result)

    # 综合各批（可能需要再过一次 LLM 做合并）
    merged = merge_batch_results(results, schema)
    return merged

def understand_batch(page_images: list, schema: dict, page_offset: int) -> dict:
    """理解一批页面"""
    content = [{"type": "text", "text":
        f"这是文档第{page_offset+1}-{page_offset+len(page_images)}页。"
        f"按 schema 提取：{json.dumps(schema)}。标注每字段来源页码。"}]
    for img in page_images:
        b64 = base64.b64encode(img).decode()
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"}})
    resp = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": content}],
        temperature=0, response_format={"type": "json_object"})
    return json.loads(resp.choices[0].message.content)
```

**跨页表格的处理**：表格可能跨页（第 5 页底到第 6 页顶）。**检测到跨页时，把这两页的表格区域裁切拼接成一张完整图再送模型**，比让模型"脑补跨页拼接"可靠。

### 混合图表：一图多类型多维度

真实图表常是"组合图"——柱状图+折线图叠加，甚至多个 Y 轴：

```
混合图表示例：
  · 左 Y 轴：销售额（柱状图）
  · 右 Y 轴：增长率（折线图）
  · X 轴：月份
  · 可能还有：饼图（占比）在角落

难点：
  · 哪条线/哪个柱属于哪个 Y 轴？
  · 多个数据系列怎么分清？
  · 双 Y 轴的数值分别读
```

```python
def extract_mixed_chart(image_path: str) -> dict:
    """混合图表提取，分维度"""
    b64 = base64.b64encode(open(image_path,"rb").read()).decode()
    resp = client.chat.completions.create(
        model="gpt-4o",   # 混合图表必须强模型
        messages=[{"role": "user", "content": [
            {"type": "text", "text":
                "分析这张混合图表。可能有多个数据系列（柱状/折线/饼图）"
                "和多个 Y 轴。输出 JSON："
                "{series:[{name, type:bar|line|pie, axis:left|right, "
                "data:[{label, value}]}], legend:[...]}。"
                "读不准的值标 null，不要猜。"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
        temperature=0, response_format={"type": "json_object"})
    return json.loads(resp.choices[0].message.content)
```

**混合图表的关键 prompt**：
- **明确告知"可能多系列多 Y 轴"**——否则模型只识别第一个系列就停
- **要求分 series 输出**——每个系列单独的 type/axis/data，结构清晰
- **读不准标 null**——混合图表数值更易错，强制诚实标注

**校验策略**：提取后，柱状图和折线图的数值应该分别和左右 Y 轴的刻度对得上。比如左轴 0-100，某柱读出 150 → 明显错（超轴范围）。

### 表格结构化提取

表格是文档理解里最难的——表格有结构（行列、合并单元格），要还原成结构化数据：

```
表格难点：
  · 合并单元格：跨行/跨列的单元格，模型可能重复或丢失
  · 表头识别：哪行是表头？多层表头？
  · 数据类型：数字 vs 文字 vs 单位
  · 无边框表格：靠对齐识别行列
```

```python
def extract_table(image_path: str) -> dict:
    """表格结构化提取"""
    b64 = base64.b64encode(open(image_path,"rb").read()).decode()
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": [
            {"type": "text", "text":
                "提取图中的表格为结构化 JSON。要求："
                "1. headers: 表头（可能是多层）"
                "2. rows: 每行数据，按列对应"
                "3. merged_cells: 标注合并单元格的位置和值"
                "4. 单位/类型尽量识别（如 '120元' 标 {value:120,unit:'元'}）"
                "5. 认不准的单元格标 [?]，不要猜"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
        temperature=0, response_format={"type": "json_object"})
    return json.loads(resp.choices[0].message.content)
```

**表格提取的可靠性增强**：纯多模态对复杂表格可能出错。生产里常**多模态 + 专门工具双路校验**：

```
双路校验：
  路1：多模态模型直接提取（理解上下文，能处理"语义表格"）
  路2：pdfplumber / Camelot 等专门表格提取工具（基于版式，精确）
  → 两路结果对比，不一致的单元格标记存疑，人工复核
```

```python
def extract_table_verified(pdf_path: str, page: int) -> dict:
    """双路校验表格提取"""
    # 路1：多模态
    page_img = render_page_image_pdf(pdf_path, page)
    llm_table = extract_table_from_image(page_img)
    # 路2：pdfplumber（基于版式）
    import pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        plumber_table = pdf.pages[page].extract_table()
    # 校验：对比两路结果，标记不一致
    return reconcile_tables(llm_table, plumber_table)
```

**为什么双路**：多模态理解语义强但可能漏行列；版式工具精确但遇扫描件/复杂合并就废。**两路互补，不一致即存疑**——这是把视觉幻觉降到最低的工程手段。

### 提取校验管道

把所有���觉提取放进统一的校验管道，而非信模型一眼：

```
校验管道（每个提取结果过一遍）：
  1. 格式校验：是否符合 schema（必填字段在不在、类型对不对）
  2. 范围校验：数值是否在合理范围（超 Y 轴/负数异常）
  3. 一致性校验：跨字段/跨页是否矛盾
  4. 双路校验：多模态 vs 专门工具，不一致存疑
  5. 置信度标注：每个字段标 confidence，低置信度人工复核
```

```python
def validate_extraction(result: dict, schema: dict) -> dict:
    """校验提取结果，标置信度"""
    issues = []
    # 格式校验
    for field, spec in schema.items():
        if spec.get("required") and field not in result:
            issues.append(f"缺必填字段: {field}")
    # 范围校验（示例：金额应为正数）
    if "amount" in result:
        val = parse_number(result["amount"])
        if val is not None and val < 0:
            issues.append(f"金额异常为负: {result['amount']}")
    # 标注置信度
    result["_issues"] = issues
    result["_confidence"] = "low" if issues else "high"
    return result
```

> 核心原则：**视觉提取的结果要像 RAG 引用溯源一样可校验**（M4 的思路）。模型说"这个数是 150"，要能追溯到"从图哪个位置读的、和坐标轴对不对得上"。不可校验的视觉提取在生产不可信——一次幻觉就可能导致基于错误数据的决策。

### 视觉专项的成本与精度权衡

深度视觉解析很贵——清醒权衡：

```
成本：
  · 多页 PDF：每页一次多模态调用 + 综合
  · 混合图表：强模型（GPT-4o 级），单次贵
  · 表格双路：多模态 + 版式工具，2 倍开销
  · 长文档可能 = 几十次多模态调用

精度优化：
  · 分而治之：粗筛用便宜模型定位"哪页有图表/表格"
  · 精分析用强模型只处理相关区域
  · 版式工具做免费预处理（pdfplumber 先试，不行再上多模态）
  · 缓存：同一文档重复解析，缓存结构化结果
```

**务实路径**：先用便宜版（GPT-4o-mini）+ 版式工具跑一遍，质量不够的关键部分再上强模型。别一上来全用 GPT-4o 解析全文档——成本会失控。

### 要点总结

- 真实文档复杂：多页跨页、混合图表多 Y 轴、嵌套合并表格、手写印章、扫描质量差——不能一眼搞定，要分而治之
- 长多页 PDF：短文档全送跨页理解，长文档分批 + 跨页表格/图形裁切拼接再送
- 混合图表：明确告知"可能多系列多 Y 轴"、分 series 输出、读不准标 null；数值和轴刻度交叉校验
- 表格提取：要求还原 headers/rows/merged_cells/单位；多模态理解语义强但可能漏行列
- 双路校验：多模态（语义强）+ pdfplumber/Camelot（版式精确）两路对比，不一致存疑人工复核
- 校验管道五步：格式校验、范围校验、一致性校验、双路校验、置信度标注——视觉提取要可校验可溯源
- 成本：深度解析极贵（几十次多模态调用）；优化靠分而治之（粗筛便宜+精分析强）+ 版式工具免费预处理 + 缓存
- 务实路径：便宜版+版式工具先跑，关键部分再上强模型，别一上来全用旗舰解析全文档
- M12 收官：从模型选型(L01)到视觉(L02/L05)、语音(L03)、视频(L04)，你已能构建多模态 Agent
