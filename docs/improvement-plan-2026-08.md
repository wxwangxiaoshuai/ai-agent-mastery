# AI Agent 课程站点 · Review 改进计划

## Context

基于 `docs/REVIEW-2026-07.md`（第 4 轮深度 Review）和 `docs/_review-notes-2026-07.md`（581 行逐模块精读记录），拆解出可执行的改进计划。

Review 核心结论：**内容架构优秀（A-），但代码可执行性系统性失守（D）**。30 个 P0 阻断项、15 个 P1 重要项、6 个系统性问题、28 个建议新增检查项。

改进分为五期，每期以"跑得通"为验收标准。

---

## 进度总览

| 期次 | 名称 | 状态 | 完成日期 |
|------|------|------|---------|
| 第一期 | 止血 | **已完成** | 2026-08-03 |
| 第二期 | 代码可执行性 | **已完成** | 2026-08-03 |
| 第三期 | 可信度与一致性 | **已完成** | 2026-08-03 |
| 第四期 | 交互组件与体验 | **已完成** | 2026-08-03 |
| 第五期 | 工程基础 | **已完成** | 2026-08-03 |

### 第一期完成详情

| Task | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| 1.1 | lockfile 修复（P0-30） | — | 此前已修复 |
| 1.2 | M19 末课顺序（P0-27/P0-28） | `l19-06.md`, `l19-07.md`, `curriculum.ts` | 已修复 |
| 1.3 | 模型标识换代（P0-29 + S2） | `models.ts`, 全站 148+ 处, `check-curriculum.mjs` | 已修复 |
| 1.4 | M1 双语言残留 | `project-p1.md` | 已修复 |
| 1.5 | P6 语法错误（P0-1） | `project-p6.md` | 已修复 |

**第一期升级内容**：
- C5 正则扩展：覆盖 `text-embedding-*`、`whisper-*`、`tts-*`、`o3`/`o4-mini` 等
- C28 新增：`models.ts` 每档 `models` 非空、各档不得完全相同
- 白名单从 9 个增至 13 个，embedding 档从空数组补齐，新增 speech 档
- 模型替换：`gpt-4o-mini` → `gpt-4.1-mini`（nano/small）、`gpt-4o` → `gpt-5`（mid）

---

## 第一期：止血（P0 阻断项，1-2 周）

目标：让全新 clone 能构建、让第一个项目能跑通、让末课不再自相矛盾。

### Task 1.1: 修 lockfile（P0-30）

**问题**：`pnpm-lock.yaml` 未被 git 跟踪，过时的 `package-lock.json` 仍在 HEAD。CI 跑 `pnpm install --frozen-lockfile` 在全新 clone 上必然失败。

**修法**：
```bash
git rm --cached package-lock.json
git add -f pnpm-lock.yaml
git commit -m "fix: 修复 lockfile 未被跟踪导致 CI 构建失败"
```

**验收**：`git ls-files pnpm-lock.yaml` 返回该文件；`pnpm install --frozen-lockfile` 成功。

---

### Task 1.2: 修 M19 末课顺序（P0-27 / P0-28）

**问题**：
- `l19-06` 自称"全课程最后一节"但实际是第 118/119 节，`l19-07` 在后面
- `l19-06` 写"前面 108 节"实际是 117 节

**修法**：
1. 把 `lesson-l19-07.md` 重命名为临时文件
2. 把 `lesson-l19-06.md` 重命名为 `lesson-l19-07.md`
3. 把临时文件重命名为 `lesson-l19-06.md`
4. 同步更新 `src/data/curriculum.ts` 中 M19 的 lesson 顺序
5. 修改原 `l19-06`（新 `l19-07`）中的"108 节"→"117 节"
6. 修改原 `l19-07`（新 `l19-06`）中的开头引用（"L19-01 到 L19-06"→"L19-01 到 L19-05"）

