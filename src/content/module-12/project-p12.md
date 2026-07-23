## 多模态内容分析 Agent

M12 五节课讲了多模态选型、视觉理解、语音流水线、视频理解、复杂文档深度解析。P12 把它们组装成一个**支持图片、语音、视频三种模态的内容分析 Agent**——用户上传任意一种，Agent 自动识别模态、走对应处理链路、输出统一结构化报告。这是"一个 Agent 处理所有媒体"的集成交付。

### 项目目标

构建多模态内容分析 Agent：
- 多模态输入路由：自动识别图片/语音/视频并分流
- 图片分析：内容描述 + OCR + 图表数据提取
- 语音分析：转写 + 摘要 + 情感分析
- 视频分析：关键帧提取 + 时序事件标注 + 视频摘要
- 统一结构化报告：所有模态输出同一 schema 的报告

### 验收标准

- [ ] 上传图片/语音/视频，Agent 自动识别模态并路由到对应处理器
- [ ] 图片：输出内容描述 + OCR 文字（如有）+ 图表数据（如有，JSON）
- [ ] 语音：输出转写文本 + 摘要 + 情感（正面/负面/中性+理由）
- [ ] 视频：输出关键帧时间戳 + 事件标注 + 整体摘要
- [ ] 三模态输出统一报告 schema（模态/内容/数据/摘要/置信度）
- [ ] 视觉提取有校验（数值范围/双路校验，L12-05）
- [ ] 含测试：三模态各自处理 + 路由正确性

### 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│            多模态内容分析 Agent                                │
│                                                               │
│  用户上传文件                                                 │
│    │                                                          │
│    ▼                                                          │
│  [模态路由] 按扩展名/MIME 分流                                │
│    │                                                          │
│    ├─ 图片(.png/.jpg/.pdf)                                    │
│    │    └→ [图片处理器]                                        │
│    │         · describe_image（内容描述）                      │
│    │         · ocr_understand（OCR，L12-02）                   │
│    │         · extract_chart_data（图表数据，L12-02/05）       │
│    │         · validate（L12-05 校验管道）                     │
│    │                                                          │
│    ├─ 语音(.mp3/.wav/.m4a)                                     │
│    │    └→ [语音处理器]                                        │
│    │         · stt（Whisper 转写，L12-03）                     │
│    │         · summarize（摘要）                               │
│    │         · sentiment（情感分析）                           │
│    │                                                          │
│    └─ 视频(.mp4/.mov)                                          │
│         └→ [视频处理器]                                        │
│              · sample_frames（帧采样，L12-04）                 │
│              · locate_events（事件定位）                       │
│              · summarize（视频摘要）                           │
│    │                                                          │
│    ▼                                                          │
│  [报告组装] 统一 schema：{modality, content, data, summary, confidence} │
│    │                                                          │
│    ▼                                                          │
│  结构化 JSON 报告                                             │
└──────────────────────────────────────────────────────────────┘
```

### 实施步骤

**Step 1：模态路由**

```python
# agent/router.py
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv"}
# PDF 单独处理（多页文档，L12-05）

def route_by_modality(file_path: str) -> str:
    """按扩展名路由模态"""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf": return "pdf"
    if ext in IMAGE_EXTS: return "image"
    if ext in AUDIO_EXTS: return "audio"
    if ext in VIDEO_EXTS: return "video"
    raise ValueError(f"不支持的文件类型: {ext}")

# 也可用 MIME 兜底
def route_by_mime(file_path: str) -> str:
    import mimetypes
    mime = mimetypes.guess_type(file_path)[0] or ""
    if mime.startswith("image"): return "image"
    if mime.startswith("audio"): return "audio"
    if mime.startswith("video"): return "video"
    if mime == "application/pdf": return "pdf"
    return "unknown"
```

**Step 2：图片处理器（复用 L12-02/L12-05）**

```python
# agent/image_processor.py
import base64, json
from openai import OpenAI
client = OpenAI()

def process_image(image_path: str) -> dict:
    """图片分析：描述 + OCR + 图表数据"""
    b64 = base64.b64encode(open(image_path, "rb").read()).decode()
    # 一次性多任务：让模型判断是普通图/含文字/含图表，并分别处理
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": [
            {"type": "text", "text":
                "分析这张图片。输出 JSON："
                "{description:'内容描述', "
                "has_text:bool, ocr_text:'识别到的文字(没有则空)', "
                "has_chart:bool, chart_data:{chart_type,data:[...]}(无图表则null), "
                "confidence:'high|medium|low'}。"
                "读不准的标 [?] 或 null，不要猜。"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
        temperature=0, response_format={"type": "json_object"})
    result = json.loads(resp.choices[0].message.content)

    # 校验（L12-05）：有图表数据时验数值合理性
    if result.get("has_chart") and result.get("chart_data"):
        result["chart_data"] = validate_chart(result["chart_data"])
    return result

