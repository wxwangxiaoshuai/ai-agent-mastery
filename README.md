# AI Agent 大师之路

> 一套从零到架构师的 AI Agent 开发实战课程，以前端站点形式呈现。

## ✨ 项目简介

本课程面向希望从 AI Agent 开发小白成长为架构师专家的开发者，内容深入浅出、循序渐进，每一模块都配有实战项目。

- **20 大模块 / 126 节精讲课 / 20 个递进式实战项目 / 226 小时**
- 七阶段成长路径：筑基 → 上下文与知识 → Agent 核心 → 工程化与编排 → 多智能体与多模态 → 质量、架构与生产落地 → 独立开发与商业化
- 覆盖：LLM 基础、Prompt 工程、上下文工程、RAG、Agent 核心架构、工具/MCP、Harness 工程化、记忆系统、代码沙箱、框架编排、多智能体、多模态、评估/测试/护栏/安全、架构设计/案例拆解、生产架构/运维/SRE、Computer Use/A2A、毕业设计、AI Coding 工程实践、产品化与商业模式、运营与长期经营
- **代码主线为 Python**（Agent 生态在 Python 侧最完整）；L01-03 附一份 TypeScript 平行实现，前端集成相关内容使用 TypeScript/React

## 🚀 技术栈

- **Vite 5** — 极速构建与 HMR
- **React 18 + TypeScript** — 类型安全
- **Tailwind CSS 3** — 原子化样式与设计系统
- **React Router 6** — 客户端路由

## 📦 本地运行

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器 (http://localhost:5173)
pnpm check       # 课程一致性校验（时长/组件引用/文档同步等 11 项）
pnpm build       # 生产构建（会先跑 check）
pnpm preview     # 预览构建产物
```

## 🌐 发布到 GitHub Pages

本项目已配置 GitHub Actions 自动部署，推送到 `main` 或 `master` 分支后会自动构建并发布。

### 首次启用步骤（必做，否则 workflow 会 404）

GitHub **不会**自动开启 Pages，必须手动启用一次：

1. 打开 https://github.com/wxwangxiaoshuai/ai-agent-mastery/settings/pages
2. 找到 **Build and deployment → Source**
3. 从下拉框选择 **GitHub Actions**（不要选 “Deploy from a branch”）
4. 保存后，到 **Actions** 页重新运行 **Deploy to GitHub Pages**

> 若仓库是**私有**的，需要 GitHub Pro 及以上套餐才支持 Pages；公开仓库免费可用。

部署完成后访问：`https://wxwangxiaoshuai.github.io/ai-agent-mastery/`

### 常见错误

| 报错 | 原因 | 处理 |
|------|------|------|
| `Get Pages site failed ... Not Found` | Pages 未启用 | 按上方步骤在 Settings → Pages 选择 GitHub Actions |
| `Failed to create deployment (status: 404)` | 同上 | 同上 |
| Node 20 deprecated 警告 | 来自 GitHub 内置 Action，可忽略 | 不影响部署 |

### 用 API 一次性启用（Settings 页面找不到选项时）

在 https://github.com/settings/tokens 创建 Classic PAT，勾选 **repo** 权限，然后执行：

```bash
curl -X POST \
  -H "Authorization: Bearer <你的PAT>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/wxwangxiaoshuai/ai-agent-mastery/pages \
  -d '{"build_type":"workflow","source":{"branch":"main","path":"/"}}'
```

若默认分支是 `master`，把 `branch` 改成 `master`。返回 201 表示成功，再去 Actions 重跑 workflow。

### 本地预览 Pages 构建

若仓库名不是 `ai-agent-mastery`，构建时需指定 base path：

```bash
VITE_BASE_PATH=/你的仓库名/ pnpm build:pages
pnpm preview
```

> `build:pages` 会在构建后复制 `index.html` 为 `404.html`，以支持 React Router 的客户端路由刷新。

## 📂 目录结构

```
src/
├── components/     # 共享 UI 组件（Layout、Badges、CodeBlock）
├── data/           # 课程数据模型与大纲内容
│   ├── curriculum.ts   # 完整课程大纲（20 模块 / 126 节课 / 20 项目）
│   └── types.ts         # TypeScript 类型定义
├── pages/          # 页面（首页、大纲、模块、路线图、项目）
├── router.tsx      # 路由配置
├── main.tsx        # 应用入口
└── index.css       # 全局样式 + Tailwind
```

## 📖 课程大纲速览

| 阶段 | 模块 | 主题 |
|------|------|------|
| 筑基 | M1-M2 | LLM 基础与开发环境 · Prompt 工程实战 |
| 上下文与知识 | M3-M4 | 上下文工程 · RAG 深度实战 |
| Agent 核心 | M5-M6 | Agent 核心架构 · 工具与 MCP |
| 工程化与编排 | M7-M10 | Harness 工程化 · 记忆系统 · 代码沙箱 · 框架编排 |
| 多智能体与多模态 | M11-M12 | 多智能体系统 · 多模态 Agent |
| 质量、架构与生产落地 | M13-M16 | 评估/护栏/可观测 · 架构设计与案例拆解 · 生产架构/运维 · 前沿范式/毕业设计 |
| 独立开发与商业化 | M17-M20 | AI Coding 工程实践（上/下） · 产品化与商业模式 · 运营与长期经营 |

---

> 课程内容持续完善中。