**涉及文件**：
- `src/content/module-19/lesson-l19-06.md`
- `src/content/module-19/lesson-l19-07.md`
- `src/data/curriculum.ts`

**验收**：`pnpm check` 通过；`l19-07`（新）是真正的最后一节且含结语。

---

### Task 1.3: 模型标识全站换代（P0-29 + S2）

**问题**：全站 148 处 OpenAI 模型标识（`gpt-4o` / `gpt-4o-mini`）已下线。C5 白名单本身过期，C14 被绕过。

**修法分三步**：

**Step 1: 更新 `src/data/models.ts` 白名单**
- 把 `gpt-4o` / `gpt-4o-mini` / `gpt-4o-2024-08-06` / `gpt-4o-2024-11-20` 替换为当前有效模型
- 补齐 `embedding` 档的 `models` 数组（当前为空）
- 区分 `nano` 与 `small` 两档（当前完全相同）
- 更新 `CALIBRATED_ON` 为实际校准日期
- 建议的替换方案（需用户确认具体型号）：
  - `gpt-4o-mini` → `gpt-4.1-mini`（nano/small 档）
  - `gpt-4o` → `gpt-5`（mid 档）
  - `gpt-4o-2024-11-20` / `gpt-4o-2024-08-06` → 对应新版本
  - embedding 档补 `text-embedding-3-small` / `text-embedding-3-large`

**Step 2: 全站替换模型标识**
- `gpt-4o-mini` → 新 nano/small 档模型（96 处）
- `gpt-4o` → 新 mid 档模型（52 处）
- `gpt-4o-2024-11-20` / `gpt-4o-2024-08-06` → 对应新版本（各 2 处）
- 可脚本化批量替换，人工复核上下文语义

**Step 3: 加固 C5 和 C14**
- 扩 C5 正则覆盖：`text-embedding-3-*`、`o3`/`o4-mini` 等非 `gpt-` 前缀的 OpenAI 推理模型
- C14 加固：白名单每个 ID 附 `verifiedAt` 字段，校准时必须逐个更新

**涉及文件**：
- `src/data/models.ts`（白名单真源）
- `src/content/` 下约 148 处引用（全站 grep 后批量替换）
- `scripts/check-curriculum.mjs`（C5 正则 + C14 逻辑）

**验收**：`pnpm check` 的 C5 全绿；全站无 `gpt-4o` / `gpt-4o-mini` 残留。

---

### Task 1.4: 修 M1 双语言残留（P0 特别说明）

**问题**：`project-p1.md` Step 1 保留 TypeScript/npm 方案，违反 Python 主线定位。

**修法**：删除 `project-p1.md` Step 1 中的 TypeScript 方案代码块，保留纯 Python 方案。

**涉及文件**：`src/content/module-01/project-p1.md`

**验收**：Step 1 不再出现 `npm install` / `tsx` / TypeScript 相关内容。

---

### Task 1.5: 修 P6 语法错误（P0-1）

**问题**：`project-p6.md:529-530` 半角双引号嵌套在双引号字符串内 → `SyntaxError`。

**修法**：内层双引号改单引号或中文引号。

**涉及文件**：`src/content/module-06/project-p6.md`

**验收**：Python `py_compile` 通过。

---

## 第二期：代码可执行性（4-6 周）

目标：**每一段 Python 都真的跑过一次**。这是全计划中回报最高的一项。

### Task 2.1: 建立代码执行验证管道（S1 基础设施）

