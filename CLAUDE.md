# AI Agent 开发课程站点

## 项目概述

Vite + React 18 + TypeScript + Tailwind CSS 3 + React Router 6 构建的 AI Agent 开发课程站点。
20 个模块、126 节课、20 个实战项目，7 大阶段，暗/亮双主题。

> 这组数字由 `pnpm check` 的 C11 检查项守护，改动课程数据后请同步更新本行与 README。

## 常用命令

```bash
pnpm dev          # 启动开发服务器
pnpm check        # 课程一致性校验（零依赖，改完内容/数据必跑）
pnpm build        # 构建（check + tsc + vite）
```

## 课程一致性校验

`scripts/check-curriculum.mjs` 把课程审查中发现的每一类问题固化成了自动检查，
`pnpm build` 与 CI 都会先跑它。加 `--strict` 可把 warning 一并升级为 error。

| 检查项 | 内容 | 级别 |
|--------|------|------|
| C1 | `module.hours === Math.round(Σ lesson.duration / 60 + project.hours)` | error |
| C2 | 内容里 `::interactive` 引用的组件已注册且组件文件存在 | error |
| C3 | 每个模块至少含 1 个交互组件 | warn |
| C4 | 无"已注册但零引用"的孤儿组件 | warn |
| C5 | 模型标识在白名单内（白名单读自 `src/data/models.ts`） | error |
| C6 | 每节课含"要点总结" | error |
| C7 | 每节课含"动手 5 分钟"练习 | warn |
| C8 | 每节课不少于 150 行 | warn |
| C9 | `curriculum.ts` 与 `.md` 文件一一对应，无孤儿文件 | error |
| C10 | 本文件的交互组件表与 `componentMap` 一致 | error |
| C11 | README 与本文件里的规模数字与课程数据一致 | error |
| C12 | `Record<联合类型, …>` 映射与联合类型定义同步（把 tsc 的这条规则前移） | error |
| C13 | `stages` 区间连续且覆盖全部模块，全站阶段数表述一致 | error |
| C14 | `models.ts` 的模型白名单校准日期未超过 180 天 | warn |
| C15 | 文案不承诺做不到的语言覆盖（Python 主线） | error |
| C16 | 静态图边的 source/target 必须存在于该图节点集 | error |
| C17 | 静态图不允许入度=出度=0 的孤立节点（annotation 豁免） | error |
| C18 | 静态图显式 `width` 必须落在 size 类 `[min,max]` 区间 | error |
| C19 | 静态图节点包围盒不得重叠、不得超出所属泳道 | error |
| C20 | 边未显式指定端口时报 warn（运行时由 `layoutEdges` 推断） | warn |
| C21 | 内容 Markdown 不得含 NUL / 二进制污染字节 | error |

## 模块开发工作流

用户通过 `/module <N>` 指令操作指定模块。模块编号 1-16。

### 子命令

| 指令 | 行为 |
|------|------|
| `/module N status` | 显示模块 N 的 lesson 列表和开发完成状态 |
| `/module N create` | 为模块 N 中所有待开发的 lesson 创建 `.md` 内容文件 |
| `/module N review` | 审核模块 N 所有 lesson 内容的质量（完整性、代码正确性、中文表述） |

### 内容文件约定

- 路径：`src/content/module-0N/lesson-l0N-0X.md`
- 模块编号补零到 2 位，lesson ID 使用小写
- 每个 `.md` 文件包含完整的课程正文（图文+交互组件）
- 交互组件语法：`::interactive{type="组件名"}`

### 交互组件类型

