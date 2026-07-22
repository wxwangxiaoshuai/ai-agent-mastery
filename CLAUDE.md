# AI Agent 开发课程站点

## 项目概述

Vite + React 18 + TypeScript + Tailwind CSS 3 + React Router 6 构建的 AI Agent 开发课程站点。
16 个模块、91 节课、16 个实战项目，7 大阶段，暗/亮双主题。

## 常用命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建（tsc + vite）
```

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
| chunkingDemo | ChunkingVisualizer | 分块策略可视化对比 |
| ragPipeline | RAGPipelineDemo | RAG 检索+生成全链路演示 |
| harnessMonitor | HarnessMonitor | Agent 健壮性实时监控面板 |
| sandboxDemo | SandboxDemo | 代码沙箱安全执行演示 |
| multimodalDemo | MultiModalDemo | 多模态输入输出对比 |

### 开发顺序

按模块 ID 递增，每个模块内的 lesson 也按顺序开发。
**约定：每个模块开发时，课程内容和项目内容必须一并补齐。**
当前进度：模块 1（4 节课 + P1）已完成，模块 2（5 节课 + P2）已完成。模块 3（6 节课 + P3）已完成。模块 4（6 节课 + P4）已完成。模块 5（6 节课 + P5）已完成。模块 6（6 节课 + P6）已完成。模块 7（5 节课 + P7）已完成。模块 8（5 节课 + P8）已完成。模块 9（4 节课 + P9）已完成。模块 10（6 节课 + P10）已完成。模块 11（5 节课 + P11）已完成。模块 12-16 待开发。

## 关键文件结构

```
src/
  data/
    types.ts          # 课程数据类型定义
    curriculum.ts     # 完整课程大纲数据
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
- 所有文本使用中文，代码示例使用 Python/TypeScript
- 不要使用 `@apply` 引用 CSS 变量颜色（Tailwind 3 会 bake 值）
- 亮色模式下代码高亮色在 `index.css` 中单独覆盖