**做法**：
1. 写抽取脚本 `scripts/extract-python-blocks.mjs`，把所有 `.md` 里的 ` ```python` 代码块抽成独立 `.py` 文件
2. 先做静态门禁：`python -m py_compile`（抓语法错误）+ `ruff check --select F`（抓 `F821` 未定义名、`F401` 未使用导入）
3. 固化成 **C22 检查项**，进 `pnpm check`

**验收**：`pnpm check` 跑 C22 并报告所有语法错误和未定义符号。

---

### Task 2.2: 修 M8 代码（P0-2, P0-3, P0-11, 以及 M8 全模块 24 条缺陷）

**问题（按优先级）**：
- **P0-2**: `lesson-l08-05.md` 全节 6 个方法写在模块顶层却用 `self.` 调用 → 收进 `MemoryUpdater` class
- **P0-3**: `MemoryUpdater` 调用 6 个从未定义的方法 → 补实现或改成显式伪代码块
- **P0-11**: `Skill(**payload)` 缺 `tools` / `example_input` → 给默认值或改 prompt
- **M8-5**: `LongTermMemory.forget` 里 `Collection.update(where=...)` Chroma 无此参数 → 先 `get(where=)` 再 `update(ids=)`
- **M8-6**: Step 5 演示脚本第一行 `AttributeError: 'NoneType'`（`bm25` 未构建）
- **M8-3**: `recall`/`soft_forget` 用整体替换写元数据，抹掉 `user_id` 隔离
- 其余 M8 缺陷见 `_review-notes-2026-07.md` M8 节

**涉及文件**：
- `src/content/module-08/lesson-l08-01.md` 到 `lesson-l08-05.md`
- `src/content/module-08/project-p8.md`

**验收**：每段核心 Python 代码通过 `py_compile`；关键方法签名与调用一致。

---

### Task 2.3: 修 M7 代码（P0-5, P0-6, P0-7, P0-8, 以及 M7 全模块 13 条缺陷）

**问题（按优先级）**：
- **P0-5**: `CheckpointAgent.run` 里 `json.dumps(ChatCompletionMessage)` → 第一次工具调用必崩，改 `msg.model_dump()`
- **P0-6**: `ModelFallbackChain` 首档 Claude 模型走 OpenAI client → 永远降级，按 provider 分派 client
- **P0-7**: `CircuitBreaker` 无锁 dataclass → 加 `threading.Lock`
- **P0-8**: `@resilient` 超时保护被拖死 + 线程泄漏 → 改用 SDK 原生 `timeout=`
- 其余 M7 缺陷见 `_review-notes-2026-07.md` M7 节

**涉及文件**：
- `src/content/module-07/lesson-l07-01.md` 到 `lesson-l07-05.md`
- `src/content/module-07/project-p7.md`

**验收**：每段核心 Python 代码通过 `py_compile`；降级链所有档模型可被对应 client 调用。

---

### Task 2.4: 修 M10 代码（P0-14, P0-15, P0-16, P0-17, 以及 M10 全模块 17 条缺陷）

**问题（按优先级）**：
- **P0-14**: `State.messages: list` 无 `add_messages` reducer + 图有回环 → 工具结果每轮被覆盖
- **P0-15**: 路由函数 `return END` 但 `END` 未 import → `NameError`
- **P0-16**: Step 6 整套测试一条也跑不了（`search_api` 未定义 + 需真实 key）
- **P0-17**: `test_parallel_search_merges` 断言 `>= 0` 恒真
- 其余 M10 缺陷见 `_review-notes-2026-07.md` M10 节

**涉及文件**：
- `src/content/module-10/lesson-l10-01.md` 到 `lesson-l10-06.md`
- `src/content/module-10/project-p10.md`

**验收**：`State` 定义有正确的 reducer；路由函数可执行；测试断言有意义。

---

### Task 2.5: 修 M9 代码（P0-12, P0-13, 以及 M9 全模块 21 条缺陷）

**问题（按优先级）**：
- **P0-12**: `run_with_file` 的 `timeout=10` 从未使用，`exec_run` 不支持 → 死循环永久挂住
- **P0-13**: `run_sandboxed` 的 `stats()` 在 `wait()` 前采样 → `peak_memory_mb` 恒为 0
- **M9-1**: `REVIEW_PROMPT` 里单花括号被 `.format()` 当替换字段 → `KeyError`
- **M9-2**: `DANGEROUS_CALLS` 黑名单 API 名拼错（`os.exec` 应为 `os.execv`）
- 其余 M9 缺陷见 `_review-notes-2026-07.md` M9 节

**涉及文件**：
- `src/content/module-09/lesson-l09-01.md` 到 `lesson-l09-04.md`
- `src/content/module-09/project-p9.md`

**验收**：Docker 沙箱代码有正确的超时和资源采样；安全审查正则实际可用。

---

### Task 2.6: 修 M11 代码（P0-18, P0-19, P0-20, 以及 M11 全模块 18 条缺陷）

**问题（按优先级）**：
- **P0-18**: `llm_route` 把 `BaseMessage` 对象直接传给 OpenAI SDK → 转 dict 再传
- **P0-19**: 三条回边的成环图未设 `recursion_limit` → invoke 时传 `recursion_limit`
- **P0-20**: `test_review_loop_converges` 断言无法区分闭环转没转 → 断言 `revision_count >= 1`
- 其余 M11 缺陷见 `_review-notes-2026-07.md` M11 节

**涉及文件**：
- `src/content/module-11/lesson-l11-01.md` 到 `lesson-l11-05.md`
- `src/content/module-11/project-p11.md`

---

### Task 2.7: 修 M3 代码（P0-4, 以及 M3 全模块 12 条缺陷）

**问题（按优先级）**：
- **P0-4**: `assemble()` 产出的消息结构对 Anthropic 和 OpenAI 都非法
- 其余 M3 缺陷见 `_review-notes-2026-07.md` M3 节

**涉及文件**：
- `src/content/module-03/lesson-l03-01.md` 到 `lesson-l03-06.md`
- `src/content/module-03/project-p3.md`

---

### Task 2.8: 修 M16 代码（P0-21, P0-22, P0-23, 以及 M16 全模块 18 条缺陷）

**问题（按优先级）**：
- **P0-21**: `while not done:` —— `done` 从未定义
- **P0-22**: `compile(checkpointer=SqliteSaver.from_conn_string(":memory:"))` —— 传的是上下文管理器对象
- **P0-23**: RAG + 记忆串联的核心代码是字面 `...` 占位符
- 其余 M16 缺陷见 `_review-notes-2026-07.md` M16 节

**涉及文件**：
- `src/content/module-16/lesson-l16-01.md` 到 `lesson-l16-04.md`
- `src/content/module-16/project-p16.md`

---

### Task 2.9: 修 M17 代码（P0-24, P0-25, P0-26, 以及 M17 全模块 26 条缺陷）

**问题（按优先级）**：
- **P0-24**: `agent_server.py` 无 uvicorn 启动入口 → pyinstaller 打包后什么都不做
- **P0-25**: `echo "$IMAGE" >> $GITHUB_ENV` 格式非法；`$HOST` 未定义
- **P0-26**: `curl /curriculum | grep "课程大纲"` 永远匹配不到（Vite SPA fallback）
- **M17-1**: 门禁逻辑整个反了（`pnpm audit --audit-level=high && exit 1`）
- **M17-15**: 三个自检脚本都会 100% 阻断提交
- 其余 M17 缺陷见 `_review-notes-2026-07.md` M17 节

**涉及文件**：
- `src/content/module-17/lesson-l17-01.md` 到 `lesson-l17-15.md`
- `src/content/module-17/project-p17.md`

---

### Task 2.10: 修其余模块 P0 缺陷

**范围**：
- **M6**: P0-1（已在 Task 1.5 修）、M6-2 到 M6-20
- **M12**: 全模块 17 条缺陷（含 M12-1 体系性矛盾、M12-3 DPI 问题、M12-5 假测试）
- **M13**: 全模块 20 条缺陷（含 M13-1 体系性 Agent 抽象不存在、M13-2 自证测试、M13-4 红队设计即失败）
- **M14**: 全模块 20 条缺陷（含 M14-1 加权算错、M14-4 签名对不上）
- **M15**: 全模块 18 条缺陷（含 M15-1 渲染缺陷、M15-8 回滚必然失败、M15-13 假测试）
- **M18**: M18-1 毛利率公式、M18-2 虚构案例
- **M5**: 全模块 12 条缺陷
- **M4**: 全模块 10 条缺陷
- **M2**: 全模块 9 条缺陷
- **M1**: 全模块 6 条缺陷（Task 1.4 已修 M1-5）

**验收**：C22（`py_compile` + `ruff --select F`）全站通过。

---

### Task 2.11: 全站字面 `...` 占位符清理（8 处）

**位置**：M6-17 / M11-13(×2) / M13-17 / M14-17 / P16 Step 4 / L18-03 / L17-11

**修法**：每处改成具名占位（如 `# TODO: 实现具体逻辑`）或补实现。

