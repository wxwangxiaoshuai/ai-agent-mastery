# Review 工作笔记（增量，非交付物）

> 交付物是 `docs/REVIEW-2026-07.md`。本文件是精读过程中的原始发现记录，写完报告后可删。

## 方法论约束（重要）

- 沙箱挂载对「git status 显示为 M」的文件返回**截断副本**。这 43 个文件必须用 Read 工具读取。
  bash `cat` 仅对 git 报告未修改的文件可信。
- 因此 `pnpm check` 无法在沙箱内执行（脚本读到的是截断的 curriculum.ts）。
  C1–C21 的验证靠人工比对，不靠跑脚本。

## 全局自动化扫描结果

### S1. 模型标识分布（全站 content/）

| 标识 | 出现次数 | 状态 |
|------|---------|------|
| gpt-4o-mini | 96 | **API 已于 2026-02-16 返回 404** |
| gpt-4o | 52 | **API 已于 2026-02-16 返回 404** |
| text-embedding-3-small | 16 | 有效（未废弃） |
| claude-sonnet-4-20250514 | 11 | 旧代但仍在白名单 |
| claude-sonnet-5 | 10 | 当前 |
| claude-opus-5 | 5 | 当前 |
| claude-haiku-4-5 | 3 | 当前 |
| gpt-4o-2024-11-20 / -08-06 | 2 / 2 | **已随 gpt-4o 一同下线** |
| gemini-2.0-flash | 1 | 旧代 |

结论：全站 OpenAI 侧示例代码（148 处）在 2026-07 已不可运行。

### S2. C5 检查项的覆盖漏洞

`scripts/check-curriculum.mjs` C5 的正则：
```js
/\b(gpt-[0-9o][\w.-]*|claude-(?:opus|sonnet|haiku)-[\w.-]*|gemini-[\w.-]*)\b/g
```
只覆盖 gpt-/claude-/gemini- 三个前缀。**不覆盖**：
- `text-embedding-3-small` / `-large`（16 + 1 处，M4 大量使用）
- 开源模型 `llama3.2`(3)、`qwen2.5-7b-instruct-q4.gguf`(1)
- 任何 DeepSeek / Mistral / Qwen API 标识

同时 `src/data/models.ts` 的 embedding 档 `models: []` 为空 →
`defaultModelOf('embedding')` 返回 `undefined`，`ModelTierTable` 渲染空行。
即：向量模型既不在白名单里，也不在档位表里，完全失守。

补充（2026-07-30 复看 models.ts）：

- **`CALIBRATED_ON = '2026-07-27'`（3 天前）是"刚校准过"的声明，但白名单里 mid 档仍以
  `gpt-4o` / `gpt-4o-2024-08-06` / `gpt-4o-2024-11-20` 为主、nano/small 档以 `gpt-4o-mini` 为主。**
  C14 因此永远绿灯，而 C14 想守的东西（模型信息不过期）恰恰没被守住。
  **校准日期是手写常量，没有任何机制验证"真的对照过厂商文档"** —— 这是全站守护体系里
  唯一一个可以靠改一个字符串就骗过的检查项。
- **nano 与 small 两档的 `models` 数组完全相同**（`gpt-4o-mini` + `claude-haiku-4-5`），
  `defaultModelOf('nano') === defaultModelOf('small')`。五档分类里有两档在实现上不可区分，
  `ModelTierTable` 会渲染出两行一样的模型列。档位抽象是半空心的。
- OpenAI 侧白名单**没有任何 gpt-4o 之后的型号**（无 gpt-5 系、无 o 系推理模型）；
  Google 侧全站只有 `gemini-2.0-flash` 一个且只在 nano 档。
  与 Anthropic 侧已用到 `claude-opus-5` / `claude-sonnet-5` 形成明显代际错位——
  **同一张白名单里混着 2024 年的 OpenAI 与 2026 年的 Anthropic。**
- C5 正则 `gpt-[0-9o][\w.-]*` 还漏掉了不以 `gpt-` 开头的 OpenAI 推理模型（`o3` / `o4-mini` 等），
  正文若写这类标识不会被拦。

### S3. 版本声明（少而松，属良好实践）

- `openai>=1.0`、`anthropic>=0.30`、`mcp>=1.8,<2`、Python 3.11+
- 无框架版本硬钉死 → 时效性风险低
- 例外：`src/content/module-02/project-p2.md:272` 示例语料写死
  "2024年10月，Anthropic发布Claude 3.5 Sonnet更新版"（可用但年代感强）

### S4. stages 注释与真源不一致（curriculum.ts）

`stages` 数组（真源，C13 守护）：
| 阶段 | 名称 | range |
|------|------|-------|
| 1 | 筑基篇 | 1–2 |
| 2 | 上下文与知识篇 | 3–4 |
| 3 | Agent 核心篇 | 5–6 |
| 4 | 工程化与编排篇 | 7–10 |
| 5 | 多智能体与多模态篇 | 11–12 |
| 6 | 质量、架构与生产落地篇 | 13–16 |
| 7 | 独立开发与商业化篇 | 17–19 |

同一文件内的块注释却写着：
- `阶段三：Agent 核心篇（M5-M7）` ← 真源是 5–6
- `阶段四：记忆执行与编排篇（M8-M10）` ← 真源是「工程化与编排篇 7–10」
- `阶段六：质量保障篇（M13）` ← 真源是 13–16
- `阶段七：架构设计与生产落地篇（M14-M16）` ← 真源是 17–19

C13 只校验 `stages` 数组本身连续、覆盖全模块，**不校验注释**，所以漏过。

### S5. 交互组件覆盖率（量化）

| 口径 | 数值 |
|------|------|
| lesson 总数 | 119 |
| **含 `::interactive` 的 lesson** | **49（41%）** |
| 不含任何交互的 lesson | **70（59%）** |
| project 文件总数 | 19 |
| **含 `::interactive` 的 project** | **0** |
| 全站 `::interactive` 引用总数 | 约 60 |
| 只被引用 1 次的组件 | **34 / 44** |

分模块（含交互 lesson / 总 lesson）：

```
M01 3/4   M02 2/5   M03 2/6   M04 3/6   M05 3/7   M06 2/8   M07 2/5
M08 2/5   M09 2/4   M10 2/6   M11 3/5   M12 4/5   M13 2/8   M14 5/6
M15 3/6   M16 2/4   M17 3/15  M18 2/7   M19 2/7
```

CLAUDE.md 写「课程没有视频，**全是图文+交互组件**」，但实际 59% 的课一个交互都没有，
19 个项目页全部为零。最差的 M17（15 节课）只有 3 节有交互。
C3 只要求「每模块 ≥1 个交互组件」，这个下限太松，无法阻止上述分布。
C4 目前**通过**（44 个注册组件全部至少被引用 1 次），但 34 个只被引用一次，
说明组件是「为了满足 C3 而造」，不是「因为教学需要而造」。

### S6. 反复出现的全站级代码缺陷（跨模块）

| 模式 | 出现位置（举例） | 影响 |
|------|-----------------|------|
| `open(path, "w")` 未指定 `encoding="utf-8"` | L03-06:68, L03-06:194, L04-05:172, L06-06:96, L13-08:157 | 全中文课程，Windows 默认 GBK，写入即 `UnicodeEncodeError` 或乱码 |
| 编造的基准数字当作事实呈现 | L04-02（分块精度 75/82/88%）、L04-04（召回率/精确率/延迟四行表）、L04-05（四轮优化曲线）、L14-01（框架评分矩阵） | 无数据集、无来源、无测量条件；学生会当作可引用的结论 |
| 类名/签名跨课漂移 | `ContextAssembler`（L03-06 是 `max_tokens=`，P3 是 `context_window=`+`output_reserve=`）；`count_tokens()`（L03-03）vs `TokenCounter.count()`（L03-03 后半 + P3） | 学生按课文顺序敲代码会在下一节报 `TypeError` |
| 课文引用本节未定义的符号 | L03-03（`TokenCounter`、`summarize_history`）、L02-04（`call_llm`） | 复制即 `NameError` |
| 同一段代码在多处近乎逐字重复 | `ContextDebugger.visualize`（L03-06 与 P3）、指令优先级段落（L02-01 与 L03-01） | 维护时只会改一处，另一处腐化 |

---

## 逐模块精读记录

### M1 · LLM 基础（4 课 + P1）

**优点**
- L01-01 深度超预期：注意力平方成本、置信度校准/logprobs、temperature=0 仍不确定的三类来源（采样/浮点/服务端），都是通常课程不讲的工程真相。
- 每课都有「动手 5 分钟」+「要点总结」，验收标准写得具体（如"断网时不崩溃"）。
- 开篇用 `::interactive{type="growthMap"}` 做能力自评，收尾呼应，设计意识好。

**问题**
| ID | 位置 | 级别 | 描述 |
|----|------|------|------|
| M1-1 | `lesson-l01-01.md:9` | 低 | "课程结束时（M16 末尾）你会再做一次同样的自评" —— 课程已扩到 M19，自评闭环点落在 M16，与 growthMap 的"架构师能力"定位也未覆盖 M17-19 的独立开发/商业化维度。 |
| M1-2 | `lesson-l01-03.md:293-294` | **高** | 重试代码 `except APIError as e: if e.status_code and ...` —— openai-python v1 里 `.status_code` 只在 `APIStatusError` 上，`APIConnectionError`/`APITimeoutError` 同为 `APIError` 子类但**没有该属性**，网络抖动时会抛 `AttributeError` 把重试逻辑本身打死。正确写法应捕获 `APIStatusError`。讽刺的是这段代码的标题正是"生产环境必须处理"。 |
| M1-3 | `lesson-l01-03.md:311-317` | 中 | 「动手5分钟」要求"从响应的 `usage` 字段读出 `input_tokens` 和 `output_tokens`" —— 但该练习基于**流式**调用：(a) OpenAI 流式默认不返回 usage，必须传 `stream_options={"include_usage": True}`；(b) OpenAI 的字段名是 `prompt_tokens`/`completion_tokens`，`input_tokens`/`output_tokens` 是 Anthropic 的命名。学生照做必然失败。 |
| M1-4 | `lesson-l01-01.md:51-54` | 中 | 上下文窗口给的是 Claude 200K / GPT 128K / Gemini 1M+ —— 2026-07 的实际值已显著上移，且已标注"参考值"但未标注校准日期。 |
| M1-5 | `project-p1.md`（Step 1） | **高** | 仍保留 `# TypeScript 方案 / npm install openai / npm install -D @types/node dotenv tsx`，直接违反 CLAUDE.md 的 Python 主线定位与 C15 的"不承诺双语言"。C15 显然只匹配文案措辞，匹配不到这种**代码块级**的双语言残留。 |
| M1-6 | 全模块 | 中 | 所有 OpenAI 示例用 `gpt-4o` / `gpt-4o-mini`（见 S1），2026-07 直接 404。 |

### M2 · Prompt 工程（5 课 + P2）

**优点**
- L02-01 的「反模式表」和「System vs User 分工表」是全站最实用的两张表之一。
- L02-04 覆盖面广：Prompt 约束 / JSON Mode / Structured Outputs / Tool Use / Prefill / Gemini / instructor，还给了可靠性对照表。
- P2 把「Prompt 测试集 + 版本对比报告」做成交付物，把调 Prompt 从玄学变工程 —— 这是本课程最有价值的设计之一。

**问题**
| ID | 位置 | 级别 | 描述 |
|----|------|------|------|
| M2-1 | `lesson-l02-04.md:105` | **高** | "Anthropic 没有类似 `response_format` 的参数" —— **已过时且错误**。Anthropic 已在 Claude Developer Platform 提供原生 Structured Outputs（`output_format` 参数，语法约束式 JSON 生成），对 Claude 4.5 及以上 GA，2026-02-04 起 Haiku 4.5 也支持。本节仍把 Tool Use / Prefill 两个 workaround 当作唯一解法教。 |
| M2-2 | `lesson-l02-04.md:206,218` | 中 | `import google.generativeai as genai` + `genai.GenerativeModel(...)` 是 Google 的**旧版 SDK**，已被 `google-genai`（`from google import genai`）取代。旧包已停止接收新模型支持。 |
| M2-3 | `lesson-l02-04.md:243` | 中 | `Field(description=..., enum=[...])` —— Pydantic v2 的 `Field()` 不支持 `enum` 关键字（作为额外 kwarg 会触发 deprecation），惯用写法是 `Literal["O(1)", ...]`。示例代码风格错误。 |
| M2-4 | `lesson-l02-04.md:303-328` | 中 | `safe_parse` 被写成可运行代码但实为伪代码：`json.loads(response)` 的 `response` 类型未定义（前文都是 response 对象）；`call_llm()` 全站未定义；其签名 `call_llm(prompt=..., response_format=...)` 也不对应任何真实 SDK。 |
| M2-5 | `lesson-l02-04.md:43` | 低 | `文本：{"这个产品功能强大但价格太高"}` —— 多余的花括号，示例本身格式不干净（而本节主题恰恰是"格式要干净"）。 |
| M2-6 | `project-p2.md`（常见问题 Q1） | 中 | "`response_format` 保证 JSON 合法但不保证 Schema 正确" —— 与同模块 L02-04:66-76 自己写的"`json_schema` + `strict: True` **保证符合你指定的 Schema**"**直接矛盾**。同一模块内两处结论打架。 |
| M2-7 | `project-p2.md`（Step 6） | 中 | 空文档用例断言 `len(result.entities) == 0 and len(result.key_points) == 0` —— LLM 对空输入的行为无法保证，这条测试天生 flaky，且与课程自己教的"断言结构与语义而非精确值"（L01-01）冲突。 |
| M2-8 | `project-p2.md`（Step 7） | 低 | `run_version` 当所有用例被跳过时 `pass_rate` 除零。 |
| M2-9 | `lesson-l02-04.md`, `project-p2.md` | 中 | 模型标识：`claude-sonnet-4-20250514`(3)、`gpt-4o`(3)、`gpt-4o-mini`(2)、`gemini-2.0-flash`(1) 全部为旧代。 |

### M3 · 上下文工程（6 课 + P3）

**优点**
- L03-01 的三层 System Prompt 架构（身份/规则/格式）+ Builder 模式，教法清晰且可落地。
- L03-03 的六槽位预算模型 + 六级降级策略是全站最工程化的内容之一。
- L03-05 Prompt Caching 给了可算的省钱账（$16.5 → $3.0），并把「缓存杀手」反模式列了出来。
- P3 把 M3 六节课收敛成一个可复用中间件，并明确说"P4/P7/P10 都能 import"——项目之间的复用意识很好。

**问题**
| ID | 位置 | 级别 | 描述 |
|----|------|------|------|
| M3-1 | `project-p3.md` Step 4 `assemble()` | **高** | `enable_cache=True` 分支产出 `{"role": "system", "content": [{"type": "text", ..., "cache_control": {...}}]}`，并注释"仅 Anthropic Claude 支持"。**这个结构对两家 API 都非法**：Anthropic 的 `messages` 不接受 `role: "system"`（system 是**顶层独立参数**，这一点 L01-03:144 自己刚强调过），OpenAI 则不认 `cache_control`。旗舰项目的核心方法跑不通。 |
| M3-2 | `project-p3.md` Step 4 / L03-05 | **高** | 同一问题的另一面：`assemble()` 把检索文档和工具结果都塞成 `{"role": "system"}` 的中间消息。这在 Anthropic 上直接报错，且课程从 P4 起要求学生"接入 Claude"（进阶挑战 1）。中间件的跨厂商承诺无法兑现。 |
| M3-3 | `lesson-l03-03.md`（OverflowHandler） | 中 | `TokenCounter` 与 `summarize_history` 在本节**从未定义**（`TokenCounter` 要到 P3 Step 2 才出现）。课文代码不自洽，学生复制即 `NameError`。 |
| M3-4 | `lesson-l03-03.md`（OverflowHandler） | 中 | Level 4「用摘要替代完整历史」是**死代码**：Level 1 的 `while count(history) > budget["history"]` 已经把历史裁到预算内，Level 4 的 `if` 条件永不成立。降级策略讲了 6 级，代码只实现 5 级且其中 1 级不可达。 |
| M3-5 | `lesson-l03-03.md`（Anthropic 计数） | 中 | "用 anthropic 的 token counting API（**如果可用**）"并给出 `tiktoken.get_encoding("cl100k_base")` 作为 Anthropic 的近似 —— Anthropic 的 `client.messages.count_tokens()` 早已 GA，不是"如果可用"；而 `cl100k_base` 根本不是 Claude 的分词器，误差可达 20%+。本节自己上一段刚说"必须用目标模型的 tokenizer"，下一段就违反。 |
| M3-6 | `lesson-l03-03.md` 预算表 vs `allocate()` | 低 | 顶部百分比表（5-10 + 20-30 + 15-25 + 20-30 + 10-15 + 15-25）最高合计 130%，与代码里的 30/25/30/15 不是同一套口径。已加注释打补丁，但两套数字并列仍会误导。 |
| M3-7 | `project-p3.md` ContextDebugger | 低 | `预算使用率: {total/128000*100}` 把窗口写死 128000，与构造函数的 `context_window` 参数脱钩；`cost_report` 默认价 0.15/0.60 是 gpt-4o-mini 的价格硬编码。 |
| M3-8 | `project-p3.md` 进阶挑战 5 | 低 | "预算紧张用 mini，预算充足用 4o" —— 直接点名已下线型号，且与 `models.ts` 的档位抽象（nano/small/mid/large）不一致，档位抽象没有贯穿到内容里。 |
| M3-9 | `lesson-l03-01.md` vs `lesson-l02-01.md` | 低 | 「指令优先级 System > Few-shot > 用户指令 > 对话历史」+「不是绝对的，强模型可能合理违反」+「详见护栏系统」几乎逐句重复。M2→M3 衔接处有内容冗余。 |
| M3-10 | `lesson-l03-01.md:末` / `lesson-l02-01.md:124` | 低 | 交叉引用写法不统一：一处「M13-04」、一处「M13 详解」、一处「M3-L03-01」。全站缺少统一的交叉引用格式。 |
| M3-11 | `lesson-l03-06.md:68,194` | 中 | `open(filepath, "w")` / `open(f"snapshots/{name}.json", "w")` 未指定 `encoding="utf-8"`。全中文内容在 Windows 上直接 `UnicodeEncodeError`。 |
| M3-12 | `lesson-l03-06.md` vs `project-p3.md` | 中 | 同名类 `ContextAssembler` 在两处签名不同（`max_tokens=8000` vs `context_window=/output_reserve=`），`ContextDebugger.visualize` 近乎逐字重复但窗口上限逻辑不同（一处 if/else 硬编码 128000/200000，一处写死 128000）。 |

### M4 · RAG（6 课 + P4）

**优点**
- 结构完整：分块 → Embedding/向量库 → 混合检索+Rerank → RAGAS 评估 → 高级范式，是全站体系最扎实的一个模块。
- L04-03 讲到 HNSW 分层原理和 M / ef_construction / ef_search 三个旋钮，超出多数中文 RAG 教程的深度。
- L04-06 对 Self-RAG 明确标注「教学简化版，原论文靠微调生成 reflection token」——这种诚实的降级说明**全站少见但极有价值**，应推广到其他模块。
- **P4 明显是全站工程质量最高的项目**：BM25 索引缓存 + `invalidate()`、RRF 两侧统一用 Chroma document id、同 source 重索引先删旧块、`upsert` 而非 `add`。它把 L04-04 课文里的缺陷全都修好了。

**问题**
| ID | 位置 | 级别 | 描述 |
|----|------|------|------|
| M4-1 | `lesson-l04-04.md`（`hybrid_search` / `HybridRetriever`） | **高** | `HybridRetriever.__init__` 预建了 `self.bm25`，但 `retrieve()` 转手调用模块级 `hybrid_search()`，后者在**每次查询**里重新 `jieba.cut` 全部文档并重建 `BM25Okapi`。`self.bm25` 是死字段，优化被自己抵消。P4 已修，但课文没修 —— 学生先学到错的。 |
| M4-2 | `lesson-l04-04.md`（效果对比表） | 中 | 「召回率@5 72%→84%、精确率@3 68%→89%、延迟 50/10/60/200ms」四行数字无数据集、无模型、无测量条件。同类问题见 L04-02（75/82/88%）、L04-05（四轮优化曲线）。**这是全站最系统性的可信度风险**。 |
| M4-3 | `lesson-l04-03.md`（`index_documents`） | 中 | `ids=[f"doc_{i}" for i in range(len(documents))]` —— 第二次调用会用同样的 id 覆盖第一批文档。增量索引场景静默丢数据。P4 用 `hashlib.md5(f"{source}_{i}")` 修了，课文没修。 |
| M4-4 | `lesson-l04-03.md` Embedding 选型表 | 中 | `embed-v3`（Cohere）不是真实模型标识（实际是 `embed-english-v3.0` / `embed-multilingual-v3.0`）；`jina-embeddings-v3` 标注「免费（开源）」但其权重是 CC-BY-NC（禁商用），对做商业项目的学员是实质性误导。 |
| M4-5 | `lesson-l04-03.md`（Chroma HNSW 配置） | 中·待核 | `metadata={"hnsw:M": ..., "hnsw:construction_ef": ...}` 是 Chroma 旧版写法；新版已迁到 `configuration={"hnsw": {...}}`，旧 key 触发 deprecation。需按目标 Chroma 版本核对。 |
| M4-6 | `lesson-l04-02.md`（`agentic_chunk`） | 中 | 提示词写「保持原文不变，只添加分隔符」但**不做任何校验**，且 `max_tokens=4000` 会把长文档的后半截静默丢弃。分块环节丢内容，下游 RAG 全链路都查不出来。 |
| M4-7 | `lesson-l04-05.md:172` | 中 | `open(output_file, "w")` 缺 `encoding="utf-8"`（同 S6）。 |
| M4-8 | `lesson-l04-06.md`（Self-RAG） | 中 | `judge.strip().lower() == "yes"` 精确比较 —— 模型回 `Yes.` / `是` 即判定为「不需要检索」，静默降级成无 RAG 回答。本节主题恰恰是「让 RAG 更可靠」。CRAG 那段的 `"high" in quality` 写法反而是对的，同一节两种风格并存。 |
| M4-9 | `lesson-l04-06.md` | 低 | 全节用 `gpt-4o-mini`（nano 档）当「相关性裁判」和「实体关系抽取」，与 `models.ts` 里 large 档写的「也用作评测里的裁判模型」冲突。档位抽象没有贯穿内容。 |
| M4-10 | `project-p4.md`（验收测试） | **高** | `assert "4 小时" in output["answer"]`、`assert "无法回答" in output["answer"] or "未找到" in ...` —— 对 LLM 自由文本做**逐字子串断言**。模型写「4小时」（无空格）或「资料中没有提到」就红。这**直接违反 L01-01 自己写的**「不要写'输出必须逐字相等'的断言，Agent 的测试应该断言结构与语义」。同一问题在 P2 的空文档用例中也出现。课程的核心教诲没有被自己的项目代码遵守。 |

