
## UI 增强实战：用社区 Skills 一键生成专业级设计

L18-05 教你手写 UI Skills——design-tokens、ui-generation、ui-review。那套做法给你最大控制力，但需要你先把 tokens 定义好、把规则写清楚。

这一节教一条更快的路：**直接用社区最强的两个 UI Skills，60 秒安装，立刻生效**。然后对比两条路的效率差异，帮你建立"什么时候该自己写、什么时候直接用现成"的判断力。

### 两个主角：ui-ux-pro-max + web-design-guidelines

**ui-ux-pro-max**（nextlevelbuilder，69 万 GitHub Stars）给 AI 装上"设计师之眼"。它内置 67 种设计风格、161 套配色方案、57 组字体配对、24 种图表类型、98 条 UX 最佳实践。本质是一个可搜索的设计智能数据库。

**web-design-guidelines**（Vercel Labs，29k Stars）给 AI 装上"工程师之尺"。它包含 45 条规则，覆盖水合错误、bundle 优化、re-render 避免、可访问性、性能指标。本质是一个自动化的 UI 代码审计器。

两个 Skill 互补：ui-ux-pro-max 管"好不好看"，web-design-guidelines 管"好不好用"。一个设计师，一个工程师。

### 安装与验证

```bash
# 安装 ui-ux-pro-max
npx skills add nextlevelbuilder/ui-ux-pro-max-skill -g

# 安装 web-design-guidelines
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -g

# 验证安装
ls ~/.claude/skills/ui-ux-pro-max/styles/      # 67 个风格文件
ls ~/.claude/skills/web-design-guidelines/     # SKILL.md + rules/
```

### ui-ux-pro-max 的核心能力

这个 Skill 不是一个"生成漂亮 UI"的咒语——它是一套让 AI 在做设计决策时有据可查的数据库。

**67 种设计风格。** 从 Glassmorphism 到 Brutalism，从 Bento Grid 到 Dark Mode，每个风格包含视觉特征描述、适用产品类型、反模式警示。

**161 套配色方案。** 按行业分类——SaaS、电商、医疗、金融、美妆、教育。AI 不再随机挑颜色，而是根据你的产品类型匹配。

**161 条设计推理规则。** 这些规则不是"怎么做"而是"为什么"——为什么金融产品该用深蓝而不是亮橙、为什么医疗产品字体要大、为什么 SaaS 首页要用 Bento 布局。

```text
# 激活 ui-ux-pro-max 的典型对话

User: 为我的开发者工具产品做一个登录页。
     风格用 Minimal + Dark Mode，色调用 Developer Tools 分类。

AI（加载 ui-ux-pro-max）:
  分析产品类型 → "Developer Tools" 分类
  匹配配色 → Slate + Indigo + Emerald accent
  匹配字体 → Inter + JetBrains Mono
  匹配风格 → Minimal: 大量留白、单栏布局、无渐变
  匹配 Dark Mode → 深色背景 bg-[#0d1117]、柔和的 card 背景
  生成登录页...
```

关键：**你省掉的时间不在代码生成，在决策**。以前你要决定"主色用什么蓝、副色用什么灰、字体用 Inter 还是 SF Pro"，现在 AI 根据产品类型自动匹配——而且匹配结果通常比你凭感觉挑的更专业。

### web-design-guidelines 的核心能力

这 45 条规则不是"建议"而是"检查"。AI 生成 UI 代码后，web-design-guidelines 逐条审计：

```text
User: 审查 src/pages/Pricing.tsx

AI（加载 web-design-guidelines）:
  ✓ 规则 3: 独立请求已并行（Promise.all）    PASS
  ✗ 规则 7: 重组件 PricingTable 未懒加载      FAIL
     影响：首屏 bundle +420KB
     修复：用 React.lazy + Suspense 包裹
  ✗ 规则 12: 列表项未 memo 优化              FAIL
     影响：每次状态变更 re-render 全部 20 行
  ✓ 规则 18: 图片有 alt 属性                  PASS
  ✓ 规则 23: 颜色对比度满足 WCAG AA           PASS
  ✗ 规则 31: Server Component 中有 useEffect  FAIL
     影响：水合失败，控制台红色警告
     修复：移到 Client Component 或改用 Server Action

总计：3 处违规 / 45 条规则。建议在合并前修复列出项。
```

