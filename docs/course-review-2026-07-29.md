# AI Agent 大师之路 — 课程设计全面 Review 报告

**审查日期**：2026-07-29
**审查范围**：全部 19 个模块 / 109 节课 / 19 个项目 / 全部 128 个 .md 内容文件
**数据来源**：`curriculum.ts`、`types.ts`、`models.ts`、全部内容文件、`pnpm check` 输出

---

## 总体评价

课程骨架扎实，M1-M16 技术主线覆盖面广且深度合理，设计哲学清晰（自底向上、理论+实战交替）。M17-M19 独立开发与商业化篇定位正确但内容深度不足，是三段式结构里最薄弱的一环。

**评级**：M1-M16 评为 **A 级**（优秀），M17-M19 评为 **B 级**（合格但需加强），整体课程评为 **A- 级**。

---

## 一、Skills 从入门到精通体系（问题 1）

### 现状

课程每节课有 `competency` 标签，但没有显式的能力进阶地图。M16-L04 的"成长地图"是一次性自评，不是贯穿全课程的 skills progression 体系。

### 问题

- 学习者不知道"学完这个模块我能做什么"
- 没有 skills 分类学，"工程能力""架构能力""产品能力"混在一起
- 缺少阶段性里程碑，7 个阶段的描述是课程视角而非学习者视角
- M8-L04 的"技能库"概念是 Agent 的技能库，不是学习者的技能库，两者未区分

### 建议

1. 为每个阶段增加"学完本阶段你能做什么"的能力清单
2. 在 `types.ts` 中增加 `SkillLevel` 类型，让 competency 形成层级：`基础认知 → 独立实现 → 工程化 → 架构设计 → 产品交付`
3. M16-L04 的 growthMap 前移到 M1 开头作为"起点自评"，M16 结尾再做"终点自评"
4. 每个模块的 `description` 中增加"学完本模块你能交付什么"

---

## 二、图文结合 —— 流程图与架构图（问题 2）

### 现状

全站 109 节课中，没有任何内嵌的架构图、流程图、时序图。零个 mermaid 图、零个 ASCII art 架构图。

### 方案：使用 React 组件绘制架构图

不使用 mermaid——mermaid 生成的图形风格与站点暗色主题、品牌色调不统一，且无法交互。本项目已有 24 个交互式教学组件，用 SVG 在页面上直接渲染，风格完全受控。架构图复用这套模式：每个架构图是独立 React 组件，使用 SVG 绘制，统一站点配色，支持暗/亮双主题。

### 需要新增的架构图组件清单

| 组件名 | 所属模块 | 图示内容 | 优先级 |
|--------|---------|---------|--------|
| `ArchitectureDiagram` | 通用基础设施 | 可复用的分层架构图组件（支持定义层、节点、边、数据流箭头） | P0 |
| `ReActLoopDiagram` | M5 | ReAct 循环状态图：Thought → Action → Observation → Thought 闭环 | P0 |
| `RAGPipelineDiagram` | M4 | RAG 数据流图：索引管道 + 检索管道 | P0 |
| `ContextAssemblyDiagram` | M3 | Context 组装流程图：静态底座→动态注入→优先级排序→Token 预算→输出 | P0 |
| `FunctionCallingSequence` | M6 | Function Calling 调用链时序图：User→Agent→Tool→Agent→User | P0 |
| `CircuitBreakerDiagram` | M7 | Circuit Breaker 三态转换图：Closed→Open→Half-Open→Closed | P1 |
| `MemoryLayersDiagram` | M8 | 记忆四层路由静态图 | P1 |
| `LangGraphStateDiagram` | M10 | LangGraph 状态图：节点、条件边、循环、Checkpoint | P1 |
| `HITLFlowDiagram` | M10 | Human-in-the-Loop 中断流程 | P1 |
| `MultiAgentTopologyDiagram` | M11 | 四种拓扑结构静态对比图 | P1 |
| `SupervisorPatternDiagram` | M11 | Supervisor 模式消息流 | P1 |
| `DeploymentArchDiagram` | M15 | 生产部署架构图：网关→队列→缓存→限流→Agent 服务 | P1 |
| `AgentPlatformDiagram` | M14 | Agent 平台分层架构 | P1 |
| `OpenSpecWorkflowDiagram` | M17 | OpenSpec + Superpowers 工作流全貌 | P0 |
| `CursorArchDiagram` | M14 | Cursor Agent 模式架构拆解图 | P2 |
| `DevinArchDiagram` | M14 | Devin 自主编程架构拆解图 | P2 |
| `PerplexityArchDiagram` | M14 | Perplexity 搜索→推理→引用→生成架构 | P2 |
| `GrowthEngineDiagram` | M19 | 增长引擎循环：获客→激活→留存→付费→传播 | P2 |

### 实现方式

放在 `src/components/diagrams/` 目录下，通过 `::interactive{type="..."}` 语法嵌入课程内容。组件内部使用 CSS 变量颜色，自动适配暗/亮双主题。

---

## 三、TypeScript 代码清理（问题 3）

### 现状

C15 检查：424 个 Python 代码块 vs 14 个 TypeScript 系代码块。

| 位置 | 内容 | 处理方式 |
|------|------|---------|
| L01-03 | 完整 TS 平行实现（~5 个代码块） | 删除，改为一句话说明 |
| L01-03 正文 | "本节附一份 TypeScript 平行实现" | 删除 |
| L02-01 | TypeScript 模板示例（1 个代码块） | 改为 Python 版本 |
| L17-04 | 项目约定中"前端 React 18 + TypeScript" | 改为"前端 React 18 + JavaScript" |
| L17-05 | `.tsx` 文件路径、`tailwind.config.js` | 保留，加"前端特例"标注 |
| L17-06 | TypeScript 判别联合类型讨论 | 改为 Python typing.Literal / Pydantic 等价讨论 |
| P1 stack | `Python/TS` | 改为 `Python` |
| P6 stack | `Python/TS` | 改为 `Python` |
| P17 stack | `TypeScript` | 改为纯前端工具链描述 |

**处理原则**：L17-05/L17-06 前端 UI 章节保留 JS/TS 是合理的，但应在章节开头明确标注"前端特例"。更新 CLAUDE.md 中 C15 白名单逻辑。

---

## 四、Agent Skills 调用机制（新增）

### 问题分析

当前 M6 讲完了 Function Calling 和 MCP 协议，但缺少关键环节：**Agent Skills 系统**。Skills 是比 Function Calling 更高层的抽象——一个 Skill 不是单个工具，而是一个**可复用的 Agent 行为包**，包含 System Prompt、工具集合、输入输出 Schema、前置条件、子 Agent 编排逻辑。

在真实工程中，Agent 不是"调一个工具"而是"加载一个 Skill 来执行一个任务"。Claude Code 的 skills 系统、LangChain 的 toolkits、OpenAI 的 GPTs 都是这个模式。**Function Calling 教 Agent 调工具，Skills 教 Agent 调"能力包"**。