| type | 组件 | 用途 |
|------|------|------|
| tokenizer | TokenizerDemo | Token 分词演示 |
| temperature | TemperatureSampler | 温度参数采样演示 |
| promptTester | PromptTemplateTester | Prompt 模板测试器 |
| agentLoop | AgentLoopVisualizer | ReAct 循环可视化 |
| embedding | EmbeddingExplorer | 向量相似度搜索演示 |
| harnessMonitor | HarnessMonitor | Agent 健壮性实时监控面板 |
| sandboxDemo | SandboxDemo | 代码沙箱安全执行演示 |
| multimodalDemo | MultiModalDemo | 多模态输入输出对比 |
| chunking | ChunkingVisualizer | 三种分块策略切分结果对比 |
| ragPipeline | RAGPipelineDemo | RAG 七道工序单步执行 |
| contextBudget | TokenBudgetPlanner | 上下文窗口预算分配 |
| toolSchema | ToolSchemaDesigner | 工具 schema 设计对照 |
| memoryLayers | MemoryLayersDemo | 记忆四层路由演示 |
| graphOrchestrator | GraphStateMachine | 图状态机执行轨迹 |
| topology | MultiAgentTopology | 多智能体拓扑对比 |
| guardrail | GuardrailTester | 护栏分层拦截测试 |
| tradeoff | TradeoffMatrix | 架构加权决策矩阵 |
| costLatency | CostLatencyOptimizer | 成本/延迟/质量三角 |
| growthMap | GrowthMapChecklist | 架构师能力自评地图 |
| modelTiers | ModelTierTable | 模型档位与标识对照（数据来自 models.ts） |
| uiStateMatrix | UIStateMatrix | 前端 UI 状态矩阵覆盖自检 |
| costModel | UnitEconomicsModel | 单位经济模型与毛利率推演 |
| growthFunnel | GrowthFunnelSim | 增长漏斗与留存复利模拟 |
| patternSelector | PatternSelector | 设计模式选择决策树交互 |
| gateConfigurator | GateConfigurator | 交互式门禁配置器 |
| acceptanceChecklist | AcceptanceChecklist | 项目验收自检清单 |
| aiCodingBoundary | AICodingBoundary | AI 编码边界决策树 |
| refactorDiffer | RefactorDiffer | 重构前后代码快照对比 |
| testPyramid | TestPyramidSim | 测试金字塔配比模拟器 |
| contextAssemblyViz | ContextAssemblyViz | 上下文预算分配可视化 |
| redTeamTarget | RedTeamTarget | 注入攻防红队靶场 |
| mcpStatus | MCPStatusPanel | MCP 连接与发现状态面板 |
| codeReviewFailures | CodeReviewFailureModes | AI 代码审查失败模式对照器 |
| specTemplate | SpecTemplateBuilder | 规格六段式模板生成器 |
| sandboxCompare | SandboxStrategyCompare | 沙箱方案谱系对比 |
| a11yCheck | A11yChecker | 无障碍自检清单 |
| conventionCheck | ConventionChecker | 代码约定检查配置器 |
| llmJudgeBias | LLMJudgeBias | LLM-as-Judge 偏倚对照器 |
| traceVisualizer | TraceVisualizer | Trace 调用链可���化 |
| sandboxPolicy | SandboxPolicyConfigurator | 沙箱安全策略配置器 |
| reActLoop | ReActLoopDiagram | ReAct 循环状态图 |
| ragPipelineDiagram | RAGPipelineDiagram | RAG 数据流架构图 |
| contextAssembly | ContextAssemblyDiagram | Context 组装流程图 |
| functionCalling | FunctionCallingSequence | Function Calling 调用链泳道图 |
| circuitBreaker | CircuitBreakerDiagram | Circuit Breaker 三态转换图 |
| openSpecWorkflow | OpenSpecWorkflowDiagram | OpenSpec + Superpowers 工作流全貌 |
| harnessGatePipeline | HarnessGatePipelineDiagram | Harness 门禁管道全景图 |
| patternMap | PatternMapDiagram | Agent 设计模式全景分类图 |
| memoryLayersDiagram | MemoryLayersDiagram | 记忆四层路由静态图 |
| langGraphState | LangGraphStateDiagram | LangGraph 状态图静态图 |
| hitlFlow | HITLFlowDiagram | Human-in-the-Loop 中断流程 |
| multiAgentTopologyDiagram | MultiAgentTopologyDiagram | 四种多 Agent 拓扑对比图 |
| supervisorPattern | SupervisorPatternDiagram | Supervisor 模式消息流 |
| deploymentArch | DeploymentArchDiagram | Agent 生产部署架构图 |
| agentPlatform | AgentPlatformDiagram | Agent 平台分层架构图 |
| cursorArch | CursorArchDiagram | Cursor Agent 模式架构拆解 |
| devinArch | DevinArchDiagram | Devin 自主编程架构拆解 |
| perplexityArch | PerplexityArchDiagram | Perplexity 搜索→推理→引用→生成架构 |
| growthEngine | GrowthEngineDiagram | 增长引擎循环 |