def validate_chart(chart: dict) -> dict:
    """图表数据校验：数值非负、类型合法"""
    issues = []
    for d in chart.get("data", []):
        v = d.get("value")
        if v is not None and v < 0:
            issues.append(f"数值异常为负: {d}")
    chart["_validation_issues"] = issues
    return chart
```

**Step 3：语音处理器（复用 L12-03）**

```python
# agent/audio_processor.py
import openai, json

def process_audio(audio_path: str) -> dict:
    """语音分析：转写 + 摘要 + 情感"""
    # 1. STT 转写（Whisper）
    with open(audio_path, "rb") as f:
        transcript = openai.Audio.transcribe(model="whisper-1", file=f, language="zh").text

    # 2. 摘要 + 情感（一次 LLM 调用）
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content":
            f"分析这段语音转写文本。输出 JSON："
            f"{{summary:'摘要(3句内)', sentiment:'正面|负面|中性', "
            f"reason:'情感判断理由', key_points:['关键点...']}}。\n\n转写：\n{transcript}"}],
        temperature=0, response_format={"type": "json_object"})
    analysis = json.loads(resp.choices[0].message.content)
    return {"transcript": transcript, **analysis}
```

**Step 4：视频处理器（复用 L12-04）**

```python
# agent/video_processor.py
import cv2, base64, json, subprocess

def process_video(video_path: str, max_frames: int = 20) -> dict:
    """视频分析：关键帧 + 事件标注 + 摘要"""
    # 1. 帧采样（关键帧采样，L12-04）
    frames = sample_keyframes(video_path, max_frames)
    fps = cv2.VideoCapture(video_path).get(cv2.CAP_PROP_FPS)

    # 2. 时序理解 + 事件标注
    content = [{"type": "text", "text":
        "这些是视频按时间顺序的关键帧。输出 JSON："
        "{events:[{time_sec, description}], summary:'整体摘要(2句)'}。"
        "标注每个事件的大致时间。"}]
    for i, (frame, ts) in enumerate(frames):
        _, buf = cv2.imencode(".jpg", frame)
        b64 = base64.b64encode(buf).decode()
        content.append({"type": "text", "text": f"[第{i+1}帧 / {ts:.1f}秒]"})
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
    resp = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": content}],
        temperature=0, response_format={"type": "json_object"})
    return json.loads(resp.choices[0].message.content)