### 新增课程

#### L06-07（新增）：Agent Skills 系统：从 Function Calling 到技能注册

- 什么是 Skills：比 Function Calling 高一层，一个 Skill 是"可复用的 Agent 行为包"
- Skills 与 Function Calling 的关系：Function Calling 是底层机制，Skills 是上层封装
- Skill 定义结构：`{id, name, description, system_prompt, tools[], input_schema, output_schema, preconditions}`
- Skill 注册表（Registry）：Agent 启动时加载可用 Skills，运行时按意图匹配
- 与 MCP 的层次关系：MCP 连接外部工具，Skills 封装内部能力
- 时长 40 分钟，类型：理论

#### L06-08（新增）：构建 Skill 注册中心与动态调度

- 实现 Skill Registry：注册、发现、匹配
- 用 Function Calling 实现 Skill 的选择与调度
- Skill 执行的上下文隔离：每个 Skill 有独立的 System Prompt 和工具集
- Skill 组合：一个任务可能触发多个 Skill 的协作
- 实战：把 P6 的工具箱 Agent 重构为 Skills 架构
- 时长 50 分钟，类型：实战

#### L08-04（扩展现有）：程序记忆与技能库

当前 L08-04 已讲"程序记忆与技能库"，侧重 Agent 从自身经验中沉淀技能。L06-07/08 讲的是开发者如何为 Agent 预定义 Skills，两者互补：L06-07/08 是开发者视角，L08-04 是 Agent 视角。

---

## 五、Agent 桌面端应用实践（新增）

### 位置与厚度

**推荐位置：M17 内部**，作为 AI Coding 的实践方向之一。M17 是"用 AI 造软件"，桌面端是造软件的一种形态。

### 新增课程

#### L17-11（新增）：Agent 桌面端应用架构

- 桌面端 Agent 技术选型：Electron vs Tauri
- 本地模型推理：Ollama 嵌入桌面应用，llama.cpp 的 Python binding
- 系统级能力：剪贴板读写、屏幕截图、文件系统监控、全局快捷键
- 离线优先架构：本地模型做常规任务，云端模型做复杂推理
- 隐私与安全：用户数据不出本机
- 时长 45 分钟，类型：理论

#### L17-12（新增）：用 AI Coding 交付一个桌面端 Agent 原型

- 用规格驱动开发写桌面端 Agent 的规格
- AI 生成 Electron + Python 后端项目骨架
- 实现系统托盘 Agent：常驻后台，快捷键唤醒，剪贴板输出
- 打包与分发：pyinstaller / electron-builder
- 时长 55 分钟，类型：实战
- 标注"前端特例"——桌面端涉及 JS/Electron，但 Python 仍是后端 Agent 主语言

---

## 六、AI Coding 工作流框架：OpenSpec + Superpowers + Harness（问题 4 重设计）

### 框架选型调研

| 框架 | Stars | 核心能力 | 课程定位 |
|------|-------|---------|---------|
| **OpenSpec** | 63k | 规格驱动开发，`/opsx:explore → propose → apply → archive` 四步工作流 | 规格层——"做什么" |
| **Superpowers** | 263k | 14 个可组合 skills：brainstorming、writing-plans、TDD、subagent-driven-development、systematic-debugging、code-review 等 | 流程层——"怎么做" |
| **Harness（Claude Code）** | — | 加载 skills、执行 subagent、hooked 到开发全流程的平台 | 运行层——"谁来执行" |

三者关系：**OpenSpec 定义"做什么" → Superpowers 指导"怎么做" → Harness 负责"谁来做"**。三者组合形成完整 AI Coding 工作流：

```
User: "我想做暗色模式"
  ↓
OpenSpec /opsx:explore   → 探索方案、对比权衡
OpenSpec /opsx:propose   → 生成 proposal.md + specs/ + design.md + tasks.md
  ↓
Superpowers brainstorming → 发散方案、风险评估
Superpowers writing-plans  → 实现计划（TDD、YAGNI、DRY）
  ↓
Superpowers subagent-driven-development → 并行派发任务给 subagent
Superpowers test-driven-development     → 红→绿→重构循环
Superpowers requesting-code-review     → 自动 review 产出
Superpowers verification-before-completion → 最终验证
  ↓
OpenSpec /opsx:archive → 归档 specs，更新项目知识库
```

### 新增课程

#### L17-13（新增，上）：AI Coding 工作流框架：OpenSpec 规格驱动 + Superpowers 流程控制

**内容**：

1. **为什么需要工作流框架**（5 分钟）：
   - 没有框架的 AI Coding = 对话式开发，补丁摞补丁，不可回溯
   - 框架解决三个问题：**做什么**（OpenSpec）、**怎么做**（Superpowers）、**谁检查**（Harness 门禁）

2. **OpenSpec 规格驱动开发**（25 分钟）：
   - 安装与初始化：`npm install -g @fission-ai/openspec && openspec init`
   - `/opsx:explore`：不写代码先探索，让 AI 读代码库、分析方案、对比权衡
   - `/opsx:propose`：生成 proposal.md（动机）+ specs/（需求+场景）+ design.md（技术方案）+ tasks.md（实现清单）
   - `/opsx:apply`：按 tasks.md 逐条实现
   - `/opsx:archive`：归档到 `openspec/changes/archive/`，更新 specs
   - 实战：用 OpenSpec 为 P17 项目的核心功能写一份完整的 spec

3. **Superpowers 技能体系**（20 分钟）：
   - 安装：`/plugin install superpowers@claude-plugins-official`
   - 核心 skills 详解：
     - `brainstorming`：结构化头脑风暴，先发散再收敛
     - `writing-plans`：写出"给热情但缺乏判断力的初级工程师"能执行的计划
     - `test-driven-development`：严格的 red/green TDD 循环
     - `subagent-driven-development`：主 Agent 拆任务，并行派发 subagent，自动 review
     - `systematic-debugging`：六步调试法（复现→隔离→定位→修复→验证→预防）
     - `requesting-code-review` / `receiving-code-review`：双向 code review 闭环
     - `verification-before-completion`：完成前强制自检
   - **Skills 触发规则**：Superpowers 的核心原则是"有 1% 可能就该调 skill"，禁止跳过 skill 直接行动
   - 实战：安装 Superpowers，用 brainstorming skill 跑一次完整的需求头脑风暴

**时长**：50 分钟，类型：实战

#### L17-14（新增，下）：Harness 质量门禁：三级防线让 AI 产出可控

**内容**：

