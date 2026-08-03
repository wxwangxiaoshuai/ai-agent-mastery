
## 运营增长的社区 Skills 实战：SEO、内容与数据驱动

L20-01 到 L20-07 讲了运营增长的完整链条——冷启动、SEO、数据分析、用户反馈、自动化运营。L20-06 讲了用 OpenSpec + Superpowers 工作流驱动增长运营。这一节把具体的社区 Skills 落地到增长运营的三个核心场景。

### 场景一：SEO 驱动的持续获客

L20-02 讲了内容 SEO 的策略。claude-seo + web-quality-skills 把这个策略变成可执行的操作流。

**第一步：全站 SEO 审计。**

```text
User（加载 claude-seo）:
  审计 https://my-product.com 并生成修复方案

AI 输出:
  ▸ 技术 SEO: robots.txt 没问题，但缺少 sitemap.xml
  ▸ 页面 SEO: 3 个关键页面的 title 没有包含目标关键词
  ▸ 结构化数据: 缺少 Article / FAQPage schema
  ▸ AI 搜索: 缺少 llms.txt

User:
  修复所有发现的问题

AI 生成:
  ▸ sitemap.xml（含所有页面 + 优先级）
  ▸ 3 个页面的优化 title 和 meta description
  ▸ JSON-LD 结构化数据（Article + FAQPage）
  ▸ llms.txt（AI 搜索引擎索引文件）
```

**第二步：内容日历规划。**

用 L20-06 讲的 brainstorming + writing-plans 工作流生成内容日历，但这次用一个更高效的做法——**让 AI 直接分析你的产品和竞品，生成关键词到内容的映射**。

```text
User:
  我的产品是 AI 笔记工具（l20-note.com）。
  用 brainstorming skill 生成 20 个内容选题，
  按"搜索意图 → 离付费距离 → 我的产品覆盖度"三维评估。

AI 输出:
  ═══════════════════════════════════
  内容选题矩阵: AI 笔记工具
  ═══════════════════════════════════

  ★★★ 高优先级（离付费近 + 产品覆盖好）
  1. "AI 笔记 vs Notion AI 对比 2026"  → 比价型 | 离付费近
  2. "AI 自动整理笔记的 5 种方法"      → 找工具型 | 离付费近
  3. "个人知识管理工具推荐"             → 找工具型 | 离付费近

  ★★ 中优先级（离付费中 + 需要先教育）
  4. "如何用 AI 提升学习效率"          → 学习型 | 离付费中
  5. "Zettelkasten 卡片笔记法入门"    → 学习型 | 离付费中

  ★ 低优先级（离付费远）
  6. "什么是大语言模型"                → 学习型 | 离付费远
  ...
```

**第三步：用 web-quality-skills 保持页面性能。**

```text
# 每次发布新文章后自动运行
User:
  检查 l20-note.com/blog/ai-notes-vs-notion 的 Core Web Vitals

AI（web-quality-skills）:
  ✓ LCP 1.2s (Good)
  ✗ CLS 0.25 (Needs Improvement) — 文章中的图片没有设置宽高
  ✓ INP 45ms (Good)
```

### 场景二：内容营销的"写完→发布"自动化

mblode/blog-post + optimise-seo 两个 Skills 能帮你从内容生产到发布自动化：

```text
User:
  用 blog-post skill 写一篇关于"AI 如何改变个人知识管理"的博文。
  目标读者是独立开发者。语气：实用，不营销。

AI（加载 blog-post）:
  ▸ 生成 outline:
    1. 独立开发者的知识管理困境（信息过载 + 检索困难）
    2. AI 在知识管理中的三个角色（分类、检索、关联）
    3. 三种 AI 笔记工具的横向对比（含你的产品）
    4. 一个实际工作流：从收集到回顾

  ▸ 生成初稿（约 2000 字）

User:
  用 optimise-seo skill 优化这篇博文

AI（加载 optimise-seo）:
  ▸ 标题优化: "AI 如何改变个人知识管理" →
               "2026 年 AI 个人知识管理指南：3 个工具 + 1 个工作流"
  ▸ Meta description: 添加了关键词 + CTA
  ▸ 结构化数据: 添加 Article schema
  ▸ 内部链接: 建议链接到定价页和功能页
  ▸ readability: 段落拆分（原有 3 个段落过长）
```