**验收**：C22 的 `ruff --select F` 不再报告这些位置的 `F821`。

---

### Task 2.12: 全站 `encoding="utf-8"` 补齐（S6，5+ 处）

**位置**：L03-06:68/194, L04-05:172, L06-06:96, L13-08:157

**修法**：每个 `open(path, "w")` 改成 `open(path, "w", encoding="utf-8")`。

**验收**：新增 C27 检查项（`open(..., "w")` 必须带 `encoding=`）通过。

---

## 第三期：可信度与一致性（3-4 周）

### Task 3.1: 清理编造数字（S3）

**位置**：
- L04-02（分块精度 75/82/88%）
- L04-04（召回率/精确率/延迟四行对照表）
- L04-05（四轮优化曲线）
- L14-01（框架评分矩阵）
- L06-08/P6（"选择噪音降了 70%"）
- L19-07（"快 3-5 倍"）
- M15-02（优化方案评估表）
- M11-15（"最佳规模 2-4 个 Agent"）
- M16-18（Computer Use 成功率）
- M18-3（"典型收益 40%-60%"）

**修法**：每处要么补上"来源/测量条件"，要么改成"量级示意，非实测"的免责标注。参照 M18 的三层免责声明写法。

**验收**：全站无"看似实测但无来源"的数字；所有基准数字带来源标注或免责声明。