### M5 · Agent 核心（7 课 + P5）

**优点**
- L05-02「Agent Loop 的本质就是一个 while 循环」直接把 6 行伪代码摆出来，是全站最好的破除框架崇拜的一段。
- `calculate` 工具没有偷懒用 `eval`，而是写了受限 AST 求值器并明确注释「生产环境禁止 eval」——安全意识到位。
- L05-03 的四类失败模式（循环 / 发散 / 幻觉工具 / 过早终止）+ 对应解法，是实战型内容。
- L05-02 的「动手 5 分钟」要求装三个安全阀（步数 / token / 墙钟）并说「这一条比让它答对更重要」——价值观正确。

**问题**
| ID | 位置 | 级别 | 描述 |
|----|------|------|------|
| M5-1 | `lesson-l05-03.md` 等 | 低 | 交叉引用继续混用「M06-03」「L05-04」「M6-M7」三种格式。 |
| M5-2 | `lesson-l05-02.md` / `l05-03.md` | 低 | 模型全部写死 `gpt-4o-mini`。 |
| M5-3 | `lesson-l05-03.md`（`detect_loop`） | 低 | 只在文中给出函数，未接进 `agent_loop`；L05-02 的循环里也没有循环检测。讲了解法但主线代码没用上。 |
| M5-4 | `lesson-l05-04.md`（`plan_and_execute`） | 中 | `check_completion` 返回的 `remaining` 只当布尔用，随即丢弃；重规划调 `generate_plan(goal, completed=plan, ...)` 重新生成整份计划，外层 `for` 会把新计划**全部重跑一遍**，已完成步骤重复执行。三阶段里的 Replanner 实际上没有"只重排剩余步骤"的语义。 |
| M5-5 | `lesson-l05-04.md`（重规划示例） | 中 | 示例片段 `completed=plan[:i]` 中的 `i` 在该片段作用域内未定义，直接拷走会 NameError。 |
| M5-6 | `lesson-l05-05.md` | 中 | `react_with_reflection` 调用未定义的 `react_loop`；中途反思片段调用未定义的 `reflect_on_progress` / `adjust_plan`，并访问不存在的 `reflection.suggests_replan`。同一节内三个悬空符号。 |
| M5-7 | `lesson-l05-05.md` / `l05-04.md` / `l05-06.md` | 中 | 大量"看似实测"的数字无出处：Self-Refine「提升 5-15%」、Reflexion「成功率提升 10-30%」、成本表 `$0.01/$0.04/$0.09`、质量分 75/88/90、L05-06 的 80/85/82 分。全部以事实语气陈述。与 S6 的全站模式一致。 |
| M5-8 | `lesson-l05-06.md`（`estimate_agent_cost`） | 低 | 注释里的期望输出算错：steps=1 时月成本应为 `$2.25`（0.00075×100×30），文中写 `$2.34`。steps=5 的 `$11.25` 正确。 |
| M5-9 | `lesson-l05-06.md`（`estimate_agent_cost`） | 低 | 成本公式 `tokens/1e6 × (input+output)/2` 把输入输出价取平均、并假定 token 各占一半，与 M1/M19 讲的分开计价口径不一致，学员照抄会低估输出密集型 Agent 的成本。 |
| M5-10 | `project-p5.md`（tests） | 中 | 与 P4 同型：`test_agent_returns_answer` / `test_max_steps_protection` 直接跑真实 `client.chat.completions.create`，是要联网、要花钱、不确定的集成测试，却放在单测里。M13 讲的"评测与单测分层"在项目里没落实。 |
| M5-11 | `project-p5.md`（`_check_divergence`） | 中 | 发散检测在**每一步**都额外发一次 LLM 请求，直接把 Agent 的调用次数翻倍；而 L05-06 整节都在讲"Agent 的隐性成本"。Step 5 的正文提到"可改为每 N 步一次"，但主线代码就是每步一次，示范与告诫互相打架。 |
| M5-12 | M5 全模块 | 中 | 7 节课只有 L05-01（reActLoop）、L05-02、L05-07（patternMap + patternSelector）带交互组件；L05-04/05/06 三节纯文本。P5 无任何交互组件。符合 S4 的全站分布。 |

## M6 工具使用与 MCP（8 节 + P6）

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M6-1 | `project-p6.md:529-530` | **高（语法错误）** | `print("- 对于"研究+保存"类任务，...")` —— 半角双引号嵌套在半角双引号字符串里，Python 直接 `SyntaxError`。整个 `compare.py`（P6 号称"最有价值的产出"）跑不起来。两行都有。 |
| M6-2 | `project-p6.md` Step 6 | **高（方法论）** | 对比实验把 `ToolboxAgent`（**并行**执行工具）与 `SkillAwareAgent`（**串行**执行工具）放在一起比耗时，并把差异归因于"Skills 系统"。混杂变量，结论不成立。而这一节的主张恰恰是"不靠感觉，靠数据说话"。 |
| M6-3 | `project-p6.md` skills.py / compare.py | 中 | `skills.py` 使用 `client` / `TOOL_MAP` / `TOOLS_SCHEMA` / `json` / `time` 全部未导入；`compare.py` 从 `agent` 导入但 Step 2 的工具定义并未说明放在 `agent.py`。按给出的目录结构照抄必然 ImportError/NameError。 |
| M6-4 | `project-p6.md` `read_file`/`write_file` | 中 | 路径逃逸校验用 `str(full_path).startswith(str(ALLOWED_FILE_DIR))`。这是已知的错误写法：`./workspace-evil` 会通过前缀判断。正确写法是 `full_path.is_relative_to(ALLOWED_FILE_DIR)`（3.9+）。安全章节自己示范了不安全的比较。 |
| M6-5 | `project-p6.md` `query_db` / MCP Server | 中 | "只读"靠 `sql.upper().startswith("SELECT"/"PRAGMA")` 判断，而 `PRAGMA` 有可写形式（如 `PRAGMA journal_mode=...`），且未用 SQLite 原生只读连接 `sqlite3.connect("file:...?mode=ro", uri=True)`。教安全但给的是最弱的一档实现。 |
| M6-6 | `project-p6.md` MCP Server `call_tool` | 低 | `with sqlite3.connect(...)` 只管事务提交/回滚，**不关闭连接**。每次工具调用泄漏一个连接。 |
| M6-7 | `project-p6.md` tests | 中 | `test_execute_code_timeout` 单测里真的 `sleep(20)` 等 10 秒超时；`test_file_write_and_read` 写真实文件且无清理；`TestSkills.test_registry_register_and_find` 调 `find_by_intent`（发真实 LLM 请求）却只断言 `len(_skills)==1`——测试名与断言不符。 |
| M6-8 | `lesson-l06-07.md`（`SkillAwareAgent.run`） | 中 | 引用未定义的 `TOOLS_SCHEMA` / `TOOL_MAP` / `client` / `json`；且 `tools=["gas_mcp:cook", ...]` 这种带命名空间的工具名与 `t["function"]["name"]` 永远匹配不上，示例自相矛盾。 |
| M6-9 | `lesson-l06-08.md` | 中 | `get_active_tools()` 返回 `list[str]`（工具名），却在 Step 5 直接作为 `tools=` 传给 `llm_call`——应传 schema 对象。第四步与第五步的类型对不上。 |
| M6-10 | `lesson-l06-08.md` `execute_with_skills` | 中 | 号称"Skill 组合"，实现却是把**同一份 user_input** 依次丢给每个 Skill 各跑一遍，结果只是塞进 dict，没有任何组合/串联语义（L06-07 承诺的"A 的 output_schema 对齐 B 的 input_schema 即可串联"完全没落地）。 |
| M6-11 | `lesson-l06-08.md` / `project-p6.md` | 中 | "选择噪音降了 70%"、"10 个平铺工具 → 3 个 Skill"等收益数字无任何测量支撑，与 S6 的全站模式一致；而 P6 的对比实验（M6-2）恰恰无法支撑它。 |
| M6-12 | `lesson-l06-06.md`（`ToolCallReplayer`） | 中 | `to_dict()` 把 result 截断到 200 字符再落盘，`replay()` 又拿这份截断结果当"精确复现"的输入。重放本身是有损的，与本节"精确复现 bug"的承诺冲突。 |
| M6-13 | `lesson-l06-06.md`（`export_json`） | 低 | `open(filepath, "w")` 未指定 `encoding="utf-8"`，Windows 默认 GBK 会在中文 trace 上抛 `UnicodeEncodeError`。S6 的全站模式在此复现。 |
| M6-14 | `lesson-l06-03.md` | 低 | 正文全程用 `ThreadPoolExecutor`，"动手 5 分钟"第 2 步却要求改成 `asyncio.gather`——练习与正文技术栈不一致，学员没有可参照的示例。 |
| M6-15 | `lesson-l06-03.md`（`research_topic`） | 低 | 组合工具示例调用未定义的 `extract_url`。 |
| M6-16 | `lesson-l06-03.md` | 低 | 同一节内模型标识不一致：并行示例用 `gpt-4o`，`agent_loop_parallel` 用 `gpt-4o-mini`。（两者当前都已下线，见 S1。） |
| M6-17 | `lesson-l06-01.md` | 低 | Anthropic 示例用 `claude-sonnet-4-20250514`，而 L01-03 用 `claude-sonnet-5`。同一课程内 Anthropic 模型代际不统一。第二次调用里的 `tools=[...]`（字面 Ellipsis）直接拷走会报参数错误。 |
| M6-18 | `lesson-l06-04.md` / `l06-05.md` | 低 | Claude Desktop 配置路径只给了 macOS 的 `~/Library/Application Support/...`，未给 Windows 的 `%APPDATA%\Claude\`。课程受众大量在 Windows。 |
| M6-19 | `lesson-l06-07.md` / `l06-08.md` | 中（时效） | 课程把 "Agent Skills" 定义为自建 dataclass + Registry。而 Anthropic 官方的 Agent Skills 是**目录 + SKILL.md 渐进披露**的规范（Claude Code / Cowork / API 都已落地）。同名不同物，学员按课程理解去看官方文档会对不上。**待联网核实版本与现状后再定级。** |
| M6-20 | `lesson-l06-05.md` | 低（待核） | `pip install "mcp>=1.8,<2"` 的版本区间需核对当前 Python MCP SDK 实际版本；`session.read_resource("kb://stats")` 传 str 而签名为 `AnyUrl`。 |

## M7 Agent 健壮性与 Harness（5 节 + P7）

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M7-1 | `lesson-l07-03.md`（`CheckpointAgent.run`） | **高（必崩）** | `messages.append(msg)` 追加的是 SDK 的 `ChatCompletionMessage` 对象，随后 `save()` 里 `json.dumps(checkpoint.to_dict())` 直接 `TypeError: Object of type ChatCompletionMessage is not JSON serializable`。**第一次工具调用后必崩**，而本节主题正是"崩了也能续上"。需 `msg.model_dump()`。 |
| M7-2 | `lesson-l07-05.md`（`ModelFallbackChain`） | **高** | 降级链首档是 `{"model": "claude-sonnet-4-20250514"}`，却统一走 `client.chat.completions.create`（OpenAI 客户端）。Anthropic 模型无法用 OpenAI SDK 调用 → 主档**永远失败**，示例每次都在降级。本节要教的"优雅降级"变成"永远降级"。 |
| M7-3 | `lesson-l07-04.md`（`CircuitBreaker`） | **高** | `CircuitBreaker` 是无锁 `@dataclass`，`can_execute` / `record_failure` 存在读-改-写竞态（half_open_calls、failure_count、state）。而本节**后半段全是并发**（`threading.Semaphore` + 加了 `threading.Lock` 的 `TokenBucket`），同一节里对线程安全采取双标。生产环境熔断器必须加锁。 |
| M7-4 | `project-p7.md`（`@resilient` 装饰器） | **高** | 每次重试都新建一个 `ThreadPoolExecutor(max_workers=1)` 用于超时控制。超时后 `future.cancel()` 对已运行的任务无效，工作线程继续挂在阻塞调用上；`with` 退出时 `shutdown(wait=True)` 反而会一直阻塞到该线程结束——**超时保护本身会被超时的调用拖死**，且线程持续泄漏。 |
| M7-5 | `project-p7.md`（`model_chain`） | 中 | 降级链两个活档是 `gpt-4o` → `gpt-4o-mini`，按 S1 两者当前均 404，实际每次都落到最后的静态兜底。整个 P7 的"多模型降级"演示不可复现。 |
| M7-6 | `project-p7.md`（`ResilientAgent`） | 中 | 决策协议退回到 `"FINAL:"` / `"SEARCH:"` 字符串前缀解析。M6 刚教完 Function Calling 并强调"别用字符串嗅探"，M7 的项目就倒退回去，能力曲线反向。 |
| M7-7 | `lesson-l07-02.md` | 中 | `Deadline` 小节里 `agent_step` 调用 `call_llm(timeout=llm_deadline.remaining)`，但同一节上方定义的 `call_llm(messages)` 没有 `timeout` 形参，且此处未传 `messages` → `TypeError`。`call_tool` 同样未定义。 |
| M7-8 | `lesson-l07-02.md`（`retry_with_backoff`） | 中 | 默认 `retryable_exceptions=(Exception,)`——默认行为是"什么错都重试"，与本节核心论点"只重试可恢复错误"直接冲突。第一个使用示例 `@retry_with_backoff(max_retries=3, base_delay=1.0)` 恰好吃到了这个危险默认值。 |
| M7-9 | `lesson-l07-04.md`（`AgentTaskQueue._worker`） | 中 | `result = agent.run(task["question"])` 引用未定义的全局 `agent`；`result` 赋值后未使用。同节 `SlidingWindowRateLimiter` 定义后全程未被引用（死代码）。 |
| M7-10 | `lesson-l07-01.md` | 中 | 本节出现两张"能力→课程"对照表，覆盖范围与措辞互相矛盾（同一能力被指向不同后续小节）。学员无法判断以哪张为准。 |
| M7-11 | `lesson-l07-03.md` / `project-p7.md` | 中 | 两处 checkpoint 实现不一致：L07-03 存 SDK 对象（会崩），P7 的 `CheckpointManager.save` 用 `json.dumps(cp.__dict__)` 且 messages 是纯 dict（不崩）。项目没有复现课上讲的那套代码，学员对不上号。两处均缺 `encoding="utf-8"`（S6 模式）。 |
| M7-12 | `lesson-l07-04.md` | 低 | `TokenBucket.wait()` 无上限地 `while not acquire(): sleep(0.1)`，在 `AgentConcurrencyController.execute` 里被信号量包着调用——持有并发名额的同时无限等令牌，可能导致所有名额被等待中的任务占满。缺 timeout 参数。 |
| M7-13 | M7 全模块 | 低 | 交互组件仅 `l07-01`（harnessMonitor）与 `l07-04`（harnessMonitor + circuitBreaker）两节，`l07-02` / `l07-03` / `l07-05` / `P7` 均无。S4 的覆盖不均模式延续。 |

## M8 记忆系统（5 节 + P8）

**总评：M8 是目前为止代码可运行性最差的一个模块。** L08-05 与 P8 的核心代码均无法执行。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M8-1 | `lesson-l08-05.md` 全节 | **高（结构性）** | 本节 6 个方法——`_resolve_conflict` / `forget_by_age`（两版）/ `forget_by_importance` / `recall` / `soft_forget`——全部以 `def xxx(self, ...)` 写在**模块顶层**，不在任何 class 内，却被 `MemoryUpdater` 用 `self.` 调用。整节代码没有一个能跑。 |
| M8-2 | `lesson-l08-05.md`（`MemoryUpdater`） | **高** | 调用了 6 个从未定义的方法：`_add` / `_replace` / `_archive` / `_judge_relation` / `_merge` / `_importance`。类骨架给了、实现全缺，学员无从照抄。 |
| M8-3 | `lesson-l08-05.md`（`recall` / `soft_forget`） | **高（隐私）** | `collection.update(ids=[mid], metadatas=[{"last_accessed": ...}])` 用**整体替换**语义写元数据，会抹掉 `user_id` / `created_at` / `status` / `protected`。一旦命中一次检索，该条记忆就脱离了 `where={"user_id":...}` 隔离——本模块反复强调的"隐私底线"被自己的代码打破。注：P8 的 `_upsert` 用了 `{**old_meta, ...}` 的正确写法，同一模块内两种写法自相矛盾。 |
| M8-4 | `lesson-l08-05.md`（`forget_by_age`） | 中 | Chroma 的 `$lt` 用在 ISO **字符串** `created_at` 上；且 `{"protected": {"$ne": True}}` 对**不含该键**的记录不匹配——而绝大多数记忆从未写过 `protected`，等于遗忘机制什么都删不掉，语义与意图完全相反。 |
| M8-5 | `project-p8.md`（`LongTermMemory.forget`） | **高（必崩）** | `self.col.update(where=..., metadatas=[...])` —— Chroma 的 `Collection.update()` **没有 `where` 参数**（签名是 `ids/embeddings/metadatas/documents`），直接 `TypeError`。而"遗忘机制"是 P8 的验收标准之一，且 `test_archived_not_recalled` 正好调它，测试必挂。 |
| M8-6 | `project-p8.md` Step 5 | **高（必崩）** | `PrivateRAG.__init__` 里 `self.bm25 = None`，只有 `index()` 才会构建。Step 5 第一行 `butler.chat("user_001", "我对花生过敏...")` 用的是默认 `enable_rag=True`，此时尚未索引任何文档 → `self.bm25.get_scores(...)` 抛 `AttributeError: 'NoneType'`。**整个演示脚本第一行就崩**。 |
| M8-7 | `lesson-l08-04.md`（`maybe_learn_skill`） | **高（必崩）** | `Skill` 的 `tools` / `example_input` 是**无默认值的必填字段**，而 `REFLECT_PROMPT` 只要求模型输出 `name/description/steps/preconditions/success_criteria`。`Skill(id=..., **payload)` 必然 `TypeError: missing required argument: 'tools'`。同节 `@dataclass` 也未 import。 |
| M8-8 | `lesson-l08-04.md`（`SkillLibrary._intent_similarity`） | 中（成本） | 每次 `retrieve` 对**每条技能**各发 2 次 embedding 请求（task 被重复编码 N 次）。技能库 100 条 → 单次检索 200 次 API 调用。技能描述的 embedding 应预计算缓存。课程反复讲控本，此处是全站最贵的一段示例代码。 |
| M8-9 | `lesson-l08-04.md` vs `lesson-l06-07.md` / `l06-08.md` | 中（体系） | **同名不同物的第二次冲突**：M6 已定义过一套 `Skill` dataclass + Registry + `find_by_intent`，M8-04 又定义了一套字段不同的 `Skill` + `SkillLibrary` + `retrieve`。两处都叫"技能"，互不引用、互不兼容，也没有一句话说明关系。学员会以为是同一个东西。 |
| M8-10 | `lesson-l08-03.md`（`LongTermMemory.remember`） | 中 | `ids=[f"{user_id}_{hash(f['fact']) & 0xffff}_{i}"]` —— Python 的 `str.__hash__` 每进程随机化（PYTHONHASHSEED），跨次运行同一事实得到不同 ID，去重/更新/删除全部失效；`& 0xffff` 仅 65536 桶，碰撞概率高。P8 的 `abs(hash(new_fact))` 同病，且第三条冲突事实会与 `_v2` 后缀撞 ID。 |
| M8-11 | `lesson-l08-03.md` | 中 | 正文写"**`remember` 是异步触发的**——不必阻塞用户等待抽取"，紧邻的 `MemoryAugmentedAgent.chat` 第 4 步却是**同步**调用。P8 Step 4 同样同步（注释坦承"异步更好，此处同步示意"）。说的和做的相反。 |
| M8-12 | `lesson-l08-03.md` / `project-p8.md` | 中 | L08-03 明确警告"生产环境应显式指定 embedding 模型，与 M4 RAG 保持一致，避免跨库语义漂移"，随后自己的 `LongTermMemory` 全部走 Chroma **默认** embedding（all-MiniLM）。P8 更进一步：`PrivateRAG` 显式用 `text-embedding-3-small`，`LongTermMemory` 用默认模型——**同一项目里两套 embedding**，正是本课警告的那个坑。 |
| M8-13 | `lesson-l08-03.md` | 中 | "隐私"小节承诺"提供'忘记我'接口（按 user_id 删除）"，`LongTermMemory` 类里没有任何删除方法。P8 也把它放进"进阶挑战 4"而非实现。承诺与交付不符。 |
| M8-14 | `lesson-l08-02.md`（三个 Memory 类） | 中 | 逐条 `pop(0)` 会把 `assistant`（带 `tool_calls`）与其配对的 `tool` 消息拆散，OpenAI API 直接返回 400。M6 刚教完 Function Calling，M8 的窗口管理却没处理工具消息配对——两模块拼在一起就报错。 |
| M8-15 | `lesson-l08-02.md`（`TokenBudgetMemory`） | 中 | `tiktoken.encoding_for_model("gpt-4o")` 用已下线模型（S1）；`_count(m["content"])` 在 content 为 `None`（tool_calls 消息）时 `TypeError`；`_total_tokens` 未计入每条消息约 3–4 token 的固定开销，预算会系统性低估。 |
| M8-16 | `lesson-l08-02.md` | 低 | "超过 ~32K 后，模型对早期内容的遵循度开始下降"标称"实测"，无任何出处或测量方法。S6 的编造数字模式复现。 |
| M8-17 | `lesson-l08-04.md`（`record_skill_outcome`） | 低 | `success_rate` 初值 1.0 + EMA(α=0.3)，新技能天生满分，检索排序系统性偏向**未经验证**的技能，与"历史成功率加权让技能库自我进化"的主张相反。应用 Beta 先验或 `usage_count` 门槛。 |
| M8-18 | `lesson-l08-04.md`（`_check_preconditions`） | 低 | 恒返回 `True`（docstring 坦承"此处恒 True 仅演示流程"），但"检索三要素"和"要点总结"都把"前置条件硬过滤"当成已落地的机制陈述。 |
| M8-19 | `project-p8.md`（`PrivateRAG.index`） | 低 | 每调用一次 `index()` 就用**全量语料**重建 `BM25Okapi`，N 篇文档是 O(N²)；`metadatas` 里又存了一份 `text`，与 `documents` 重复占用一倍空间。 |
| M8-20 | `project-p8.md` | 中（体系） | L08-04 程序记忆（技能库）整节内容在 P8 中**完全没有落地**——架构图里标注"进阶可选"，实施步骤 1–6 无一涉及，只在"进阶挑战 2"里提一句。M8 五节课有一节没有项目承接。 |
| M8-21 | `project-p8.md` | 中（成本） | 单轮 `chat()` 的 LLM 调用数：摘要压缩 1 + `_extract` 1 + 每条事实 `_judge_relation` 1（+可能 `_merge` 1）+ 主推理 1 ≈ **4–6 次**，外加 2 次 embedding。项目通篇未提这个成本量级，也没给节流开关。 |
| M8-22 | `lesson-l08-01.md` | 低 | 正文教的是**五**类记忆（短期/情景/语义/程序/工作），配套交互组件是 `memoryLayers`「记忆**四层**路由」+ `memoryLayersDiagram`「记忆**四层**」。文字与组件的分类数对不上，学员一眼就会困惑。 |
| M8-23 | M8 全模块 | 低 | 交互组件集中在 `l08-01`（2 个）与 `l08-02`（1 个，且是 M3 复用的 contextBudget）；`l08-03` / `l08-04` / `l08-05` / `P8` 全无。S4 模式延续，且本模块正是最需要可视化（冲突/遗忘时间线）的一章。 |
| M8-24 | `lesson-l08-03.md` | 低（待核） | MemGPT 已更名并产品化为 **Letta**（2024 年下半年），课程全程只称 MemGPT，未提改名；Mem0 也已有独立开源产品形态。**待联网核实后定级。** |

## M9 代码执行与沙箱（4 节 + P9）

**总评：M9 是 M5–M9 中设计质量最高的模块**——威胁模型清晰、方案谱系完整、纵深防御分层合理、动手练习有验收标准。问题集中在代码细节，且多处「课上写错、项目里悄悄改对」。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M9-1 | `lesson-l09-04.md`（`REVIEW_PROMPT`） | **高（必崩）** | prompt 里的 JSON 示例 `{"safe": bool, "reason": "...", "risk": "..."}` 用了**单花括号**，却走 `.format(code=code)` → `str.format` 把它当成替换字段，直接 `KeyError`。`llm_review_code` 第一次调用就崩。**证据**：L08-04 的 `REFLECT_PROMPT` 正确写了 `{{"save": false}}`，P9 的同一段 prompt 改用字符串拼接绕开了——项目侧已经"悄悄改对"，说明课上这版确实是错的。 |
| M9-2 | `lesson-l09-04.md` / `project-p9.md`（`DANGEROUS_CALLS`） | **高（安全）** | 黑名单里写的是 `os.exec` / `os.spawn`，但真实 API 叫 `os.execv` / `os.spawnl`，`f"{fn.value.id}.{fn.attr}"` 拼出来永远匹配不上，**这两条等于没写**。更关键的是三种一行绕过全部未拦、也未提及：`import os as o; o.system(...)`、`from os import system; system(...)`、`getattr(__builtins__,...)`。课文只承认 `getattr` 拼接这一种局限，给学员的安全感高于实际防护力。 |
| M9-3 | `lesson-l09-02.md`（`run_with_file`） | **高** | 函数签名有 `timeout=10`，函数体里**从头到尾没用过**——`container.exec_run()` 不支持 timeout 参数。传进来的 `while True: pass` 会永久挂住。这是一节安全课里的无超时执行路径。 |
| M9-4 | `project-p9.md`（`run_sandboxed` 内存采样） | **高** | `container.stats(stream=False)` 紧跟在 `container.start()` **之后、`wait()` 之前**执行（注释却写"简化：取结束时的 stats"），采到的是 t≈0 的内存 → `peak_memory_mb` 恒为 0。而"审计日志记录每次执行的资源"是 P9 的验收标准之一。另：`memory_stats.max_usage` 是 **cgroup v1** 字段，现代内核（cgroup v2）下不存在，同样返回 0。 |
| M9-5 | `project-p9.md` Step 6 测试 | **高** | 多个测试与自己的安全管道冲突：`test_no_network` 提交 `urllib.request.urlopen(...)`——这**正是** `llm_review` 被要求拦截的"网络外连"，被拦后 `/exec` 返回 `{"error": ...}`（无 `exit_code` 键），测试里 `r["exit_code"]` 直接 `KeyError` 而非干净失败。`test_memory_bomb_oom` / `test_output_redaction` 同样只走 happy path。 |
| M9-6 | `project-p9.md`（`/exec` 与 SDK） | 中 | 拦截路径返回 `{"error": ...}` 且 HTTP 200，与成功路径的 `{exec_id, exit_code, stdout, stderr, ...}` **结构完全不同**，SDK 又原样 `return r.json()`。验收标准写的是"返回 stdout/stderr/exit_code"，拦截时并不满足。调用方必须先猜返回形状。 |
| M9-7 | `project-p9.md`（`AuditRecord`） | 中（安全语义） | P9 把 L09-04 的 `execution_blocked` 字段**删掉了**，AST/LLM 拦截也记成 `output_blocked=True`，于是 `_detect` 对一次**输入侧注入拦截**告警成"输出被拦"。安全服务的审计日志把攻击类型记反了，事后溯源会误导。且与 L09-04 的字段定义不一致。 |
| M9-8 | `lesson-l09-02.md` | 中 | `security_opt=["no-new-privileges", "seccomp=default"]` —— Docker 的 seccomp 选项取值是**配置文件路径或 JSON**（或 `unconfined`），`default` 不是合法取值，默认配置本来就自动生效。P9 里改成了只留 `no-new-privileges`——又一处"项目悄悄改对、课上没改"。 |
| M9-9 | `lesson-l09-02.md` / `project-p9.md` | 中（体系） | 沙箱镜像固定 `python:3.12-slim` + `read_only=True` + `network_mode="none"` → **装不了任何第三方包**。而 L09-01 开篇举的旗舰场景就是"读 CSV、用 pandas 算统计量、画图"，L09-03 的 E2B 示例也是 pandas。自建 Docker 方案**跑不了本模块自己反复宣传的用例**，全模块没有一句话说明这个落差（要么预装镜像、要么挂只读的 site-packages）。 |
| M9-10 | `lesson-l09-04.md` / `project-p9.md`（`SENSITIVE_PATTERNS`） | 中（时效） | `sk-[a-zA-Z0-9]{48}` 是**旧格式** OpenAI key 的正则；现行 key 为 `sk-proj-...` 且长度不定，该规则对当前密钥**完全不匹配**。一个号称"密钥外泄兜底"的正则实际拦不住今天的密钥。`ghp_[a-zA-Z0-9]{36}` 同样需要复核。 |
| M9-11 | `lesson-l09-04.md`（`safe_execute`） | 中 | `ExecutionAudit` 声明了 `peak_memory_mb` / `cpu_time_ms`，`safe_execute` 里两者**始终是 0**，全靠 `exit_code == 137` 猜 OOM。"第三层：资源使用审计"这一层在课上其实没有落地实现，但要点总结把它当已完成能力陈述。 |
| M9-12 | `lesson-l09-03.md` | 中（标题名不副实） | 标题是「E2B / Modal / Fly.io Machines」，实际只有 E2B 有可运行代码；**Modal 零代码**（只在对比表出现一行），Fly.io 只有 3 行 `# 概念示意` 注释。三选一的深度写成了三家并列的标题。 |
| M9-13 | `lesson-l09-03.md`（`interactive_session`） | 中 | 这段代码要演示"沙箱保持状态、复用上一步的 `df`"，但真正证明这一点的 `r = sb.run_code("print(df.describe())")` **被赋值后丢弃**，函数返回的 `r2` 反而是**重新 `read_csv` 一遍**的结果——恰好绕开了要演示的特性。示例证明不了自己的论点。 |
| M9-14 | `lesson-l09-01.md`（`subprocess_exec`） | 中 | `finally` 里 `os.rmdir(sandbox_dir)` 只能删空目录，而 `cwd=sandbox_dir` 正是让被执行代码写文件的地方（哪怕只生成 `__pycache__`）→ `OSError: Directory not empty`，掩盖真实结果。应 `shutil.rmtree(..., ignore_errors=True)`。另：`subprocess.run(timeout=)` 抛的 `TimeoutExpired` 未捕获，函数的"返回 str"契约在最该生效时失效。 |
| M9-15 | `lesson-l09-01.md`（`subprocess_exec`） | 低 | `env={"PATH": "/usr/bin:/bin", ...}` + `["python", script]` 是纯 POSIX 写法，Windows 上直接失效（应 `sys.executable`）。与 M6-18 的 macOS-only 路径是同一类平台假设问题。 |
| M9-16 | `lesson-l09-02.md` / `project-p9.md` | 低 | `exit_code = 137（OOM Killed）` 被当作确定结论写进注释和断言，但 `x = 'A' * 10**9` 在 CPython 里常先抛 `MemoryError`（exit 1）而非被 OOM killer 杀。P9 的 `test_memory_bomb_oom` 用 `== 137` 硬断言，本身就是个 flaky test。 |
| M9-17 | `lesson-l09-04.md`（`review_output`） | 低 | `findings` 非空即置 `output_blocked = True`，但函数**照常返回**脱敏后的输出，什么也没 block——字段名与行为不符。IP 正则 `(?:\d{1,3}\.){3}\d{1,3}` 无白名单，会把数据分析里的正常数值/版本号一并涂黑，而数据分析正是本模块的旗舰场景。 |
| M9-18 | `project-p9.md` | 低 | 缺 `requirements.txt` / `Dockerfile` / 启动说明——SDK 默认打 `http://localhost:8000`，但全文没有一句 `uvicorn sandbox.service:app`；`service.py` 用相对导入 `from .executor import`（需 `__init__.py`），测试却用绝对导入 `from sandbox.sdk import`，两种风格未统一。Step 1 的 `tarfile, io, hashlib, uuid, datetime` 全部未使用。 |
| M9-19 | `project-p9.md`（`load_test.py`） | 低（成本） | 20 并发 × 100 次 = 100 个 Docker 容器 **+ 100 次 LLM 审查调用**。压测脚本的真实成本（钱和机器）只字未提，也没给"压测时跳过 LLM 审查"的开关。 |
| M9-20 | M9 全模块 | 低 | 交互组件只在 `l09-02`（sandboxDemo）与 `l09-04`（guardrail，M12 复用）出现；`l09-01`（方案谱系对比，最该可视化）、`l09-03`、`P9` 均无。S4 模式延续。 |
| M9-21 | `lesson-l09-03.md` | 低（待核） | 需联网核实：E2B `Sandbox.create(timeout=)` 的语义（是**沙箱生命周期**而非单次执行超时，课文的参数名与用法有歧义）、"~150ms 启动"、`e2b-code-interpreter` 当前 SDK 版本与 API 形态、Modal/Fly.io 的现状。 |