**关键**：blog-post 负责"内容写得好不好"，optimise-seo 负责"内容能不能被搜到"。两者分工明确。

### 场景三：增长实验的记录与可视化

L20-03 讲了数据驱动增长——留存、转化、漏斗。增长的很多决策需要用图表来呈现：

```text
User:
  用 excalidraw-diagram skill 画一张"用户留存队列分析图"——

  数据: Day 1 100 人 → Day 7 40 人 → Day 30 12 人。
  三条线: 有机流量用户、付费广告用户、推荐注册用户。

AI（加载 excalidraw-diagram）:
  ▸ 生成 cohort-retention.excalidraw（Excalidraw 格式）
  ▸ 三条留存曲线的可视化对比
  ▸ 可导出 PNG 用于周报或团队分享
```

excalidraw-diagram（walidboulanouar/ay-skills）的优势是：它生成的图是可编辑的——你可以手动微调布局、颜色、标注，而不像 AI 生成的 PNG 图片那样无法修改。

```bash
# 安装 excalidraw-diagram
npx skills add walidboulanouar/ay-skills --skill excalidraw-diagram -g
```

### 运营增长 Skills 全景

| 增长环节 | L20 课程 | 社区 Skill | 解决的问题 |
|---------|---------|-----------|-----------|
| SEO 审计 | L20-02 | claude-seo | 技术 SEO + 页面 SEO + AI 搜索优化 |
| 性能监控 | L20-02 | web-quality-skills | Lighthouse + Core Web Vitals |
| 内容生产 | L20-02 | blog-post | 结构化博文写作 |
| 内容优化 | L20-02 | optimise-seo | Meta 标签 + 结构化数据 + 内部链接 |
| 内容策略 | L20-06 | brainstorming + claude-seo | 关键词研究 + 内容日历 |
| 数据可视化 | L20-03 | excalidraw-diagram | 留存曲线、漏斗、A/B 实验报告 |
| 增长实验 | L20-06 | Superpowers brainstorming | 发散假设 + 设计实验 |

### 两个常被问的问题

**Q：AI 写的内容会被 Google 惩罚吗？**

Google 的官方立场是"关注内容质量而非生产方式"。关键不是谁写的，而是：是否提供了独特的价值（个人经验、一手数据、真实案例）。如果你用 blog-post 生成初稿，然后注入你自己的经验——"我用了三个月后的真实感受"、"这个功能上线后用户反馈如何"——那就是高质量内容。如果你只是让 AI 生成一篇泛泛的"AI 改变知识管理"，那确实不会排到任何关键词前面。

**Q：SEO 要多久才能看到效果？**

claude-seo 修复的是技术问题（sitemap、结构化数据等），修复后 Google 一般在 1-2 周内重新抓取。但内容排名通常需要 3-6 个月。SEO 是复利游戏——你第一篇内容 3 个月开始有流量，第 20 篇的时候，前面 19 篇的流量叠加在一起。**SEO 最难的一步是坚持到第 20 篇**。

### 动手：增长运营 Skills 实战

1. 选 P20 项目中一个增长场景（SEO、内容生产、数据可视化任选一个）。
2. 安装对应的社区 Skill。
3. 完成一次完整的操作：SEO 审计 → 修复 → 验证；或博客文章 → 优化 → 发布。
4. 记录 Skill 在该任务中节省的时间和帮助的决策。

**验收标准**：至少用社区 Skill 完成了 1 篇内容的生产 + SEO 优化，并在 1 周后回看这篇文章的搜索表现。

### 要点总结

- **SEO 三件套**：claude-seo（审计 + 修复）+ brainstorming（内容选题）+ web-quality-skills（性能监控）。
- **内容营销流水线**：blog-post（初稿）→ optimise-seo（结构化优化）→ 人工审查（注入个人经验）→ 发布。
- **增长实验可视化**：excalidraw-diagram 生成可编辑的留存曲线、A/B 实验报告。
- **SEO 是复利游戏**：3 个月开始见效果，关键不在第一篇，在坚持到第 20 篇。
