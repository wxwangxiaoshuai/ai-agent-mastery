# AI Agent 大师之路

> 一套从零到架构师的 AI Agent 开发实战课程，以前端站点形式呈现。

## ✨ 项目简介

本课程面向希望从 AI Agent 开发小白成长为架构师专家的开发者，内容深入浅出、循序渐进，每一模块都配有实战项目。

- **16 大模块 / 91 节精讲课 / 16 个递进式实战项目 / ~159 小时**
- 七阶段成长路径：筑基 → 上下文与知识 → Agent 核心 → 记忆执行与编排 → 多智能体与多模态 → 质量保障 → 架构设计与生产落地
- 覆盖：LLM 基础、Prompt 工程、上下文工程、RAG、Agent 核心架构、工具/MCP、Harness 工程化、记忆系统、代码沙箱、框架编排、多智能体、多模态、评估/测试/护栏/安全、架构设计/案例拆解、生产架构/运维/SRE、Computer Use/A2A、毕业设计

## 🚀 技术栈

- **Vite 5** — 极速构建与 HMR
- **React 18 + TypeScript** — 类型安全
- **Tailwind CSS 3** — 原子化样式与设计系统
- **React Router 6** — 客户端路由

## 📦 本地运行

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器 (http://localhost:5173)
pnpm build       # 生产构建
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
│   ├── curriculum.ts   # 完整课程大纲（16 模块 / 91 节课 / 16 项目）
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
| Agent 核心 | M5-M7 | Agent 核心架构 · 工具/MCP · Harness 工程化 |
| 记忆执行与编排 | M8-M10 | 记忆系统 · 代码沙箱 · 框架编排 |
| 多智能体与多模态 | M11-M12 | 多智能体系统 · 多模态 Agent |
| 质量保障 | M13 | 评估 · 护栏 · 测试 · 可观测性 |
| 架构设计与生产落地 | M14-M16 | 架构设计/案例拆解 · 生产架构/运维 · 前沿范式/毕业设计 |

---

> 课程内容持续完善中。
