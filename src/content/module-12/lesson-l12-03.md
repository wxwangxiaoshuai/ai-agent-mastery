## 语音交互 Agent：STT → LLM → TTS 实时流水线

视觉让 Agent 看见，语音让它能听能说。语音交互是最自然的人机界面——用户开口说话，Agent 听懂、思考、开口回答。但"语音进→语音出"看似简单，做实时流畅却处处是坑。这一节搭 STT→LLM→TTS 流水线，并解决打断、停顿、流畅性这些真实问题。

### 语音 Agent 的三段流水线

核心架构是把三个环节串起来：

```
用户说话（音频）
   │
   ├─→ STT（Speech-to-Text）：语音 → 文本
   │     · Whisper / Deepgram / AssemblyAI
   │
   ├─→ LLM：文本 → 文本（思考+回答）
   │     · 任何文本模型，如 GPT-4o-mini
   │
   └─→ TTS（Text-to-Speech）：文本 → 语音
         · ElevenLabs / Edge TTS / OpenAI TTS
                                    ↓
                              Agent 说话（音频）
```

**为什么是流水线而非端到端**：每个环节有专门模型，组合灵活、可替换。虽然 GPT-4o 有原生语音，但多数生产场景用流水线——能单独优化每段、成本可控、模型可换。

**关键挑战**：三段串起来，**延迟叠加**。STT 要等用户说完？LLM 要等想完？TTS 要等全文生成？这样延迟可能 5-10 秒，对话体验崩。优化的核心是**让三段流式重叠**。

### STT：语音转文本

先把用户语音转成文字。主流方案：

| 方案 | 特点 | 适合 |
|------|------|------|
| Whisper（OpenAI，可本地） | 开源、多语言、精度高 | 自托管/隐私敏感 |
| Deepgram | 快、流式支持好 | 实时对话 |
| AssemblyAI | 准、有说话人分离 | 多人对话 |
| 云厂商 STT（Azure/Google） | 集成全、多语言 | 已用云生态 |

```python
# Whisper 本地方案（隐私+免费）
import openai

def stt(audio_path: str) -> str:
    """语音转文本（Whisper）"""
    with open(audio_path, "rb") as f:
        resp = openai.Audio.transcribe(
            model="whisper-1", file=f, language="zh")
    return resp.text

# Deepgram 流式（实时）
from deepgram import DeepgramClient
dg = DeepgramClient()

async def stt_stream(audio_stream):
    """实时流式转写——边说边出文字"""
    result = await dg.listen.async.v("1").stream(audio_stream)
    return result.channel.alternatives[0].transcript
```

**关键区别——批处理 vs 流式**：
- 批处理：用户说完一整句，一次性转写。延迟高，但准确（有完整上下文）。
- 流式：边说边出文字。延迟低，但可能因没上下文而错。

**实时对话用流式**，批处理用于"上传录音转写"（L12-02 场景）。

### TTS：文本转语音

把 Agent 回答转成语音：

| 方案 | 特点 | 适合 |
|------|------|------|
| ElevenLabs | 最自然、克隆音色 | 高质量对话 |
| Edge TTS | 免费、质量不错 | 成本敏感 |
| OpenAI TTS | 集成方便、稳定 | 已用 OpenAI |
| 本地 TTS（piper/coqui） | 免费、低延迟、离线 | 隐私/边缘 |

```python
# OpenAI TTS
def tts(text: str) -> bytes:
    """文本转语音"""
    resp = openai.audio.speech.create(
        model="tts-1", voice="alloy", input=text)
    return resp.content   # 音频 bytes

# Edge TTS（免费）
import edge_tts, asyncio
async def tts_edge(text: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice="zh-CN-XiaoxiaoNeural")
    import io
    stream = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            stream.write(chunk["data"])
    return stream.getvalue()
```

### 流式重叠：降低端到端延迟

朴素串行的延迟灾难：

```
朴素串行（慢）：
  用户说完 → STT 全转写(1s) → LLM 全生成(3s) → TTS 全合成(1s) → 播放
  端到端 ~5s，用户等太久

流式重叠（快）：
  用户说话 → STT 边出文字 ──┐
                            ├→ LLM 边出文字 ──┐
                            │                  ├→ TTS 边出音频 → 播放
                            └─（STT 未完LLM已开始）
  端到端首音 ~1.5s，边说边出
```

**三个重叠点**：
1. **STT 流式 → LLM**：STT 边出文字，LLM 可以在用户还在说话时就开始处理（要处理"部分句子"的不完整）
2. **LLM 流式 → TTS**：LLM 边出 token，TTS 边合成，不必等全文（用 L10-05 的 token 流式）
3. **TTS 流式 → 播放**：TTS 边出音频块，播放器边播

```python
async def voice_agent_pipeline(audio_stream):
    """流式语音 Agent：三段重叠"""
    # 1. STT 流式，边出文字喂给 LLM
    transcript_queue = asyncio.Queue()
    asyncio.create_task(stt_to_queue(audio_stream, transcript_queue))

    # 2. LLM 流式，边出 token 喂给 TTS（用队列传递部分文本）
    tts_input_queue = asyncio.Queue()
    asyncio.create_task(llm_stream_to_queue(transcript_queue, tts_input_queue))

    # 3. TTS 边合成边产出音频块
    async for audio_chunk in tts_stream(tts_input_queue):
        yield audio_chunk   # 立即送给播放器
```