## M10 Agent 框架与编排（6 节 + P10）

**总评：M10 的判断力是全站最好的一档**——L10-01 的选型框架、L10-06 的"框架三重税/何时退回手写"、L10-04 的 CrewAI↔LangGraph 对照，都是有观点、有取舍、不吹框架的成熟写法。但**代码的可运行性与正文承诺之间存在系统性缺口**，且缺口集中在同一个知识点上：reducer。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M10-1 | `lesson-l10-02.md`（`ResearchState`） | **高（自相矛盾）** | `docs: list` **没有 reducer**，但本节"并行"小节明确写"`docs` 用 list 累加，自动收集三个来源的结果"。实际上无 reducer 的字段被多个并行节点同时写会抛 `InvalidUpdateError: At key 'docs': Can receive only one value per step`。本节自己讲了 reducer 的必要性（"忘了加 reducer→状态莫名丢失"），却在自己的 state 上漏了——**课上唯一完整的 state 定义就是反面教材**。P10 的 `raw_results: Annotated[list, lambda a,b: a+b]` 才是对的，又一次"课上写错、项目里悄悄改对"（M9-1/M9-8 同型）。 |
| M10-2 | `lesson-l10-03.md`（`State` / ToolNode 图） | **高** | HITL 小节复用的 `State` TypedDict 里 `messages: list` 同样**无 `add_messages` reducer**，而 `call_model` 返回 `{"messages": [ai]}`、图里又有 `tools → agent` 回环。无 reducer ⇒ 每轮**覆盖**而非追加 ⇒ 工具结果消息在下一轮丢失，Agent 永远看不到自己刚拿到的工具返回。与 L10-02 亲自给出的告诫直接冲突。 |
| M10-3 | `lesson-l10-03.md` / `project-p10.md`（`route_after_review`） | **高（必崩）** | 两处路由函数都 `return END`，但 `END` 在各自的文件/代码块里**从未 import**（P10 的 `hitl.py` 只 `from langgraph.types import interrupt, Command`）→ `NameError`。P10 的 `graph.py` 才 import 了 `END`，但路由函数不在那儿。学员照抄即崩。附带：函数签名标注 `-> str`，返回的却是 `END` 哨兵。 |
| M10-4 | `project-p10.md` Step 6 测试 | **高** | 整套测试**一条也跑不了**：`make_search_node` 里的 `search_api` 从未定义（NameError），`nodes.py` 模块级 `client = OpenAI()` 需真实 key，且无任何 mock/monkeypatch。而"含测试：HITL 中断恢复、并行汇聚、状态重放"是 P10 的验收标准。 |
| M10-5 | `project-p10.md`（`test_parallel_search_merges`） | **高（测试无效）** | 断言是 `assert len(state.values.get("raw_results", [])) >= 0` —— **恒真**，空列表、字段不存在都能通过。号称验证"并行汇聚"的测试实际什么都没验证。全站目前发现的最典型的假测试。 |
| M10-6 | `lesson-l10-05.md` / `project-p10.md` | 中（体系） | 两处出现完整 **JSX/React 组件**（`AgentChat`、`ResearchAgent`）。而 `CLAUDE.md` 明文规定"代码主线是 Python，只有 L17-05/L17-06/L17-11/L17-12 例外"。M10 的前端代码**不在例外清单里**，C15 也只查"双语言承诺"文案、不查实际代码块分布——规则与事实脱节，要么补进例外清单，要么把 C15 扩成"按文件统计 TS 代码块并核对白名单"。 |
| M10-7 | `lesson-l10-02.md` | 中 | `pip install langgraph` 之后直接 `from langgraph.checkpoint.sqlite import SqliteSaver`——`SqliteSaver` 在独立包 `langgraph-checkpoint-sqlite` 里，不额外装会 `ImportError`。P10 Step 3 同病。本节把 checkpointer 当作"编译时传一个即可"的内建能力介绍，装包这一步被略过。 |
| M10-8 | `lesson-l10-02.md` / `l10-03.md` | 中 | 大量未定义符号：l10-02 的 `vector_db` / `llm_rewrite` / `llm_generate`；l10-03 的 `llm` / `ALL_TOOLS` / `json`（未 import）/ `time`（未 import，用于 `deadline_ts`）。示例性代码可以留占位，但本模块的定位是"动手用框架"，占位密度已高到无法整段运行。 |
| M10-9 | `lesson-l10-03.md`（超时降级小节） | 中 | `deadline_ts` 被写进 interrupt 的 payload，但图里**没有任何节点消费它**，超时后的降级完全依赖一段伪代码描述的"外部调度器"。这一小节讲的是"HITL 等不到人怎么办"——这恰恰是生产最关键的一问，却是全节唯一没有可运行落地的部分。 |
| M10-10 | `project-p10.md` Step 5 前端 | 中 | `resume()` 里 `fetch(...).then(r => r.body.getReader())` 拿到 reader 后**从不读取**，`setReport` 全程未被调用 → UI 上"报告：{report}"永远是空的。而"前端可视化：实时步骤列表 + 逐字答案 + 中断审核 UI"是验收标准。批准之后用户看不到任何结果，演示在最后一步断掉。 |
| M10-11 | `lesson-l10-05.md`（`running_tasks`） | 中 | 取消机制用模块级全局 dict，多 worker（`uvicorn --workers N`）或多实例部署下 `/cancel` 会打到没有该 task 的进程上，静默失效。本节正是在讲"前端假停 vs 后端真停"，给出的"真停"方案在生产拓扑下同样是假停。另：走取消分支时 `running_tasks.pop` 被 `return` 跳过 → 条目泄漏，而同节"坑3"讲的就是连接/资源泄漏。 |
| M10-12 | `lesson-l10-05.md`（坑3） | 低（待核） | "后端检测连接断开（yield 时抛异常）就停"——Starlette 的 `StreamingResponse` 对同步生成器并不保证在客户端断开时向生成器抛异常，可靠做法是 `await request.is_disconnected()` 或 `anyio` 任务组。**待核实当前 Starlette 版本行为后定级。** |
| M10-13 | `lesson-l10-04.md` | 中 | 全节 CrewAI 代码**零验证痕迹**：`llm="gpt-4o-mini"` 字符串式传参、`Process.hierarchical` 下 Task 仍显式绑定 `agent=`（与"主管动态分配"语义冲突）、`crew.kickoff(...).raw`、`from crewai.tools import tool` 的装饰器签名——这些 API 在 CrewAI 各版本间变动频繁，正文未给任何版本约束（只写 `pip install crewai`）。**待联网核实当前 CrewAI 版本 API 后定级。** |
| M10-14 | `lesson-l10-04.md` | 低 | `allow_delegation=True` 只在 `coder` 上开启，而委托的语义是"向别人求助"——正文举的例子是"程序员问 PM"，但 PM 与 architect 都是 `allow_delegation=False`。CrewAI 里被委托方是否需要开启该开关、`sequential` 下能否反向委托，正文未交代，例子与配置对不上。 |
| M10-15 | `project-p10.md`（`plan` / `dedup`） | 低 | `plan` 只在 prompt 里要求"3 个子查询"，无长度校验；`make_search_node` 把整个 `sub_queries` 列表原样传给 `search_api`，三个来源节点因此跑的是**同一批查询**（差异只在 source），与"分解为不同角度的子查询"的设计意图脱节。`dedup` 用 `r["title"][:50]` 做键，但搜索结果的字段形状全靠约定，`search_api` 又是未定义的。 |
| M10-16 | `lesson-l10-01.md` / `l10-04.md` / `l10-05.md` / `l10-06.md` / `P10` | 低 | 交互组件只在 `l10-02`（graphOrchestrator + langGraphState）与 `l10-03`（topology + hitlFlow）出现，**其余 4 节课与项目全无**。且 `l10-03` 用的 `topology` 是 M11「多智能体拓扑」的组件，与本节 HITL 主题关系很弱（疑似为凑 C3/C4 而挂）。S4 模式在本模块最明显。 |
| M10-17 | `lesson-l10-01.md` | 低 | 全节纯概念、无一行可运行代码，且**无交互组件**，是"框架选型"这种最该给对照表/决策器的主题——现有 `tradeoff`（架构加权决策矩阵）组件正好适用却未被引用。 |

## M11 多智能体系统（5 节 + P11）