1. **Harness 门禁全景**（10 分钟）：
   - Harness 不是"运行 skills 的平台"，而是 AI Coding 工作流的**质量强制层**
   - 三个问题："AI 产出的代码，谁来保证它没有破坏已有功能？谁来保证它符合项目约定？谁来保证它没有引入安全漏洞？"
   - 答案：Harness 门禁——在 AI 产出代码的每一个关键节点，自动触发检查，不通过就阻断
   - 一张架构图展示 Harness 门禁在 OpenSpec + Superpowers 工作流中的位置

   ```
                         Harness 门禁（Quality Gate Layer）
                         ┌────────────────────────────────────┐
   OpenSpec /opsx:explore │  → Gate 0: 自动触发 brainstorming  │
   OpenSpec /opsx:propose │  → Gate 1: spec review（完整性检查）│
   OpenSpec /opsx:apply   │  → Gate 2: TDD 红绿循环           │
                          │  → Gate 3: 并行 subagent 执行      │
   每个 task 完成          │  → Gate 4: subagent 产出自动 review│
   所有 tasks 完成         │  → Gate 5: verification-before-    │
                          │            completion 强制自检      │
   git commit 前           │  → Gate 6: lint / type-check /     │
                          │            test / 依赖红线 / 安全   │
   git push 前            │  → Gate 7: 完整回归测试             │
   OpenSpec /opsx:archive │  → Gate 8: specs 更新一致性检查    │
                         └────────────────────────────────────┘
   ```

2. **Gate 0-2：实现前门禁——先想清楚再动手**（15 分钟）：
   - **Gate 0（探索门禁）**：Superpowers 的 `using-superpowers` skill 强制"有 1% 可能就该调 skill"，杜绝跳过头脑风暴直接写代码
   - **Gate 1（规格门禁）**：OpenSpec 的 propose 阶段，spec 必须包含边界情况 + 不做什么 + 验收标准，缺一不可。AI 生成 spec 后，由 `requesting-code-review` skill 审查 spec 的完整性
   - **Gate 2（计划门禁）**：Superpowers 的 `writing-plans` 强制 TDD 任务拆分——每个任务必须先写测试再写实现。计划不规范（如"实现用户系统"这种大颗粒任务），AI 会拒绝执行并要求细化
   - 实战：给一个模糊需求"加个搜索功能"，让它依次通过 Gate 0-2，对比不走门禁的产出

3. **Gate 3-5：实现中门禁——生成过程可控**（15 分钟）：
   - **Gate 3（执行门禁）**：Superpowers 的 `subagent-driven-development` 拆任务→并行派发 subagent。每个 subagent 独立上下文、独立工具权限，避免上下文污染。subagent 失败时自动重试，不污染主 Agent 上下文
   - **Gate 4（Review 门禁）**：每个 subagent 完成产出后，Superpowers 的 `requesting-code-review` + `receiving-code-review` 自动触发双向 review。reviewer subagent 用独立视角审视代码，发现的问题自动反馈给 implementer subagent 修改
   - **Gate 5（完成门禁）**：Superpowers 的 `verification-before-completion` 强制逐条检查：测试全绿？代码风格一致？没有引入新依赖？没有吞异常？没有重复实现？检查通过才能标记 task 完成
   - 实战：观察一次 subagent-driven-development 的完整执行——拆任务、派发、review、修改、验证

4. **Gate 6-7：提交前门禁——CI 自动化防线**（15 分钟）：
   - **Gate 6（Pre-commit 门禁）**：Harness 的 hooks 在 git commit 前自动运行：
     ```json
     // .claude/settings.json — Harness hooks 配置
     {
       "hooks": {
         "PreCommit": [
           { "command": "ruff check src/ && ruff format --check src/" },
           { "command": "mypy src/ --strict" },
           { "command": "python -m pytest --co -q 2>/dev/null | tail -1" },
           { "command": "bash scripts/check-quality.sh" },
           { "command": "bash scripts/check-dependency-redline.sh" },
           { "command": "safety check --bare 2>/dev/null || echo '⚠️ 安全扫描跳过'" }
         ]
       }
     }
     ```
     - 逐条解释每个 hook 防什么：ruff 防风格漂移、mypy 防类型错误、pytest --co 防测试收集失败、check-quality.sh 防吞异常和依赖膨胀、safety check 防已知漏洞
     - **关键原则**：门禁失败的 commit 不允许创建。AI 必须修复问题后重新提交。这比"事后 review 发现"便宜一个量级
   - **Gate 7（Pre-push 门禁）**：完整回归测试 + 安全扫描。比 pre-commit 重但频率低，防止 AI 的改动破坏已有功能
   - 实战：配置一套完整的 pre-commit + pre-push hooks，故意让 AI 生成一段有问题的代码（吞异常 + 超复杂度），观察门禁如何阻断

5. **Gate 8：归档前门禁——知识沉淀不腐烂**（5 分钟）：
   - OpenSpec 的 `/opsx:archive` 归档前自动检查：specs 是否与实现一致？design.md 是否更新了？tasks.md 是否全部完成？
   - 归档后的 specs 是项目的"活文档"——下次 AI 读取 specs 就能理解已实现的功能，避免重复造轮子

6. **门禁的配置管理**（10 分钟）：
   - 门禁不是越严越好——每个项目按风险等级配置
   - 低风险项目（个人玩具）：pre-commit lint + test 即可
   - 中风险项目（有用户的产品）：+ type-check + 依赖红线 + 安全扫描
   - 高风险项目（涉及钱/权限/数据删除）：+ 人工审批 gate + 安全审计
   - 门禁配置写在 `.claude/settings.json` 或 `.github/hooks/` 里，随项目 Git 版本管理
   - 对比其他 Harness 的门禁机制：Cursor rules 的 pre-commit、GitHub Copilot 的 CI check

7. **门禁不是枷锁，是安全带**（5 分钟）：
   - 门禁的心理学：很多人觉得"加了门禁会变慢"
   - 实际数据：pre-commit 检查耗时 30 秒，但省掉的是"合并后发现问题返工 1 小时"
   - L17-09 的量级对比：**Prompt 约束 1 分钟 / review 发现 10 分钟 / 合并后重构 1 小时 / 线上出事半天**
   - Harness 门禁把质量成本前移到"最便宜的那一刻"——**在 commit 之前**

**时长**：75 分钟，类型：实战

**配套架构图**：`HarnessGatePipelineDiagram`——Harness 门禁管道全景图（Gate 0-8 的完整流程）

**配套交互组件**：`gateConfigurator`——交互式门禁配置器，学习者选择项目风险等级 → 自动生成推荐的门禁配置

#### L17-15（新增）：生产级 UI 约束：用 Skills 让 AI 产出美观可用的前端

**内容**：

1. **AI 默认 UI 的问题**（10 分钟）：
   - 每个页面风格不同、圆角随机、间距漂移、五种灰色、无响应式
   - 根因：AI 没有设计约束，每次都在"发明"设计决策

2. **设计系统 Skills**（25 分钟）：
   - `ui-craft`（219★）：设计工程系统，把设计 token 固化为 AI 可消费的约束
   - 接入方式：安装 skill → 定义 design token → AI 自动遵守
   - 实战：为 P17 项目定义一套 design token（颜色、圆角、间距、字体、阴影），让 AI 产出的 UI 风格一致

