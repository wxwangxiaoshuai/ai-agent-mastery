## A2A 协议与 Agent 互联

M6 讲了 MCP——连接"一个 Agent"与"工具/数据"。这一节讲另一个层面的互联：**Agent 和 Agent 之间怎么通信**。当 Agent 不只是你自己的，而是不同组织、不同平台各自开发的——它们怎么协作？Google 的 A2A（Agent-to-Agent）协议就是为这个设计的。这是 Agent 生态从"单体"走向"互联"的关键。

### 为什么需要 A2A

先理解问题——Agent 多了，互联的需求就来了：

```
现状（孤立）：
  · 我的 Agent 调我的工具（MCP）
  · 我的多个 Agent 内部协作（M11）
  · 但：我的 Agent 调不了你的 Agent

痛点：
  · 重复造轮子：每家都做自己的"搜索 Agent""预订 Agent"
  · 能力孤岛：A 公司的旅行 Agent 想用 B 公司的支付 Agent，没法对接
  · 协作限于内部：跨组织 Agent 协作要各自定制对接，无标准

A2A 的目标：
  · 让任意 Agent 能发现彼此、委托任务、返回结果
  · 像"Agent 的 HTTP"——标准协议，任何 Agent 按它来就能互联
```

**类比理解**：
- MCP = "Agent 与工具"的 USB 接口（一个 Agent 接各种工具）
- A2A = "Agent 与 Agent"的 HTTP（Agent 之间标准通信）

两者层次不同，互补不替代。

### A2A 的核心概念：Agent Card

A2A 的关键设计——每个 Agent 有张"名片"（Agent Card），告诉别人自己是谁、能干啥、怎么调：

```
Agent Card（概念）：
  {
    "name": "旅行预订 Agent",
    "description": "能预订机票酒店，擅长跨国行程规划",
    "endpoint": "https://travel-agent.example/a2a",
    "capabilities": ["flight_booking", "hotel_booking", "itinerary_planning"],
    "auth": {"type": "oauth2", ...},
    "version": "1.2"
  }

价值：
  · 自描述：别的 Agent 看名片就知道你能不能干这个
  · 可发现：Agent Card 注册到目录，别的 Agent 能搜到
  · 标准化：endpoint+capabilities 格式统一，任何 Agent 能解析
```

```python
# A2A 客户端：发现并调用别的 Agent
def discover_agents(capability: str):
    """在 Agent 目录里找有该能力的 Agent"""
    catalog = fetch_agent_catalog()
    return [a for a in catalog if capability in a["capabilities"]]

def delegate_to_agent(agent_card, task: str):
    """按 A2A 协议委托任务给另一个 Agent"""
    resp = http.post(agent_card["endpoint"], json={
        "task": task,
        "auth": get_auth_token(agent_card),
    })
    return resp.json()   # 对方 Agent 处理后返回结果
```

**Agent Card 的设计精髓**：**自描述 + 可发现 + 标准格式**。像 Web 的 DNS+HTTP——你能找到服务、知道它提供啥、按标准协议调用。这让 Agent 生态从"一对一硬对接"变成"标准互联"。

### A2A 的工作流程

一个跨 Agent 协作的典型流程：

```
场景：用户的"行程助手 Agent"要订机票，自己不会，委托"旅行预订 Agent"

1. 发现：行程助手在 Agent 目录搜 "flight_booking" 能力的 Agent
   → 找到"旅行预订 Agent"的 Card
2. 委托：行程助手按 Card 的 endpoint 发任务
   "帮我订 7/25 北京到上海最便宜的机票"
3. 执行：旅行预订 Agent 自己内部跑（可能调自己的工具/MCP）
4. 返回：旅行预订 Agent 把结果（订票成功/航班信息）返回给行程助手
5. 整合：行程助手拿结果继续和用户对话
```