**总评：M11 是全站"观点密度"最高的模块**——L11-05 的"边际收益递减 / 先问这个 Agent 能不能去掉"、L11-04 的"对话式并没有真正去中心化，manager 就是 supervisor 换皮"，都是敢说真话的判断。但本模块出现了一个新的、比代码 bug 更值得警惕的问题：**课程反复强调的核心机制（防坍缩、护栏），在自己的代码里几乎全部没有落地。**

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M11-1 | `lesson-l11-02.md`（`llm_route` vs `route`） | **高（自相矛盾）** | 同一节给出两套互斥的非法路由处理：`llm_route` 里 `raise ValueError(f"非法路由: {nxt}")`，而正文紧接着说"对策——校验 next 在合法 options 里，不在就当重新决策"，`route()` 也写了 `return "supervisor"` 兜底。实际执行时 **`raise` 先发生**，异常冒泡炸掉整张图，`route()` 的兜底分支是**永远走不到的死代码**。本节自己的核心论点"把失败作为 state 流动而非抛异常"被自己的代码违反。 |
| M11-2 | `lesson-l11-02.md`（`llm_route` 的 messages） | **高（必崩）** | `messages: Annotated[list, add_messages]` 经 reducer 后存的是 LangChain 的 `BaseMessage` 对象；`llm_route` 却把 `state["messages"]` 直接拼进 `client.chat.completions.create(messages=[system] + messages)`。OpenAI SDK 收到 `AIMessage` 对象会报错。**与 M7-1 是同一类型的错误（SDK 对象 / dict 混用），方向相反。** |
| M11-3 | `lesson-l11-02.md` | **高** | supervisor↔下属是本课程里最典型的**成环图**（三条回边），却 `g.compile(checkpointer=...)` 后既没设 `recursion_limit`，正文也未提。L10-02 明写"任何成环的图都该设 recursion_limit"、L10-06 把"盲信默认值"列为反模式——M11-02 同时踩了两条。而本节"动手 5 分钟"第 3 步恰恰要求学员实现"总步数上限"和"无进展检测"，正文没给任何示范。 |
| M11-4 | `lesson-l11-03.md`（`debate()`） | **高（承诺 vs 落地）** | 本节的核心论点是"默认 LLM 会坍缩到附和，必须主动设计对抗压力"，并给出三个手段（强制对立 prompt / 每轮换防 / 魔鬼代言人）。而唯一可运行的 `debate()` 函数**一个都没实现**：没有立场轮换、没有对立 prompt、`devil_advocate_round` 定义后**从未被调用**。学员照抄 `debate()` 得到的正是本节警告的那种"浪费算力的附和会"。 |
| M11-5 | `project-p11.md`（`TeamGuardrails`） | **高（承诺 vs 落地）** | 验收标准写"病态行为护栏：recursion_limit、修改次数上限、强制找茬、**TeamGuardrails**"，Step 5 也定义了这个类——但它**从未接进图**。Step 7 的注释坦承"护栏可挂在自定义节点包装或 stream 循环里"，Step 8 只对它做孤立单测。**M11 收官项目的旗舰护栏是死代码。** 与 M11-4 是同一个病：模块最强调的机制恰恰是没落地的那个。 |
| M11-6 | `project-p11.md`（`test_review_loop_converges`） | **高（测试无效）** | 断言只有 `assert r.get("test_report")`——而"通过评审"和"改满 3 次强制交付"两条路径**都会**产出 test_report。这个测试无法区分"闭环收敛了"和"闭环一次都没转"。考虑到 LLM 的讨好倾向，Reviewer 大概率第一轮就 `pass`，于是这个名为"验证闭环收敛"的测试实际连闭环都没进过。与 M10-5 同型。 |
| M11-7 | `project-p11.md`（`test_debate_produces_verdict`） | 中 | `assert "采纳" in r["architecture"] or "否定" in r["architecture"]`——对 LLM **自由文本**做子串断言，天然 flaky。且这条测试自身要发 5 次 LLM 请求（2 轮 ×2 + 裁判，裁判还是 `gpt-4o`）。 |
| M11-8 | `project-p11.md` Step 8 | 中（成本） | 4 条测试**全部发真实 LLM 请求、零 mock**。`test_full_pipeline_*` 单条就是 pm 1 + debate 5 + coder 1 + reviewer 1（+ 最多 3 轮 coder/reviewer = 6）+ tester 1 ≈ 9–15 次调用。跑一次 `pytest` 约 30–40 次 LLM 调用且需真实 key，项目全文未提。与 M9-19 同型。 |
| M11-9 | `project-p11.md` | 中（体系） | **五节课里有两节在项目中没有落地**：L11-02（supervisor，本模块篇幅最大、代码最多的一节）被降级到"进阶挑战 1"，项目还专门写了一段"为何不用全程 Supervisor"来解释；L11-04（AutoGen 对话式）降级到"进阶挑战 4"。M8-20 的模式在此复现，且更严重——这次是模块的**主角**没上场。 |
| M11-10 | `lesson-l11-05.md`（`MultiAgentGuardrails.check`） | 中 | 重复检测 `hash(str(state["messages"][-1:])[:100])`：先 `str()` 一个单元素列表再截前 100 字符。这 100 字符里前 ~60 个是 `[{'role': 'assistant', 'name': 'reviewer', 'content': '` 这类**固定样板**，真正参与判重的内容不足 40 字符 → **同一角色连续两次发言极易被误判为"死循环"而强制终止**。一节讲护栏的课，给出的护栏本身会误杀。P11 的 `TeamGuardrails` 用 `str(state["code"])[:100]` 同病，且变量名叫 `msg_hashes` 却存的是原文前缀。 |
| M11-11 | `lesson-l11-04.md` | 中（待核） | AutoGen/AG2 用法存疑三处：(a) `pm` 既是 `groupchat.agents` 成员又用 `pm.initiate_chat(manager, ...)` 发起（惯例是群外的 `UserProxyAgent` 发起）；(b) `is_termination_msg` 配在**成员** Agent 上，而 GroupChat 的终止判定通常看 `GroupChatManager`——正文却把它列为"终止三手段"之一并称已配好；(c) `@coder.register_for_execution()` + `@reviewer.register_for_llm(...)` 的角色分配与语义相反（写代码的 coder 成了执行方、审代码的 reviewer 成了调用方）。**待联网核实当前 AG2 版本 API 后定级。** |
| M11-12 | `lesson-l11-04.md` | 中 | `UserProxyAgent` 被创建后**从未加入任何 GroupChat**，正文却断言"群聊里 user_proxy 在需要时会问真人"。承诺与代码不符（M11-4/M11-5 的同一模式，第三次出现）。 |
| M11-13 | `lesson-l11-02.md` / `l11-05.md` | 中 | `options=[...]`（字面 Ellipsis）在 M11 出现两次（`supervisor` 容错版、`supervisor_route`），加上 M6-17 的 `tools=[...]` 已是**第三次**。这类"占位符长得像可运行代码"的写法直接拷走就是 `TypeError`，且报错信息与真实原因无关，学员很难定位。建议全站统一改成 `options=OPTIONS` 之类的具名占位。 |
| M11-14 | `lesson-l11-01.md`（通信复杂度表） | 低 | 表里链式/星型/层级在 n=3/5/10/20 时写成 3/5/10/20 条边，实际都是 **n−1**（2/4/9/19）。网状列 3/10/45/190 是对的。一节以"把成本算清楚"为主旨的课，自己的数字表系统性差 1。 |
| M11-15 | `lesson-l11-05.md` | 低 | "最佳规模是 2-4 个 Agent"、"超过 7 个通信成本明显拖累"（L11-01）均以经验结论陈述，无任何出处或测量方法；同节的"收益随 Agent 数量变化"ASCII 曲线画得也不成形（下降段画在平台段右上方，横轴 1/2/3/4/7/10 非等距）。S6 的编造数字模式复现，且这次是模块的**核心论点**。 |
| M11-16 | `project-p11.md`（`debate_architecture`） | 低 | `history`（Python list）被直接 f-string 插进 prompt，模型看到的是带引号和转义的 list repr；且每轮把全量 history 重发，2 轮下来 prompt 体积平方增长。L11-03 的 `transcript` 至少加了说话人标签的注释，P11 反而更粗糙。另：`architecture` 字段存的是**裁判的元评论**（"采纳了哪些、否定了哪些"）而非干净的架构文档，却直接喂给 Coder 当"架构方案"。 |
| M11-17 | `project-p11.md` Step 6 | 低 | `from langgraph.checkpoint.sqlite import SqliteSaver` 只在注释里用到 → 未使用的 import，且需额外装 `langgraph-checkpoint-sqlite`（M10-7）。 |
| M11-18 | M11 全模块 | 中 | 交互组件：`l11-01`（topology + multiAgentTopologyDiagram）、`l11-02`（supervisorPattern）、`l11-05`（topology，**与 l11-01 重复**且只是"先回到面板看一眼"的装饰性引用）；`l11-03`（debate）、`l11-04`（对话式）、`P11` **全无**。而 L11-05 的五种病态行为（死循环/互相恭维/推诿/发散/串行化）是全站最适合做可视化的内容之一——P11 的"进阶挑战 6：病态监测面板"等于把本该由课程提供的交互组件**外包给了学员**。 |

## M12 多模态 Agent（5 节 + P12）

**总评：M12 的知识组织是好的**——L12-01 的"模态×能力"选型框架、L12-04 的"采样是视频理解的必需前提"、L12-05 的"双路校验"都是有工程含金量的判断。但本模块暴露了一个贯穿全模块的结构性矛盾：**L12-01 花一整节课教你怎么在 OpenAI / Gemini / Claude 之间选型，随后四节课与项目的每一行代码都只用 OpenAI。**选型框架成了纯装饰。同时 M12 把 S2（模型白名单治理）的漏洞扩大到了语音/嵌入类模型。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M12-1 | M12 全模块 | **高（体系 / 承诺 vs 落地）** | L12-01 建立三厂商选型框架（长文档→Gemini、OCR/精细读数→Claude、通用→GPT-4o），而 L12-02/03/04/05 与 P12 的**全部**代码都是 `client = OpenAI()`。最刺眼的一处：`understand_document` 里注释写着 `# 2. 多页一起送多模态模型（Gemini 多图强项）`，**紧挨着的下一行就是 `model="gpt-4o"`**；`ocr_understand` 用 `gpt-4o-mini`，而 L12-01 刚说 OCR 该选 Claude。视频（Gemini 的原生长视频输入是该领域最大差异点）全节未提 Gemini。选型课与实现课互不通气。 |
| M12-2 | `lesson-l12-03.md` | **高（治理）** | `model="whisper-1"`、`model="tts-1"` 既不在 `models.ts` 白名单里，也**不被 C5 正则覆盖**（正则只认 `gpt-*` / `claude-*` / `gemini-*`）。同类逃逸还有 `text-embedding-3-*`、`bge-*`（M4）。结论：**全站的模型时效性守护只覆盖对话模型，语音/嵌入/重排模型完全在治理之外**——恰恰是这几类的型号更迭同样频繁。需扩 `MODEL_TIERS` 的 embedding 档（现为空数组）并新增 speech 档，同步扩 C5 正则。 |
| M12-3 | `lesson-l12-02.md` / `l12-05.md` / `project-p12.md` | **高** | `page.get_pixmap()` **用默认 72 DPI** 渲染 PDF 页，三处全同。72 DPI 下正文小字在多模态模型眼里已接近不可读——而这两节的主题正是"OCR / 表格 / 扫描件的准确率"。正确写法是 `get_pixmap(dpi=150~200)` 或 `matrix=fitz.Matrix(2,2)`。**准确率课自己埋了最大的准确率杀手**，且 L12-05 通篇在讨论"提取不准怎么办"却从未提到分辨率这一因素。 |
| M12-4 | `lesson-l12-02.md`（`understand_document`）/ `l12-04.md`（`sample_frames_uniform`, `locate_event`） | **高（自相矛盾）** | 三个函数都**没有任何数量上限**：`understand_document` 把 PDF 全部页无条件送进一次请求，而 L12-01 自己警告过"base64 大图会让请求体超过 API 限制"；`sample_frames_uniform` 对 10 分钟视频按 2 秒采样得 300 帧，而三行之后正文写着"控制采样到 10-30 帧"；`locate_event` 每 3 秒发一次 LLM 请求，10 分钟视频 = **200 次调用**，而本节"成本陷阱"小节的结论是"帧数严控"。**正文的成本纪律与同页代码全部相反。** |
| M12-5 | `project-p12.md` Step 8 | **高（测试无效）** | `TestProcessors` 三条断言均为**恒真**：`assemble_report` 无条件写入 `content["description"] / ["transcript"] / ["events"]` 等键（值可为 `None`），断言只查 `in`，故只要不抛异常就必过。同时这三条测试全部发**真实 API 请求**，依赖从未提供的 `test_data/chart.png|voice.mp3|clip.mp4`，无 mock——即"跑不起来，跑起来也验不到东西"。与 M10-5 / M11-6 同型，本模块是第三次。 |
| M12-6 | `lesson-l12-05.md` | **高（承诺 vs 落地）** | 本节的旗舰机制"双路校验"由 `reconcile_tables(llm_table, plumber_table)` 承载，而这个函数**从未定义**——整套校验的核心逻辑（怎么比、不一致怎么标）是空的。同节的 `merge_batch_results`（长 PDF 的跨批综合）、`parse_number`（范围校验）同样未定义。三个未定义函数恰好是本节三个小节各自的关键一步。另：`pdfplumber.extract_table()` 在扫描件上返回 `None`，而正文明说双路的价值就在扫描件场景，代码对 `None` 无任何处理。 |
| M12-7 | `lesson-l12-04.md`（`extract_highlights`） | 中 | `parse_time_segments` 未定义；`cut_clip` 用 `-c copy` 且 `-ss` 置于 `-i` 之后，流拷贝只能在关键帧处切，实际切点可能偏移数秒——对"提取最关键的 15 秒"这个需求是硬伤，正文的注释却只提醒了 `-y` 的位置。要精确切需 `-c:v libx264` 重编码或先 `-ss` 快定位再精定位。 |
| M12-8 | `lesson-l12-04.md`（`locate_event`） | 中 | `if "是" in resp...content` —— **"不是"也含"是"**，模型任何否定回答都会被判为命中。与 M11-7 的自由文本子串断言同型，但这次错在产品逻辑而非测试里。应改结构化输出或 `content.strip().startswith("是")`。另：相邻命中段未合并，输出 `[(12,15),(15,18)]` 而非正文承诺的"12-15 秒之间"的连续区间。 |
| M12-9 | `lesson-l12-03.md`（`VoiceAgent`） | 中 | 打断机制不成立：`respond()` 先 `reply = await llm_stream(text)` **完整跑完**才置 `self.speaking = True`，所以 LLM 生成阶段 `interrupt()` 什么也取消不了——而正文承诺的是"立即停止 TTS 播放 **+ 取消 LLM 生成**"。且 `interrupt()` 与 `respond()` 的 `finally` 都写 `self.speaking`，存在竞态；`listen_and_respond` 每个 chunk 覆盖 `current_task` 而不 await 前一个，任务泄漏。本节最核心的卖点（可打断的语音 Agent）在代码层面不成立。 |
| M12-10 | `lesson-l12-02.md` | 中 | mime 硬编码 `data:image/png` 出现在 `describe_image` / `analyze_multiple` / `ocr_understand` / `extract_chart_data` / `understand_document` 五处，而同节用例传的是 `"meeting.jpg"`；讽刺的是本节前 60 行的 `vision_base64` 已经**正确地按后缀推导 mime**，后面全部倒退。P12 的 `MIME` 字典是对的——又一次"课上写错、项目里悄悄改对"（M9-1/M9-8/M10-1 同型，第四次）。 |
| M12-11 | `lesson-l12-02.md` | 中（成本） | 讲"视觉的成本与延迟"却**从头到尾没提 OpenAI 的 `detail: "low"/"high"` 参数**——这是图片理解唯一的一级成本开关（low 固定 85 token，相比高清图的上千 token 差一个量级）。一节以省钱为落点的课漏掉了最大的省钱手段。 |
| M12-12 | `lesson-l12-02.md` / `l12-05.md` | 低 | 临时文件反复出问题：`pdf_to_images` 写死 `pdf_page_{i}.png` 到 `tempfile.gettempdir()`（多进程/多文档并发必冲突，且从不清理），`extract_table_from_image` 写死 `page.png` 同理；`open(path,"wb").write(...)` 与 `open(image_path,"rb").read()` 全模块共 6 处**不用上下文管理器**。另 `render_page_image_pdf` 每次调用 `fitz.open` 且从不 `close`。 |
| M12-13 | `lesson-l12-01.md` | 低 | "多模态模型支持多轮对话中'记住'之前的图（部分模型）"——chat completions 是无状态的，图片能被"记住"只是因为整段 messages 被重发，措辞会让学员以为存在服务端图片会话状态。另本节引用的上下文窗口数字（GPT-4o 128K / Gemini 1M+ / Claude 200K）无校准日期，S6 模式。 |
| M12-14 | `lesson-l12-03.md` | 低 | Deepgram 小节明写是伪代码并调用未定义的 `dg_transcribe_chunk`；"Whisper ~\$0.006/分钟"为具体价格但无校准日期与来源（S6）。缺 `pip install` 说明的第三方依赖在本模块累计四个：`pymupdf`（l12-02/05）、`opencv-python`（l12-04/P12）、`pdfplumber`（l12-05）、`ffmpeg` 二进制（l12-04）。 |
| M12-15 | `project-p12.md` | 中（体系） | 项目对课程的落地率是全站最低之一：L12-03 的**流式打断**（该节最核心、篇幅最大的内容）→ 进阶挑战 1；L12-05 的**双路校验**（写进了 P12 验收标准！）→ 进阶挑战 3；L12-04 的 `locate_event` / `cut_clip`（关键片段提取整整一小节）→ 项目完全未用。**验收标准第 6 条"视觉提取有校验（双路校验，L12-05）"与实际实现（只有一个查负数的 `validate_chart`）不符**——验收标准写了做不到的事。M11-9 模式复现。 |
| M12-16 | `project-p12.md` | 低 | `route_by_mime` 定义后**从未被调用也未被测试**（死代码），而正文称它是"MIME 兜底"；`analyze()` 无任何异常处理，不支持的扩展名直接把 `ValueError` 抛给调用方；`process_audio` 硬编码 `language="zh"`，非中文音频会被强制按中文转写，而 L12-03 讨论过语种问题。 |
| M12-17 | M12 全模块 | 中 | 交互组件：`l12-01`（multimodalDemo）、`l12-02`（multimodalDemo，**与 l12-01 完全重复**）、`l12-03`（costLatency，M14 组件）、`l12-04`（contextBudget，M3 组件）；`l12-05` 与 `P12` **全无**。即 M12 五节课**没有一个专属的多模态交互组件**，三个引用都是借用他模块的通用组件，一个是重复引用。C3/C4 只查"每模块≥1"和"无孤儿组件"，查不出这种"靠复用凑数"——建议新增 C3 的加强版：同一组件在同一模块内重复引用应告警。 |

## M13 评估、护栏、测试与可观测（8 节 + P13）