def sample_keyframes(video_path: str, max_n: int) -> list:
    """关键帧采样（场景变化），返回 [(frame, timestamp), ...]"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames, prev_gray, last_ts = [], None, -1
    while True:
        ret, frame = cap.read()
        if not ret: break
        ts = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray).mean()
            if diff > 30 and ts - last_ts > 2:
                frames.append((frame, ts)); last_ts = ts
        else:
            frames.append((frame, ts)); last_ts = ts
        prev_gray = gray
    cap.release()
    return frames[:max_n]
```

**Step 5：PDF 处理器（复用 L12-05）**

```python
# agent/pdf_processor.py
import fitz, base64, json

def process_pdf(pdf_path: str, max_pages: int = 10) -> dict:
    """多页 PDF 理解"""
    doc = fitz.open(pdf_path)
    pages = []
    for i in range(min(len(doc), max_pages)):
        pix = doc[i].get_pixmap()
        pages.append(pix.tobytes("png"))

    content = [{"type": "text", "text":
        "理解这份多页文档。输出 JSON："
        "{doc_type:'文档类型(发票/合同/报告/...)', "
        "summary:'内容摘要', key_fields:{字段:值}, "
        "source_pages:{字段:页码}}。认不准标 [?]。"}]
    for img in pages:
        b64 = base64.b64encode(img).decode()
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"}})
    resp = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": content}],
        temperature=0, response_format={"type": "json_object"})
    return json.loads(resp.choices[0].message.content)
```

**Step 6：报告组装（统一 schema）**

```python
# agent/report.py
def assemble_report(modality: str, content_result: dict) -> dict:
    """组装统一结构化报告"""
    report = {
        "modality": modality,
        "summary": content_result.get("summary", ""),
        "data": content_result,
        "confidence": content_result.get("confidence", "medium"),
    }
    # 各模态特化
    if modality == "image":
        report["content"] = {
            "description": content_result.get("description"),
            "ocr_text": content_result.get("ocr_text"),
            "chart": content_result.get("chart_data"),
        }
    elif modality == "audio":
        report["content"] = {
            "transcript": content_result.get("transcript"),
            "sentiment": content_result.get("sentiment"),
            "key_points": content_result.get("key_points"),
        }
    elif modality == "video":
        report["content"] = {
            "events": content_result.get("events"),
            "frame_count": len(content_result.get("events", [])),
        }
    elif modality == "pdf":
        report["content"] = {
            "doc_type": content_result.get("doc_type"),
            "key_fields": content_result.get("key_fields"),
        }
    return report
```

**Step 7：主 Agent（路由 + 分流 + 组装）**

```python
# agent/main.py
from .router import route_by_modality
from .image_processor import process_image
from .audio_processor import process_audio
from .video_processor import process_video
from .pdf_processor import process_pdf
from .report import assemble_report

PROCESSORS = {
    "image": process_image,
    "audio": process_audio,
    "video": process_video,
    "pdf": process_pdf,
}

def analyze(file_path: str) -> dict:
    """多模态内容分析主入口"""
    modality = route_by_modality(file_path)
    processor = PROCESSORS[modality]
    content_result = processor(file_path)
    report = assemble_report(modality, content_result)
    report["file"] = file_path
    return report

# 用法
import json
print(json.dumps(analyze("photo.jpg"), ensure_ascii=False, indent=2))
print(json.dumps(analyze("meeting.mp3"), ensure_ascii=False, indent=2))
print(json.dumps(analyze("demo.mp4"), ensure_ascii=False, indent=2))
```

**Step 8：测试**

```python
# tests/test_multimodal.py
import pytest
from agent.main import analyze
from agent.router import route_by_modality

class TestRouter:
    def test_image_routing(self):
        assert route_by_modality("a.png") == "image"
        assert route_by_modality("b.jpg") == "image"
    def test_audio_routing(self):
        assert route_by_modality("a.mp3") == "audio"
        assert route_by_modality("b.wav") == "audio"
    def test_video_routing(self):
        assert route_by_modality("a.mp4") == "video"
    def test_pdf_routing(self):
        assert route_by_modality("a.pdf") == "pdf"
    def test_unsupported(self):
        with pytest.raises(ValueError):
            route_by_modality("a.xyz")

class TestProcessors:
    def test_image_report_schema(self):
        r = analyze("test_data/chart.png")
        assert r["modality"] == "image"
        assert "summary" in r and "confidence" in r
        assert "description" in r["content"]
    def test_audio_report_schema(self):
        r = analyze("test_data/voice.mp3")
        assert r["modality"] == "audio"
        assert "transcript" in r["content"]
        assert "sentiment" in r["content"]
    def test_video_report_schema(self):
        r = analyze("test_data/clip.mp4")
        assert r["modality"] == "video"
        assert "events" in r["content"]
```

### 进阶挑战

1. **流式语音**：把语音处理升级为实时对话（L12-03 的 STT→LLM→TTS 流式流水线 + 打断）
2. **混合模态**：一份"带语音的视频"，同时处理视频帧+音轨，关联分析
3. **视觉双路校验**：PDF 表格用多模态+pdfplumber 双路提取校验（L12-05）
4. **Agent 工具化**：把分析能力封装成 Agent 工具（M6），让 Agent 按需调用而非被动处理
5. **批量处理**：多文件并行分析 + 汇总报告（M7 并发控制）
6. **成本优化**：粗筛用轻量模型定位关键页/帧，再上强模型精分析

### 要点回顾

- 多模态 Agent = 模态路由 + 三处理器 + 统一报告组装
- 路由：按扩展名/MIME 分流图片/语音/视频/PDF
- 图��处理：一次多任务调用（描述+OCR+图表），结构化输出 + 校验
- 语音处理：STT(Whisper) 转写 + LLM 摘要情感
- 视频处理：关键帧采样 + 时序理解 + 事件标注时间戳
- PDF 处理：多页转图 + 多图送模型 + 结构化字段 + 来源页码
- 统一报告 schema：{modality, content, summary, confidence}，三模态特化 content 字段
- 视觉提取要校验：数值范围合理性、读不准标 [?]/null、双路校验存疑
- 测试：路由正确性 + 三模态各自报告 schema 一致性
- M12 收官：你已能构建看/听/读视频的多模态 Agent；M13 进入质量保障——评估、护栏、测试、可观测

### 下一步

完成 P12 后，你的 Agent 有了多模态感官。M13「评估、护栏、测试与可观测性」是 Agent 走向生产的关键工程能力——让 Agent 可度量、可管控、可信任、可测试。