---

### Task 3.2: 修假测试（S4）

**位置**：
- `project-p10.md` `test_parallel_search_merges`（`>= 0` 恒真）
- `project-p11.md` `test_review_loop_converges`（无法区分闭环）
- `project-p10.md` Step 6 全套（一条也跑不了）
- `project-p9.md` `test_no_network`（KeyError）
- `project-p12.md` Step 8（三条恒真断言）
- `project-p13.md` Step 4+5（红队设计即失败）
- `project-p13.md` Step 7（硬编码常量报告）
- `project-p15.md` Step 9（断言函数对象恒为真）

**修法**：断言改成能区分成功与失败的形式。补 mock/monkeypatch。

**验收**：每个测试在 mock 环境下能跑且能检测到失败。

---

### Task 3.3: 跨模块引用校验（S6 引用错位）

**问题**：
- L18-05 写"M12 讲过路由"（M12 是多模态）
- L17-10 写"M12 讲过模型档位的选择逻辑"（同上）
- P18 写"P17 的返工点记录（L17-13）"（实际在 `project-p17.md`）
- L16-04 依赖关系图用 `L0N` 和 `MN` 两种格式混用
- M14-6 patternSelector 被错配到无关主题

**修法**：
1. 逐条修正上述已知错位引用
2. 新增 **C23 检查项**：扫描正文里的 `M\d+` / `L\d\d-\d\d` / `P\d+` 引用，校验目标存在且模块主题匹配

**涉及文件**：
- `src/content/module-18/lesson-l18-05.md`
- `src/content/module-17/lesson-l17-10.md`
- `src/content/module-18/project-p18.md`
- `src/content/module-16/lesson-l16-04.md`
- `scripts/check-curriculum.mjs`（新增 C23）

---

### Task 3.4: 正文规模数字校验（P0-28 防回归）