```
用户 → [行程助手 Agent] --A2A委托--> [旅行预订 Agent]
                                         │（内部用MCP调航司API）
                                         │
                  <--A2A返回结果----------┘
       │
       └→ 整合后回用户
```

**和 M11 多 Agent 的区别**：

```
M11 多 Agent：
  · 同一个组织内部，同一框架（LangGraph/CrewAI）
  · 内部编排，控制流明确

A2A：
  · 跨组织，不同框架/平台
  · 松耦合，靠协议通信，不共享内部状态
  · 像"服务间调用"，各自独立部署
```

> M11 是"一家公司内的 Agent 团队"；A2A 是"不同公司的 Agent 互联"。前者紧耦合可控，后者松耦合靠协议。两者解决的问题层次不同。

### A2A vs MCP：层次区分

最易混淆的——A2A 和 MCP 是不同层次，别混：

```
层次模型：
  ┌─────────────────────────────────┐
  │  Agent A (行程助手)              │
  │    │                             │
  │    ├─ MCP → 工具/数据（自己用的） │  ← MCP 层：Agent 与工具
  │    │                             │
  │    └─ A2A → Agent B（委托给别人） │  ← A2A 层：Agent 与 Agent
  └──────────────────────────────────┘
                          │ A2A
                          ▼
  ┌──────────────────────────────────┐
  │  Agent B (旅行预订)               │
  │    └─ MCP → 航司API/酒店API       │
  └──────────────────────────────────┘
```

| 维度 | MCP | A2A |
|------|-----|-----|
| 连接对象 | Agent ↔ 工具/数据源 | Agent ↔ Agent |
| 层次 | Agent 内部能力扩展 | Agent 之间协作 |
| 耦合 | 紧（Agent 直接用工具） | 松（协议通信） |
| 共享状态 | 工具结果进 Agent 上下文 | 各自独立，只传任务和结果 |
| 关系 | 主从（Agent 调工具） | 平等（Agent 委托 Agent） |

**记忆要点**：
- MCP 是"Agent 的手"——接工具
- A2A 是"Agent 的社交"——找别的 Agent 协作

**它们如何配合**：Agent A 用 MCP 接自己的工具，同时用 A2A 委托任务给 Agent B，B 用自己的 MCP 完成后返回。**两层叠加**，Agent 既有自己的能力，又能借别人的能力。

### A2A 的工程挑战

A2A 很美，但落地有现实挑战：

```
挑战1：信任与授权
  · 我的 Agent 委托任务给陌生 Agent，凭啥信它？
  · 它返回的结果可靠吗？会泄露我的数据吗？
  · 对策：信任域、能力签名、审计、敏感数据不外传

挑战2：发现与目录
  · 怎么找到合适的 Agent？要有 Agent 目录/注册中心
  · 目录谁维护？能力怎么标准化分类？
  · 对策：公共目录 + 私有目录，能力本体标准化

挑战3：异构性
  · 不同 Agent 框架/模型/能力，怎么互相理解任务？
  · 任务描述要够标准（类似"协议契约"）
  · 对策：任务 schema 标准化、结果格式约定

挑战4：异步与长任务
  · 委托的任务可能跑很久（深度研究），不能同步等
  · 对策：异步任务+回调/Webhook+状态查询

挑战5：安全与隐私
  · 委托任务可能含敏感数据
  · 跨组织数据流要合规
  · 对策：数据最小化、脱敏、合规审查（L13-06/L14-06）
```

```python
def safe_a2a_delegate(target_card, task, user_data):
    """安全的 A2A 委托"""
    # 1. 信任检查：目标 Agent 在信任域内吗
    if not in_trust_domain(target_card):
        return "不信任该 Agent，拒绝委托"
    # 2. 数据最小化：只传完成任务必需的，脱敏敏感
    minimal_task = minimize_data(task, user_data)
    # 3. 审计记录
    audit_log(target_card, minimal_task)
    # 4. 异步委托 + 超时
    return delegate_async(target_card, minimal_task, timeout=300)
```

