
## 部署、SEO 与性能：社区 Skills 让产品从代码变成可搜索的上线产品

代码写完了、测试通过了、安全审计也过了。最后一步：让别人能访问到它，并且搜得到它。

独立开发者最容易在最后一公里掉链子——部署一个 5 分钟能搞定的事拖了一下午、上线后发现 Google 根本搜不到、或者页面在移动端卡成幻灯片。这三个问题分别由三个社区 Skills 解决。

### vercel-deploy：一行命令上线

Vercel 官方的 vercel-deploy Skill 把部署从"读文档、配环境、调 CDN、加域名"变成一句话的事。

```bash
# 安装
npx skills add vercel-labs/agent-skills --skill vercel-deploy -g
```

```text
# 使用——在 Claude Code 或 Cursor 中输入
User: 把当前项目部署到 Vercel

AI（加载 vercel-deploy）:
  ▸ 检测到项目类型: Vite + React
  ▸ 检查 package.json → build 命令已配置
  ▸ 自动执行: vercel --prod
  ▸ 部署完成
    ✓ 生产环境: https://my-saas-app.vercel.app
    ✓ 预览环境: https://my-saas-app-git-feat-xyz.vercel.app
    ✓ 自动 SSL + CDN + 边缘缓存 已启用
  ▸ 部署链接已生成，可在 Vercel Dashboard 中认领管理
```

**关键**：Vercel 不需要你提前注册账号——Skill 会生成一个可认领的部署链接，你访问后完成账号绑定即可。这意味着一人公司的第一个部署是零前置配置的。

**对独立开发者的价值**：你省掉的不只是部署命令，而是"选 CDN → 配域名 → 调 SSL → 设缓存策略 → 配 CI/CD 部署"这五步。每步都需要读文档、踩坑、调试。Vercel 把这些合成了一个命令。

### claude-seo：全栈 SEO 审计

SEO 是唯一会复利的获客渠道——你今天写的一篇文章，三年后还在搜索引擎里给你带流量。但独立开发者做 SEO 最大的槛是：你不知道问题在哪。

claude-seo（walidboulanouar/ay-skills）解决这件事。它不是给建议，而是扫描你的站点的每一项 SEO 指标并给出具体修复方案。

```text
User: 用 claude-seo 审计 https://my-saas-app.vercel.app

AI（加载 claude-seo）:
  ═══════════════════════════════════════
  SEO Audit: https://my-saas-app.vercel.app
  ═══════════════════════════════════════

  ▸ 技术 SEO
    ✗ 缺少 sitemap.xml
    ✗ robots.txt 禁止了所有爬虫: "Disallow: /"
    ✓ HTTPS 已启用
    ✗ 没有 Open Graph meta 标签（影响社交分享预览）
    ✗ 没有 Twitter Card meta 标签

  ▸ 页面 SEO
    ✗ 首页 <title> 只是 "My SaaS App"——缺少关键词
    ✗ 所有页面共用同一个 <meta description>
    ✗ H1 标签缺失（首页用了 <h3> 代替）
    ✗ 3 张图片缺少 alt 属性

  ▸ 结构化数据
    ✗ 未检测到任何 Schema.org 结构化数据
      建议: 添加 Organization / WebApplication schema

  ▸ AI 搜索优化
    ✗ 没有提供 llms.txt 文件（AI 搜索引擎使用的索引格式）
    ✗ 页面内容对 AI 爬虫不够结构化

  ▸ 性能（影响搜索排名）
    ✗ LCP 3.8s（应 < 2.5s）
    ✗ CLS 0.35（应 < 0.1）

  ═══════════════════════════════════════
  总评: 17 issues found (3 CRITICAL, 8 HIGH, 6 MEDIUM)
  预计修复时间: 2-4 小时（大部分可让 AI 批量修复）
  ═══════════════════════════════════════
```

**关键**：AI 不会只报告问题——你可以接着让它修复。`"请修复以上所有 CRITICAL 和 HIGH 级 SEO 问题"`——AI 会生成 sitemap.xml、修正 robots.txt、补充 meta 标签、添加结构化数据。