**修法**：扩展 C11，把"前面 N 节"这类正文里的规模数字也纳入校验。

**涉及文件**：`scripts/check-curriculum.mjs`

---

### Task 3.5: C15 扩展——代码块级双语言检测

**问题**：C15 只匹配文案措辞，匹配不到代码块级的双语言残留。

**修法**：扩 C15 为"非例外清单文件不得出现 ts/tsx/js/jsx 代码块"。

**当前违规文件**（需先修或补进清单）：
- `l10-05`（2 个 jsx）
- `l15-06`（2 个 jsx）
- `project-p16`（1 个 jsx）
- `l17-15`（1 个 typescript）

**涉及文件**：`scripts/check-curriculum.mjs`

---

### Task 3.6: C14 加固

**问题**：`CALIBRATED_ON` 可以靠改字符串骗过。

**修法**：改成白名单里每个 ID 附一个 `verifiedAt`，校准脚本必须逐个更新。或至少在 warn 文案里写明"改日期不等于校准"。

**涉及文件**：`src/data/models.ts`、`scripts/check-curriculum.mjs`

---

### Task 3.7: 类名/签名跨课漂移修复（S6）

**位置**：
- `ContextAssembler`：L03-06 用 `max_tokens=`，P3 用 `context_window=`+`output_reserve=`
- `count_tokens()` vs `TokenCounter.count()`
- `ContextDebugger.visualize`：L03-06 与 P3 近乎逐字重复但窗口上限逻辑不同

**修法**：统一签名；重复代码提取到一处，另一处引用。

---

### Task 3.8: stages 注释同步（P1-9 + M16 化石）

**问题**：`curriculum.ts` 四处块注释与 `stages` 数组真源不一致。L16-04 要点总结仍使用废弃的七阶段划分。

**修法**：
1. 更新 `curriculum.ts` 块注释使其与 `stages` 数组一致
2. 更新 L16-04 要点总结，使其与正文的六阶段一致

**涉及文件**：`src/data/curriculum.ts`、`src/content/module-16/lesson-l16-04.md`

---

### Task 3.9: P1 项修复（15 条）

| # | 位置 | 修法 |
|---|------|------|
| P1-1 | L01-03:293-294 | 改捕 `APIStatusError` 而非 `APIError` |
| P1-2 | L02-04:105 | 更新为 Anthropic 已有原生 Structured Outputs |
| P1-3 | L04-04 `HybridRetriever` | 删除 `self.bm25` 死字段，或让 `retrieve()` 用实例字段 |
| P1-4 | P6 Step 6 | 对比实验控制变量（并行 vs 并行）或标注混杂 |
| P1-5 | L06-08 `execute_with_skills` | 实现真正的串联语义，或改标题为"Skill 并行调用" |
| P1-6 | L06-06 `ToolCallReplayer` | 截断前保存完整结果，或标注"有损重放" |
| P1-7 | M9/M13 三处 | 更新密钥正则匹配当前格式 |
| P1-8 | L14-03/L14-04 | 补 Python 代码块 |
| P1-9 | curriculum.ts | 块注释与 stages 真源同步（见 Task 3.8） |
| P1-10 | L18-05 | `total_cost` 加回支付抽成和重试损耗 |
| P1-11 | L18-07 | 删掉真实公司名或补可核查来源 |
| P1-12 | L18-04 | `TRANSITIONS[ACTIVE]` 补 `EXPIRED` 目标态 |
| P1-13 | L19-07 | 与 l19-02/03/04 去重；补可执行代码或降级为参考附录 |
| P1-14 | package.json | 删掉 `"lint": "eslint ."` 或补 eslint 配置 |
| P1-15 | 仓库根 | 给 `scripts/check-curriculum.mjs` 补 vitest 单测 |

---

### Task 3.10: 时效性修复

