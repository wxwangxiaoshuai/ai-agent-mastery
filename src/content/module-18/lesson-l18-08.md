
## 质量与安全：社区 Skills 的 Review、Testing 与 Security ��践

L18-04 讲了 Harness 质量门禁——pre-commit、CI、归档前三级防线。那是"自动检查"的框架。这一节往框架里填内容：**社区里有三个顶级的 Review / Testing / Security Skills，组合起来就是你的 AI 代码质量的最后一道防线。**

### 三个主角

- **grill-me**（mattpocock/skills，16.5 万 GitHub Stars）：反向拷问你的需求假设。在写第一行代码之前，先逼你把每个决策分支想清楚。
- **code-review-and-quality**（addyosmani/agent-skills，8 万 Stars）：五维代码评审——逻辑正确性、安全性、性能、可维护性、测试覆盖。
- **trailofbits security-audit**（Trail of Bits 官方）：专业安全审计——注入、越权、密钥泄漏、依赖漏洞。

三者的关系：**grill-me 在写代码前防方向性错误，code-review 在合代码前防逻辑和风格错误，security-audit 在发布前防安全漏洞。**

### grill-me：需求拷问

AI 编程最大的风险不是 AI 写错了代码，而是**你提出的需求方向本身就错了**。AI 不会质疑你——你说"做一个用户积分系统"，它就开始做了。但"积分系统"真的是你的产品现在需要的东西吗？

grill-me 解决的就是这个问题：它在 AI 动手之前，先 relentless 拷问你。

```text
User: 用 grill-me skill 审查这个需求：
      "为我的 SaaS 产品加一个用户积分系统，
      完成任务获得积分，积分可兑换优惠券"

AI（加载 grill-me）:
  问题 1: 你的竞品有积分系统吗？如果没有，为什么？
  问题 2: 你现在的付费转化率是多少？积分系统能提升转化率还是只增加留存？
  问题 3: 积分兑换优惠券，边际成本是多少？
          如果一个用户每月产生 $10 的积分兑换成本，
          他的 LTV 能否覆盖？
  问题 4: 你打算怎么防止积分刷量？
          每个 IP / 设备 / 账号的日上限是多少？
  问题 5: 如果不做积分系统，只做"连续使用 7 天送优惠券"，
          效果会不会差不多但实现成本只有 1/10？

  → 请回答以上问题后再让我动手写代码。
```

**grill-me 的核心价值不是"帮你做决定"，而是"强迫你面对自己没想清楚的地方"。** 一个问题你没想清楚的信号是：你对它的回答超过 3 句话还说不清。如果五个问题里有两个你说不清——这个需求很可能应该搁置。

### code-review-and-quality：五维评审

AI 自带的 code review 常常是"代码结构清晰、命名规范"这种无信息量的评价。code-review-and-quality 强制 AI 按五个维度逐条打分，每个问题标严重程度。

```text
User: 审查 src/services/billing.ts (180 行)

AI（加载 code-review-and-quality）:
  ═══════════════════════════════════
  Review: src/services/billing.ts
  ═══════════════════════════════════

  1. 逻辑正确性          评分: 7/10
     ✗ [HIGH]   第 42 行: 扣款成功但 update_user_quota 失败时，
                没有回滚扣款——用户钱扣了、额度没加
     ✗ [MEDIUM] 第 78 行: calculate_prorated_refund 对跨月订阅
                的按日计算有边界错误（31 天月 vs 30 天月）

  2. 安全                评分: 6/10
     ✗ [HIGH]   第 15 行: API key 硬编码在代码中
     ✗ [MEDIUM] 第 103 行: SQL 拼接未使用参数化查询，存在注入风险

  3. 性能                评分: 8/10
     ✗ [LOW]    第 56 行: 循环内 await（N+1 查询），
                建议改为 Promise.all

  4. 可维护性            评分: 7/10
     ✗ [MEDIUM] 第 112 行: calculate_tax 函数 80 行，职责过多
     ✗ [LOW]    第 3 行:  魔数 0.029（税率）未定义为常量

  5. 测试覆盖            评分: 5/10
     ✗ [HIGH]   calculate_prorated_refund 无单元测试
     ✗ [MEDIUM] 退款流程无集成测试（扣款→退款→对账）

  ═══════════════════════════════════
  总评: 6.6/10 — BLOCKED（2 个 HIGH 级问题）
  ═══════════════════════════════════
```

