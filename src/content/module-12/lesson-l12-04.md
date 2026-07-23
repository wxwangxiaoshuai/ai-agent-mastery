## 视频理解 Agent：帧采样、时序分析、关键片段提取

视频是 L12-01 说的时序模态——信息分布在时间上，且密度极高。你不能把一整段视频"喂"给模型（模型不支持、token 爆炸），必须先采样成关键帧，再让多模态模型理解帧序列的时序关系。这一节解决"怎么从视频里提取有用信息"。

### 视频理解的本质难题

先想清楚视频比图片难在哪：

```
图片：一张图，1 个空间维度（二维像素）
  · 直接送模型，看一眼就懂
  · token 可控（1 张图 ~1-2k token）

视频：一段时间，1 个空间 + 1 个时间维度
  · 30fps × 60秒 = 1800 帧！
  · 全送模型：token 爆炸（1800×1k = 1.8M token），且模型也看不过来
  · 帧间有大量冗余（相邻帧几乎一样）
```

**核心难题**：视频帧太多，必须**采样**——从 1800 帧里挑出"代表整段视频"的几十帧。采样的好坏决定理解质量：采少了漏关键事件，采多了 token 爆炸。

### 帧采样策略

三种主流采样策略，各有适用：

```
策略1：均匀采样（最简）
  · 每隔 N 秒取一帧（如每 2 秒一帧）
  · 优点：实现 5 行，覆盖全时间线
  · 缺点：可能漏关键瞬间事件（如突然的爆炸/动作）

策略2：关键帧采样（运动去冗余）
  · 提取场景变化大的帧（视频编码的 I 帧）
  · 优点：去掉冗余，保留场景切换
  · 缺点：静态长镜头仍可能冗余、动作细节可能漏

策略3：场景变化采样（智能）
  · 检测画面内容突变，在变化点采样
  · 优点：信息密度高，抓住"内容变了"的时刻
  · 缺点：实现复杂，需场景检测
```

```python
import cv2  # OpenCV

def sample_frames_uniform(video_path: str, interval_sec: float = 2.0) -> list:
    """均匀采样：每 interval_sec 秒一帧"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_step = int(fps * interval_sec)
    frames, idx = [], 0
    while True:
        ret, frame = cap.read()
        if not ret: break
        if idx % frame_step == 0:
            frames.append(frame)
        idx += 1
    cap.release()
    return frames

def sample_frames_keyframe(video_path: str, max_frames: int = 30) -> list:
    """关键帧采样：基于场景变化（帧差分）"""
    cap = cv2.VideoCapture(video_path)
    frames, prev_gray, last_saved = [], None, -1
    while True:
        ret, frame = cap.read()
        if not ret: break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray).mean()
            if diff > 30:   # 场景变化阈值
                if len(frames) - last_saved > 5:   # 避免太密
                    frames.append(frame); last_saved = len(frames)
        else:
            frames.append(frame); last_saved = 0
        prev_gray = gray
    cap.release()
    # 限制总数（token 预算）
    return frames[:max_frames]
```

**采样决策**：
- 简单概览（视频讲了啥）→ 均匀采样
- 事件密集（监控/体育）→ 关键帧/场景变化
- 长视频（讲座/会议）→ 均匀 + 去冗余

**关键原则**：**帧数要受 token 预算约束**。30 帧送多模态模型 = 30×1k = 30k token，已经很贵。控制采样到 10-30 帧，而非越多越好。

### 帧序列的时序理解

采样完帧，怎么让模型理解"时间关系"？三种方式：

```
方式1：多图+顺序提问
  · 把帧按时间顺序送模型，问"这些帧的时间顺序发生了什么"
  · 简单，但模型对顺序的理解依赖 prompt 引导

方式2：时间戳标注
  · 每帧标注"第 X 秒"，模型能定位事件时间
  · 适合要"事件在哪一秒发生"的任务

方式3：分段理解再综合
  · 视频分段，每段独立理解，再综合成整体
  · 适合超长视频（一段段处理，每段不超模型限制）
```

```python
def understand_video(frames: list, fps: float, question: str) -> str:
    """多模态理解视频帧序列"""
    content = [{"type": "text", "text":
        f"以下是视频按时间顺序的关键帧（每帧间隔约{1/fps:.1f}秒）。"
        f"基于帧序列回答：{question}"}]
    for i, frame in enumerate(frames):
        # 帧转 base64
        _, buf = cv2.imencode(".jpg", frame)
        b64 = base64.b64encode(buf).decode()
        time_sec = i * (1/fps) * 2  # 假设采样间隔2秒（示例简化）
        content.append({"type": "text", "text": f"[第{i+1}帧 / {time_sec:.1f}秒]"})
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})

    resp = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": content}],
        temperature=0)
    return resp.choices[0].message.content
```

**关键 prompt 技巧**：
- **明确告诉模型这是时间序列**："按时间顺序的关键帧"——否则模型可能当成一组并列图
- **标注时间戳**："第3帧/6.0秒"——让模型能定位事件时间，回答可引用时间

### 事件定位与时序分析

视频理解的高级任务——**定位事件发生在哪**：