3. **UI 质量检查 Skills**（20 分钟）：
   - 可访问性（a11y）检查 skill：确保对比度、键盘导航、语义化 HTML
   - 响应式约束 skill：mobile-first、断点一致性、触摸友好
   - 状态矩阵覆盖检查：loading / empty / error / success / edge cases
   - 实战：用 UI 质量检查 skill 审查 P17 项目的前端页面，修复发现的问题

4. **工作流整合**（15 分钟）：
   - OpenSpec 写 UI 功能的 spec（含设计约束）
   - Superpowers 的 brainstorming 发散 UI 方案
   - Superpowers 的 subagent-driven-development 并行执行 UI 任务
   - UI skills 在生成后自动检查
   - 形成闭环：**spec 定义约束 → skill 指导生成 → skill 自动审查 → 人最终确认**

**时长**：70 分钟（可分上下两节），类型：实战

---

## 七、新增内容后的实战项目重设计（问题 1 补充）

### 项目影响分析

| 项目 | 原范围 | 新增内容影响 | 是否需要重设计 |
|------|--------|------------|--------------|
| **P6** 全能工具箱 Agent + 自制 MCP Server | 多工具 Agent + MCP Server 发布 | 新增 Skills 注册中心 + 动态调度 | **是，扩展交付物** |
| **P17** 用 AI Coding 从零交付一个可上线的 Web 应用 | Web 应用 + 规格 + 测试 + CI/CD | 新增 OpenSpec 工作流 + Superpowers 流程 + UI skills + 桌面端可选方向 + 可复用 skills 库 | **是，重大重设计** |
| P1-P5 | CLI 助手 / 文档抽取 / Context 管理 / RAG / ReAct Agent | 无直接新增内容 | 否 |
| P7-P16 | 弹性框架 / 知识管家 / 沙箱 / 深度研究 / 多 Agent 团队 / 多模态 / 质量安全 / 架构设计 / 生产部署 / 毕业设计 | 无直接新增内容 | 否 |
| P18 | 收款闭环 + 单位经济仪表盘 | 可提及用 OpenSpec 写支付集成的 spec | 微调 |
| P19 | 上线运营 + 增长循环 | 无直接新增内容 | 否 |

### P6 重设计

**原交付物**：
- 多工具 Agent（搜索/代码/DB/文件）
- 独立的 MCP Server（含 tools+resources）
- MCP 客户端接入演示
- 工具调用链追踪面板

**新增交付物**：
- **Skills 注册中心**：将工具按"能力包"组织为 Skills（如 `research` skill 包含搜索+抓取+总结三个工具）
- **Skill 动态调度**：Agent 按意图匹配 Skill，而非直接匹配工具
- **Skill 级别上下文隔离**：每个 Skill 加载时注入独立的 System Prompt
- **对比报告**：Function Calling（直接调工具）vs Skills（调能力包）的架构对比

**stack 更新**：`Python / Function Calling / MCP SDK (1.x) / SQLite / Skill Registry`

### P17 重大重设计

**原交付物**：
- 可访问的线上应用（含域名或托管地址）
- 规格文档与验收用例
- 前端 UI 状态矩阵自检表
- 测试套件与 CI/CD 流水线
- AI 参与度与返工点记录

**重设计后交付物**：

1. **OpenSpec 工作流产物**（必选）：
   - `openspec/` 目录完整结构：proposal.md + specs/ + design.md + tasks.md
   - 至少一个已完成并归档的 change（`openspec/changes/archive/`）
   - `/opsx:explore` 探索记录（至少 2 次探索对话摘要）

2. **Superpowers 流程产物**（必选）：
   - brainstorming 输出（需求头脑风暴记录）
   - writing-plans 输出（实现计划，含 TDD 任务拆分）
   - subagent-driven-development 执行记录（至少 3 个并行 subagent 任务）
   - code-review 记录（至少 2 次 review 闭环）

3. **UI Skills 约束产物**（必选）：
   - 设计 token 定义文件（颜色、圆角、间距、字体、阴影）
   - UI 质量检查报告（a11y + 响应式 + 状态矩阵）
   - 修复前后截图对比

4. **可复用 Skills 库**（必选）：
   - 至少 3 个自建 skills（如 `feature-spec` skill、`ui-review` skill、`deploy-checklist` skill）
   - 每个 skill 含 `SKILL.md`（触发条件+执行指令）
   - 使用说明文档

5. **线上应用**（必选）：
   - 可访问的 Web 应用（含域名或托管地址）
   - 或桌面端 Agent 原型（Electron + Python 后端，含打包产物）

6. **CI/CD + 测试**（必选）：
   - 测试套件 + CI/CD 流水线
   - AI 参与度与返工点记录（含 OpenSpec 和 Superpowers 在流程中的介入点分析）

**stack 更新**：`Python / React / OpenSpec / Superpowers / UI Skills / GitHub Actions / AI Coding`

### P18 微调

在 P18 的交付物中增加：
- 支付集成的 OpenSpec spec（可选，作为"如何用 spec 管理高风险功能"的示范）

---

## 八、知识点全面性、正确性、厚薄合理性（问题 5）

### 8.1 覆盖良好的领域

LLM 基础、Prompt 工程、上下文工程、RAG、Agent 核心、工具使用、Harness 工程化、记忆系统、代码沙箱、框架编排、多智能体、多模态、评估/护栏/测试/可观测性、架构设计、生产运维。

### 8.2 缺失或薄弱的知识点

| 缺失知识点 | 严重程度 | 建议 |
|-----------|---------|------|
| **Agent Skills 调用机制** | 高 | 新增 L06-07/L06-08（见第四节） |
| **Agent 桌面端应用** | 高 | 新增 L17-11/L17-12（见第五节） |
| **AI Coding 工作流框架（OpenSpec+Superpowers+Harness）** | 高 | 新增 L17-13/L17-14（见第六节） |
| **开源模型本地部署**（Ollama/vLLM/llama.cpp） | 高 | L17-11 覆盖 |
| **结构化输出解析库**（instructor、Pydantic、outlines） | 中 | L02-04 或 L06-01 补充 |
| **Agent 日志系统设计** | 中 | M15 监控章节补充 |
| **异步 Python 在 Agent 中的应用**（asyncio） | 中 | L06-03 加入 asyncio 实战 |
| **WebSocket / SSE 实时通信深入** | 中 | L10-05 深入 |
| **Agent API 鉴权与安全** | 中 | M15 或 M13 增加 |
| **多租户数据隔离实战** | 低 | L14-05 增加代码示例 |
| **Agent 的数据库设计** | 中 | M8 或 M7 补充 |
| **Langfuse / Arize 可观测性平台实战** | 中 | L13-03 增加 |
| **Agent 性能测试与压测** | 中 | M15 补充 locust/k6 |
| **Prompt 注入防御纵深** | 低 | L13-05 增加红队 checklist |
| **Dify / Coze / Flowise 低代码平台** | 低 | M10 框架全景图提一句 |

