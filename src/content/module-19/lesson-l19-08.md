
## 产品化中的社区 Skills 实战：从验证到上线的加速链路

L19-01 到 L19-07 讲了产品化的完整链条——选品、MVP 裁剪、定价、支付、单位经济、合规。这些环节都可以被社区 Skills 加速。

这一节不讲新框架，而是**把前三节（L18-06 ~ L18-08）讲过的 Skills 落地到产品化的具体场景里**——需求验证、支付落地、落地页测试。

### 需求验证：用 grill-me 反问你的选品假设

L19-01 讲了三步验证法——落地页测试、预售、人工替身。但第一步之前其实还有一步：**你的需求假设本身可经得住拷问吗？**

```text
User（加载 grill-me）:
  我的产品是"AI 自动整理会议纪要"——
  参会者录音，AI 提取讨论主题、待办事项、决策记录。
  目标用户是中小团队的 PM。

AI（grill-me 输出）:
  Q1: 你的目标用户现在是怎么解决这个问题的？
      → 如果是"让实习生整理"——你是不是在和免费人力竞争？
      → 如果是"用飞书/钉钉自带功能"——你的产品比它们好在哪？

  Q2: 这个需求是"今天就想解决"还是"以后可以解决"？
      → 会议纪要的痛感通常是"偶尔"而不是"每次"。
        如果 10 次会议里有 7 次不需要纪要，你的使用频率够撑起订阅价吗？

  Q3: 你的产品需要多少用户才能覆盖推理成本？
      → 一次会议 60 分钟，转录约 20k tokens，摘要约 2k tokens。
        GPT-4o-mini: 单次约 ¥0.15。如果月费 ¥29，需要至少 200 次/月才能不亏。

  Q4: 竞品是谁？你把他们列全了吗？
      → Otter.ai、Fireflies.ai、飞书妙记、钉钉闪记——
        这四个里至少有一个你的用户已经在用了。

  Q5: 如果只做"转录"不做"整理"，你的产品还有价值吗？
      → 转录是纯技术能力，门槛极低。整理（提取主题/待办/决策）
        是产品能力，这是你可能的护城河。
```

**grill-me 在产品化中的独特价值**：它不是在帮你"完善方案"，而是在帮你"证伪思路"。Q1 和 Q2 是最容易被跳过的——很多独立开发者对自己的产品太乐观，低估了"用户现在凑合着也能过"这个事实。

### 支付落地：用 stripe-best-practices 避免支付事故

L19-04 讲了支付系统的技术架构。但支付代码的特殊性在于：**写错了不只是功能不 work，写错了是真金白银的损失**。

stripe-best-practices（Stripe 官方）是一个很少被介绍但非常重要的 Skill——它专门针对 AI 写支付代码的常见错误。

```text
User（加载 stripe-best-practices）:
  审查 src/services/payment.py 和 src/routes/webhook.py

AI（stripe-best-practices 输出）:
  ═══════════════════════════════════
  Payment Audit: billing module
  ═══════════════════════════════════

  ✗ [CRITICAL] webhook.py:15
    Webhook 签名验证缺失——任何人都可以伪造 Stripe webhook 请求
    修复: 必须调用 stripe.Webhook.construct_event() 验证签名

  ✗ [CRITICAL] payment.py:42
    扣款成功但数据库写入失败时没有补偿逻辑
    → 用户被扣了钱但你的系统不知道
    修复: 用 Stripe Idempotency Key + 数据库事务

  ✗ [HIGH] payment.py:78
    create_payment_intent 的 amount 是整数（分），
    但代码传入了浮点数 amount=19.99 → Stripe 会报错
    修复: amount=1999（1999 分 = ¥19.99）

  ✗ [HIGH] webhook.py:33
    未处理 webhook 重复投递——Stripe 在某些网络条件下会重试
    修复: 用 event.id 做幂等去重

  ✗ [MEDIUM] payment.py:103
    API key 硬编码（sk_test_xxx），应使用环境变量
  ═══════════════════════════════════
```