**重点**：这三处违规，AI 自己不会主动告诉你。你让它"做一��定价页"，它就给你一个定价页——水合错误和未懒加载的重组件都是"能用但不专业"的问题，人工 code review 很难逐条发现，但这个 Skill 自动扫描出来了。

### 对比实验：纯 AI vs ui-ux-pro-max vs 组合拳

我们用同一个 prompt 做三次实验：

```text
"为 AI 客服 SaaS 产品做一个定价页，三个档位，
 含功能对比表、FAQ 折叠区、CTA 按钮。"
```

**实验一：无任何 Skills。**

产出特征：紫色渐变背景、白色卡片、Inter 字体、三种不同深浅的灰色、按钮圆角 8px 和 6px 混用。一眼就是 AI 生成的——能用，但没人会为这个界面付费。

**实验二：仅 ui-ux-pro-max。**

AI 匹配了 SaaS + Indigo 配色方案、Inter + SF Mono 字体、Bento Grid 布局。视觉上明显提升——像一个真正的 SaaS 网站。但首屏加载了 3.2MB 的 bundle（未懒加载的重组件），移动端卡片错位。

**实验三：ui-ux-pro-max + web-design-guidelines 组合。**

上一轮的基础上，web-design-guidelines 自动审计出 5 处问题。AI 修复后：首屏 bundle 降到 480KB（懒加载 + code splitting），移动端使用单栏堆叠，水合警告消除。**视觉和工程质量同时达标。**

**结论**：ui-ux-pro-max 解决审美问题，web-design-guidelines 解决工程问题。单用一个能提升一个维度，两个组合才能同时提升两个维度。

### 什么时候用自建 UI Skills，什么时候用社区 Skills

| 场景 | 自建 Skills（L18-05） | 社区 Skills |
|------|----------------------|------------|
| 你已经有成熟的设计系统 | ✅ 精确映射你的 tokens | ❌ 社区风格可能不匹配 |
| 从零开始做新产品 | ❌ 建立 tokens 需要时间 | ✅ 一分钟装好，立刻有效果 |
| 团队协作，需要统一品牌色 | ✅ 自定义 tokens 确保一致性 | ❌ 社区风格无法精确到你的品牌 |
| 快速原型 / MVP 验证 | ❌ 不值得投入时间定义 tokens | ✅ 这正是社区 Skills 的最佳场景 |
| 需要性能和可访问性审计 | ❌ 需要自己写检查规则 | ✅ web-design-guidelines 现成 |
| 特殊行业（如医疗/金融） | ❌ 行业规范可能不熟 | ✅ ui-ux-pro-max 按行业匹配 |

**经验法则**：先装 ui-ux-pro-max 快速出效果，如果产品验证了 PMF（Product-Market Fit），再花时间建自己的设计 tokens。不要在验证阶段花两周建设计系统。

### ��手：用社区 UI Skills 重建一个页面

1. 安装 ui-ux-pro-max 和 web-design-guidelines。
2. 选你 P18 项目中一个已有页面（比如登录页或仪表盘）。
3. 用 ui-ux-pro-max 匹配你的产品类型，让 AI 重新生成。
4. 用 web-design-guidelines 审计新页面，记录发现的违规数和类型。
5. 截图保存"重建前 vs 重建后"的对比，这是你在简历上能展示的东西。

**验收标准**：重建后的页面满足三个条件——(a) 配色和字体有明显提升，不再是"AI 默认审美"；(b) web-design-guidelines 审计通过率 > 90%；(c) 你愿意把这个页面放进自己的产品。

### 要点总结

- **ui-ux-pro-max = 设计师之���**：67 种风格 + 161 套配色 + 57 组字体 + 161 条推理规则，让 AI 根据产品类型自动匹配设计决策。
- **web-design-guidelines = 工程师之尺**：45 条审计规则，自动扫描水合错误、bundle 体积、re-render、可访问性。
- **两个 Skill 互补**：一个管审美，一个管工程质量。单独用一个能提升一个维度，组合拳才能双维度达标。
- **决策框架**：快速原型 / MVP → 用社区 Skills。已有设计系统 / 品牌色 → 用自建 Skills。验证了 PMF 之后 → 从社区 Skills 迁移到自建 Skills。
- **检验方法**：对比"无 Skill vs 仅 ui-ux-pro-max vs 组合拳"的生成结果，量化视觉和工程两个维度的提升。
