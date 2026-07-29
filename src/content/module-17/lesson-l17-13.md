## AI Coding 工作流框架（上）：OpenSpec 规格驱动 + Superpowers 流程控制

L17-03 讲了"规格驱动开发"的理念——把想法写成 AI 能执行的规格。这一节把理念变成可操作的工作流，引入两个具体的框架：**OpenSpec**（定义"做什么"）和 **Superpowers**（指导"怎么做"）。

### 为什么需要工作流框架

没有框架的 AI Coding 是**对话式开发**：你说一句，AI 写一段，你再改改，AI 再补补。问题是：

- **不可回溯**：AI 为什么选择这个方案？当时有哪些替代方案被否决了？没人知道
- **补丁摞补丁**：每次对话都是独立的上下文，后面的修改没有前面的设计约束
- **质量无保障**：AI 写了代码，谁来保证它没有破坏已有功能？谁来保证它符合项目约定？

工作流框架解决三个问题：

| 问题 | 框架 | 职责 |
|------|------|------|
| **做什么** | OpenSpec | 规格驱动：explore → propose → apply → archive |
| **怎么做** | Superpowers | 流程控制：brainstorming、TDD、subagent、review、verification |
| **谁检查** | Harness 门禁 | 质量强制：Gate 0-8 自动阻断（下节讲） |

```
User: "我想做暗色模式"
  ↓
OpenSpec /opsx:explore   → 探索方案、对比权衡
OpenSpec /opsx:propose   → 生成 proposal.md + specs/ + design.md + tasks.md
  ↓
Superpowers brainstorming → 发散方案、风险评估
Superpowers writing-plans  → 实现计划（TDD 任务拆分）
  ↓
Superpowers subagent-driven-development → 并行派发任务
Superpowers test-driven-development     → 红→绿→重构循环
Superpowers requesting-code-review     → 自动 review 产出
Superpowers verification-before-completion → 最终验证
  ↓
OpenSpec /opsx:archive → 归档 specs，更新项目知识库
```

### OpenSpec 规格驱动开发

OpenSpec（63k GitHub stars）是规格驱动开发的 CLI 工具。四步工作流：

#### 1. `/opsx:explore` —— 不写代码，先探索

```bash
npm install -g @fission-ai/openspec
openspec init
```

然后对 AI 说：

```text
/opsx:explore 我想给 P17 项目加一个"暗色模式切换"功能。
请探索以下方向：
1. 用 CSS 变量 vs Tailwind dark: 前缀，各自的优劣？
2. 需要改多少文件？哪些文件必须改？
3. 有没有现成的方案可以复用？
4. 这个功能的风险点在哪？
```

**explore 的价值**：在写一行代码之前，AI 先读代码库、分析方案、对比权衡。**很多时候，explore 的结果是"这个功能没那么简单，建议拆成两个阶段"——这比写到一半才发现省了太多时间。**

#### 2. `/opsx:propose` —— 生成四份规格文件

```text
/opsx:propose 基于刚才的 explore 结果，生成完整的暗色模式 propose。
```

OpenSpec 会在 `openspec/changes/dark-mode/` 下生成：

```
dark-mode/
  proposal.md       # 动机：为什么要做、做了有什么好处
  specs/            # 需求 + 场景：用户故事、验收标准
    dark-mode.md
  design.md         # 技术方案：CSS 变量方案、组件改造策略
  tasks.md          # 实现清单：按优先级排序、可逐条执行
```

**proposal.md 示例**：

```markdown
# Proposal: 暗色模式切换

## 动机
当前站点只有暗色模式，部分用户在白天使用反馈刺眼。
11 条用户反馈中 4 条提到"希望能切换亮色"。

## 范围
- 全局主题切换（暗色 ↔ 亮色）
- 切换状态持久化（localStorage）
- 10 个页面组件的颜色适配

## 不在范围
- 不引入第三方主题库
- 不做"跟随系统主题"（后续版本）
- 不修改 ECharts 图表颜色（图表组件单独处理）

## 风险
- 部分组件使用了硬编码颜色 → 需要先做颜色 token 化
- 亮色模式下代码高亮色需要单独调整
```

**关键**：proposal 里写了"不在范围"（不做什么）和"风险"（什么可能出问题），这比只写"做什么"重要得多。**AI 倾向于"能做就做"，proposal 的不在范围是给它画边界。**

#### 3. `/opsx:apply` —— 按 tasks.md 逐条实现

```text
/opsx:apply 按 tasks.md 逐条实现暗色模式。每完成一个 task 就标记完成。
```

OpenSpec 会追踪 tasks.md 的状态：

```markdown
## tasks.md
- [x] Task 1: 定义亮色主题 CSS 变量
- [x] Task 2: 实现 ThemeProvider + ThemeToggle 组件
- [ ] Task 3: 改造 10 个页面组件适配主题
- [ ] Task 4: 调整亮色模式代码高亮色
- [ ] Task 5: 测试所有页面亮暗切换
```

**apply 的关键原则**：一次只做一个 task，做完再下一个。不要一次让 AI 实现所有 tasks——上下文会爆炸，质量会下降。

#### 4. `/opsx:archive` —— 归档，更新知识库

```text
/opsx:archive dark-mode
```

归档后，`dark-mode/` 变更记录移到 `openspec/changes/archive/`，specs 更新到 `openspec/specs/`。**下次 AI 读 specs 就能理解"暗色模式已经实现了，用的是 CSS 变量方案"——避免重复造轮子。**

### Superpowers 技能体系

