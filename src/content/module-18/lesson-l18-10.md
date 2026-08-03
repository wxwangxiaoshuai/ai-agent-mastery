
## 全链路协同：OpenSpec + Superpowers + 社区 Skills 联动实战

L18-03 到 L18-09，每节课讲了一个工具或一个 Skills 组合。这一节把这些串成一条完整的武器链——一个真实案例，从需求到上线，每一步用了什么、为什么用这个、替代方案是什么。

### 案例：为一个 AI 笔记工具添加"智能摘要"功能

背景：你的产品是一个 AI 笔记应用（P18 项目）。用户反馈"笔记太多，找不到重点"。你想加一个"一键生成笔记摘要"功能。这个功能涉及前端 UI（摘要卡片）、后端 API（调用 LLM）、成本控制（摘要很贵）、用户体验（摘要应该在笔记创建时生成还是用户手动触发？）。

### 全链路走一遍

#### 第一阶段：方向校验

```text
User（加载 grill-me skill）:
  审查需求："为笔记应用添加 AI 智能摘要功能"

AI（grill-me 输出）:
  1. 100 个用户里有多少人需要这个功能？
     → 我看了 30 条反馈，8 条提到"笔记太长"
     → grill-me: 30 条反馈里 8 条提到，占比 27%。
        但这是"主动反馈"的 30 个用户——大部分用户不会反馈。
        实际需求可能更低。建议先做一次应用内投票确认。

  2. 每次摘要的 token 成本是多少？
     → 平均笔记 2000 字，摘要约 150 字，
       GPT-4o-mini 成本约 ¥0.02/次
     → grill-me: 如果日活 500 人，每人每天 3 条笔记，
        日成本 = 500 × 3 × ¥0.02 = ¥30/天 = ¥900/月。
        这个成本在你的单位经济模型里是否可接受？

  3. 如果纯做"前 3 行自动作为摘要"，效果如何？
     → ...（讨论替代方案）

  结论: 需求成立，但成本需要设上限——先限制"手动触发"而非"自动生成"，
        每天每人最多 20 次，避免被滥用。
```

**用了什么**：grill-me skill。**替代方案**：自己列五个问题问自己。**效率差异**：grill-me 直接基于你的产品上下文提问（读取了代码库和用户反馈数据），你自己列问题会漏掉成本建模。

#### 第二阶段：规格定义

```text
User（加载 OpenSpec）:
  /opsx:explore "智能摘要功能——手动触发，每用户日限 20 次"

AI（OpenSpec explore 输出）:
  ▸ 分析了现有代码库
  ▸ 笔记模型在 src/models/note.py，已有 content 和 title 字段
  ▸ 前端组件在 src/components/NoteCard.tsx，可以在右下角加摘要按钮
  ▸ 推荐方案：新增 summary 字段 + POST /api/notes/:id/summarize 接口
  ▸ 风险：如果 LLM 返回速度慢（>3s），用户会反复点击——需要加 debounce

User:
  /opsx:propose

AI（OpenSpec propose 输出）:
  生成 openspec/changes/smart-summary/
    proposal.md — 动机：27% 用户反馈 + 预估成本 ¥900/月
    specs/smart-summary.md — 需求：手动触发、日限 20 次、缓存已生成的摘要
    design.md — 技术方案：新增 summary 字段 + summarize API + debounce 前端
    tasks.md — 实现清单：10 个任务，按优先级排列
```

**用了什么**：OpenSpec /opsx:explore + /opsx:propose。**替代方案**：自己写一份 PRD。**效率差异**：OpenSpec 自动读取了代码库结构（Note 模型、NoteCard 组件），你自己写 PRD 要先花 30 分钟翻代码。

#### 第三阶段：实现拆解

```text
User（加载 Superpowers）:
  用 writing-plans 把 tasks.md 拆成可并行执行的子任务

AI（Superpowers writing-plans 输出）:
  ═══════════════════════════════════════
  Implementation Plan: Smart Summary
  ═══════════════════════════════════════

  Phase 1（可并行）:
    Task A: 后端 — 新增 summary 字段 + 数据库迁移
    Task B: 前端 — NoteCard 添加摘要按钮 UI
    Task C: 后端 — 实现 POST /api/notes/:id/summarize

  Phase 2（依赖 Phase 1）:
    Task D: 前端 — 连接 API + 状态管理
    Task E: 后端 — 日限计数器（Redis / 内存）

  Phase 3（最后）:
    Task F: 测试 — 单元测试 + 集成测试
    Task G: UI — 摘要生成中的骨架屏 + 错误处理
    Task H: 成本监控 — 在仪表盘添加摘要用量图表

  ═══════════════════════════════════════
  预计: Phase 1 用 subagent-driven-development 并行执行 A/B/C
  ═══════════════════════════════════════
```

**用了什么**：Superpowers writing-plans。**替代方案**：自己画甘特图。**效率差异**：AI 自动识别了并行化机会（A/B/C 可以同时做），你自己规划可能漏掉。

#### 第四阶段：代码生成（并行 + 约束）

```text
User:
  用 subagent-driven-development 并行执行 Phase 1 的三个任务。
  后端用 TDD（先写测试再写代码）。
  前端 UI 加载 ui-ux-pro-max skill（匹配产品现有设计风格）。

AI 启动 3 个子代理:
  Subagent 1: Task A — 数据库迁移
    → 生成 migration 文件 + 单元测试
    → TDD: 先写 test_add_summary_field，红 → 绿 → 重构

  Subagent 2: Task B — 摘要按钮 UI
    → 加载 ui-ux-pro-max → 匹配"Productivity Tool"风格
    → 生成 NoteCard 增强组件
    → 自动检查：按钮用 <button>、有 focus 样式、颜色来自 design tokens

  Subagent 3: Task C — summarize API
    → 生成 FastAPI route + service 函数
    → TDD: test_summarize_returns_summary → 红 → 绿

Phase 1 全部完成后:
  → 自动触发 code-review-and-quality skill 审查 Subagent 1/2/3 的产出
  → 发现: Subagent 3 的 service 函数中没有处理 LLM 超时
  → 自动打回: Subagent 3 修复 → 再次审查 → 通过
```