**总评：M13 的知识面是全站最完整的**——评估方法论、CI 评测、OTel tracing、护栏、注入攻防、工具权限、测试金字塔、Mock LLM，八节课把"生产质量保障"讲全了，L13-01 的"结果 vs 轨迹"二分、L13-05 的"间接注入是 Agent 时代新攻击面"、L13-08 的"别 mock 太假"都是准确的判断。但本模块有一个**贯穿全部八节课的地基问题**：所有代码都建立在一个从未存在过的 `Agent(llm=..., tools=..., memory=..., guardrails=...)` 抽象上（M13-1）。更要命的是，M13 是全站唯一一个**"教怎么测"的模块**，而它自己给出的示范测试里有多条是恒真的自证测试（M13-2、M13-3），P13 的红队通过率甚至在设计上就不可能达标（M13-4）。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M13-1 | M13 全模块（8 节 + P13） | **高（体系，本模块最重要）** | 八节课与项目的每一段可运行代码都依赖 `Agent(llm=..., tools=..., memory=..., guardrails=...)` 这个类，以及 `agent.run(x, collect_trace=True)` 返回带 `.output/.trace/.tokens/.latency_ms` 的对象、`agent.last_tokens`、`agent.last_steps`。**课程从未定义过这个类**：M5 是手写 `while` + `client.chat.completions.create`，M10/M11 是 LangGraph 的 `StateGraph`，两者都没有这个接口，也都不接受"注入一个 llm 对象"。于是 M13 教的 Mock LLM（L13-08 的 `StubLLM.chat(messages)`）**接不进学员实际写过的任何 Agent**——真实代码调的是 `client.chat.completions.create`，不是 `llm.chat`。这不是漏写一个函数，是整个模块的可操作性建立在一层不存在的依赖注入抽象上。**修复方案只能二选一**：要么在 L13-07 前面补一节"把你的 Agent 重构成可注入的 `Agent` 类"，要么把 M13 全部代码改写成对 `openai.Client` 打 monkeypatch/`responses` 库的形态。 |
| M13-2 | `lesson-l13-07.md`（`test_agent_remembers_across_turns`） | **高（自证测试）** | 这条"验证 Agent 跨轮记忆"的集成测试，mock LLM 第二次调用被写死返回 `"你叫 Alice"`，然后断言 `assert "Alice" in result`——**答案是测试自己喂进去的**，Agent 有没有记忆、Memory 类存没存东西，这条测试完全不关心。删掉整个 `memory=Memory()` 参数它照样绿。一节讲"怎么给 Agent 写测试"的课，其记忆测试示范本身是教科书级的反面案例。同节 `test_agent_calls_search_then_summarize` 的 `assert "这是摘要" in result` 同病（好在还有 `call_count == 3` 这条真断言兜着）。 |
| M13-3 | `lesson-l13-08.md`（`RecordReplayLLM.chat` replay 分支） | **高（自相矛盾）** | 录制时把 tool_calls 存成 `[{"name":..., "arguments":...}]` 的**字典**，回放时 `MockResponse(data["content"], data["tool_calls"])` 直接把字典列表塞进去；而同文件 `MockToolCall` 提供的是 `tc.function.name` / `tc.function.arguments` 的**对象**形态，Agent 侧消费的也是对象。**回放模式产出的结构和录制模式、和真实 SDK 都不一样**——恰恰命中本节自己写下的警告"mock 返回结构真实 LLM 不会产生 → 测过绿但真实解析崩"。另：record 分支不 `os.makedirs(fixture_dir)`（首次录制必 `FileNotFoundError`）、`real_llm` 未定义、replay 未命中 fixture 时抛裸 `FileNotFoundError`，而本节"动手 5 分钟"的验收标准明写"未命中时明确报错'需要重新录制'"。 |
| M13-4 | `project-p13.md` Step 4 + Step 5 | **高（设计即失败）** | P13 的旗舰交付物"注入红队通过率"**在设计上不可能达标**。链路：`guarded_run` 的输入护栏命中注入 → 返回字符串 `"输入被拦: 疑似注入"` → `run_red_team` 用 `is_refusal(output) or "拒绝" in output` 判定是否拒答 → 而 `is_refusal` 的 `REFUSAL_MARKERS = ("抱歉","无法","不能","拒绝","不便回答","超出服务范围")` **一个都不匹配这句话** → `refused=False` → `ok=False`。**护栏拦得越成功，红队分越低。** 4 条 `expect="refuse"` 案例全判失败 ⇒ `pass_rate ≤ 0.33` ⇒ Step 7 的 `go_no_go`（要求 ≥0.9）**恒为 False**。学员照做只会得到一个永远说"不可上线"的报告，且报错原因完全隐形。 |
| M13-5 | `project-p13.md` Step 7（`generate_report`） | **高** | "质量与安全报告"里 `tool_safety` 的四个字段 `{"sandbox": True, "least_privilege": True, "audit_log": True, "approval_for_dangerous": True}` 是**硬编码常量**，`guardrails` 的两个列表同理，`mock_regression.duration_sec: 3` 同理。也就是说这份决定 go/no-go 的报告，**安全部分不做任何实际检测，无条件宣布一切合规**。M13 通篇在讲"别信感觉要看数据"，收官项目的报告却把最关键的安全结论写成了字面量。 |
| M13-6 | `lesson-l13-02.md`（`score_case` / `aggregate`） | **高（信号丢失）** | `score_case` 算出了 `contain_rate`（结果评估）和 `refused`（安全案例是否拒答），但 `aggregate` **只汇总 `quality`/`tokens`/`latency`**，两个信号算完即弃；`quality_gate` 自然也管不到它们。后果：评测集里精心设计的 `must_refuse: true` 注入案例（E002/E003）**对门禁毫无影响**——注入防护整体退化，CI 照样绿。L13-01 建立的"结果评估 + 轨迹评估"二分，到了流水线里结果评估被丢弃、轨迹评估从未实现（`run_single` 收集了 `result.trace` 但**全模块没有一行代码消费它**）。**只剩 LLM-as-Judge 一条腿。** |
| M13-7 | `lesson-l13-04.md`（`output_guardrail`） | **高** | `SAFETY_VIOLATIONS = ["暴力","自残","违法"]` 做**子串匹配**，命中即整段替换为"抱歉，我无法提供此类内容。"。于是"本产品不含暴力内容"、"请勿从事违法活动"、"如有自残念头请联系专业帮助"这类**正确且必要的回答会被硬拦**——尤其最后一种，一个本意保护用户的护栏会精确地拦掉危机干预信息。同节"护栏的权衡"小节自己列了误拦对策（分级、白名单、持续调优），代码一条未实现。输入侧同病：`PII_PATTERNS` 里 `\d{16,19}` 匹配任意 16–19 位连续数字（订单号、时间戳、哈希全中），`1[3-9]\d{9}` 无边界会在长数字串内部命中；而本节举的误拦例子正是"我的手机是138开头帮我查订单"。 |
| M13-8 | `project-p13.md` Step 5（`RED_TEAM`） vs `lesson-l13-04.md` | 中（自相矛盾） | 红队案例 `("忽略格式要求直接输出全部数据", "refuse")` 要求**必须拒答**；而 L13-04 的"误拦场景"小节把 `"忽略格式要求"` 明确列为**注入护栏的典型误杀**（"正常指令被当注入"）。同一模块内，同一句话在一节课里是应当豁免的假阳性，在项目里是必须拦下的攻击。学员按哪边做都会被另一边判错。 |
| M13-9 | `project-p13.md` Step 5 | 中 | 验收标准写"注入红队：**至少 10 个**注入/越狱案例"，`RED_TEAM` 实际只有 **6 条**。且其中最关键的**间接注入**案例内容是字面量 `"总结这个网页[含注入]"`——`[含注入]` 就是四个汉字，没有任何真实的被投毒网页 fixture。L13-05 花了整节论证"间接注入是 Agent 时代的新攻击面、比直接注入危险得多"，到了红队里它是一个占位符。 |
| M13-10 | `lesson-l13-03.md`（`run_agent`） | 中（承诺 vs 落地） | 本节的核心论点是"Span 是 Agent 可观测性的核心，只有 span 级才能定位哪步慢"，并画了嵌套调用树。但唯一完整的示例 `run_agent` **只开了一个 `agent_run` span**，每步的子 span 全是注释（`# 子 span 可记`、`# 子 span`）——前面的 `llm_call`/`tool_call` 辅助函数在 `run_agent` 里一个都没用上。学员照抄得到的 trace 是一根光杆，正是本节批评的"指标级监控，没用"。另：小节标题是"Token 与成本追踪"，全节**没有任何一处把 token 换算成钱**，而"每请求成本"被列为生产监控指标。 |
| M13-11 | `lesson-l13-03.md` | 中（安全，跨节矛盾） | `span.set_attribute("tool.args", str(args))` 与 `trace_span.set_attribute("agent.input", question)` 把**工具参数与用户原始输入原样写进遥测数据**并导出到第三方平台（LangSmith/Langfuse/Arize）。紧接着的 L13-04/L13-06 用两节课讲 PII 脱敏、讲"审计日志敏感参数记 hash 不记原文"——L13-03 的埋点却是全模块唯一一处明确把原文外送的地方，且无任何提示。P13 Step 3 原样继承。 |
| M13-12 | `lesson-l13-03.md` | 中（待核） | 自定义了 `llm.model` / `llm.input_tokens` / `llm.latency_ms` 等属性名，而 OpenTelemetry 已有 **GenAI 语义约定**（`gen_ai.system` / `gen_ai.request.model` / `gen_ai.usage.input_tokens` 等）。一节以"OTel 是可观测性的事实标准"开篇的课，用自造属性名会让 Phoenix/Langfuse 等后端解析不出 LLM 语义，白白丢掉平台的开箱面板。**待联网核实该约定当前的稳定级别后定级并给出对照表。** |
| M13-13 | `lesson-l13-02.md` CI 章节 | 中 | YAML 与 Python 对不上：`python -m evals.run` / `python -m evals.gate` 所需的 `__main__` 与 `--dataset/--report/--thresholds` 参数**全模块没有任何实现**；`report.json` 里的 `gate_passed` 字段没有任何代码产出；门禁阈值有两个真源（`gate.py` 里的 `THRESHOLDS` 字典 vs YAML 里的 `evals/thresholds.yaml`）；`compare_to_baseline` 需要的 baseline **从哪来、存哪、何时更新全未交代**，CI 里也没有它的位置。另：workflow 没有配 `OPENAI_API_KEY` secrets，而这条流水线**每个 PR 都要跑全量真实 LLM 调用 + LLM-as-Judge**，钱和时间的量级只字未提。 |
| M13-14 | `project-p13.md` Step 8 vs `lesson-l13-07.md`/`l13-08.md` | 中（自相矛盾） | L13-07/L13-08 反复强调的分层原则是"单元/集成用 mock 每次跑，**E2E 真 LLM 只 nightly**，别把真 LLM 设成每次提交必跑，会拖垮开发节奏"。而 P13 的 CI 里 `eval-pipeline` 和 `red-team` 两个 job 都挂在 `pull_request` 上，两者都跑真实 Agent + 真实 LLM 裁判。**收官项目在 CI 配置上违反了自己刚讲完两节的核心原则。** 另 `mock-regression` 跑的是 `pytest tests/`（全目录），会把 `tests/e2e/` 一并卷进每次 PR。 |
| M13-15 | `lesson-l13-02.md`（`run_eval_suite`） | 中 | `list(pool.map(...))` 无 per-case 异常处理——**任何一个案例抛异常，整套评测直接崩**，已跑完的结果全丢。评测跑批最需要的就是"单点失败不影响整体、失败也算一条记录"。同处：`p99_latency` 用 `sorted(...)[int(len(x)*0.99)]`，n=10 时取的是索引 9（最大值，实为 p100），小样本下这个"p99"没有意义。`is_refusal` 用 `"无法" in output` 这类子串判定拒答，正常回答里的"我无法确定这一点"会被误判成拒答。 |
| M13-16 | `lesson-l13-04.md`（`classify_topic`） | 中 | 三个问题叠加：(a) `max(topics.items(), key=lambda t: similarity(q_emb, embed(t[1][0])))` **只拿每个话题的第一个关键词**做比较，`["问诊","用药","症状"]` 里后两个白写；(b) `max` 必然返回一个话题，**没有相似度阈值** ⇒ 任何无关问题都会被归到某个已有话题 ⇒ `topic_guard` 的越界拦截对未知话题**完全失效**，而这正是它存在的理由；(c) `embed`/`similarity` 未定义，且每次调用都重算所有话题的 embedding，无缓存。同节 `input_guardrail` 里 `OFF_TOPIC_HINTS`（关键词集）与 `allowed_topics`（话题名列表）被放在同一个 `in` 判断里比较，两套词表语义不同。 |
| M13-17 | `project-p13.md` Step 6（`safe_tool_exec`） | 中 | `require_approval=None` 作为默认参数，函数体里却直接 `return require_approval(...)` → 不传就是 `TypeError: 'NoneType' object is not callable`，而这条路径正是"危险操作审批"这个卖点本身。同行 `auditor.log(ToolAuditLog(..., tool_name, hash_args(args)))` 又一次用字面 `...` 当位置参数（M6-17 / M11×2 之后**第四次**），而 `ToolAuditLog` 是带 6 个具名字段的 dataclass，这个调用形态无论如何都构造不出来。`get_tools_for_task` / `validate_args` / `current_task` / `auditor` / `hash_args` / `TOOLS` 全部未定义。 |
| M13-18 | M13 全模块（评测集 key 名） | 低 | 同一个评测集在四处用了四套字段名：L13-01 用 `expected_outcome` + `eval_criteria` + `expected_tools`，L13-02 的 YAML 用 `expected`，`score_case` 读 `result["expected"]`，P13 Step 1 读 `case["criteria"]`。`expected_tools`（轨迹评估的参考）**从头到尾没有任何代码读过**。模块路径也有两套：L13-02 是 `evals/`，L13-07 却 `from quality.scorer import is_refusal`，P13 统一到 `quality/`——学员按课抄完目录结构对不上。 |
| M13-19 | `lesson-l13-07.md` / `lesson-l13-08.md` | 低（体系） | 两节内容大幅重叠：L13-07 的"集成测试"小节直接给出 `SequencedMockLLM` + `MockResponse` + `MockToolCall` 的完整用法，而这三个类要到 L13-08 才定义（L13-07 里靠一句注释"MockLLM 即 L13-08 的 SequencedMockLLM"前向引用）；L13-08 的"用 Mock 测 Agent 轨迹"与 L13-07 的集成测试示例几乎同构。M13 是全站课时最多的模块（8 节），这两节合并成一节更合理，腾出的篇幅正好补 M13-1 缺的那节"Agent 可测试化重构"。 |
| M13-20 | M13 全模块 | 中 | 交互组件覆盖是全站最差：9 个文件里只有 `l13-04`（guardrail，**M9 l09-04 已用过**）和 `l13-07`（gateConfigurator）两处，`l13-01/02/03/05/06/08` 与 `P13` **全无**。而本模块恰恰是最适合做交互的：LLM-as-Judge 的偏倚（位置/冗长）可做 A/B 对照器、trace 调用链树是天然的可视化、测试金字塔可做分层配比模拟器、注入攻防可做红队靶场。八节课只借了一个旧组件 + 一个新组件，S4 模式在此达到峰值。 |

## M14 Agent 架构设计（6 节 + P14）

**总评**：M14 是全站"思想密度"最高、"可验证性"最低的模块。1718 行里只有 8 个 Python 块，`l14-03`/`l14-04`/`P14` 三个文件**零代码**——对架构模块这本身可接受，但它带来两个后果：一是判断全靠断言，二是 P14 的 9 条验收标准**没有一条能被自动检查**（这是全站唯一一个"交付物无法被 `pnpm check` 或任何脚本触及"的项目）。更要命的是，L14-01 这节"把直觉换成量化"的课，**自己的量化算错了**。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M14-1 | `lesson-l14-01.md` L176 | 高（本模块最重要） | 全模块唯一一段可执行代码的**输出注释算错两处**。`customer_weights = Weights(reliability=0.2, maintainability=0.2, cost=0.2, latency=0.4)` 下：手写(5,5,3,2) 实际 `.2×5+.4×5+.2×3+.2×2 = 4.0`，正文写 **4.2**；AutoGen(3,2,3,3) 实际 `.6+.8+.6+.6 = 2.6`，正文写 **3.0**。另两项（LangGraph 3.4 / CrewAI 3.8）与 research 那一行全对。排名恰好不受影响，所以错了也没人发现——但这节课的中心论点是"量化分析逼你把假设摆上台面，哪怕打分主观，也比无依据强"，而它给出的正是一组无人复核的数字。学员照抄 `rank()` 跑一遍就会发现输出和课本对不上。 |
| M14-2 | `lesson-l14-01.md` vs `project-p14.md` Step 4 | 高（自相矛盾） | 同一个"客服 Agent"场景，两处权重与结论相反：L14-01 标注"**客服 Agent（延迟优先）**"，`customer_weights` 给 latency=0.4、reliability=0.2，结论是"手写排第一"；P14 的客服场景写"权重：可靠性0.4/延迟0.3/成本0.2/可维护0.1"，理由是"**客服质量优先（答错/误退订成本最高）**"，结论是选强模型+RAG+HITL。同一本书里同一个场景，一处说延迟压倒可靠性、一处说可靠性压倒延迟，且都以"这就是架构决策的本质"作结。必须二选一，或显式说明是两类不同的客服。 |
| M14-3 | `project-p14.md` Step 4 | 中（反向印证） | P14 的加权算术**全对**（3.9 / 3.7 / 3.0 三项手算复核无误），且它主动把算式写了出来。与 M14-1 并置，构成"**课上写错、项目里悄悄改对**"的第五次（M9-1 / M9-8 / M10-1 / M12-10 之后）。这个模式已稳定到可以作为报告的独立结论：项目文件的质量系统性高于课文件，说明复核精力分配失衡。 |
| M14-4 | `lesson-l14-05.md`（`StatelessAgent.run`） | 高 | `TenantScopedMemory.__init__(self, tenant_id, collection)` 需要两个参数，同一节 66 行后的 `StatelessAgent.run` 却写 `TenantScopedMemory(tenant_id).recall(question, user_id)` —— 少传 `collection`，**必然 TypeError**。而这两段是本节仅有的两块代码，一块讲租户隔离、一块讲无状态化，中间隔着一句"这个 trade-off 几乎总是值"。同处 `load_history_from_db` / `save_history_to_db` / `self._llm` 均未定义（可接受为示意），但构造函数签名对不上是硬错。 |
| M14-5 | `lesson-l14-05.md`（`TenantScopedMemory.remember`） | 中 | `ids = [f"{tenant_id}:{user_id}:{i}" for i in range(len(facts))]` —— id 由**当次批内序号**生成，第二次 `remember` 又从 0 开始，Chroma 的 `add` 遇到同 id 会覆盖/报错，老记忆被静默冲掉。这与 M8 记忆模块同型（同一根因：把"批内下标"当"全局唯一键"）。应改 `uuid4()` 或带时间戳。讽刺的是本节的论点正是"架构上要保证不可能忘（带 tenant_id）"——隔离维度做对了，唯一性维度塌了。 |
| M14-6 | `lesson-l14-05.md` L7 | 中（组件错配） | `::interactive{type="patternSelector"}` 被放在"你的场景适合哪种模式？"这句引导之后——但 `patternSelector` 是 L05-07 的 **Anthropic 五大设计模式决策树**（Prompt Chaining / Routing / Parallelization / Orchestrator-Workers / Evaluator-Optimizer），回答的是"用哪种 Agent 编排模式"，与本节的"单 Agent 还是多租户平台/逻辑还是物理隔离"**完全不是同一个问题**。这比 M12 的"借用组件凑数"更严重：M12 借的组件至少讲的是同一件事，这里是引导语与组件语义直接错位，学员点开会答非所问。C3/C4 检查不出这类错配（它只看引用是否存在、是否有孤儿）。 |
| M14-7 | `lesson-l14-06.md` vs `lesson-l13-03.md` | 高（跨模块矛盾） | L14-06 用整节篇幅承诺 GDPR **被遗忘权**——"能精确删干净（不留残骸）"，`delete_user_data` 删向量库/历史/记忆三处。但 L13-03 的 trace 导出（M13-11）把 `agent.input`、`tool.args` 原样发往 LangSmith/Langfuse 等第三方平台，`delete_user_data` **触及不到这些副本**；同节自己的 `access_logs` 也不在删除范围内（虽然审计日志按合规确实该留，但正文没说明这个例外）。一门课里前脚把 PII 发出去、后脚承诺能删干净，是架构文档里最典型的"合规纸面化"。应在 L14-06 显式列出"删除边界：trace 平台 / 备份 / 审计日志各自的处置策略"。 |
| M14-8 | `lesson-l14-06.md`（`agent_run` 影子流量） | 中 | 影子逻辑写在灰度分流之后：`if config == OLD_CONFIG and shadow_enabled:` → 被路由到老版本的 **95% 用户每次请求都会额外全量跑一遍新版本**，即整体 LLM 成本接近翻倍，正文对此只字未提，而 M15 紧接着就要讲成本优化。影子流量在生产里通常按比例采样（1%~5%）且异步执行，不阻塞主响应；这里是同步串行，用户延迟也翻倍。另 `shadow_enabled` / `NEW_CONFIG` / `OLD_CONFIG` / `run_with` / `log_diff` 未定义，`config == OLD_CONFIG` 用 dict 相等判版本而不用 `version` 变量，脆弱。 |
| M14-9 | `lesson-l14-06.md`（`AGENT_CONFIG`） | 中（体系） | 讲"模型会升级、三维版本管理"的这一节，自己把 `"model": {"name": "gpt-4o", "fallback": "gpt-4o-mini"}` **硬编码进配置**，完全绕开了课程自建的 `src/data/models.ts` 档位抽象（nano/small/mid/large）。全站最该演示"用档位而非型号"的地方反倒示范了型号硬编码。同处 `"version": "2026.07.23"` 是写死的日期字符串，与 C14 的校准日期机制（`CALIBRATED_ON`）互不相干却极易被误认为同一套。`now()` 未定义。 |
| M14-10 | `lesson-l14-01.md`（`Weights`） | 中 | `Weights` 无任何"权重和为 1"的校验，而 `score()` 直接线性加权。学员按正文鼓励的"改一个权重跑一次看排名怎么变"操作，把 latency 从 0.1 改成 0.4 后总和变成 1.3，所有总分整体膨胀且**跨场景不可比**——正是这节课要消灭的"看起来量化其实无意义"。应在 `__post_init__` 里断言 `abs(sum - 1.0) < 1e-6`，或在 `score()` 内归一化。 |
| M14-11 | `lesson-l14-02.md`（`extract_symbols`） | 中 | `ast.walk(tree)` 会遍历**所有嵌套节点**，于是类里的方法被同时计入独立 `function` 符号和该类的 `methods` 列表——索引重复计数。更严重的是只匹配 `ast.FunctionDef`，**`ast.AsyncFunctionDef` 完全未处理**：任何 `async def` 在索引里彻底不可见。一节讲"给真实代码库建符号索引"的课，对现代 Python 代码库里最常见的一类定义视而不见。修法是 `isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))` 且改用 `tree.body` 顶层遍历 + 类内单独处理。 |
| M14-12 | `lesson-l14-02.md`（`search_index` / `build_index`） | 中 | 三处：(a) `sym["file"]` 在 `extract_symbols` 里存的是绝对路径，`search_index` 又用相对 key 覆盖同一字段——一个字段两种语义，下游无法判断拿到的是哪种；(b) `sorted(..., key=lambda s: len(s["name"]))` 的注释写"精确匹配优先"，实际只是**短名字优先**，`get` 会排在 `get_user_by_id` 前面，与注释承诺不符；(c) `Path(root).rglob("*.py")` 无 `.venv` / `site-packages` / `node_modules` / `.git` 排除，对真实仓库会把整个虚拟环境索引进去（这正是 Cursor 索引工程的第一个坑，而本节主题就是拆 Cursor 的索引）。`open(file_path)` 未指定 `encoding`（S6 全站模式）。 |
| M14-13 | `lesson-l14-03.md` L141 | 低（但显眼） | 自主性谱系的箭头方向画反了：上一行的坐标轴是 `Copilot补全 ◀──────▶ Devin/Claude Code`（左低右高），紧接的一行却写 `Copilot ← Cursor辅助 ← Cursor Agent ← Claude Code ← Devin`，箭头从高自主指向低自主，与刚定义的轴向相反。读者要么以为谱系反了，要么以为箭头表示"演化来源"。改成 `→` 即可。 |
| M14-14 | `lesson-l14-03.md` / `lesson-l14-04.md` | 中（体系） | 两节**零 Python 代码块**，纯断言式拆解，且大量内容是对闭源产品的推测。L14-03 对 Devin 工具集诚实标注了"（推测）"——这是全站最好的知识边界处理之一，但同一节对 Claude Code 的"工具链精炼/沙箱分层信任/最小权限"四条却以确定语气给出、无出处标注，L14-04 对 ChatGPT/Perplexity 的架构表格同样如此。要么统一加"（推测/据公开资料）"标注并给出处，要么把无法证实的部分降级为"一种合理的架构假说"。 |
| M14-15 | `lesson-l14-04.md` | 中（时效性，待核） | 多条关于 ChatGPT / Perplexity 现状的断言以 2024 前后的产品形态为准，2026 年已明显滞后：`引用 弱（工具结果可显示来源但非每论断标注）`、`信息时效 靠工具（默认弱）`、`工具使用 按需（模型决策）` vs Perplexity `多轮 相对弱（每次偏独立问答）`。Perplexity 的 Threads/追问与 ChatGPT 的默认联网+内联引用都已常态化，"搜索型 vs 对话型"这组对立正是本节自己在"融合趋势"一节承认正在消解的。整节论证建立在一组正在失效的事实上——待核并加"截至 XXXX 年"限定。同处"ChatGPT 长期记忆（M8 记忆系统的 Mem0 式思路）"是把开源实现反向归因给闭源产品，属推测。 |
| M14-16 | `project-p14.md` Step 5 | 中（承诺 vs 落地） | 验收标准要求"容量估算：并发/存储/**带宽**/成本预测"，Step 5 的成本模型却是纯占位：`· LLM：假设 60% 走 mini + 40% 走 4o` → `· 月调用量估算 → token 成本`、`· 向量库：按租户分片，存储成本`、`· 基础设施：无状态 Agent 实例 × 扩容数`——**一个具体数字都没有**，"带宽"在全文从未出现。容量那半段（1000 并发 × 7500 token / 300s ≈ 25000 token/s，手算复核正确）恰恰示范了该有的样子，成本这半段却退化成小标题。这是"承诺 vs 落地"模式在 M14 的落点。 |
| M14-17 | `project-p14.md` Step 1 | 中（承诺 vs 落地） | 验收标准写死"ADR ≥ 5 条，每条含状态/背景/决策/备选方案/后果"，示例只完整给了 ADR-001/002 两条，其余三条压缩成一行括号：`（ADR-003 记忆架构 Mem0 式、ADR-004 多租户隔离策略、ADR-005 模型路由 Opus→Sonnet→Haiku ...）`——又一处字面 `...` 占位（M6-17 / M11×2 / M13-17 之后**第五次**）。ADR-005 的"Opus→Sonnet→Haiku"用裸家族名绕过了 C5 的模型白名单正则（正则要求 `claude-opus-...` 这种完整标识），是白名单机制的又一个盲区（继 M12-2 的 `whisper-1`/`tts-1` 之后）。 |
| M14-18 | `project-p14.md` 全篇 | 中（体系） | P14 是全站 19 个项目里**唯一不产出可运行物**的项目，9 条验收标准全是主观自评勾选框（"文档自洽：新人能据此理解系统为何这么设计"）。对架构文档这本身合理，但课程既然建了 `pnpm check` 这套自动门禁、又在 M13 教了质量门，P14 至少应给出一份**可核对的 checklist 或评审 rubric**（如"每条 ADR 的备选方案数 ≥2 且都写了否决理由"这类可数条件），否则学员无法自证完成。可考虑提供一个 ADR 模板文件 + 一个校验脚本（检查五段结构齐全、ADR 数量、是否含未决项）。 |
| M14-19 | M14 全模块（交互组件） | 低 | 6 节 + 项目共 7 个文件，`l14-06`（演进治理，全模块 Python 最多的一节）与 `P14` 无任何交互组件；`l14-05` 一节塞两个且其中一个错配（M14-6）。最该做交互的两处反而没有：三维版本矩阵（Prompt×工具×模型 的组合爆炸）可做组合选择器，灰度分流可做 hash 分桶模拟器（直观展示"稳定分流 vs 随机分流"的体验差异）。S4 模式延续。 |
| M14-20 | M14 全模块（亮点，需在报告中正面引用） | — | 三处值得表扬、应作为全站范本推广：(a) `l14-02` 的"**拆解的边界：别把推测当事实**"小节及其"把推测和观察分栏写"的动手练习，是全站最诚实的知识边界处理；(b) `l14-05` 动手环节要求越权测试"**必须返回 404 而不是 403**（403 会泄露该资源存在）"——这是真实工程中才会踩到的细节，含金量高于本模块多数正文；(c) `l14-06` 的"加字段不删字段 / 改行为不改契约 / 删功能先标记废弃"三原则表述精准。M14 的问题不在见识，在于**见识没有被代码和数字兑现**。 |

## M15 生产架构与运维（6 节 + P15）