### 8.3 知识点正确性

从抽样的内容来看（L17-01、L17-03、L17-04、L14-01、L16-04），知识点正确性高，没有发现技术错误。值得肯定的是：

- L17-01 的三类委托方式判断框架清晰实用
- L17-03 的规格六段式模板工程上可直接复用
- L17-04 的三层上下文模型（项目约定/任务相关/负面约束）准确
- L14-01 的 ADR 模板和加权决策矩阵方法论正确

### 8.4 厚薄合理性

| 阶段 | 模块 | 节数 | 平均行数 | Python 代码块 | 交互组件 | 评价 |
|------|------|------|---------|-------------|---------|------|
| 筑基 | M1-M2 | 9 | 245 | 48 | 4 | 合理 |
| 上下文 | M3-M4 | 12 | 229 | 65 | 4 | 合理 |
| Agent 核心 | M5-M6 | 12→14 | 237 | 46 | 2 | M5 仅 1 个交互组件 |
| 工程化 | M7-M10 | 21 | 242 | 106 | 5 | 合理，M9 偏轻（4 节） |
| 多智能体 | M11-M12 | 10 | 249 | 54 | 3 | 合理 |
| 质量架构 | M13-M16 | 24 | 258 | 77 | 4 | M13 厚重，M14/M16 代码少 |
| 独立开发 | M17-M19 | 22→32 | 185 | 28 | 3 | **明显偏薄，代码密度低** |

**主要厚薄问题**：
1. M17-M19 内容偏薄（平均 185 行/节 vs 全站平均 239 行/节），新增 4 节课后可缓解
2. M13 过于厚重（8 节课、16 小时），评估/护栏/安全/测试/可观测性塞在一个模块
3. M14 架构设计代码太少（6 个 Python 代码块，4 节纯理论）
4. M16 毕业设计偏轻（4 节课、8 小时）
5. M9 代码沙箱偏轻（4 节课）

---

## 九、Agent 设计模式章节（新增问题 1）

### 专业判断：需要增加，但只需要 1 节课放在 M5 末尾

#### 现状分析

当前课程中，Agent 设计模式是**隐式分散**在多个模块中的：

| 模式 | 当前覆盖位置 | 覆盖方式 |
|------|------------|---------|
| ReAct（推理-行动循环） | M5 L05-02, L05-03 | 作为"Agent 内核"讲，未命名"设计模式" |
| Plan-and-Execute | M5 L05-04 | 作为"任务分解"讲 |
| Reflection / Self-Refine | M5 L05-05 | 作为"自我反思"讲 |
| Tool Use / Function Calling | M6 全部 | 作为"工具使用"讲 |
| Prompt Chaining | 无 | 未覆盖 |
| Routing（意图分类→分发） | 无 | 未覆盖，与 Supervisor 不同 |
| Parallelization | M6 L06-03 | 作为"并行工具调用"讲，但未抽象为模式 |
| Orchestrator-Workers | M11 L11-02 | 作为"Supervisor 模式"讲，但侧重多 Agent |
| Evaluator-Optimizer | 无 | 未覆盖，与 Reflection 不同（Reflection 是自我批评，Evaluator-Optimizer 是外部评估者+迭代优化者） |
| HITL（Human-in-the-Loop） | M10 L10-03 | 作为"人工介入编排"讲 |

**核心问题**：学习者学完 M5-M11 后，脑子里有一堆分散的技术点（ReAct、Plan-Execute、Supervisor、Debate……），但没有一个**统一的分类框架**来组织它们。这导致：
- 不知道"我该用哪个模式"——决策靠直觉
- 不知道"这些模式之间是什么关系"——看不出层级和组合
- 不知道"还有哪些模式我没学过"——知识盲区不自知

Anthropic 2024 年 12 月的 _Building effective agents_ 文章将 Agent 设计模式归纳为 5 类：**Prompt Chaining、Routing、Parallelization、Orchestrator-Workers、Evaluator-Optimizer**。这是业界最权威的分类框架之一，但课程完全没有引用或借鉴。

#### 推荐方案：新增 L05-07（放在 M5 末尾），1 节课

**为什么不新增完整模块**：
- 设计模式分散在 M5-M11 是合理的——因为每个模式需要不同的前置知识（工具、编排、多 Agent 协作）
- 新增模块会打乱已有的模块编号和阶段划分，影响面太大
- 1 节"全景分类"课放在 M5 末尾，后续模块各节引用回去，成本最低、收益最大

**位置**：M5 末尾，L05-06 "何时该用 Agent，何时不该用" 之后。逻辑链路：
- L05-02/03：ReAct 模式（从零实现）
- L05-04：Plan-and-Execute 模式
- L05-05：Reflection 模式
- L05-06：**什么时候**该用 Agent（决策框架）
- **L05-07：用**什么模式**来设计 Agent（模式选择框架）← 新增

#### L05-07（新增）：Agent 设计模式全景

**内容**（45 分钟，类型：理论+复盘）：

1. **为什么需要设计模式**（5 分钟）：
   - Agent 开发不是每次都从零发明架构
   - 设计模式 = 经过验证的、可复用的架构模板
   - 类比：GoF 设计模式之于 OOP，Agent 设计模式之于 AI Agent

2. **五大基础模式**（20 分钟，对应 Anthropic 分类）：
   - **Prompt Chaining**：A 的输出 → B 的输入。适用：可拆成固定子任务的流程。示例：写文档→翻译→格式化
   - **Routing**：分类意图 → 分发到专门的处理者。适用：输入类型差异大、各自需要不同处理。示例：客服问题分类（退换货/技术咨询/投诉）→ 不同 handler
   - **Parallelization**：同时执行多个子任务 → 聚合结果。适用：可并行的独立子任务。示例：同时搜索多个数据源→合并去重。分两种：Sectioning（分块并行）和 Voting（多路投票）
   - **Orchestrator-Workers**：中央规划者动态拆任务 → 派发给多个 worker。适用：子任务无法预知、需动态规划。示例：深度研究 Agent（规划→派搜索→派总结→派综合）
   - **Evaluator-Optimizer**：生成者产出 → 评估者打分 → 反馈 → 生成者改进 → 循环。适用：有明确质量标准的任务。示例：代码生成→review→修改→再 review

3. **模式与课程模块的映射**（10 分钟）：
   - 用一张架构图展示所有模式及其在课程中的位置
   - Prompt Chaining → M2 Prompt 工程
   - Routing → M6 工具使用（Function Calling 做意图分类）
   - Parallelization → M6 并行工具调用 + M11 多 Agent
   - Orchestrator-Workers → M11 Supervisor / CrewAI
   - Evaluator-Optimizer → M5 Reflection + M13 评估
   - HITL → M10 人工介入
   - **让学习者看到"全景地图"**，知道自己学过的和还没学的各在什么位置