**范围**：
- M2-2: Google SDK 从旧版 `google-generativeai` 更新到 `google-genai`
- M2-3: Pydantic v2 `Field(enum=...)` 改为 `Literal`
- M8-24: MemGPT 加注"现已更名 Letta"
- M12-8: 修复 `"是" in content` 子串匹配（"不是"也含"是"）
- M12-13: 多模态"记住"图片的措辞修正
- M16-7: A2A 协议归属更新为"由 Google 发起、现由 Linux Foundation 托管"
- M16-13: SqliteSaver 上下文管理器用法校验
- 各模块第三方 API 版本与用法校验（M10-13 CrewAI、M11-11 AutoGen、M9-21 E2B、M12-14 依赖）

---

## 第四期：交互组件与体验（4-6 周，可与三期并行）

### Task 4.1: 收紧 C3 并禁止跨模块借用凑数

**修法**：
1. C3 从"每模块 ≥1"改为"每模块交互覆盖率 ≥ 40% 的 lesson"，或"每 3 节课至少 1 个"
2. 新增 **C26**：若某模块引用的组件全部来自其他模块，报 warn；同一组件在同一模块内重复引用应告警
3. 解决 4 处已知的借用组件语义错配：M14-6（patternSelector）、M16-9（multimodalDemo）、M18-7（patternSelector）、M19-3（patternSelector）

**涉及文件**：`scripts/check-curriculum.mjs`

---

### Task 4.2: 优先补 M17 交互组件（缺口最大）

M17 15 节课只有 3 节有交互，优先补以下节：
- L17-01（AI Coding 边界，可用 `patternSelector` 或新组件）
- L17-02（需求验证，可用 `tradeoff` 矩阵）
- L17-03（规格约束，可做规格六段式模板器）
- L17-04（代码规范，可做约定检查配置器）
- L17-05（前端集成，可用 `uiStateMatrix` 扩展）
- L17-07（重构，可做快照对比器）
- L17-08（CI/CD，可用 `gateConfigurator`）
- L17-09（AI 代码审查，可做五种失败模式对照器）
- L17-10（成本控制，可用 `costModel`）
- L17-14（质量门禁，已有 `gateConfigurator`）
- L17-15（UI Skills，可做 a11y 自检器）

---

### Task 4.3: 补其余低覆盖模块交互

- M13（8 节课只有 2 个交互）：补 LLM-as-Judge 偏倚对照器、trace 调用链可视化、测试金字塔配比模拟器、注入攻防红队靶场
- M6（8 节课只有 2 个交互）：补 Tool Schema 对照器、MCP 连接状态面板
- M3（6 节课只有 2 个交互）：补上下文组装可视化、预算分配拖拽器
- M9（4 节课只有 2 个交互）：补方案谱系对比、沙箱安全策略配置器

---

### Task 4.4: 项目页各加至少 1 个交互

当前 19 个项目全部零交互。设计上可做"验收自检清单"型组件，复用性高。

---

### Task 4.5: 修 M15-1 渲染缺陷（唯一一处）

**问题**：`lesson-l15-01.md` L34-L65 代码围栏在中途断裂，L46-L58 落在围栏外。

**修法**：修复围栏闭合位置。同时新增 C22 检查项（禁止制表符出现在代码围栏外）——注意此 C22 与 Task 2.1 的 C22 是同一个，需合并。

**涉及文件**：
- `src/content/module-15/lesson-l15-01.md`
- `scripts/check-curriculum.mjs`

---

## 第五期：工程基础（与一至四期并行）

### Task 5.1: 仓库工程卫生

**范围**：
- 无 `.husky/`——加 pre-commit 钩子跑 `pnpm check`
- 无 `.gitattributes`——加 `*.md text eol=lf` 统一换行符
- 换行符归一化：15 个 project 文件（CRLF）统一为 LF
- `package.json` 里 `"lint": "eslint ."` 死配置——删掉或补配置
- 无测试框架——给 `scripts/check-curriculum.mjs` 补 vitest 单测

### Task 5.2: CI 最佳实践回流到教材