### 跨组织协作的前景与现实评估

A2A 描绘的未来——Agent 像服务一样跨组织互联：

```
理想愿景：
  · Agent 市场生态：能干啥的 Agent 都注册，别人按需调用
  · 组合式 AI：用户的 Agent 按需组合别人的专精 Agent
  · 像 Web 一样：任何网站能被任何浏览器访问

现实约束（2026）：
  · 标准还在演进（A2A 协议本身在迭代）
  · 信任难题没解决（跨组织凭啥信）
  · 能力分类不统一（"搜索"能力各家定义不一）
  · 商业模式不成熟（Agent 调 Agent 怎么计费/分成）
  · 安全面：跨组织委托的攻击面大
```

> A2A 是**方向正确但尚未成熟**的前沿。现在更多是"关注+小范围试"，而非"生产全量上"。保持关注协议演进，但别赌它短期内成主流。L14-01 的"别盲目追新"在这里同样适用。

### A2A 的适用场景

虽然前沿，但有些场景现在就有价值：

```
适合现在用 A2A：
  · 企业内部多部门 Agent 互联（同公司，信任问题小）
    · 客服 Agent 委托 IT 运维 Agent 处理技术工单
  · 已有合作的伙伴间（签了协议，信任建立）
    · 平台和已对接的服务商
  · 公开能力的 Agent（如公开的搜索/翻译 Agent）

不适合：
  · 对安全/合规要求高的跨组织（信任没建立）
  · 高频实时（A2A 的发现+委托有开销）
  · 强耦合任务（不如直接共用一个 Agent）
```

### 生态演进：从单体到互联

把 A2A 放在 Agent 生态演进的大图里看：

```
Agent 生态演进：
  阶段1：单体 Agent（一个 Agent 干所有）—— M5-M13
  阶段2：多 Agent 内部协作（同框架）—— M10-M11
  阶段3：Agent 与工具互联（MCP）—— M6
  阶段4：Agent 与 Agent 互联（A2A）—— 本节，进行中
  阶段5：Agent 市场生态（按需组合）—— 未来

每阶段解决前一阶段的瓶颈：
  · 单体能力有限 → 多 Agent 协作
  · 多 Agent 同框架局限 → MCP 接外部工具
  · 工具接够了但 Agent 间孤立 → A2A 互联
```

> 你学的全书恰好是这条演进线的具体技能。M16-04 回顾会把这条线和 16 模块的知识串成完整图谱。

### 要点总结

- A2A 解决 Agent 之间互联：跨组织/平台 Agent 能发现、委托、返回，像"Agent 的 HTTP"
- 类比：MCP=Agent与工具的USB（接能力），A2A=Agent与Agent的HTTP（社交）——层次不同互补
- 核心 Agent Card：自描述(能力)+可发现(目录)+标准格式——让 Agent 生态从硬对接变标准互联
- 工作流程：发现(目录搜能力)→委托(按endpoint发任务)→执行(对方内部跑)→返回→整合
- 与 M11 多 Agent 区别：M11 同组织同框架紧耦合，A2A 跨组织松耦合靠协议，不共享内部状态
- A2A vs MCP：MCP 是Agent内接工具(主从)，A2A 是Agent间协作(平等)；两层叠加配合
- 工程挑战：信任授权、发现目录、异构理解、异步长任务、安全隐私——分别对策
- 跨组织前景：方向正确但未成熟(标准演进/信任/分类/商业模式/安全)——关注+小范围试别赌短期
- 适用现在：企业内部多部门、已合作伙伴、公开能力 Agent；不适合高安全跨组/高频实时/强耦合
- 生态演进：单体→多Agent协作→MCP工具→A2A互联→Agent市场，全书技能是这条线的具体落地
- 下一节 L16-03：模型定制化——微调/LoRA/DPO 的工程决策