4. **模式选择决策树**（10 分钟）：
   ```
   任务可以预定义步骤？
     ├─ 是 → Prompt Chaining
     └─ 否 → 需要动态决策？
              ├─ 子任务可以并行？
              │   ├─ 是 → Parallelization
              │   └─ 否 → 需要动态拆任务？
              │            ├─ 是 → Orchestrator-Workers
              │            └─ 否 → 有明确质量门禁？
              │                     ├─ 是 → Evaluator-Optimizer
              │                     └─ 否 → Routing（按意图分发）
              └─ ...
   ```
   - 用交互组件 `patternSelector` 让学习者输入任务描述，自动推荐模式

**时长**：45 分钟，类型：复盘

**先修课**：L05-06（何时该用 Agent）

**competency**：架构决策

**交互组件**：`patternSelector`（新增，模式选择决策树交互）

---

## 十、商业化部分借助 Skills 辅助赋能（新增问题 2）

### 专业判断：需要增加，M18 + 1 节，M19 + 1 节

#### 现状分析

M18（产品化与商业模式）和 M19（运营增长与长期经营）目前是纯"商业知识"授课，几乎没有 Python 代码和 AI 工具实战。例如：

- L18-01 选品验证：讲了落地页/预售/人工替身做验证，但没讲"用 AI 做竞品扫描"
- L18-03 定价：讲了订阅/用量/买断的对比，但没讲"用 AI 辅助定价建模"
- L18-06 合规：讲了隐私条款，但没讲"用 AI 生成合规检查清单"
- L19-02 SEO：讲了内容策略，但没讲"用 AI 做关键词研究和内容规划"
- L19-03 数据驱动增长：讲了漏斗分析，但没讲"用 AI 做数据洞察"

**M19-L05 "自动化运营：用 Agent 经营你的 Agent 产品"** 已经涉及了"用 Agent 做运营自动化"，但侧重的是**操作层**（监控、报表、支持初筛）。M18 和 M19 其他课程缺少的是**策略层**——用 AI 辅助做商业决策本身。

**核心洞察**：M17 教了 OpenSpec + Superpowers 工作流，这个工作流不仅适用于写代码，同样适用于做商业决策。一个独立开发者可以用同样的"探索→提案→执行→归档"流程来做：
- 竞品分析（OpenSpec explore → Superpowers brainstorming）
- 定价决策（OpenSpec propose → 生成定价方案+财务模型）
- 增长实验（OpenSpec propose → Superpowers parallel agents 执行多渠道实验）

#### 推荐方案：M18 新增 L18-07，M19 新增 L19-07

##### L18-07（新增）：用 AI Skills 辅助产品化决策

**内容**（45 分钟，类型：实战）：

1. **AI 辅助选品与需求验证**（15 分钟）：
   - 用 Superpowers brainstorming + web search 做竞品扫描
   - Prompt 模板：`"我要做 X 产品，请列出 5 个最接近的竞品，分析它们的定价、核心功能、用户评价、以及你觉得它们没做好的地方。只列事实，不要推销。"`
   - 用 AI 生成 landing page 文案和 A/B 测试变体
   - 用 AI 分析用户访谈记录，提取需求模式

2. **AI 辅助定价与商业模式设计**（15 分钟）：
   - 用 AI 做定价敏感度分析：`"这是我的成本结构 [X]，竞品定价 [Y]，目标用户画像 [Z]。请设计 3 种定价方案，并分析各自的优缺点和适用条件。"`
   - 用 AI 做财务模型：`"基于以下假设 [订阅价格/预期转化率/流失率]，请建一个 12 个月的收入预测模型（Python），输出月度 MRR 和累计收入。"`
   - 用 OpenSpec 管理定价变更：定价调整 → propose → 评估影响 → 灰度发布

3. **AI 辅助合规检查**（15 分钟）：
   - 用 AI 生成合规检查清单：`"我做的产品是 [X]，收集以下数据 [Y]，面向 [Z] 地区用户。请列出我需要关注的合规事项清单，按风险等级排序。"`
   - 注意：AI 生成的合规建议**不构成法律意见**，但可以作为"被提醒了才知道该去查什么"的起点
   - 用 AI 生成隐私政策草稿（标注"需律师审核"）

**时长**：45 分钟，类型：实战

**先修课**：L17-13（OpenSpec 工作流）、L18-01 至 L18-06

##### L19-07（新增）：用 AI Skills 驱动增长运营

**内容**（45 分钟，类型：实战）：

1. **AI 辅助内容营销与 SEO**（15 分钟）：
   - 用 AI 做关键词研究：`"我的产品是 [X]，目标用户是 [Y]。请列出 20 个他们会在 Google 搜索的长尾关键词，按搜索意图分类（信息型/对比型/购买型），并标注难度估计。"`
   - 用 AI 生成内容日历：每周一篇，覆盖不同搜索意图，形成内容矩阵
   - 用 OpenSpec 管理内容 pipeline：`specs/content-seo.md` 定义内容质量标准，每篇内容走 propose→apply→archive

2. **AI 辅助增长实验设计**（15 分钟）：
   - 用 Superpowers brainstorming 发散增长假设：`"我的产品当前转化率是 X%，请列出 10 个可能提升转化率的实验假设，按预期影响和实现成本排序。"`
   - 用 AI 写实验设计文档：假设、变量、样本量、成功标准、实验时长
   - 用 Superpowers parallel agents 同时跑多个实验的文案/设计/代码

3. **AI 辅助用户反馈分析**（15 分钟）：
   - 把用户反馈批量喂给 AI，提取主题、情感、优先级
   - 用 AI 做 feedback → issue → roadmap 的自动转化（L19-04 的用户支持进阶）
   - 用 OpenSpec 管理产品迭代：用户反馈 → `/opsx:explore` → `/opsx:propose` → 纳入 roadmap

**时长**：45 分钟，类型：实战

**先修课**：L17-13（OpenSpec 工作流）、L19-01 至 L19-06

#### 对 M18/M19 课程结构的影响

| 模块 | 当前课时 | 变更后 | 变化 |
|------|---------|--------|------|
| M18 | 6 | 7 | +1（L18-07） |
| M19 | 6 | 7 | +1（L19-07） |

---

## 十一、深度审查发现的其他问题

### 9.1 交互组件分布严重不均

M01 有 3 个交互组件，但 M05（Agent 核心！）只有 1 个。M13（8 节课）只有 1 个。核心模块应至少各有 2-3 个交互组件。

### 9.2 课程讲授语言与实际代码不一致

全站声称"Python 主线"，但 M17 前端章节使用了 JS/TS/React 代码。需要在章节开头明确标注"前端特例"。

### 9.3 缺少"Agent 开发环境搭建"的系统性指导

L01-03 讲了 API 调用，但没有系统讲 Python 虚拟环境、依赖管理（poetry/uv）、项目结构。