**关键**：这个 Review 和 L18-04 的 Harness 门禁是互补的。Harness 检查的是"形式对不对"（格式化、类型、测试通过/失败），code-review 检查的是"逻辑对不对"（边界情况、安全漏洞、设计质量）。两者缺一不可。

### trailofbits security-audit：安全防线

Trail of Bits 是安全审计领域的顶级公司。它们开源的 security-audit Skill 针对 AI 生成的代码做了专项训练——AI 写代码最常见的几类安全漏洞。

```text
User: 用 security-audit skill 扫描整个项目

AI（加载 trailofbits security-audit）:
  ▸ 依赖漏洞扫描
    ✓ 未发现已知 CVE（npm audit / pip-audit 已通过）

  ▸ 注入风险
    ✗ src/routes/api.ts:34 — 用户输入直接拼入 SQL
    ✗ src/utils/render.ts:12 — 用户 HTML 未做 sanitize

  ▸ 密钥与凭证
    ✗ .env.example 中包含了真实 API key 的前 8 位
    ✗ src/config.ts:7 — JWT secret 硬编码

  ▸ 权限与越权
    ✗ src/routes/admin.ts:22 — 管理员接口未验证角色，
       任何登录用户都可以访问
    ✗ src/services/export.ts:15 — 导出接口未限制导出条数，
       可能被用于拖库

  ▸ 依赖供应链
    ✗ 检测到 3 个依赖使用了非标准 registry（非 npm/pypi 官方源）
    ✓ 未检测到 typosquatting（包名仿冒）风险

  ═══════════════════════════════════
  总评: 7 issues found (2 CRITICAL, 3 HIGH, 2 MEDIUM)
  ═══════════════════════════════════
```

**将 security-audit 接入 CI**：在 L18-04 的 Harness Gate 5（pre-commit 安全检查）中集成这个 Skill 的输出。

### 三步质量链：把三个 Skills 串起来

三个 Skills 不是平级的——它们应该按"时间段"串联使用：

```text
┌─────────────────────────────────────────────────────┐
│ 阶段一：方向校验（写代码前）                          │
│ grill-me: 拷问需求假设，确认方向正确再动手             │
│ 时间：5-15 分钟 / 每个需求                            │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 阶段二：代码审查（合代码前）                          │
│ code-review-and-quality: 五维评审，不通过不合入        │
│ 时间：1-3 分钟 / 每个 PR（AI 自动执行）               │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 阶段三：安全审计（发布前）                            │
│ trailofbits security-audit: 全面安全扫描              │
│ 时间：3-5 分钟 / 发布前（AI 自动执行）                │
└─────────────────────────────────────────────────────┘
```

**关键门禁**：grill-me 不通过 → 不进入开发。code-review 出现 HIGH 级问题 → 不合并 PR。security-audit 出现 CRITICAL 级问题 → 不发布。

### 动手：在 P18 项目中实施三步质量链

1. 安装三个 Skills：
```bash
npx skills add mattpocock/skills --skill grill-me -g
npx skills add addyosmani/agent-skills --skill code-review-and-quality -g
npx skills add trailofbits/skills --skill security-audit -g
```

2. 挑一个你 P18 项目中的需求（已实现的或计划中的），先用 grill-me 拷问它——记录 5 个问题和你对每个问题的回答。如果超过 2 个回答说不清，标记这个需求为"需重新评估"。

3. 挑一个你最近合并的 PR，用 code-review-and-quality 重新审查。记录发现的 HIGH 级问题数和 MEDIUM 级问题数。

4. 在整个项目上跑一次 security-audit。逐个处理 CRITICAL 和 HIGH 级问题。

**验收标准**：grill-me 至少让你搁置或重新思考了 1 个需求方向；code-review 发现了至少 2 个你在人工 review 时遗漏的问题；security-audit 完成了全项目扫描且没有 CRITICAL 级未处理项。

### 要点总结

- **三个 Skills 三个阶段**：grill-me（方向校验）→ code-review-and-quality（代码审查）→ trailofbits security-audit（安全审计）。
- **grill-me 防方向性错误**：在写代码前拷问需求假设。一个需求说不清超过 2 个问题就该搁置。
- **code-review-and-quality 防逻辑和风格错误**：五维打分（逻辑/安全/性能/可维护性/测试），每个问题标严重程度。
- **trailofbits security-audit 防安全漏洞**：注入、越权、密钥泄漏、供应链——AI 写代码最常见的几类漏洞。
- **门禁规则**：grill-me 未通过不开发 / code-review HIGH 级问题不合入 / security-audit CRITICAL 级问题不发布。