Superpowers（263k GitHub stars）是 Claude Code 的插件，提供 14 个可组合 skills。每个 skill 是一个**AI 行为指令集**——告诉 AI 在这个场景下该怎么思考、怎么执行。

安装：

```text
/plugin install superpowers@claude-plugins-official
```

#### 核心 Skills 详解

**`brainstorming`**：结构化头脑风暴，先发散再收敛。AI 会先尽可能多地列出方案，然后按可行性、成本、风险逐条评估，最后收敛到 2-3 个推荐方案。

```text
请用 brainstorming skill 帮我发散 P17 项目的功能优先级排序。
```

**`writing-plans`**：写出"给热情但缺乏判断力的初级工程师"能执行的计划。每个任务必须包含：输入、输出、验收标准、前置条件、预估时间。**计划不规范（如"实现用户系统"这种大颗粒任务），AI 会拒绝执行并要求细化。**

**`test-driven-development`**：严格的 red/green TDD 循环。先写失败测试 → 写最小实现 → 测试通过 → 重构。**禁止跳过测试直接写实现。**

**`subagent-driven-development`**：主 Agent 拆任务 → 并行派发 subagent → 自动 review 产出。每个 subagent 独立上下文、独立工具权限，避免上下文污染。

**`systematic-debugging`**：六步调试法：复现 → 隔离 → 定位 → 修复 → 验证 → 预防。不只是修 bug，还要写回归测试防止重现。

**`requesting-code-review` / `receiving-code-review`**：双向 code review 闭环。一个 subagent 实现代码，另一个 subagent 用独立视角审视，发现问题自动反馈给实现者修改。

**`verification-before-completion`**：完成前强制自检。逐条检查：测试全绿？代码风格一致？没有引入新依赖？没有吞异常？没有重复实现？全部通过才能标记 task 完成。

#### Skills 触发规则

Superpowers 的核心原则是：**"有 1% 可能就该调 skill"**。禁止跳过 skill 直接行动。

这背后的逻辑是：**AI 容易高估自己的判断力**。一个任务看起来简单，AI 可能直接跳过 brainstorming 开始写代码。但"看起来简单"常常是"没想清楚"的伪装。强制调 skill 就是把"想清楚"变成硬约束。

### 实战：为 P17 项目跑一遍完整工作流

```text
# Step 1: OpenSpec explore
/opsx:explore P17 项目要做一个"Markdown 笔记管理器"。
核心功能：创建笔记、Markdown 编辑、标签分类、全文搜索。
技术栈：Python FastAPI + React + SQLite。
请探索技术方案，重点对比以下方向：
1. 编辑器选型：CodeMirror vs Monaco vs 简易 textarea
2. 全文搜索：SQLite FTS5 vs 外部搜索引擎
3. 数据模型：单表 vs 笔记+标签关联表

# Step 2: Superpowers brainstorming
用 brainstorming skill 发散"笔记管理器的功能优先级"。
先发散（至少列出 15 个功能点子），再按"用户价值/实现成本"矩阵收敛到 5 个 MVP 功能。

# Step 3: OpenSpec propose
/opsx:propose 基于 explore 和 brainstorming 的结果，
生成完整的 proposal.md + specs/ + design.md + tasks.md。
重点：proposal 里要写清楚"不在范围"和"风险"。

# Step 4: Superpowers writing-plans
用 writing-plans skill 把 tasks.md 里的每个 task 拆成
"给初级工程师也能执行"的粒度。每个 task 包含：
输入 / 输出 / 验收标准 / 前置条件 / 预估时间。

# Step 5: OpenSpec apply（配合 Superpowers subagent + TDD + review）
/opsx:apply 按 tasks.md 逐条实现。
每实现一个 task：
- 用 TDD skill 先写测试
- 用 subagent-driven-development skill 并行派发独立任务
- 用 code-review skill 自动 review 每个 subagent 的产出
- 用 verification-before-completion skill 做完成自检
```

### 动手 5 分钟

1. 安装 OpenSpec：`npm install -g @fission-ai/openspec && openspec init`。
2. 用 `/opsx:explore` 探索 P17 项目的核心功能方案，记录 explore 发现的至少 2 个"如果不探索就没想到"的问题。
3. 用 Superpowers 的 `brainstorming` skill 做一次完整的需求头脑风暴（发散 → 收敛），输出一份功能优先级排序。

**验收标准**：explore 记录里至少有 2 个"没想到"的问题，brainstorming 输出有明确的发散阶段和收敛阶段（不是直接跳到结论）。

### 要点总结

- **没有框架的 AI Coding = 对话式开发，不可回溯、补丁摞补丁、质量无保障**。OpenSpec 定义"做什么"，Superpowers 指导"怎么做"，Harness 门禁负责"谁检查"。
- **OpenSpec 四步工作流**：`/opsx:explore`（不写代码先探索）→ `/opsx:propose`（生成 proposal + specs + design + tasks）→ `/opsx:apply`（逐条实现）→ `/opsx:archive`（归档，更新知识库）。
- **proposal 里最重要的不是"做什么"，而是"不做什么"和"风险"**。AI 倾向于"能做就做"，proposal 的不在范围是给它画边界。
- **Superpowers 的 14 个 skills 是可组合的 AI 行为指令集**。核心 skills：brainstorming、writing-plans、TDD、subagent-driven-development、systematic-debugging、code-review、verification-before-completion。
- **"有 1% 可能就该调 skill"**——AI 容易高估自己的判断力，强制调 skill 是把"想清楚"变成硬约束。
- **apply 的关键原则**：一次只做一个 task，做完再下一个。不要一次让 AI 实现所有 tasks——上下文会爆炸，质量会下降。