### 9.4 缺少"Agent 项目模板/脚手架"

全课程 19 个项目，每个都从零开始，没有统一的项目模板。学习者学完 M7 后，每次新建 Agent 项目都要重复配置基础设施。

### 9.5 缺少"学习路径指南"

不同背景的学习者进入课程的路径不同，没有提供"如果你已经会 X，可以从 Y 模块开始"的指南。

### 9.6 "要点总结"质量参差不齐

部分课程的要点总结是 7 条精炼 bullet point，部分只有 3-4 条概括性描述。

### 9.7 缺少"常见问题 FAQ"或"踩坑记录"

全课程没有 FAQ 章节。学习者在实践时遇到的常见错误没有集中记录。

---

## 十、优先级排序的改进清单

### P0（影响课程核心质量，立即修复）

| # | 事项 | 涉及文件 | 类型 |
|---|------|---------|------|
| 1 | 新增 L05-07：Agent 设计模式全景 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 2 | 新增 L06-07：Agent Skills 系统 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 3 | 新增 L06-08：Skill 注册中心与动态调度 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 4 | 新增 L17-11：Agent 桌面端应用架构 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 5 | 新增 L17-12：用 AI Coding 交付桌面端 Agent 原型 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 6 | 新增 L17-13：OpenSpec 规格驱动 + Superpowers 流程控制 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 7 | 新增 L17-14：Harness 质量门禁：三级防线让 AI 产出可控 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 8 | 新增 L17-15：生产级 UI 约束 Skills | `curriculum.ts` + 新内容文件 | 新增内容 |
| 9 | 新增 L18-07：用 AI Skills 辅助产品化决策 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 10 | 新增 L19-07：用 AI Skills 驱动增长运营 | `curriculum.ts` + 新内容文件 | 新增内容 |
| 11 | **P6 项目重设计**：增加 Skills 注册中心 + 动态调度 | `curriculum.ts` | 修改数据 |
| 12 | **P17 项目重设计**：OpenSpec + Superpowers + UI Skills + 可复用 skills 库 | `curriculum.ts` | 修改数据 |
| 13 | 新增 `ArchitectureDiagram` 通用架构图组件 | 新组件文件 | 新增组件 |
| 14 | 新增 7 个 P0 架构图组件（含 OpenSpecWorkflowDiagram、PatternMapDiagram） | 新组件文件 | 新增组件 |
| 15 | 新增 `patternSelector` 交互组件（设计模式决策树） | 新组件文件 | 新增组件 |
| 16 | 清理 TypeScript 代码 | 多个内容文件 | 修改内容 |
| 17 | M17-M19 现有内容增厚（平均 185→220+ 行） | M17-M19 内容文件 | 修改内容 |

### P1（提升课程完整性和学习者体验）

| # | 事项 | 涉及文件 | 类型 |
|---|------|---------|------|
| 18 | 建立 Skills 能力进阶体系 | `types.ts` + 阶段页面 | 修改代码 |
| 19 | M14/M16 增加代码示例 | 内容文件 | 修改内容 |
| 20 | 补充缺失知识点（开源模型部署、结构化输出库、异步 Python、Agent 日志） | 多个内容文件 | 修改内容 |
| 21 | 新增"Agent 开发环境搭建"内容（L01-03 扩充） | 内容文件 | 修改内容 |
| 22 | 在 M17 前端章节标注"前端特例" | 内容文件 | 修改内容 |
| 23 | 实现 P1 优先级架构图组件（7 个） | 新组件文件 | 新增组件 |
| 24 | **P18 微调**：增加 L18-07 对应的项目扩展（可选） | `curriculum.ts` + 内容文件 | 修改内容 |

### P2（锦上添花）

| # | 事项 | 涉及文件 | 类型 |
|---|------|---------|------|
| 25 | 增加"学习路径指南"和阶段性能力清单 | 页面组件 | 新增功能 |
| 26 | 交互组件分布均衡化（M5/M10/M13 各增加 1-2 个） | 新组件文件 | 新增组件 |
| 27 | 增加 FAQ / 踩坑记录 | 内容文件 | 新增内容 |
| 28 | 提供 Agent 项目脚手架 | 项目模板 | 新增内容 |
| 29 | 统一"要点总结"质量标准 | 内容文件 | 修改内容 |
| 30 | M16-L04 growthMap 前移到 M1 开头 | 页面组件 | 修改代码 |
| 31 | 架构图组件 P2 批次（5 个） | 新组件文件 | 新增组件 |

---

## 十二、附录：课程规模变化汇总

| 项目 | 当前 | 计划变更后 |
|------|------|-----------|
| 模块数 | 19 | 19 |
| 课时数 | 109 | 109 + 10 = **119** |
| 项目数 | 19 | 19（P6 和 P17 重设计） |
| 总时长 | ~200h | ~215h |
| 交互组件 | 24 | 24 + 17（架构图）+ 1（patternSelector）+ 1（gateConfigurator） = **43** |
| 新增目录 | — | `src/components/diagrams/` |

### 各模块课时变化

| 模块 | 当前课时 | 变更后 | 变化 |
|------|---------|--------|------|
| M5 | 6 | 7 | +1（L05-07） |
| M6 | 6 | 8 | +2（L06-07, L06-08） |
| M17 | 10 | 15 | +5（L17-11 至 L17-15） |
| M18 | 6 | 7 | +1（L18-07） |
| M19 | 6 | 7 | +1（L19-07） |
| 其余 14 个模块 | 不变 | 不变 | 0 |
| **合计** | **109** | **119** | **+10** |

### 项目变更汇总

| 项目 | 变更类型 | 变更内容 |
|------|---------|---------|
| P6 | 扩展 | 新增 Skills 注册中心 + 动态调度交付物 |
| P17 | 重大重设计 | OpenSpec 工作流 + Superpowers 流程 + UI Skills + 可复用 skills 库 + 桌面端可选方向 |
| P18 | 微调 | 可选：AI Skills 辅助产品化决策记录 |

### 新增课程总览

| 编号 | 标题 | 所属模块 | 时长 | 类型 |
|------|------|---------|------|------|
| L05-07 | Agent 设计模式全景 | M5 | 45min | 复盘 |
| L06-07 | Agent Skills 系统：从 Function Calling 到技能注册 | M6 | 40min | 理论 |
| L06-08 | 构建 Skill 注册中心与动态调度 | M6 | 50min | 实战 |
| L17-11 | Agent 桌面端应用架构 | M17 | 45min | 理论 |
| L17-12 | 用 AI Coding 交付一个桌面端 Agent 原型 | M17 | 55min | 实战 |
| L17-13 | OpenSpec 规格驱动 + Superpowers 流程控制 | M17 | 50min | 实战 |
| L17-14 | Harness 质量门禁：三级防线让 AI 产出可控 | M17 | 75min | 实战 |
| L17-15 | 生产级 UI 约束：用 Skills 让 AI 产出美观可用的前端 | M17 | 70min | 实战 |
| L18-07 | 用 AI Skills 辅助产品化决策 | M18 | 45min | 实战 |
| L19-07 | 用 AI Skills 驱动增长运营 | M19 | 45min | 实战 |