### web-quality-skills：Lighthouse 全面诊断

addyosmani 的 web-quality-skills 是你上线前的最后一道质量检查。它基于 Google Lighthouse 和 Core Web Vitals，但比直接跑 Lighthouse 更有用——因为它**解释"为什么会这样"和"怎么修"**，而不仅仅是给一个分数。

```text
User: 用 web-quality-skills 审计 https://my-saas-app.vercel.app

AI（加载 web-quality-skills）:
  ═══════════════════════════════════════
  Lighthouse Report: https://my-saas-app.vercel.app
  ═══════════════════════════════════════

  性能: 62/100
    ✗ LCP 3.8s — 最大内容绘制时间过长
      根因: 定价页的背景图 (hero-bg.webp, 2.1MB) 未压缩
      修复: 转为 AVIF 格式 + 加 loading="lazy" → 预计 LCP 降至 1.2s
    ✗ TBT 450ms — 主线程阻塞
      根因: 首页有 3 个未优化的 GSAP 动画
      修复: 用 CSS animation 替代 GSAP（首屏不需要 GSAP）

  可访问性: 78/100
    ✗ 颜色对比度不足: 定价卡片的灰色文字与背景对比度 3.2:1
      修复: 把 text-ink-muted (#94a3b8) 改为 text-ink-subtle (#64748b)
    ✗ 4 个按钮没有 accessible name
    ✗ 表单输入框缺少 <label> 关联

  最佳实践: 85/100
    ✗ 控制台有 2 个 Deprecation 警告（使用了废弃 API）
    ✗ 使用了 document.write()（应避免）

  SEO: 详见 claude-seo 审计报告

  ═══════════════════════════════════════
  修复优先级（按影响排序）:
  1. 压缩背景图 (LCP -60%)
  2. 补充 label 关联 (WCAG 合规)
  3. 修复对比度 (可访问性)
  4. 替换 GSAP 首屏动画 (TBT -70%)
  ═══════════════════════════════════════
```

### 上线检查链：三个 Skills 的协同

部署、SEO、性能不是三个独立步骤——它们应该是一条上线前的检查链：

```text
vercel-deploy          → 代码上线，获得 URL
  ↓
claude-seo             → SEO 审计 + 批量修复
  ↓
web-quality-skills     → 性能 + 可访问性 + 最佳实践
  ↓
修完所有 CRITICAL/HIGH → 正式推向用户
```

**每一步都可以让 AI 执行**——你只需要给出指令："部署到 Vercel"→"做 SEO 审计并修复"→"做质量检查并修复 HIGH 以上问题"。

### 动手：让 P18 项目上线并通过三项检查

1. 用 vercel-deploy 把 P18 项目部署到线上。记录从"给指令"到"URL 可访问"的实际耗时。
2. 用 claude-seo 审计你的线上地址。记录 CRITICAL + HIGH 级问题数。
3. 让 AI 修复全部 CRITICAL 和 HIGH 级问题，重新部署。
4. 用 web-quality-skills 审计修复后的站点。确保性能 > 80 分、可访问性 > 85 分、最佳实践 > 90 分。

**验收标准**：产品线上可访问；claude-seo CRITICAL 级问题清零；web-quality-skills 三个维度都达到目标分数线。

### 要点总结

- **vercel-deploy**：零配置部署。一行命令解决部署→CDN→SSL→域名五步。对独立开发者，第一次上线不该超过 5 分钟。
- **claude-seo**：全栈 SEO 审计——技术 SEO + 页面 SEO + 结构化数据 + AI 搜索优化 + 性能。不只是报告问题，还可以让 AI 批量修复。
- **web-quality-skills**：Lighthouse 深度诊断——不仅给分数，还给根因分析 + 具体修复方案 + 优先级排序。
- **上线检查链**：部署 → SEO 审计 → 质量检查 → 修复 → 推向用户。每一步都可以让 AI 自动执行。