> 核心思想：**不要等上一段全完成才开始下一段**。用队列把"生产者-消费者"解耦，每段产出一部分就传给下一段。这是实时语音 Agent 的延迟优化精髓。

### 打断处理：用户随时能插嘴

人对话会打断——Agent 说到一半，用户想插话。语音 Agent 必须支持：

```
打断场景：
  Agent 正在 TTS 播放："这个问题我认为..."
  用户开口："不对，我想问的是..."  ← 要打断 Agent
  
处理：
  1. 检测到用户开始说话（VAD 语音活动检测）
  2. 立即停止 TTS 播放和合成
  3. 中止当前 LLM 生成（如支持 cancel）
  4. 开始新一轮 STT → LLM → TTS
```

```python
class VoiceAgent:
    def __init__(self):
        self.speaking = False
        self.current_task = None

    async def listen_and_respond(self):
        async for user_audio in mic_stream():
            # VAD 检测到用户说话
            if self.speaking:
                await self.interrupt()   # 打断自己
            # 正常处理
            self.current_task = asyncio.create_task(self.respond(user_audio))

    async def interrupt(self):
        """打断当前回复"""
        self.speaking = False
        if self.current_task:
            self.current_task.cancel()   # 取消 LLM/TTS
        await stop_audio_playback()
```

**关键**：打断要**立即停止 TTS 播放 + 取消 LLM 生成**，否则用户说完了 Agent 还在说。VAD（Voice Activity Detection）检测用户开口是打断的触发器。

### 停顿与流畅性

语音不比文字——文字看一眼就懂，语音要听完。流畅性影响体验：

```
问题1：长停顿
  · LLM 在"想"，TTS 没东西播 → 用户听到静音 → 以为卡住
  · 对策：填充音（"嗯""让我想想"）或思考进度提示

问题2：句子切碎
  · TTS 按句号断句播，但 LLM 流式出的 token 还没到句号
  · 对策：按语义块（逗号/短语）而非整句合成

问题3：语速/情感不匹配
  · 平铺直叙 vs 该有情感
  · 对策：高质量 TTS（ElevenLabs）或 SSML 标记情感
```

**填充音技巧**：检测到 LLM 还在"思考"（token 流未产出可播内容），先合成一个填充音"嗯，让我看看"播放，给用户"还在"的信号。这是语音 UX 比文本 UX 多的考量。

### 实时 vs 录音：两种场景

语音 Agent 分两类，架构不同：

```
实时对话（双向流式）：
  · 用户和 Agent 交替说话，要打断、要低延迟
  · 架构：流式 STT + 流式 LLM + 流式 TTS + VAD
  · 难点：延迟、打断、状态管理
  · 本节主要内容

录音处理（单向批处理）：
  · 用户上传一段录音，Agent 处理后返回结果（转写+摘要+情感）
  · 架构：批 STT + LLM + （可选 TTS）
  · 难点：长音频、说话人分离
  · P12 的语音模态走这条
```

**别混架构**：实时对话用流式，录音处理用批处理。把实时架构硬套录音处理，是杀鸡用牛刀且延迟没意义；把批处理套实时，延迟惨不忍睹。

### 语音 Agent 的成本与隐私

语音有额外成本和隐私考量：

```
成本：
  · STT 按音频时长计费（Whisper ~$0.006/分钟）
  · TTS 按字符计费
  · 叠加 LLM 调用 → 语音对话比文本对话贵数倍

隐私：
  · 语音是生物特征信息（声纹），比文本更敏感
  · 合规：录音留存？声纹数据出境？用户知情同意？
  · 本地 STT/TTS（Whisper+piper）可规避云端，但质量/成本权衡
```

> 务实建议：**原型用云服务（快），生产评估本地化（隐私+成本）**。实时对话延迟敏感，本地 STT/TTS 能省掉网络往返，反而可能更快——但要算本地推理的机器成本。

### 要点总结

- 语音 Agent = STT→LLM→TTS 流水线，组合灵活可替换，但延迟叠加是核心挑战
- STT：Whisper（本地/隐私）/Deepgram（流式快）；批处理 vs 流式，实时用流式
- TTS：ElevenLabs（最自然）/Edge TTS（免费）/本地（隐私低延迟）
- 延迟优化精髓：三段流式重叠（STT未完LLM已开始、LLM未完TTS已合成），用队列解耦生产者消费者
- 打断：VAD 检测用户开口 → 立即停 TTS 播放 + 取消 LLM 生成 → 开始新轮
- 流畅性：长停顿用填充音、按语义块而非整句合成、SSML 控情感
- 实时对话（双向流式+VAD+打断）vs 录音处理（批处理）——别混架构
- 成本：语音对话比文本贵数倍；隐私：声纹是生物特征，考虑本地化 STT/TTS
- 下一节 L12-04：视频模态——帧采样、时序分析、关键片段提取