---

## 十二、执行计划

### 阶段一：数据结构与基础设施（先改真源）

**Step 1.1** 更新 `src/data/types.ts`
- 新增 `SkillLevel` 类型
- 在 `Lesson` 中增加 `skillLevel` 可选字段

**Step 1.2** 更新 `src/data/curriculum.ts`
- M5 新增 L05-07（Agent 设计模式全景）
- M6 新增 L06-07、L06-08 两节课（含 objectives、tags、prerequisites、competency）
- M17 新增 L17-11、L17-12、L17-13、L17-14、L17-15 五节课
- M18 新增 L18-07（用 AI Skills 辅助产品化决策）
- M19 新增 L19-07（用 AI Skills 驱动增长运营）
- 更新 M5、M6、M17、M18、M19 的 hours 字段
- **重设计 P6**：新增 deliverables 项（Skills 注册中心、动态调度、对比报告）
- **重设计 P17**：重写 deliverables、stack、summary
- **微调 P18**：可选增加 AI Skills 辅助产品化决策记录
- 更新相关模块描述

**Step 1.3** 更新 CLAUDE.md 和 README 中的规模数字
- 109 → 119 节课
- 同步更新 `pnpm check` C11 检查涉及的文档

### 阶段二：架构图基础设施

**Step 2.1** 创建 `src/components/diagrams/` 目录

**Step 2.2** 实现通用 `ArchitectureDiagram` 组件
- 支持定义层（layers）、节点（nodes）、边（edges）、数据流箭头
- 自适应暗/亮双主题
- 使用 CSS 变量颜色

**Step 2.3** 实现 P0 优先级架构图组件（7 个）
- `ReActLoopDiagram` — M5
- `RAGPipelineDiagram` — M4
- `ContextAssemblyDiagram` — M3
- `FunctionCallingSequence` — M6
- `CircuitBreakerDiagram` — M7
- `OpenSpecWorkflowDiagram` — M17 (L17-13/L17-14)
- `HarnessGatePipelineDiagram` — M17 (L17-14)
- `PatternMapDiagram` — M5（设计模式全景分类图）

**Step 2.4** 注册架构图组件到 `MarkdownRenderer.tsx` 的 `componentMap`

**Step 2.5** 在对应课程内容中插入 `::interactive{type="..."}` 引用

**Step 2.6** 实现 `patternSelector` 交互组件（M5 L05-07 使用）
- 设计模式决策树交互
- 学习者输入任务描述 → 推荐设计模式

### 阶段三：新增课程内容（P0 优先级）

**Step 3.1** 编写 L05-07 内容文件：`src/content/module-05/lesson-l05-07.md`
**Step 3.2** 编写 L06-07 内容文件：`src/content/module-06/lesson-l06-07.md`
**Step 3.3** 编写 L06-08 内容文件：`src/content/module-06/lesson-l06-08.md`
**Step 3.4** 编写 L17-11 内容文件：`src/content/module-17/lesson-l17-11.md`
**Step 3.5** 编写 L17-12 内容文件：`src/content/module-17/lesson-l17-12.md`
**Step 3.6** 编写 L17-13 内容文件：`src/content/module-17/lesson-l17-13.md`
**Step 3.7** 编写 L17-14 内容文件：`src/content/module-17/lesson-l17-14.md`
**Step 3.8** 编写 L17-15 内容文件：`src/content/module-17/lesson-l17-15.md`
**Step 3.9** 编写 L18-07 内容文件：`src/content/module-18/lesson-l18-07.md`
**Step 3.10** 编写 L19-07 内容文件：`src/content/module-19/lesson-l19-07.md`

### 阶段四：项目重设计（P0 优先级）

**Step 4.1** 重写 P6 项目内容文件：`src/content/module-06/project-p6.md`
- 增加 Skills 注册中心架构说明
- 增加 Skill 动态调度实现步骤
- 增加 Function Calling vs Skills 对比报告要求

**Step 4.2** 重写 P17 项目内容文件：`src/content/module-17/project-p17.md`
- 增加 OpenSpec 工作流步骤（explore → propose → apply → archive）
- 增加 Superpowers skills 使用要求
- 增加 UI Skills 约束要求
- 增加可复用 skills 库交付物
- 增加桌面端可选方向
- 增加 AI 参与度记录（含 OpenSpec 和 Superpowers 介入点分析）

**Step 4.3** 微调 P18 项目内容文件：`src/content/module-18/project-p18.md`
- 可选：AI Skills 辅助产品化决策记录（竞品分析、定价建模、合规检查清单）

### 阶段五：TypeScript 清理与内容修复

**Step 5.1** 清理 L01-03 的 TypeScript 代码和描述
**Step 5.2** 清理 L02-01 的 TypeScript 模板示例
**Step 5.3** 修改 L17-06 的 TypeScript 判别联合讨论
**Step 5.4** 修改 P1、P6、P17 的 stack 字段
**Step 5.5** 在 M17 前端章节标注"前端特例"
**Step 5.6** 更新 CLAUDE.md 中 C15 的白名单逻辑

### 阶段六：内容增厚（P0 优先级）

**Step 6.1** M17 现有 10 节课增厚（平均 185→220+ 行）
**Step 6.2** M18 现有 6 节课增厚（平均 179→200+ 行）
**Step 6.3** M19 现有 6 节课增厚（平均 182→200+ 行）

### 阶段七：P1 优先级改进

**Step 7.1** 实现 Skills 能力进阶体系（页面展示）
**Step 7.2** M14/M16 增加 Python 代码示例
**Step 7.3** 补充缺失知识点（开源模型部署、结构化输出库、异步 Python、Agent 日志）
**Step 7.4** 新增"Agent 开发环境搭建"内容
**Step 7.5** 实现 P1 优先级架构图组件（7 个）
**Step 7.6** 在对应课程内容中插入架构图引用

### 阶段八：P2 优先级改进

**Step 8.1** 增加"学习路径指南"
**Step 8.2** 交互组件分布均衡化
**Step 8.3** 增加 FAQ / 踩坑记录
**Step 8.4** 提供 Agent 项目脚手架
**Step 8.5** 统一"要点总结"质量标准
**Step 8.6** growthMap 前移到 M1 开头
**Step 8.7** 实现 P2 优先级架构图组件（5 个）

### 阶段九：校验与收尾

**Step 9.1** 运行 `pnpm check` 确保所有检查项通过
**Step 9.2** 更新 C1-C15 检查项适配新规模
**Step 9.3** 运行 `pnpm build` 确保构建通过
**Step 9.4** 运行 `pnpm dev` 手动验证所有新增页面和组件