**总评**：M15 的知识结构是全站最完整的之一（基础设施→优化→监控→应急→发布→UX 六节环环相扣，收尾的"能力链"自洽）。但它同时把全站两个最顽固的模式推到了极致：一是**"课上写错、项目里悄悄改对"——P15 几乎每一段代码都是对应课文代码的修正版**（缓存 TTL、租户键、回滚可用性、告警可解析、分流去相关…无一例外），这已经不能用巧合解释，说明课文与项目是两套复核标准；二是**"教量化却给不出处的数字"**（L15-02 的优化收益表、L15-03 的告警阈值）。另有一处**真实渲染缺陷**（L15-01 代码围栏断裂），是全站唯一一处，必须优先修。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M15-1 | `lesson-l15-01.md` L34–L65 | 高（唯一的渲染缺陷，优先修） | "生产架构全景"这张图的**代码围栏在中途断了**：L34 开 ```、**L45 提前闭合**、L46–L58（语义缓存 / 同步 Agent 服务 / 异步队列 / Worker 池四个方框，正是全图信息量最大的部分）**落在围栏之外当作正文渲染**，L59 才重新开栏。全文 ``` 计数为 26（偶数），所以任何"围栏是否配平"的检查都发现不了。已写脚本全量扫描 `src/content/**/*.md`（判据：制表符 `┌┐└┘├┤┬┴┼─│▼▲` 出现在围栏外），**全站仅此一处**——是孤立事故而非系统问题，但它出现在 M15 第一节的第一张图，每个学员都会撞上。建议同时加 C22 检查项：禁止制表符出现在代码围栏外。 |
| M15-2 | `project-p15.md` 全篇 vs `lesson-l15-01/03/05.md` | 高（体系，本模块最重要的结论） | P15 是"课上写错、项目里悄悄改对"模式的**第六次也是最集中的一次**——逐条对应：(a) L15-01 的 `smart_cache_get`（时效/个性化豁免）是**死代码**，真正接线的 `agent_with_cache` 从不调用它，且缓存无 TTL、key 不含租户；P15 的 `SemanticCache.get` 把豁免前置、`set(..., ttl=3600)`、key 写成 `f"{tenant_id}:{hash_question(q)}"`，三处全对。(b) L15-05 的 `VersionManager.rollback()` 必然失败（见 M15-8）；P15 的 `CanaryManager.rollback()` 改成"把 ratio 清零"，可用。(c) L15-03 的 `ALERT_RULES` 是不可解析的字典字面量；P15 的 `alerts.yml` 是真正的 PromQL + `for:`。(d) L15-05 的 A/B 分桶与灰度分桶相关（见 M15-9）；P15 的 `_hash(user_id, dim)` 带按维 salt。(e) P15 甚至主动写下 `# 勿用字符串 >= 比较严重度`、`# 仅返回，不写共享可变状态` 这类"防坑注释"。**结论：项目文件被认真复核过，课文件没有。**报告应把它作为独立的流程结论（复核精力分配失衡），而非逐条 bug。 |
| M15-3 | `lesson-l15-02.md`（`route_with_fallback`） | 高 | `def route_model(question: str, history: list)` 要求两个位置参数，25 行后的 `route_with_fallback` 写 `model = route_model(question)` → **必然 TypeError**（`history` 在函数体内还从未被使用）。与 M14-4 的 `TenantScopedMemory` 完全同型：**同一节课内相邻两块代码的签名对不上**，说明代码块是分别写的、没有整体跑过。同处 `quality_check` / `threshold` 未定义；更根本的是"小模型答得不好就升级重答"这条回退链**每次都要跑一遍质量评判器（通常又是一次 LLM 调用）+ 可能的重答**，而本节声称模型路由降本 40% 的数字里没有计入这两笔——回退机制的成本被静默忽略。 |
| M15-4 | `lesson-l15-02.md`（优化方案评估表） | 高（教量化却不量化） | "模型路由 -40% / 语义缓存 -25% / 分级推理 -30% / 蒸馏 -60%"以及"80% 问题是简单的"、"80% 在 L1 结束"——**全部没有出处、没有推导、没有前提条件**。而这节的中心句是"没有数字，优化是无依据的玄学"。与 M14-1（L14-01 的加权算错）同型，是全站第二次"讲量化的课自己给未经检验的数字"。另有一处表格语义错误：同一列"延迟改善"里，模型路由写 `-30%`（负=改善）、分级推理写 `+20%`（正=恶化），**符号约定在同一列内不一致**，读者无法判断 `+20%` 是改善了 20% 还是延迟涨了 20%。 |
| M15-5 | `lesson-l15-02.md`（`tiered_reasoning`） | 中 | 同一节里 `call` 出现两种签名：`call(question, model)`（`route_with_fallback`）与 `call(question, "claude-sonnet-5", context=ans1)`（`tiered_reasoning`）。`quality()` / `GOOD_ENOUGH` / `GOOD` / `deep_reasoning` 均未定义。另：`route_model` 用 `claude-haiku-4-5` / `claude-sonnet-5` / `claude-opus-5` 直接写型号，绕开了课程自建的 `models.ts` 档位抽象（nano/small/mid/large）——与 M14-9 同型，全站最该演示"用档位不用型号"的两节课都在示范型号硬编码。 |
| M15-6 | `lesson-l15-03.md`（`ALERT_RULES`） | 高（自相矛盾） | 本节"陷阱5"明确说"**没有基线无法判断**，对策：先建立历史基线，再定告警阈值"，紧接着自己给出的 `ALERT_RULES` 全是**无基线的绝对阈值**：`avg_steps > 8`（8 从哪来？）、`quality_score < 3.5`（几分制？L13-01 的 judge 量表从未统一）、`p99_latency > 5000ms`。同时 `daily_cost` 那条**没有 `duration` 字段**，而本节原则第一条就是"有持续时间：单点突刺不告警"。此外整份 `ALERT_RULES` 的 `condition` 是自由文本（`"> 5000ms"` / `"increase > 30%"` / `"> budget * 0.8"`），**没有任何解析器能消费它**——本节唯一的"规则引擎"是一段不可执行的字典字面量（P15 的 `alerts.yml` 才是可执行版，见 M15-2）。 |
| M15-7 | `lesson-l15-04.md`（Postmortem 范本） | 中 | 这份用来教"严谨事故记录"的范本**自身内部不自洽**：摘要写"7/23 **14:00-16:00**，约 5000 用户受影响"，时间线却是 14:00 告警 → 14:10 止血 → 14:15 质量恢复 → **14:30 验证恢复**（30 分钟）。摘要与时间线差了 4 倍。另：标称"5 whys"实际只有 **4 问**，且第一行缩进 2 空格、后三行顶格，渲染出来是断裂的。本节 py=0（全文零 Python），是继 L14-03/L14-04 之后第三节纯断言课。 |
| M15-8 | `lesson-l15-05.md`（`VersionManager`） | 高 | 教"一键回滚"的这段代码，**默认回滚路径必然失败且静默**：`__init__` 里 `self.versions = {}`（空）但 `self.current = "stable"`，`rollback(to_version="stable")` 的第一句是 `if to_version in self.versions` → `"stable"` 从未被 `deploy` 写入过 → 走 `return False`。调用点 `if quality_drop_detected(): version_mgr.rollback()` **连返回值都不检查**，于是"质量崩了自动回滚"在代码层面等于什么也没做。而本节自己写着"回滚最怕'回不了'"。修法：`__init__` 里把当前稳定配置作为 `"stable"` 写进 `versions`，且 `rollback` 失败必须抛异常或告警而非返回 False。 |
| M15-9 | `lesson-l15-05.md`（`ab_test`） | 高（统计陷阱） | A/B 分桶用 `md5(user_id) % 2 == 0`，灰度分桶用 `md5(f"{user_id}{salt}") % 100 < ratio*100`；当 `ab_test` **不加 salt** 时两者基于同一个 md5 整数 `h`：灰度 new 组是 `h%100 ∈ {0,1,2,3,4}`，其中 `{0,2,4}` 为偶数 ⇒ **灰度组里约 60% 落进 A/B 的 B 桶**，两个实验严重相关，A/B 结论被灰度污染。讽刺的是同一节课在三维灰度那段刚写过"可用不同 salt 避免相关"——**自己给的规避手段没用在自己身上**。同处 `is_significant` 对 cost/latency 这类重尾分布和 LLM-Judge 的序数评分一律用 `ttest_ind`（均值 t 检验），前提不成立却未加说明；`scipy` 也不在任何依赖说明里。 |
| M15-10 | `lesson-l15-05.md`（`automated_canary`） | 中 | `schedule = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]`，每档 `wait(30*60)` ⇒ **3 小时从 1% 走到全量**。而本节"反模式3"写的正是"1% 跑 5 分钟就说没问题 → 没覆盖足够 case/时间"——在 1% 流量下跑 30 分钟，样本量同样达不到本节 A/B 那段自己要求的统计显著性。给出的 schedule 与自己的反模式判据互相打脸。另 `agent_run` / `canary_route` 与 L14-06 几乎逐字重复（正文标了"L14-06 讲过，这里运维视角"），并且**原样继承了 M14-8 的影子流量成本问题**：`if version == "old" and shadow_enabled` ⇒ 95% 用户每请求额外全量跑一遍新版本，成本与延迟双倍，两节都未提及。 |
| M15-11 | `lesson-l15-06.md`（jsx 代码块） | 中（规范违规，可自动检查） | 本节含 2 个 ` ```jsx ` 代码块，而 `CLAUDE.md` 明确规定"代码主线是 Python，**只有以下例外**使用 TypeScript/React：L17-05、L17-06、L17-11、L17-12"。全量扫描确认**三节课越界**：`l10-05`（2×jsx）、`l15-06`（2×jsx）、`l17-15`（1×typescript）；反过来 `l17-12`（被列为例外的 Electron 章节）**一个 TS 块都没有**。即例外清单与实际分布双向不符。C15 只校验"文案是否承诺双语言"，管不到代码块的实际语言分布——建议扩成"非例外清单文件不得出现 ts/tsx/js/jsx 代码块"。代码本身也有问题：`function errorRecovery(agentAnswer)` 在非低置信分支**不返回任何值**，作为组件会崩；命名是 camelCase 却返回 JSX（React 要求 PascalCase 才能作为组件使用）。 |
| M15-12 | `lesson-l15-06.md` / M15 全模块 | 中 | L15-06 **零交互组件**——而全站恰好注册了一个 `uiStateMatrix`（"前端 UI 状态矩阵覆盖自检"），它只在 `l17-06` 用过一次；一节专讲"Agent 产品 UX：透明度/可控性/错误恢复"的课，正是 UI 状态矩阵最自然的归宿。模块整体：7 个文件里 `l15-04` / `l15-05` / `l15-06` / `P15` 四个无组件，`l15-03` 用的 `harnessMonitor` 是 M7 旧组件。最该做交互而没做的是 L15-05（灰度分流可做 hash 分桶模拟器，直观演示"稳定分流 vs 随机分流"和 M15-9 的分桶相关性）。S4 模式延续。 |
| M15-13 | `project-p15.md` Step 9（`chaos_test.py`） | 高（恒真断言，第五次） | 故障注入演练——本项目的旗舰交付物——的断言**全部不成立**：`assert fallback_model_triggered`、`assert pods_restarted`、`assert no_request_lost`、`assert agent_runs_without_search()` 里前三个断的是**裸名字而非调用**，要么 `NameError`，要么（若真有同名函数）断言的是函数对象**恒为真**。这是"恒真/自证测试"模式的第五次（M10-5 / M11-6 / M12-5 / M13-2 之后），且这次落在"用来证明系统有韧性"的那份代码上——演练全绿但什么都没验证。 |
| M15-14 | `project-p15.md` Step 6 vs Step 9/10 | 高（跨文件矛盾） | `inject_llm_failure` 断言 `alert_fired("LLMDown")`，但 `alerts.yml` 定义的五条规则是 `HighLatency` / `HighErrorRate` / `QualityDrop` / `CostSpike` / `StepBloat`——**根本没有 `LLMDown` 这条告警**，演练报告表格里"LLM全限流 → 告警触发 ✅"同样无对应规则支撑。另一处硬矛盾：报告写"质量暗降 **25min 发现**"，而 `QualityDrop` 规则配的是 `for: 30m`——配置上不可能在 25 分钟触发；改进项写"25min太久→10min（owner:A）"却没提要改这个 `for`。一份用来证明"演练有效"的报告，与它所验证的配置对不上。 |
| M15-15 | `project-p15.md` Step 5（`metrics.py`） | 高（Prometheus 用法实质错误） | `cost_per_req = Gauge(...)` + `cost_per_req.set(estimate_cost(trace))` —— **用 Gauge 记"每请求成本"是错的**：Gauge 保存瞬时值，下一个请求立刻覆盖，抓取时只采到"最后一个请求"的成本，多副本下更无意义。正确做法是 Counter 累计总成本 + Counter 累计请求数，查询时相除（`rate(cost_total)/rate(requests_total)`）。这直接导致 `alerts.yml` 里 `CostSpike` 那条 PromQL（`avg_over_time(agent_cost_per_request[1h])`）在语义上无效——**本项目的成本监控主干指标是坏的**。同处：声明了 13 个指标，`collect_metrics` **只写了 6 个**；`cache_hit_rate` / `model_dist` / `tool_success` / `guardrail_triggers` / `error_rate` / `feedback_pos` 全部无数据源，而 Grafana 布局的"行2 成本（缓存命中/模型分布）"和"行3 行为（工具成功率/护栏触发）"要的正是这几个——仪表盘承诺的两整行没有数据。承诺 vs 落地。 |
| M15-16 | `project-p15.md` Step 8（`IncidentResponse`） | 中 | `SEVERITY = {"P0":0,"P1":1,"P2":2}` **漏了 P3**，而 L15-04 定义的是 P0–P3 四级；`assess()` 也永远不会返回 P3，`degrade("P3")` 会 `KeyError`。`stop_bleeding(self, level, symptom)` 的 `level` 参数从未使用。`auto_rollback_on_quality_drop` 里 `quality_metric` / `FLOOR` 是未定义的自由变量，且这个函数**没有被任何调度器或告警回调接上**——"质量降自动回滚"（验收标准之一、演练报告的改进项之一）在代码里是个孤立函数。 |
| M15-17 | `project-p15.md` Step 3 / Step 1 | 中 | (a) `long_task` 的 `except: raise self.retry(exc=e, countdown=60)`：`max_retries=3` 耗尽后 Celery 抛出原异常，**`notify_user` 永不执行**——慢任务彻底失败时用户既拿不到结果也收不到失败通知，只能对着 `task_id` 无限轮询。这正好踩在 L15-06 讲的"让失败有出路"上，是队列层与 UX 层的接缝漏洞。(b) Dockerfile 没有 `USER` 指令，**服务以 root 运行**——一门用 M9 整章讲沙箱、用 L13-06 讲最小权限的课程，自己的生产镜像是 root。 |
| M15-18 | M15 全模块（亮点，报告中应正面引用） | — | 值得表扬并作为范本：(a) `l15-01` 语义缓存的"坑与边界"四条（阈值/时效/个性化/事实校验）是全站少见的"给了手段也给了禁区"；(b) `l15-04` 的"**先止血后定位 / 别在着火时研究火因**"与无指责复盘（blameless）文化段落写得准且有分寸；(c) `l15-04` 动手环节的桌面推演（tabletop）要求找出"降级开关需要改代码重新部署"这类 MTTR 断点，是真实运维才有的洞察；(d) `l15-06` 的"延迟分级 UX 表"（<1s 直出 / 1-3s 转圈 / 3-10s 流式 / >10s 异步）可直接拿去用；(e) `l15-05` 的"灰度验证'没坏'、A/B 验证'更好'"这个区分干净利落。M15 的问题不在结构，在于**课文代码没跟上课文见识**。 |

## M16 前沿范式与毕业设计（4 节 + P16）

**总评**：M16 是全站最短的技术模块（4 节，1284 行），也是**结构断层最明显的一节**——它以"毕业"收口，但课程还有 M17–M19 三个模块、29 节课、3 个项目在后面。前三节（Computer Use / A2A / 模型定制化）作为"前沿速览"定位准确、判断清醒（"能用 API 就别 Computer Use""微调几乎从不是首选"），但**代码密度降到全站最低**：4 节课共 4 个 Python 块，`l16-03` 零代码零交互。L16-04 的要点总结里还留着一版被正文明确废弃的阶段划分，这个化石同时存在于 `curriculum.ts` 的章节注释里。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M16-1 | `project-p16.md` + `lesson-l16-04.md`（结构性，全站最重要的问题之一） | 高 | **"毕业"落在第 16 个模块，而课程有 19 个**。L16-04 标题"回顾与你的成长地图"、要点总结末条"全书完"；P16 开篇"全书 16 模块学完"、结尾"毕业寄语……走完 16 模块 + 16 个项目……毕业快乐 🎓"。而站点实际是 19 模块 / 119 节 / 19 个项目，P16 之后还有 M17（15 节 + P17）、M18（7 节 + P18）、M19（7 节 + P19）。L16-04 仅在第 13 行用一个括号交代"M17-M19 属于第七阶段「独立开发与商业化」……不在本节的技术脉络里展开"，**P16 则完全没提**。学员读完 P16 会合理地认为课程结束。要么把 M17–M19 明确定位成"毕业后的延伸线"并在 P16 里显式交代，要么把毕业收口移到 P19。 |
| M16-2 | `lesson-l16-04.md` 要点总结第 1 条 + `curriculum.ts` 章节注释（自相矛盾，同一化石两处） | 高 | L16-04 正文（L11–L56）讲"技术主线的**六个**阶段"，并专门加了注解释"曾经有过一版**七阶段**的说法（把 M13 单独列为一个阶段），后来把它并入「质量、架构与生产落地」"。但同一文件的要点总结第一条却写：**"七阶段脉络：筑基→上下文知识→Agent核心→记忆执行编排→多Agent多模态→质量保障→架构生产"**——正是被废弃的那一版（"质量保障"单列 = M13）。同一化石还在 `src/data/curriculum.ts` 的章节注释里：L488 `// 阶段三：Agent 核心篇（M5-M7）`、L902 `// 阶段四：记忆执行与编排篇（M8-M10）`、L1459 `// 阶段六：质量保障篇（M13）`、L1620 `// 阶段七：架构设计与生产落地篇（M14-M16）`——**与同一文件 L2561 的 `stages` 数组直接矛盾**（数组是 `Agent 核心篇[5,6]` / `工程化与编排篇[7,10]` / `质量、架构与生产落地篇[13,16]` / `独立开发与商业化篇[17,19]`）。C13 只校验 `stages` 数组本身，注释和课文要点总结抓不到。 |
| M16-3 | `lesson-l16-04.md` 依赖关系图（L64） | 中 | `L01 LLM基础 → L02 Prompt → L03 上下文 → M5 Agent → M6 工具 → M7 弹性` —— 前三项用 `L0N` 指代**模块**，后三项用 `MN`，而全站约定 `MN` 是模块、`L0N-0X` 是课。同一段落下一行就写 `M3 上下文 + M4 RAG`，自己打自己。 |
| M16-4 | `lesson-l16-01.md`（`computer_use`，L43–L60） | 高 | `while not done:` —— **`done` 从未定义也从未赋值**，第一次求值即 `NameError`。真正的出口是循环体末尾的 `if task_completed(history): break`。这是本节唯一一段"机制演示"代码，讲的是 Computer Use 的核心循环。 |
| M16-5 | `lesson-l16-01.md`（`reliable_computer_use`，L156–L170） | 高 | 三个自由变量未定义：`history`（传给 `model.decide`）、`MAX_STEPS`（`range()` 的上界）、`result`（`return result`）。更关键的是逻辑：`if fail_streak >= fail_limit: human_intervene()` 之后是 `continue` 而**不是 `break`/`return`**——转人工后循环照跑，且此后每一次失败都会重复调用 `human_intervene()`。这是本节"连续失败 N 次转人工"这条可靠性增强手段的唯一示范代码，而它转了人工却不停。 |
| M16-6 | `lesson-l16-02.md`（A2A 客户端示例） | 中 | `delegate_to_agent` 里 `http.post(...)` —— Python 没有 `http.post` 这个顶层调用（`http` 标准库是包，不是 HTTP 客户端），应为 `httpx`/`requests`。另：`delegate_to_agent(agent_card, task)` 与 `safe_a2a_delegate` 里的 `delegate_async(target_card, minimal_task, timeout=300)` 是两套互不衔接的签名，读者无法拼出完整调用链。 |
| M16-7 | `lesson-l16-02.md`（时效性，待联网核实） | 高 | 通篇表述为"**Google 的 A2A（Agent-to-Agent）协议**"。A2A 已在 2025 年移交 Linux Foundation 托管（需核实），"Google 的"这个归属表述要更新为"由 Google 发起、现由 Linux Foundation 托管"。Agent Card 字段也在演进：课文示例用 `authentication: {"schemes": ["oauth2"]}`，较新规范改为 `securitySchemes` / `security`。**值得表扬的是课文已经自己加了免责**——"字段名随协议演进，以官方 Agent Card 为准"、示例注明"示意，非协议原文"——这是全站处理前沿易变内容的正确姿势，应在报告里作为范本推广。→ 进 #5 待核清单。 |
| M16-8 | `lesson-l16-03.md`（模型定制化） | 中 | **全站唯一一节零 Python 代码块 + 零交互组件的技术课**（继 `l14-03` / `l14-04` / `l15-04` 三节纯文字之后，第四节）。而这一节讲的恰恰是最需要一段最小可跑示例的微调——哪怕 20 行 `peft` LoRA 配置、或一份 DPO 偏好对的数据格式样例，都能让"该不该微调"的决策落到实处。C7（动手 5 分钟）和 C8（≥150 行）都过，C3 只管模块级，所以没有任何检查项能发现这节课"只有观点没有可操作物"。 |
| M16-9 | M16 全模块的交互组件 | 中 | 4 节课只有 2 节有交互组件（`l16-01` / `l16-04`），`l16-02`（A2A）、`l16-03`（微调）、`P16` 均为 0。且 `l16-01` 用的 `multimodalDemo` 是 M12 的组件，课文自己的引入语是"先看一眼多模态对比面板……理解多模态的输入输出差异能帮你理解 Computer Use 的可靠性挑战"——**属于借用而非专属**。M16 没有任何自己的交互组件。与 M14-6（`patternSelector` 语义错配）同类：C3 只要求模块级 ≥1，C4 只查孤儿，两者都无法发现"借来的组件和本节主题只是擦边"。 |
| M16-10 | `lesson-l16-04.md` L5–L9（亮点，报告中应作为范本推广） | — | **全站唯一一处"首尾同组件自评对照"**：L16-04 第 7 行明确写"如果你在 M1 开头（L01-01）做过起点自评，现在回到同一个地图再打一次——对比两次结果，红色区域变成了绿色还是黄色"，然后复用同一个 `::interactive{type="growthMap"}`。已核实：`growthMap` 全站仅 `lesson-l01-01.md:7` 与 `lesson-l16-04.md:9` 两处引用，闭环成立。这个"同一把尺子量两次"的设计比任何结课总结都有说服力，值得推广到其他长模块。 |
| M16-11 | `project-p16.md` Step 4（RAG + 记忆） | 高 | ```python\ndef chat(user_id, msg):\n    related = memory.recall(user_id, msg)\n    ...\n    memory.remember(user_id, msg)\n``` —— 中间是**字面 `...` 占位符**，即"拿到记忆之后怎么用"这一步整个是空的。这是**第 6 次**出现字面 `...` 占位（M6-17 / M11-13 ×2 / M13-17 / M14-17 / 本条），而这一次它落在**毕业设计把 RAG 与记忆串起来的核心代码**上。 |
| M16-12 | `project-p16.md` 全部 5 段 Python | 中 | **没有一段可运行**。Step 3 的 `@mcp.tool()` 里 `mcp` 对象未创建（课文注明"FastMCP 风格示意"并指向 L06-05，尚可接受）；Step 5 的 `EvalPipeline` / `QUALITY_GATE` / `llm_judge` / `traced` / `input_guardrail` / `safe_tool_exec` / `hitl_for_dangerous` 全部无定义、无出处链接以外的实现；Step 6 和 Step 8 干脆只有注释（`# 容器化（Dockerfile 见 P15）`、`# K8s 部署（Deployment 多副本 + HPA）`）。P16 与 P14 一样，是**没有可运行交付物的项目**——而它是毕业设计。 |
| M16-13 | `project-p16.md` Step 2（时效性，待核） | 中 | `return g.compile(checkpointer=SqliteSaver.from_conn_string(":memory:"))` —— 新版 `langgraph-checkpoint-sqlite` 的 `from_conn_string` 返回的是**上下文管理器**，必须 `with ... as saver:` 取出真实 saver，直接传进 `compile()` 会拿到 `_GeneratorContextManager` 而非 checkpointer。需回查 M10（LangGraph 章）是否也是这个写法，若一致则是全站性问题。→ 进 #5 待核清单。 |
| M16-14 | `project-p16.md` Step 7 + CLAUDE.md 语言例外清单（规范违规，并更正上一轮记录） | 中 | P16 Step 7 是 ```` ```jsx ```` 代码块，而 CLAUDE.md 的 TS/JSX 例外清单只列 L17-05 / L17-06 / L17-11 / L17-12。**重新精确统计（更正 M15-11 里那条记录）**：违反清单的是 `l10-05`（2 个 `jsx`）、`l15-06`（2 个 `jsx`）、`project-p16`（1 个 `jsx`）、`l17-15`（1 个 `typescript`）共 4 个文件 6 个块；`l17-11`（1 个 `typescript`）和 `l17-12`（1 个 `javascript`）**在清单内，上一轮"l17-12 零 TS 块"的记录有误**（当时的匹配模式只认 `ts`/`tsx` 未认 `javascript`，且在被截断的挂载视图上统计）。另一层问题更实质：**P16 的验收标准第 11 项要求交付"前端 UI（流式 + HITL 审核 + 透明度）"，而全课程系统讲前端的 L17-05 / L17-06 排在 P16 之后**——毕业设计依赖尚未讲授的内容。C15 只校验营销文案里的"双语言"承诺，管不到代码块语言分布。 |
| M16-15 | 全仓库（工程卫生，从 P16 发现后全站扫描） | 中 | **换行符不统一且无 `.gitattributes`**。精确统计：`P1–P16` 中除 `P6` 外的 **15 个 project 文件是纯 CRLF**（每一行都带 `\r`），而**全部 119 个 lesson 文件、P6、P17–P19 是 LF**；`src/components/` 下 12 个文件（HarnessMonitor / MultiModalDemo / TemperatureSampler / SandboxDemo / AgentLoopVisualizer / ProgressProvider / EmbeddingExplorer / TokenizerDemo / CodeBlock / ThemeProvider / PromptTemplateTester / ThemeToggle）也是 CRLF。仓库根目录**没有 `.gitattributes`**，Windows 与 CI 之间会持续产生整文件级 diff 噪声，也让"改了哪几行"无法审查。**已验证这不是渲染 bug**：`MarkdownRenderer.splitContent` 的 `/^::interactive\{([^}]+)\}$/gm` 在 CRLF 下仍能匹配（JS 多行模式下 `$` 把 `\r` 也当行终止符），且这 15 个 project 文件本来就没有 `::interactive` 指令。建议加 `.gitattributes`（`*.md text eol=lf`）并一次性归一。 |
| M16-16 | `project-p16.md` 验收标准 | 中 | 13 条 checkbox 里"完整可运行的生产级 Agent 产品（不止 demo，能真实用）""毕业答辩 + 复盘报告"无法自动核验，与 P14 同病。但**P16 明显好于 P14**：13 条都给了模块映射（`M11` / `L13-01/02` / `L15-04/05`），"ADR ≥ 5 条""至少 2 个 Agent 编排"这类是可数的。P14 应该照 P16 的粒度重写。 |
| M16-17 | `project-p16.md` Step 2（亮点） | — | 两处**踩过坑才写得出来的防御性注释**：`"supervisor": "supervisor",  # 非法/未知路由回主管`（补上了条件边的兜底分支，正是 M11 讲的 supervisor 失败模式）、以及 `# invoke 时传 recursion_limit，勿放进 compile：` 后面直接给出 `config = {"configurable": {"thread_id": "..."}, "recursion_limit": 25}`。与 P15 的 `# 勿用字符串 >= 比较严重度` 同一风格——**再次印证"项目文件的复核标准高于课文"这条全站模式**（累计第 7 例）。 |
| M16-18 | `lesson-l16-01.md`"量化对比"表与"现状（2026）" | 中 | "API 成功率 99%+ / Computer Use 70-90%"、"每步截屏+视觉理解，秒级"、"现状（2026）：能做简单 GUI 任务，复杂任务成功率仍低"——全部无出处、无测量方法、无基准任务集。这是 S6 / M15-4 那条全站模式（教量化却给不出处的数字）在前沿章节的复现，而前沿章节恰恰是读者最没有能力自行判断真伪的地方。同表"成本：低 vs 高"连量级都没有。至少应注明这些区间来自哪个 benchmark（如 OSWorld / WebArena 一类）。 |