**stripe-best-practices 的核心价值**：它覆盖的不是"支付系统怎么设计"（L19-04 讲了），而是"AI 写支付代码时最容易踩的坑"——Webhook 签名验证遗漏、幂等缺失、金额单位错误。这三个坑，任何一个踩了都可能在半夜把你叫醒。

```bash
# 安装
npx skills add stripe/agent-skills --skill stripe-best-practices -g
```

### 落地页测试：用 vercel-deploy 一小时验证需求

L19-01 建议用落地页测试验证需求。社区 Skills 组合让这件事从"半天"变成"一小时"：

```text
# 完整链路：一小时完成落地页 + 上线 + 数据分析

User:
  1. 用 ui-ux-pro-max 生成一个 SaaS 落地页模板，
     行业选 "Productivity Tools"，风格选 "Minimal + Dark"
  2. 替换文案为我的产品描述
  3. 加一个"立即购买"按钮 → 点击后跳到"即将上线，留下邮箱"表单
  4. 用 vercel-deploy 上线
  5. 用 claude-seo 加基础 SEO（页面标题、meta description、Open Graph）

AI 完成整套操作:
  ▸ 落地页生成完成（ui-ux-pro-max: Minimal + Indigo 配色）
  ▸ 表单集成完成（Tally / Google Form）
  ▸ 部署到 Vercel: https://try-my-product.vercel.app
  ▸ SEO 基础配置完成
  ▸ 从指令到可访问的落地页: 47 分钟
```

**与 L19-01 的呼应**：L19-01 说"按钮文案必须是购买语义"。用这套 Skills 流程，你可以快速生成 A/B 两个版本——一个按钮写"立即购买"、一个写"了解更多"——看哪个点击率高。一小时内完成传统上需要一整天的"写页面 → 部署 → 配分析 → 等数据"。

### 组合：产品化 Skills 工具链

| 产品化环节 | L19 课程 | 社区 Skill | 加速点 |
|-----------|---------|-----------|--------|
| 选品验证 | L19-01 | grill-me | 反向拷问需求假设，避免乐观偏差 |
| 需求验证 | L19-01 | ui-ux-pro-max + vercel-deploy + claude-seo | 1 小时完成落���页 + 上线 + SEO |
| 支付接入 | L19-04 | stripe-best-practices | 审计 AI 写支付代码的 5 类常见错误 |
| 定价建模 | L19-03 | Superpowers brainstorming | 发散定价方案 + 敏感性分析 |
| 合规检查 | L19-06 | trailofbits security-audit | 数据处理的合规风险扫描 |
| 竞品分析 | L19-07 | brainstorming + web search | 结构化竞品扫描 + 差异化分析 |

### 动手：产品化 Skills 实战

1. 选一个 P19 项目涉及的产品化环节（选品、定价、支付、合规任选一个）。
2. 按上表匹配对应的社区 Skill，安装并使用。
3. 记录 Skill 在该环节中产出的结论或发现的问题。
4. 对比：如果不用这个 Skill，你会漏掉哪些问题？

**验收标准**：Skill 在你的产品化决策中至少产出一个你之前没想到的洞察或问题。

### 要点总结

- **grill-me 用于需求验证**：在选品阶段反向拷问假设——Q1（现有方案）和 Q2（需求紧迫度）是最容易被跳过的关键问题。
- **stripe-best-practices 用于支付安全**：审计 AI 写的支付代码——Webhook 签名、幂等、金额单位是最容易踩的三个坑。
- **ui-ux-pro-max + vercel-deploy + claude-seo 组合用于落地页验证**：1 小时内完成"写页面 → 上线 → SEO"。
- **产品化 Skills 工具链**：每个产品化环节都有 1-2 个对应的社区 Skill，按需取用即可。