```
任务：用户问"视频中什么时候出现了红色汽车？"
  · 不能只说"出现了红色汽车"
  · 要定位："在 12-15 秒之间画面右侧出现红色汽车"

实现：
  · 分段采样 + 逐段判断"这段含红色汽车吗"
  · 含事件的段标时间戳
  · 综合输出"事件时间段"
```

```python
def locate_event(video_path: str, event_desc: str) -> list:
    """定位事件发生的时间段"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    segments = []   # [(start_sec, end_sec, frame)]
    # 每 3 秒一段，取每段中间帧
    while True:
        ret, frame = cap.read()
        if not ret: break
        # ... 采样分段（简化）
    cap.release()

    # 逐段判断是否含事件
    located = []
    for start, end, frame in segments:
        b64 = frame_to_b64(frame)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"user","content":[
                {"type":"text","text":f"这帧画面是否包含：{event_desc}？只回是/否。"},
                {"type":"image_url","image_url":{"url":f"data:image/jpeg;base64,{b64}"}}]}],
            temperature=0)
        if "是" in resp.choices[0].message.content:
            located.append((start, end))
    return located   # [(12.0, 15.0)] 等
```

**注意**：事件定位用轻量模型逐帧判断（省钱），再用强模型综合事件描述。**分而治之**——粗筛用便宜模型，精分析用强模型。

### 关键片段提取与视频摘要

视频理解最实用的产出——**自动提取关键片段 + 生成摘要**：

```
需求：60秒视频，提取"最关键的 15 秒"，并生成文字摘要

流程：
  1. 采样帧 + 时序理解
  2. 识别"重要事件段"（动作/变化/信息密集）
  3. 提取这些时间段的原始视频片段
  4. 综合各段生成整体摘要
```

```python
def extract_highlights(video_path: str, top_n: int = 3) -> dict:
    """提取关键片段 + 摘要"""
    # 1. 采样并分段理解
    frames = sample_frames_keyframe(video_path, max_frames=20)
    # 2. 让模型识别最重要的 N 段
    understanding = understand_video(frames, 1.0,
        "识别视频中最重要的几个时刻/片段，标注大致时间，并说明为何���要")
    # 3. 按模型指示的时间切原始视频片段（FFmpeg）
    segments = parse_time_segments(understanding, top_n=top_n)
    clips = [cut_clip(video_path, s, e) for s, e in segments]
    # 4. 整体摘要
    summary = understand_video(frames, 1.0,
        "用一句话概括整段视频的核心内容")
    return {"clips": clips, "summary": summary, "understanding": understanding}
```

**切视频用 FFmpeg**：

```python
import subprocess
def cut_clip(video_path: str, start: float, end: float) -> str:
    """用 FFmpeg 切片段"""
    out = f"clip_{start}_{end}.mp4"
    subprocess.run(["ffmpeg", "-i", video_path,
                     "-ss", str(start), "-to", str(end),
                     "-c", "copy", out, "-y"], check=True)
    return out
```

### 视频理解的成本陷阱

视频是最贵最慢的模态——清醒算账：

```
成本构成：
  · 采样 20 帧 × 1k token = 20k token/次理解
  · 多轮（分段理解+综合）×N 次 LLM 调用
  · 切片用 FFmpeg（便宜，CPU）
  · 一次视频理解可能 = 10-50 次图片理解的成本

延迟：
  · 采样：几秒（CPU）
  · 多模态理解：每次几秒，多段累积十几秒
  · 不是实时，是"批处理"延迟

优化：
  · 帧数严控（10-30 帧，受 token 预算约束）
  · 分而治之：粗筛用便宜模型，精分析用强模型
  · 缓存：同视频重复问，缓存理解结果
  · 预处理：长视频先粗粒度分段，只对相关段细分析
```

> 反模式：**把整段视频每个帧都送模型**。1800 帧送多模态 = token 灾难 + 模型看不过来。**采样是视频理解的必需前提**，且帧数要受预算约束。视频理解的工程，一半是在"怎么聪明地采样"。

### 要点总结

- 视频本质难题：帧太多（30fps×60s=1800帧），全送模型 token 爆炸，必须采样
- 采样三策略：均匀（覆盖全时间线，简单）、关键帧（去运动冗余）、场景变化（智能，信息密度高）
- 采样受 token 预算约束：控制 10-30 帧，30 帧=30k token 已很贵，不是越多越好
- 时序理解三方式：多图+顺序提问、时间戳标注（定位事件时间）、分段理解再综合（超长视频）
- prompt 技巧：明确告知"这是时间序列"+ 标注帧时间戳，否则模型当并列图
- 事件定位：分而治之——便宜模型逐段粗筛，强模型精分析，输出"事件时间段"
- 关键片段提取：识别重要段→FFmpeg 切片→综合摘要；切视频用 FFmpeg
- 成本：视频是最贵模态（10-50 倍图片成本），延迟批处理级；优化靠帧数严控+分而治之+缓存+预处理分段
- 反模式：每帧都送模型——采样是前提，帧数受预算约束，视频理解一半工程在聪明采样
- 下一节 L12-05：视觉专项深度——多页文档、混合图表、表格结构化提取