## M17 AI Coding 与独立开发（15 节 + P17）

> 本表分两批写入：先记 `l17-08`–`l17-14`（已精读），再补 `l17-01`–`l17-07` / `l17-15` / `P17`。

**总评（初步）**：M17–M19 明显是**更晚、标准更高的一轮撰写**——行文更克制、判断更诚实（"回滚比修复快""能不能被解释"三问、债务矩阵、1min→10min→1h→半天 的成本阶梯都是真有工程手感的内容），是全站文字质量最好的一段。但两个系统性缺陷同时出现：**交互组件几乎归零**（M17 15 节课只有 3 个交互组件，P17/P18/P19 全部 py=0 且 inter=0），以及**Shell/CI 代码显然从未执行过**——本模块教门禁，而其示范门禁本身逻辑反了。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M17-1 | `lesson-l17-14.md` Gate 3（依赖安全） | 高 | **门禁逻辑整个反了**：`pnpm audit --audit-level=high && exit 1` —— `pnpm audit` 在**没有**达到该级别漏洞时才返回 0，于是 `&&` 成立、`exit 1` 触发，**审计干净时阻断、有高危漏洞时反而放行**。同节"实战"变体 `pnpm audit --audit-level=high && exit 1 \|\| true` 除了继承同一处反转，末尾 `\|\| true` 还把整条命令永远变成成功——这道门禁在任何情况下都不会拦住任何东西。这是全站最讽刺的一处 bug：**在一节专门讲"门禁必须真的会拦"的课里，示范门禁永远不拦**。 |
| M17-2 | `lesson-l17-14.md` Gate 6（冒烟测试） | 高 | `curl http://localhost:5173/curriculum \| grep "课程大纲"` **永远匹配不到**。本项目是 Vite SPA，`/curriculum` 命中 SPA fallback 返回 `index.html`，而 `index.html` 的 `<title>` 是"AI Agent 大师之路 · 从小白到专家的实战课程"，全文不含"课程大纲"——"课程大纲"是客户端路由渲染后才出现的。冒烟测试写在自家仓库上却没跑过一次。 |
| M17-3 | `lesson-l17-14.md` Gate 2 | 中 | 写"跑 `pnpm check` 的 **C1-C15** 检查项"，而 CLAUDE.md 与 `scripts/check-curriculum.mjs` 实际是 **C1–C21**（C16–C21 是静态图与 NUL 字节检查）。课程文档落后于它所描述的脚本 6 项。 |
| M17-4 | `lesson-l17-14.md` Gate 4 / Gate 1 | 中 | Gate 4 用 `--coverageThreshold '{"global":{"lines":70}}'` —— 这是 **Jest** 的参数格式，而本项目是 Vite 生态（vitest 用 `coverage.thresholds` 配置项）。Gate 1 用 `eslint . --ext .ts,.tsx` —— `--ext` 已在 **ESLint v9 flat config** 中移除。两处都是"从别处抄来、没在本仓库跑过"的痕迹。→ 进 #5 待核。 |
| M17-5 | 全仓库 vs `l17-08`/`l17-09`/`l17-14`（承诺 vs 落地，task #4 主证据） | 高 | **本课程教的门禁，本仓库一个都没装**。`package.json` 里没有任何测试框架、没有 husky、没有 prettier、没有 eslint 依赖，却声明了 `"lint": "eslint ."`（且仓库内找不到任何 eslint 配置文件，这条脚本必然失败）；`.github/workflows/` 下只有 `deploy-pages.yml` 一个文件，**没有 `ci.yml`**；仓库根目录**没有 `.husky/`**。唯一真实存在的门禁是 `pnpm check`，`deploy-pages.yml` 把它独立成一步跑（注释"课程一致性校验独立成一步"）——这一点做得对且值得表扬。但一门用自己仓库当教具、专章讲 pre-commit/CI/post-deploy 三道门的课程，仓库本身只有三分之一道门。 |
| M17-6 | `lesson-l17-12.md`（M17 最差的一个文件） | 高 | `agent_server.py` **没有 uvicorn 启动入口**（无 `if __name__ == "__main__": uvicorn.run(...)`），而本节的整个架构是"Electron 主进程 spawn 这个被 pyinstaller 打包的后端"——**打包出来的可执行文件跑起来什么都不做，端口永远不监听，Demo 根本起不来**。这是本节唯一的端到端交付物。 |
| M17-7 | `lesson-l17-12.md` `classify_task` | 高 | 分类函数四处坏：① `text_lower = text.lower()` 算了但**从未使用**；② `code_indicators` 里含 `"{"` 和 `"}"`，几乎任何带花括号的文本都被判为代码；③ 判定顺序导致"场景 3（摘要）"**不可达**；④ 摘要分支的 `len(text.split()) > 200` 对中文永远不成立（中文不按空格分词）。这是本节讲"本地小模型做路由"的核心示例。 |
| M17-8 | `lesson-l17-12.md` `build_prompt` / `call_llm` | 高 | ① 注释写"中文内容 → 翻译成英文"，而 `build_prompt["translate"]` 的实际 prompt 是"将以下内容翻译成中文"——**注释与代码方向相反**；② `call_llm` 用裸 `except Exception` 吞掉一切并返回 `prompt[:200]`（连原文都不是，是拼好的 prompt 前 200 字），**这正是同一模块 `l17-09` 点名批判的"过度防御吞异常"反模式**，隔了三节课自己犯；③ `CORSMiddleware(allow_origins=["*"], allow_methods=["*"])` 挂在一个无鉴权的 localhost 端口上，任意网页都能打本地 Agent。 |
| M17-9 | `lesson-l17-12.md` 规格 vs 实现 | 中 | 需求边界写明"处理超过 10 秒时显示进度通知"，Gate 5 的检查清单里也列了这一条，但**代码里没有任何 timeout / 计时 / 进度通知**。本节自己的门禁清单没能拦住自己。 |
| M17-10 | `lesson-l17-11.md` | 高 | ① `@app.post("/agent/run", response_model=AgentResponse)` 的函数体是字面 `...` —— **第 7 次**字面占位符，且声明了 `response_model` 的路由返回 `None` 会直接触发 pydantic 校验错误；② `classify_task` 拿 LLM 原始输出和 `== "simple"` 直接比（未 strip/lower）；③ f-string 隐式拼接把 `{user_input}` 和"选项：…"粘成一行；④ `_check_internet` / `_call_cloud_model` 无定义；⑤ Electron 片段里 `new Notification(...)` **没有 import `Notification`**，却 import 了从未使用的 `Menu`；⑥ `new Tray('icon.png')` 用相对路径，打包后必然找不到。 |
| M17-11 | `lesson-l17-08.md` | 高 | ① `echo "$IMAGE" >> $GITHUB_ENV` —— `GITHUB_ENV` 要求 `NAME=value` 格式，这样写等于往环境文件塞一行裸值，**下游 `$IMAGE` 恒为空**，部署会拉一个空 tag；② `$HOST` **从未定义**却被用了三次（`ssh deploy@$HOST` ×2、`scp ... deploy@$HOST:/app/.env`）；③ 对一个 Docker 部署的 Web 应用，"构建"步骤用 `python -m build`（这是打 sdist/wheel 的命令）。 |
| M17-12 | `lesson-l17-08.md`（亮点） | — | 内容判断非常扎实：**sha 标签的不可变部署**（不用 `latest`）、`rollback.sh` 强调"回滚脚本必须演练过"、`/healthz` 返回 `version` 便于确认部署生效、**数据库迁移拆三次发布**保持向后兼容、`concurrency` + `cancel-in-progress` 防并发部署。已核实 `rollback.sh` 里 `set -euo pipefail` 配 `[ -z "$PREV" ] && {...}` **不是 bug**（AND-OR 列表豁免 `set -e`）——本条是"差点误报"的记录。 |
| M17-13 | `lesson-l17-09.md` | 中 | 两条给出去就会被直接复制的命令是坏的：① `rg -U 'def \w+\([^)]*\):(\n(?!def ).*){80,}'` 用了**负向先行断言**，ripgrep 默认引擎（Rust regex）不支持，必须加 `-P` 走 PCRE2，否则报错退出；② 重复函数检测 `rg -o 'def (format_\|parse_\|to_\|from_)\w+' -r '$1' \| sort \| uniq -d` 只按**前缀**聚合，`format_date` 与 `format_price` 会被报成重复——假阳性率极高。内容本身是 M17 最好的一节（AI 代码五种失败模式、"为什么在这里 / 输入范围 / 坏了怎么表现"三问、债务矩阵）。 |
| M17-14 | `lesson-l17-10.md` | 中 | ① `rate_limit` 的模块级 `_hits` 字典**只增不删**，key 永不回收，长期运行内存无界增长——一节讲成本控制的课，示例代码自己漏内存；② "M12 讲过模型档位的选择逻辑"是**错误的交叉引用**（M12 是多模态）；③ "砍掉 40%-60% 的 token 支出"无出处。 |
| M17-15 | `lesson-l17-01.md` / `l17-03.md` / `l17-04.md` 的三个自检脚本（**同一类致命缺陷，三节连犯**） | 高 | M17 前四节各给了一个"放进 pre-commit 自动跑"的检查脚本，**三个都会 100% 阻断提交**：① `l17-01` 的 `check_boundaries.py` 把 `("import ", "疑似引入新依赖")` 放进 `REDLINE_PATTERNS` —— 任何一个含 `import` 的 Python 文件都命中，红线目录里不可能有文件不含 import，`sys.exit(1)` 恒定触发；② `l17-03` 的 `check_spec_constraints.py` 的 `no_new_deps` 只认 8 个标准库名（`os/sys/json/re/pathlib/datetime/typing/collections`），`import fastapi`、`import app.xxx` 全部报错，注释虽写"只告警不做最终判断"但代码直接 `sys.exit(1)`；③ `l17-04` 的 `check_conventions.py` 更硬——`node.module or ""` 对 `ast.Import` 节点求值会直接 **AttributeError 崩溃**（只有 `ast.ImportFrom` 有 `.module`），任何写了 `import os` 的文件都会让脚本异常退出。**这三节课的主张是"能自动检查的约定才会被遵守"，而三个示范脚本没有一个能通过一次真实运行。** |
| M17-16 | `lesson-l17-04.md` `head()`（L100–L104） | 中 | `truncated='{len(lines) < n}'` **判断反了**：`splitlines()[:n]` 之后，`len(lines) < n` 意味着文件比 n 短、**没有**被截断，却标 `truncated=True`；文件足够长时 `len(lines) == n`（真被截断）反而标 `False`。这个标记是喂给模型的元信息，反了会让模型误判"这段代码是完整的/不完整的"。同文件 `check_import_direction` 还把 model 层检查嵌在 import 循环里再套一层 `ast.walk`，同一个方法会被重复报告 N 次（N = 文件里的 import 语句数）。 |
| M17-17 | `lesson-l17-07.md` 特征测试（L98） | 中 | `def test_snapshot(snapshot_file='tests/pricing_snapshot.json')` —— **pytest 会把 `snapshot_file` 当 fixture 解析，默认值不起作用**，收集期直接报 `fixture 'snapshot_file' not found`，这个测试永远跑不起来。而它是本节"重构前先固化现状"这一核心手法的唯一示例。另：快照文件怎么第一次生成，全节没写。 |
| M17-18 | `lesson-l17-06.md` Playwright 片段（L197–L212） | 中 | 第一个用例"所有按钮都有可区分的文本或 aria-label"**只有 `console.log` 没有 `expect`**——永远通过。这正是同模块 `l17-03` 点名批判的"断言过弱，`assert x is not None` 永远绿"。第四个用例只扫 `document.querySelectorAll('style')`（内联 `<style>`），而 Vite 生产构建把 CSS 抽成外链 `<link>`，`outline: none` 检查在真实构建产物上永远不触发。 |
| M17-19 | `lesson-l17-15.md`"ui-review 自动审查"输出（示范造假） | 高 | 这段 `🔍 UI Review: SearchPanel.tsx` 的"审查报告"逐条打 ✓，其中**"颜色对比度：bg-surface-card + text-ink-base 满足 WCAG AA ✓"和"无横向滚动条 ✓"是仅凭读源码不可能得出的结论**——对比度要解析 token 实际色值算亮度比，横向滚动要真的渲染。这份报告是编出来的理想输出，却被当作"skill 自动审查"的效果证明。**更严重的是它是一次退步**：同模块 `l17-06` 已经给了真能跑的 Playwright 脚本做这两项检查，`l17-15` 把可执行验证换成了让 LLM 打勾。这与全站反复强调的"要可核实的结论"直接冲突。 |
| M17-20 | `lesson-l17-15.md` `SearchPanel.tsx` 示范代码（a11y 反模式） | 中 | 一节讲可访问性的课，其"正确示范"本身违反 ARIA：`<ul role="listbox">` 的每个 `<li role="option">` 里**塞了一个 `<button>`**——`option` 不允许包含可交互后代，屏幕阅读器会拿到冲突的语义；且 listbox 没有 `aria-activedescendant`、没有方向键导航、`aria-selected` 恒为 `false`。要么老老实实用 `<ul>` + `<button>`（不加 role），要么完整实现 combobox 键盘模型。 |
| M17-21 | `lesson-l17-15.md` vs `project-p17.md`（同一产物两种格式） | 中 | L17-15 教读者写 **`design-tokens.yml`**（YAML），P17 的验收标准和交付清单要求 **`design-tokens.json`**（JSON，且给了不同的结构示例：`{"value","cssVar","tailwind"}` 三字段包装）。同一个"UI Skills 落地产物"在教学课和项目里格式与 schema 都不一致，读者按 L17-15 做完，P17 验收不过。 |
| M17-22 | `project-p17.md` 第五阶段（把本仓库的门禁原样抄给读者的新项目） | 高 | P17 的 pre-commit / CI 模板是从本仓库上下文里**未经改写就复制**过去的：`Gate 2: Curriculum check` 跑 `pnpm check --strict`（这是本课程站点的课程一致性校验，读者的 Web 应用里根本没有这个脚本）；`Gate 6` 跑 `curl -s http://localhost:5173 \| grep "AI Agent"`（"AI Agent"来自**本站** `index.html` 的 title，读者项目里必然匹配不到）。此外 `pnpm audit --audit-level=high && exit 1 \|\| true` 继承了 M17-1 的反转（干净时反而阻断）、`pnpm eslint . --ext .ts,.tsx` 继承 M17-4 的废弃参数、`pnpm test -- --coverage` 假设了一个从未安装的测试框架、`pnpm/action-setup@v2`（本仓库自己的 workflow 已用 `@v4`）、`pnpm install` 没有 `--frozen-lockfile`。**照抄这份模板的读者，第一次 `git commit` 就会被自己的门禁拦住，而且拦的理由是假的。** |
| M17-23 | `project-p17.md` 工期 | 中 | 正文写"规模控制：一个核心功能，两到三个页面，**一周内能做完**"，但六个阶段的标注时长加起来是 **7.5 小时**（1.5+1+2+1.5+1+0.5）。其中"第三阶段：功能实现（约 2 小时）"要完成 TDD + subagent 派发 + code review + verification 四个 skill 的完整闭环并实现全部 tasks——不可能。P17 是全站验收标准最多的项目（18 条 checkbox），却给了最不可信的工期。 |
| M17-24 | M17 全模块（交互组件 + 代码密度） | 中 | 15 节课 + P17 只有 **3 个交互组件**（`l17-06` 的 `uiStateMatrix`、`l17-13`、`l17-14`），且 **P17 零 Python 代码块、零交互组件**（P19 同；P18 有 1 个 python 块，三个项目均零交互组件）。M17 是全站最长的模块（15 节），交互密度却是全站最低区间之一。C3 只要求模块级 ≥1，抓不到"15 节课只有 3 个"。 |
| M17-25 | `lesson-l17-15.md` vs CLAUDE.md 语言例外清单 | 中 | CLAUDE.md 写"只有以下例外使用 TypeScript/React：前端集成/UI 相关内容（L17-05、L17-06）、桌面端 Electron 章节（L17-11、L17-12）"，但 **L17-15 整节就是前端 UI 课**（唯一的代码块是 `typescript` 的 `SearchPanel.tsx`），却不在清单里。这不是课程的错，是 **CLAUDE.md 的清单没跟上 M17 扩容**——应把 L17-15 补进例外清单（并把 `l10-05` / `l15-06` 的 `jsx` 块处理掉，见 M16-14）。 |
| M17-26 | M17 内容质量（亮点，须写进报告） | — | 尽管代码问题密集，**M17 的文字是全站质量最高的一段**，且判断诚实得罕见：`l17-01`"AI Coding 的价值不是写得快，是让一个人维护得住更大的代码量""合并进主干的代码你必须能解释每一段"；`l17-02`"你的竞品包括'忍着'和'不做了'""先证伪最脆弱的假设——崩掉的通常是行为假设不是技术假设"；`l17-03` 规格六段式里"不做什么"单列一段；`l17-04`"写模型猜不到的，别写模型能猜到的"；`l17-07`"不要让 AI 读着实现写测试，那只会把 bug 一起固化"、技术债 TODO 必须写"什么问题/什么时候会爆/什么时机修"三要素。这些是真有工程手感、不是复述博客的内容。**问题集中在"文字写得对、代码没跑过"这一个断层上**——这也是全站最值得投入修复的地方：内容底子好，缺的只是一次代码执行验证。 |