**用了什么**：Superpowers subagent-driven-development + TDD + ui-ux-pro-max + code-review-and-quality。**替代方案**：一个个任务手动让 AI 做。**效率差异**：三个任务并行执行，快了约 2.5 倍；code-review 在合入前自动发现超时处理缺失，比人工 review 发现快了一整个阶段。

#### 第五阶段：质量把关

```text
User（加载 Harness）:
  检查 Phase 1 所有产出是否通过 Gate 0-8

AI（Harness 自动检查）:
  Gate 0 — 类型检查: ✓ (mypy --strict 通过)
  Gate 1 — Lint: ✓ (ruff check 通过)
  Gate 2 — 单元测试: ✓ (pytest 12/12 通过)
  Gate 3 — 测试覆盖率: ✓ (新增代码 94% 覆盖)
  Gate 4 — 安全扫描: ✓ (trailofbits audit 通过，无 CRITICAL)
  Gate 5 — UI 审计: ✓ (web-design-guidelines 通过)

  Gate 0-5 全部通过 → 允许合并 PR
```

**用了什么**：Harness 门禁 + trailofbits security-audit + web-design-guidelines（在 Gate 4/5 中自动调用）。**替代方案**：手动逐条检查。**效率差异**：全自动，从开发完成到 PR 合入的审查时间从人工 30 分钟降到 AI 自动 3 分钟。

#### 第六阶段：上线与发布

```text
User:
  1. 用 vercel-deploy 上线
  2. 用 claude-seo 审计新页面
  3. 用 web-quality-skills 做最终检查

AI:
  ▸ vercel-deploy → 线上地址: https://notes-app.vercel.app
  ▸ claude-seo → 新页面 meta 标签缺失（已自动修复）
  ▸ web-quality-skills → 性能 88/100，可访问性 92/100
  ▸ 全部通过 → 发布
```

**用了什么**：vercel-deploy + claude-seo + web-quality-skills。**替代方案**：手动部署 + 手动检查 SEO + 手动跑 Lighthouse。**效率差异**：AI 一条命令完成三步，人工需要 1-2 小时。

### 全流程总结：工具矩阵

| 阶段 | 工具 / Skill | 解决什么问题 | 替代方案 | 加速倍数 |
|------|-------------|------------|---------|---------|
| 方向校验 | grill-me | 需求方向性错误 | 自己列问题 | ~2x |
| 规格定义 | OpenSpec explore/propose | 需求→可执行规格 | 手写 PRD | ~3x |
| 实现拆解 | Superpowers writing-plans | 任务并行化 | 手画甘特图 | ~2x |
| 代码生成 | subagent + TDD + ui-ux-pro-max | 并行开发 + 质量约束 | 逐任务 AI 生成 | ~2.5x |
| 代码审查 | code-review-and-quality | 五维自动审查 | 人工 review | ~10x |
| 安全审计 | trailofbits | 安全漏洞扫描 | 人工安全审计 | ~20x |
| 部署 | vercel-deploy | 零配置上线 | 手动配 CDN | ~10x |
| SEO | claude-seo | SEO 审计 + 修复 | 手动 SEO | ~5x |
| 最终检查 | web-quality-skills | Lighthouse 诊断 | 手动跑 Lighthouse | ~3x |

### 核心原则：该用工具的用工具，该自己写代码的自己写

全链路走下来，一个关键体会：**不是每个环节都该用社区 Skills**。

- 方向校验、代码审查、安全审计——这些环节 AI 做得比人工好，因为检查维度多且不会疲劳。**用社区 Skills。**
- 核心业务逻辑——你的笔记摘要应该怎么排版、你的定价模型参数是什么——这些是 AI 不知道的。**自己写代码 + 用自建 Skills 约束。**
- 部署、SEO、性能检查——这些是重复性操作，每次上线都要做。**用社区 Skills 自动化。**

### 动手：用全链路工作流完成 P18 项目的一个新功能

1. 为 P18 项目选一个你想加但还没开始做的功能。
2. 按本节的全链路走一遍：grill-me → OpenSpec → Superpowers → 社区 Skills 代码生成 → code-review → 安全审计 → vercel-deploy → claude-seo → web-quality-skills。
3. 记录每个阶段的耗时和 AI 介入深度。
4. 项目完成后，写一段 300 字的反思：哪个工具省了最多时间？哪个环节手动做反而更快？

**验收标准**：全链路走通，功能已上线且可访问。反思文档诚实——有哪个工具你觉得"装了但没派上用场"也要写出来。

### 要点总结

- **全链路六阶段**：方向校验 → 规格定义 → 实现拆解 → 代码生成 → 质量把关 → 上线发���。
- **工具不是越多越好**：每个阶段选 1-2 个最合适的工具/Skill，不要为了"用全"而过度工程化。
- **该用工具的用工具，该自己写的自己写**：检查类、重复类操作用社区 Skills；核心业务逻辑自己写。
- **核心指标不是工具数量，是从需求到上线的总耗时**。如果全链路走下来比你不 用任何工具快 3 倍以上，那就是对的。