> 此表必须与 `src/components/MarkdownRenderer.tsx` 的 `componentMap` 保持一致，
> 由 `pnpm check` 的 C10 检查项守护。**不要在此表登记尚未实现的组件**——
> 曾出现过 chunkingDemo / ragPipeline 只写进文档却没有实现，导致内容引用悬空。
> 每个模块至少要有 1 个交互组件（C3），且不允许存在零引用的孤儿组件（C4）。

### 开发顺序

按模块 ID 递增，每个模块内的 lesson 也按顺序开发。
**约定：每个模块开发时，课程内容和项目内容必须一并补齐。**
当前进度：M1-M16（技术主线）全部开发完毕。M17（上，10 节课 + P17）已完���。M18（下，5 节课已完成 + 5 节新课待编写）。M19（产品化，7 节课已完成 + 1 节新课待编写）。M20（运营，7 节课已完成 + 1 节新课待编写）。全部 20 个模块框架已定义，7 节新课内容待编写。

## 关键文件结构

```
src/
  data/
    types.ts          # 课程数据类型定义
    curriculum.ts     # 完整课程大纲数据（含 stages 阶段划分，全站派生真源）
    models.ts         # 模型档位与标识白名单（C5/C14 的真源，换代时只改这里）
  content/            # 课程内容（Markdown 文件）
    module-01/
      lesson-l01-01.md
      ...
  components/
    interactive/      # 交互式教学组件
      TokenizerDemo.tsx
      TemperatureSampler.tsx
      ...
    MarkdownRenderer.tsx  # Markdown → React 渲染器
    CodeBlock.tsx
    Badges.tsx
  pages/
    HomePage.tsx
    CurriculumPage.tsx   # 课程大纲
    ModulePage.tsx       # 模块详情
    LessonPage.tsx       # 课程详情（新增）
    RoadmapPage.tsx
    ProjectsPage.tsx
```

## 主题系统

- 暗色为默认，`html.light` class 切换亮色
- CSS 变量定义在 `src/index.css` 的 `:root` 和 `html.light` 块
- 页面组件使用 `ink-*` / `brand-*` 色阶 class，自动适配主题
- 防闪烁脚本在 `index.html` 的 `<head>` 中
- `ThemeProvider` + `ThemeToggle` 在 `src/components/` 中

## 注意事项

- 课程没有视频，全是图文+交互组件
- 所有文本使用中文
- **代码主线是 Python**。Agent 生态在 Python 侧完整得多，课程重点是架构与工程而非语言。
  只有以下例外使用 TypeScript/React：前端集成/UI 相关内容（L17-05、L17-06）、桌面端 Electron 章节（L17-11、L17-12）。
  不要在任何地方承诺"双语言" —— 全站 438 个 Python 代码块 vs 16 个 TypeScript，
  假装双语言比坦白单语言伤害更大。C15 会守住这条。
- 不要使用 `@apply` 引用 CSS 变量颜色（Tailwind 3 会 bake 值）
- 亮色模式下代码高亮色在 `index.css` 中单独覆盖