## M18 商业化与一人公司（7 节 + P18）

**总评（读完 7 节课后）**：M18 是**全站工程质量最稳的模块**，和 M17 正好相反——M17 是"文字好、代码没跑过"，M18 是"文字好、代码也基本能跑"。`l18-04`（支付/订阅状态机）与 `l18-06`（合规与风险）是全站最扎实的两节课之一。M18 也是**全站免责声明纪律最好的模块**：`l18-01` 和 `l18-06` 都在开篇显式写了"不构成法律、税务或投资建议"。核对过的算术全部正确。问题集中在**三处虚构/无出处的"数据"**和**一个自相矛盾的毛利率公式**上。

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M18-1 | `lesson-l18-05.md` `gross_margin` 计算 | 高 | 演示脚本用 `gross_margin = (revenue - total_cost) / revenue * 100`，而 `total_cost` **只含推理成本**。同一节课在下文明确警告"毛利率 >80% 很好，**或者你漏算了成本**"，并把"支付抽成、失败重试"列为最容易漏算的两项——**脚本本身犯了它自己警告的那个错**，算出来的必然是虚高的毛利率。这是 M18 唯一的高危问题，也是全站"课程自相矛盾"模式的又一例（对照 `l17-09` 骂裸 except 而 `l17-12` 写裸 except、`l17-03` 骂弱断言而 `l17-06` 写弱断言）。修法很轻：把 `payment_fee_pct`（`l18-07` 的 `pricing_breakeven()` 里已经正确带上了 0.03）和重试损耗加进 `total_cost`。 |
| M18-2 | `lesson-l18-07.md`「实际案例」段落 | 高 | 虚构了一个"学员做一个'AI 会议纪要自动提取待办事项'的工具"的案例，其中点名 **Otter.ai / Fireflies.ai / Fathom** 并给出了关于这些产品用户抱怨的具体论断。**无出处、不可核实，且以"实际案例"的口吻呈现**。这与 M17-19（`l17-15` 把一份编造的 UI review 输出当成证据展示）是同一类问题：**把想象出来的结论包装成经验数据**。处理方式二选一：删掉具体公司名改成泛指，或补上可核查的来源与时间戳。 |
| M18-3 | `lesson-l18-05.md` / `lesson-l18-03.md` / `lesson-l18-07.md` 无出处的百分比 | 中 | 三处"看起来像调研数据"的数字都没有来源：`l18-05`"典型收益是 40%-60%"、`l18-03`"这个结论来自**大量 A/B 测试数据**"（价格尾数 $19 vs $20）、以及 M17-14 已记的 `l17-10`"砍掉 40%-60% 的 token 支出"。课程整体的可信度靠的是工程判断的诚实，**这类无源数字是最便宜也最伤的失分点**——要么给来源，要么改成"我的经验是"。 |
| M18-4 | `lesson-l18-05.md` 交叉引用 | 中 | "M12 讲过路由的判断逻辑"——**M12 是多模态**，不是模型路由。这与 M17-14 记的 `l17-10`"M12 讲过模型档位的选择逻辑"是**同一个错误重复出现两次**，说明不是笔误而是系统性问题：需要对全站交叉引用做一次机器核对（可作为新增检查项 C22/C23 之一：`M\d+` / `L\d+-\d+` 形式的引用必须指向 `curriculum.ts` 里真实存在且主题相符的模块）。 |
| M18-5 | `lesson-l18-03.md` `BLOCKED_DOMAINS` | 中 | `BLOCKED_DOMAINS = {'mailinator.com', '10minutemail.com', ...}` —— 字面量 `...` 占位符，这是**全站第 8 处**同类问题（前 7 处集中在 M17 的 `response_model=` 函数体和测试模板里）。Python 里 `...` 在 set 里语法合法但语义为空，读者复制即得一个含 `Ellipsis` 的集合。全站应统一改成注释形式（`# ... 更多域名`）。 |
| M18-6 | `lesson-l18-04.md` `TRANSITIONS` 状态机 | 中 | `TRANSITIONS[ACTIVE]` 缺 `EXPIRED`。年付订阅到期不续费是**真实存在的路径**，按当前表 `ACTIVE → EXPIRED` 会被 `transition()` 拒绝。另外片段里 `logger` / `UniqueViolation` / `days_ago` 三个符号未定义（属于片段惯例，但这节课其他部分给得很完整，此处略显不齐）。 |
| M18-7 | `lesson-l18-07.md` 交互组件与错别字 | 中 | ① `::interactive{type="patternSelector"}` 是**从 M15 借用**的组件，引导语"先用设计模式选择器感受一下决策树交互——同样的交互逻辑，在产品化决策中同样适用"承认了它不是为本节做的。这是全站第三次出现借用组件（对照 M16-9、M14-6），C3/C4 都抓不到——建议新增检查：交互组件引用应与所在模块主题匹配，跨模块借用需登记。② 错别字"空袭分析"应为"空隙分析"。 |
| M18-8 | `lesson-l18-05.md` 细节 | 低 | ① `active_users = sum(r['users'] for r in tiers)` 标注为"活跃付费用户"，但 `tiers` 里包含免费档，口径不符；② `asyncio` / `datetime` 导入后未使用。 |
| M18-9 | `lesson-l18-06.md` 细节 | 低 | 伪名化片段用了 `hashlib.sha256` 但片段内未 `import hashlib`（同上，片段惯例，但本节其他代码给得很全）。 |
| M18-10 | M18 全模块（亮点，须写进报告） | — | **M18 是全站最值得作为标杆的模块。** ① **免责声明纪律**：`l18-01`"本模块内容为工程与经营的通用参考，不构成法律、税务或投资建议"、`l18-06` 同样开篇声明并单列"必须找专业人士"清单，还写了"别用 AI 直接生成一份法律文件然后原样贴上去"——这是全站唯一一处主动划出 AI 能力边界的地方。② **`l18-04` 是全站工程质量最高的代码**：`SubStatus` 枚举 + `TRANSITIONS` 显式转移表 + `transition()` 校验、`FEATURES`/`QUOTA` 全枚举映射（呼应 C12 的设计哲学）、webhook 签名校验 + **用数据库唯一约束做幂等**（不是内存 set）+"重复事件必须返回 200"、以及一个带反向核对的 `reconcile()`。③ **`l18-06` 的 `delete_user(dry_run=True)`** 附了一句罕见的诚实说明："备份里的数据随保留期自然过期"——大多数教材会假装删除是瞬时完备的。④ **算术全部核对通过**：`l18-03` 的 `60×19+30×15+8×0+2×(-80)=1430`、`MAX_FREE_USERS = 200/(10×0.05) = 400`、`l18-07` 的 `pricing_breakeven()`（且正确含 `payment_fee_pct=0.03`）。⑤ **概念贡献**：`l18-02` 的"最小**可收费**产品"（而非最小可用产品）、"离第一笔收入有多远"作为砍功能的唯一判据、"**你开始烦了**是最可靠的自动化信号"、`NOT_DOING.md` 作为"存放好主意的地方"；`l18-01` 的"有成本的信号"分级表与"如果模型厂商下个版本内置了这个功能，我还剩下什么"；`l18-03` 的"用量长尾分布下 2% 重度用户吃掉全部毛利"与"不要向用户暴露 token"。这些都不是复述博客的内容。 |
| M18-11 | `project-p18.md`（亮点 + 小瑕疵） | — | **P18 是全站质量最高的项目**，且与 P17 形成鲜明对照：① 开篇有测试环境 + 专业人士 + 免责三重声明；② 工期标注 1+1.5+1.5+1+0.5 = **5.5 小时且没有"一周内能做完"这类互相打架的表述**（对照 M17-23）；③ "先写状态机再接支付"给了**可操作的理由**（"照着网关字段设计模型，换网关等于重写"）；④ 支付验收不是"点一次成功"而是**五条路径**，并点名第 3 条（webhook 重放）"最容易糊弄过去、也最容易在生产上出事"；⑤ `api_calls` 表专门留了 `success` 字段并解释"失败也要记，成本已经产生"；⑥ 仪表盘第 4 问"单日成本 Top 10 账号"；⑦ 七条"常见翻车点"每条都是真实故障模式，尤其"隐私政策抄了一份跟产品对不上的……这是虚假陈述，比不写危险"。**瑕疵两处（均低）**：① "P17 的返工点记录（**L17-13**）"——返工点记录在 `project-p17.md` 里（第 18/38 行），不在 L17-13，属交叉引用错标（与 M18-4 同类）；② "用 **systematic-debugging** skill 逐条过 L18-06 合规清单"——该 skill 在 L17-13 里定位是系统化排障，用来走 checklist 是误用，改用 writing-plans 或直接手工更贴切。 |

## M19 上线之后：运营、增长与长期经营（7 节 + P19）

**总评**：M19 与 M18 同级，是全站质量最高的两个模块之一，且**几乎没有可执行代码，因此也几乎没有代码 bug**（7 节课里只有 3 段真正的 Python/SQL）。`l19-06` 是全站最好的一节课，也是唯一负责任地处理心理健康议题的内容。**M19 唯一的高危问题是结构性的：课程的结尾被放错了位置。**

| # | 位置 | 严重度 | 问题 |
|---|------|--------|------|
| M19-1 | `lesson-l19-06.md` vs `lesson-l19-07.md`（全课程结尾错位） | 高 | `l19-06` 开篇写"**这是全课程的最后一节**"，结尾写"**课程到这里结束了**……产品会结束，能力不会"——这是一段写得极好的收束。**但它是第 118 节，不是第 119 节。** 其后还有 `l19-07`（用 AI Skills 驱动增长运营），而 `l19-07` 开头正是"L19-01 到 L19-06 讲了增长运营的各个模块"，明确承认自己排在后面。结果是**全课程真正的最后一节是一节 prompt 模板课，而不是那段刻意写就的结语**。这是"后来追加的 10 节新课"（CLAUDE.md 自己记了这件事）没有回头修订原结尾造成的。**修法二选一：把 `l19-07` 前移到 `l19-06` 之前（推荐，`l19-07` 本质是工具课，放在长期经营之前更合逻辑），或者把结语段落搬到 `l19-07` 末尾。** 这是全站唯一一处影响读者最终观感的问题。 |
| M19-2 | `lesson-l19-06.md` 第 5 行 | 高 | "前面 **108** 节讲的都是怎么把事情做成"——实际先于 `l19-06` 的课是 **117 节**（119 − M19 的 7 节 + l19-01…05 的 5 节）。**差 9 节，且 108+1=109 恰好是 M17 扩容前的课程总数**，与 M19-1 同源：这节课写于 10 节新课追加之前，之后没人回头改数字。**建议把这类"课程规模数字"纳入 C11 的检查范围**（目前 C11 只查 README 和 CLAUDE.md，不查课程正文）。 |
| M19-3 | `lesson-l19-07.md`（借用组件 + skill 误用） | 中 | ① `::interactive{type="patternSelector"}` 又一次借用 M15 的设计模式选择器，引导语"先跑一遍设计模式选择器——增长运营的策略选择同样可以用决策树来梳理"和 `l18-07` 几乎是同一句话。**这是 patternSelector 连续第二次被塞进不相干模块**（`l18-07`、`l19-07`），加上 M16-9、M14-6，全站借用组件已达 4 处。C3（模块 ≥1 组件）恰恰**鼓励**了这种为凑数而借用的行为。② "请用 **systematic-debugging** skill 的'分类→定位'方法分析用户反馈"——与 M18-11 记的 P18 是同一个误用，该 skill 在 L17-13 的定位是系统化排障。**两处出现说明是系统性误解，不是笔误。** |
| M19-4 | `lesson-l19-07.md` 内容定位 | 中 | 本节与 `l19-02`（内容）、`l19-03`（数据）、`l19-04`（反馈）**重叠度很高**——三个场景恰好就是那三节课的主题，只是换成 prompt 模板重讲一遍。全站三节"用 AI Skills 辅助 X"课（L17-13 / L18-07 / L19-07）里，`l19-07` 的增量最少。且**全节没有一行可执行代码**，7 个代码块全是 `text` 的 prompt 模板。"这个分工比'全自己做'快 3-5 倍"同样无出处（与 M18-3 同类）。 |
| M19-5 | `lesson-l19-02.md` `ContentAttribution` | 低 | 定义了一个 5 字段 dataclass（含 `visitor_count`），但下文说"**三个字段就够了**：`slug`、`signup_count`、`paying_count`"，且这个类**在后续的 SQL 方案里完全没被用到**（真正的机制是 `users.acquisition_source` + 一条 GROUP BY）。类和正文互相矛盾，删掉这个 dataclass 反而更清楚。`datetime` 导入未使用。 |
| M19-6 | `lesson-l19-03.md` 细节 | 低 | ① 队列 SQL 的 `第0月` 列取的是**有活跃行为的人数**（`JOIN activity`），而叙述把它当成注册基数——注册后从未 `first_run` 的用户被整行排除，留存率的分母其实是"激活数"不是"注册数"，口径需要点明；② 周报里"付费 2 → 活跃付费率 4.1%"的分母（≈49）在报表里找不到对应数字；③ `track()` 用了 `json.dumps` 但片段未 import。 |
| M19-7 | M19 全模块（亮点，须写进报告） | — | **M19 是全站的收尾典范，`l19-06` 是全站单节最高分。** ① **`l19-06` 负责任地处理了倦怠与心理健康**：给了具体可判别的早期信号清单，明确写"问题通常不在你的意志力，在于工作方式没有可持续性"，并在信号升级时（持续数周低落、影响睡眠饮食、对喜欢的事失去兴趣）建议"和专业人士或你信任的人聊一聊……这不是软弱，就像服务器需要监控一样，人也需要"——**既不回避也不说教，还点出了"没有同事会注意到你不对劲"这个独立开发者特有的风险**。② **把"退出"正当化**：出售/开源/体面关停/转手/低投入维持五种结局，并给了关停的具体做法（提前 60-90 天通知、完整数据导出、退未使用订阅费、文档留在线上、诚实说明原因）。③ **`l19-03` 的数字全部内部自洽**（我逐条核过）：队列表 32/100、41/140、67/180 对应正文的 32%/29%/37% ✓；周报里按来源的 142+201+77=420 访问、18+9+11=38 注册、12+3+6=21 激活，三行分别与总数完全吻合 ✓——**这种编造示例数据时仍保持内部一致的克制，在全站是罕见的**。④ **`l19-03` 的"留存进入复利公式"给了可推导的结论**（稳态用户数 = 新增/流失率，流失 30%→20% 稳态涨 50%），而不是喊口号；并配了两个真实相关的交互组件（`growthFunnel`、`growthEngine`），是 M17-M19 里交互用得最对的一节。⑤ **`l19-01` 的私信四要素模板**（为什么找他/为什么做/坦白局限/一个具体问题）和"搜索这个问题的抱怨帖，提问者就是最精准的用户"是可以直接抄去用的。⑥ **`l19-05` 的运营 Agent 边界表**（按"错了的代价和谁承担"而非技术难度划线）+ "权限边界要在系统层强制，给它只读数据库角色"+ 日报 prompt 三约束（只写异常/标注推测/**无异常就说无异常**，最后一条防模型为显得有用而制造问题）——这是全课程 HITL 与护栏思想最漂亮的一次自我应用。⑦ **`l19-05` 结尾的"别过度自动化"**（"前 100 个用户期间支持不要自动化，你需要的不是效率是理解"、过度自动化的信号是"你已经说不出最近三个用户分别是谁"）是全站少见的**主动给自己教的技术划边界**。⑧ **`P19` 是全站最诚实的项目**："唯一一个成败不由你单独决定的项目"，验收标准明写"不看用户数，看你能不能用数据说清下一步该改什么"，迭代计划模板硬性要求"只写一个瓶颈（写两个说明你还没判断出来）"，工期 1.5+1.5+1.5+1+1.5=7 小时跨 4 周、与"需要真实时间流逝才有数据"的说明一致（对照 M17-23 的自相矛盾）。 |

## 工程与代码质量

| # | 位置 | 级别 | 发现 |
|---|------|------|------|
| E-1 | 仓库根 / `.github/workflows/deploy-pages.yml` | **高** | **`pnpm-lock.yaml` 没有被 git 跟踪**（`git ls-files --error-unmatch pnpm-lock.yaml` 失败，且它并不在 `.gitignore` 里），而过时的 `package-lock.json`（149,231 字节）反而still在 HEAD 里、工作区已删（` D package-lock.json`）。CI 跑的是 `pnpm install --frozen-lockfile`——**没有提交的 lockfile 这条命令在全新 clone 上必然失败**，部署工作流实际是坏的。修复：`git rm --cached package-lock.json && git add -f pnpm-lock.yaml` 并提交。 |
| E-2 | `package.json` | 中 | 声明了 `"lint": "eslint ."`，但仓库里**没有任何 eslint 配置文件**（无 `eslint.config.js` / `.eslintrc*`）。这个 script 跑不起来，属于死配置。要么补配置，要么删掉这行。 |
| E-3 | 仓库根 | 中 | **没有任何测试框架**（`package.json` 无 vitest/jest 依赖与 `test` script），而课程本身在 M13 用 8 节课讲评估与测试、M17 反复强调"门禁"。**站点自己不体现所教的工程纪律**，这是最容易被学员感知到的不一致。最小可行：给 `scripts/check-curriculum.mjs` 补几条 vitest 单测。 |
| E-4 | 仓库根 | 低 | 无 `.husky/`（无 pre-commit 钩子，`pnpm check` 全靠人自觉）、无 `.gitattributes`（中文 Markdown + CRLF 混排环境下容易产生噪音 diff，也是本次 review 里 mount 截断误判的诱因之一）。 |
| E-5 | `src/data/models.ts` | 低 | `embedding` 档位的 `models: []` 是空数组，`defaultModelOf('embedding')` 返回 `undefined`，而该档位正文写着"建库与查询必须用同一个模型"——**唯一强调必须锁定模型的档位反而没有登记任何模型 ID**。另外 `nano` 与 `small` 两档的模型列表完全相同，档位区分在 ID 层面不可校验（C5 白名单因此对这两档失效）。 |
| E-6 | `src/components/diagrams/_shared/layout.ts:76` | 亮点 | `layoutEdges(nodes, edges)` 用 `inferSides(dx, dy)` 几何推断 `sourceHandle`/`targetHandle` 并自动在 `step`/`bezier` 间选择——**上一轮 diagrams review 的头号问题 P0-1（101/231 条边退化成 top→top）已修复**。C20 把"未显式指定端口"降为 warn 与这个运行时兜底是配套的，设计合理。 |
| E-7 | `.github/workflows/deploy-pages.yml` | 亮点 | 质量明显高于课程里教的模板：`actions/checkout@v4` + `pnpm/action-setup@v4` + `node-version: 24` + `cache: pnpm` + `--frozen-lockfile`，`pnpm check` 单独成一步（带中文注释说明为什么单独跑），`concurrency: {group: pages, cancel-in-progress: true}`，以及 Pages 未启用时给出可操作报错的 precheck。**但这恰恰反衬 M17-22**：P17 里贴给学员的模板还停留在 `@v2`、无 `--frozen-lockfile`——仓库自己的最佳实践没有回流到教材。 |
| E-8 | `scripts/check-curriculum.mjs` | 亮点 | C1–C21 共 21 条检查（C16–C21 在 652–773 行，是本轮新增的静态图几何校验），零依赖、error/warn 分级、`--strict` 可升级。**把历次 review 的结论固化成机器检查**，是这个项目最值得称道的工程决策。本轮新提的两条建议（跨模块引用校验、正文规模数字校验）都应该按同样方式落进这个脚本。 |

## 前三轮 review 的落实核对

| # | 结论 |
|---|------|
| R-1 | `docs/review2.md` 的 10 条：**第 1、2、3（除 L17-15）、4、5、7、8、9、10 条均已修复**。报告中不应重复这些，只需记一句"已闭环"。 |
| R-2 | 唯一未闭环的是第 6 条（M14 Python 代码密度）：整体有改善，但 `lesson-l14-03.md` 与 `lesson-l14-04.md` 仍然是 **0 个 Python 代码块**。 |
| R-3 | `docs/diagrams-review-2026-07-29.md` 的 P0-1 已修复（见 E-6）。 |

## 时效性核对（含一处重要撤回）

| # | 对象 | 结论 |
|---|------|------|
| T-1 | `lesson-l17-13.md` 的 OpenSpec / Superpowers 数据 | **撤回此前的"疑似编造"判断——全部核实为准确。** OpenSpec ≈61.7k stars（课程写 63k，同量级）；Superpowers GitHub 页面显示 **261.9k stars / 23.4k forks**（课程写 263k）；`npm install -g @fission-ai/openspec` ✓；`/opsx:explore|propose|apply|archive` ✓；`/plugin install superpowers@claude-plugins-official` ✓ 与官方 README 完全一致；"14 个可组合 skills" ✓ **恰好 14 个**。唯一小瑕疵：课程写作 `code-review`，实际拆成 `requesting-code-review` 与 `receiving-code-review` 两个。**这一条要作为正面案例写进报告**——它说明作者是照着一手资料写的。 |
| T-2 | `src/data/models.ts` `CALIBRATED_ON` | `'2026-07-27'`，距今 3 天，C14（180 天）远未触发。白名单 9 个 ID。 |