**问题**：本仓库 `.github/workflows/deploy-pages.yml` 质量很高（`@v4`、`--frozen-lockfile`、`concurrency`），但 P17 里贴给学员的模板还停留在 `@v2`、无 `--frozen-lockfile`。

**修法**：更新 P17 的 CI 模板使其与本仓库实际使用的一致。

**涉及文件**：`src/content/module-17/project-p17.md`

---

## 建议新增检查项汇总

| 编号 | 内容 | 级别 | 对应问题 | 实现期 |
|------|------|------|---------|--------|
| C22 | 所有 Python 代码块通过 `py_compile` + `ruff --select F` | error | S1 全部 | 第二期 |
| C23 | 正文里的 M/L/P 交叉引用目标存在且主题匹配 | error | S6 引用错位 | 第三期 |
| C24 | 正文里的规模数字（"前面 N 节"等）与课程数据一致 | error | P0-28 | 第三期 |
| C25 | 代码块级双语言检测（扩展 C15） | error | M1 残留 | 第三期 |
| C26 | 交互覆盖率 ≥ 40%（收紧 C3）+ 禁止全部借用外模块组件 | warn | S5 | 第四期 |
| C27 | `open(..., "w")` 必须带 `encoding=` | warn | S6 | 第二期 |
| C28 | `models.ts` 每档 `models` 非空、各档不得完全相同 | error | S2 | 第一期 |

---

## 执行顺序

```
第一期（1-2 周）
├── Task 1.1: lockfile ← 先做，半小时
├── Task 1.2: M19 末课顺序
├── Task 1.3: 模型标识换代（含 C5/C14 加固 + C28）
├── Task 1.4: M1 双语言残留
└── Task 1.5: P6 语法错误

第二期（4-6 周）
├── Task 2.1: 建立代码执行验证管道（C22 + C27）
├── Task 2.2-2.10: 按缺陷密度 × 位置重要性逐模块修
│   优先级: M8 > M7 > M10 > M9 > M11 > M6 > M3 > M16 > M17 > M12 > M13 > M14 > M15 > M5 > M4 > M2 > M1 > M18 > M19
├── Task 2.11: 全站 `...` 占位符清理
└── Task 2.12: 全站 `encoding="utf-8"` 补齐

第三期（3-4 周，严格串行，二期完成后再开始）
├── Task 3.1: 清理编造数字
├── Task 3.2: 修假测试
├── Task 3.3: 跨模块引用校验（C23）
├── Task 3.4: 正文规模数字校验（C24）
├── Task 3.5: C15 扩展（C25）
├── Task 3.6: C14 加固
├── Task 3.7: 类名/签名跨课漂移修复
├── Task 3.8: stages 注释同步
├── Task 3.9: P1 项修复
└── Task 3.10: 时效性修复

第四期（4-6 周，严格串行，三期完成后再开始）
├── Task 4.1: 收紧 C3 + C26
├── Task 4.2: 补 M17 交互
├── Task 4.3: 补其余低覆盖模块交互
├── Task 4.4: 项目页加交互
└── Task 4.5: 修 M15-1 渲染缺陷

第五期（1-2 周，严格串行，四期完成后再开始）
├── Task 5.1: 仓库工程卫生
└── Task 5.2: CI 最佳实践回流
```

---

## 任务跟踪策略

- 严格串行：每期完成后再进入下一期
- 按模块分组：第二期代码修复按模块创建任务（Task 2.2 M8、Task 2.3 M7...），每模块一个任务
- 每完成一个任务标记 completed，确保进度可见

---

## 验证方式

每期完成后：
1. `pnpm check` 全绿（含新增检查项）
2. `pnpm build` 成功
3. 新增 C22 的 `py_compile` + `ruff --select F` 全站通过（第二期后）
4. 全站无 `gpt-4o` / `gpt-4o-mini` 残留（第一期后）
5. 全站无 `open(path, "w")` 缺 `encoding=` （第二期后）