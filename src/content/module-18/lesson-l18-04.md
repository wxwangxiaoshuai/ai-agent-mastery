## 支付、账号与订阅系统落地

「接个支付」在工程师的心理估时里通常是一天。真实情况是，一个能上线的订阅系统 —— 包含账号、订阅状态、续费、失败重试、退款、对账 —— 需要三到五天，而且其中大部分时间不是花在调接口上，是花在处理各种不一致状态上。

这一节讲清楚复杂度到底在哪，以及一个人怎么用最小代价把它做对。

### 收钱这件事真正的复杂度

调用支付接口很简单。难的是**支付系统和你的系统之间的状态同步**。

想一遍这些场景：

- 用户点了付款，跳到支付页，然后关掉了浏览器。钱扣了没有？你的库里应该是什么状态？
- 支付成功了，但你的服务器那一刻正在重启，webhook 没收到。用户付了钱但没开通。
- webhook 收到了两次（网络重试）。用户被开通了两次订阅？
- 用户的信用卡在续费时失败了。立刻停服？还是给几天宽限期？
- 用户在第 3 天要求退款。已经用掉的额度怎么算？
- 用户升级套餐，中间的差价怎么算？

这些都不是罕见情况，它们每天都在发生。一个能上线的系统必须对每一种有明确的答案。

**核心原则：支付网关是唯一真相来源，你的数据库只是它的缓存。** 任何时候两边不一致，以支付网关为准。这条原则能解决上面一大半的问题。

### 最小闭环的状态机

不要用一堆布尔字段（`is_paid`、`is_active`、`is_cancelled`）表示订阅状态 —— 组合爆炸，非法状态一堆。用显式状态机：

```python
from enum import Enum

class SubStatus(str, Enum):
    NONE      = 'none'       # 从没订阅过
    PENDING   = 'pending'    # 发起了支付，还没确认
    ACTIVE    = 'active'     # 正常服务中
    PAST_DUE  = 'past_due'   # 续费失败，宽限期内，仍可用
    CANCELED  = 'canceled'   # 用户取消，到期前仍可用
    EXPIRED   = 'expired'    # 已到期，停服
    REFUNDED  = 'refunded'   # 已退款，停服

# 合法转移（其余一律拒绝并告警）
TRANSITIONS = {
    SubStatus.NONE:     {SubStatus.PENDING},
    SubStatus.PENDING:  {SubStatus.ACTIVE, SubStatus.NONE},
    SubStatus.ACTIVE:   {SubStatus.PAST_DUE, SubStatus.CANCELED, SubStatus.REFUNDED},
    SubStatus.PAST_DUE: {SubStatus.ACTIVE, SubStatus.EXPIRED},
    SubStatus.CANCELED: {SubStatus.ACTIVE, SubStatus.EXPIRED},
    SubStatus.EXPIRED:  {SubStatus.PENDING},
    SubStatus.REFUNDED: {SubStatus.PENDING},
}

def transition(cur: SubStatus, nxt: SubStatus) -> SubStatus:
    if nxt not in TRANSITIONS[cur]:
        logger.error('非法订阅状态转移 %s -> %s', cur, nxt)
        raise ValueError(f'illegal transition {cur} -> {nxt}')
    return nxt
```

把非法转移记成 error 级日志，比静默接受重要得多 —— 它是支付逻辑出 bug 的第一信号。

`PAST_DUE` 这个状态经常被省略，但它很关键：信用卡续费失败在真实世界里非常普遍（卡过期、额度不足、银行风控），立刻停服会把本来愿意付钱的用户赶走。给 3-7 天宽限期，同时发邮件提醒，能挽回相当一部分。

### 权限映射：一处判断，到处使用

订阅状态和功能权限的映射必须集中在一个地方。散落在各个接口里的 `if user.is_paid` 是 bug 的温床。

```python
FEATURES: dict[SubStatus, set[str]] = {
    SubStatus.NONE:     {'basic'},
    SubStatus.PENDING:  {'basic'},
    SubStatus.ACTIVE:   {'basic', 'pro', 'export', 'api'},
    SubStatus.PAST_DUE: {'basic', 'pro', 'export', 'api'},  # 宽限期内不降级
    SubStatus.CANCELED: {'basic', 'pro', 'export', 'api'},  # 到期前不降级
    SubStatus.EXPIRED:  {'basic'},
    SubStatus.REFUNDED: {'basic'},
}

QUOTA: dict[SubStatus, int] = {
    SubStatus.NONE: 10, SubStatus.PENDING: 10,
    SubStatus.ACTIVE: 500, SubStatus.PAST_DUE: 500,
    SubStatus.CANCELED: 500, SubStatus.EXPIRED: 10, SubStatus.REFUNDED: 0,
}

def can(user, feature: str) -> bool:
    return feature in FEATURES[user.sub_status]
```

用 `dict[SubStatus, ...]` 这种全枚举映射的好处是：**新增一个状态时，类型检查会提醒你补上映射**。这和 L17-06 讲的判别联合是同一个思路 —— 把「别忘了」变成编译器的工作。

L17-01 讲过权限判断属于不可委托给 AI 的红线代码，这一段就是典型。可以让 AI 写周边的样板，但这张表和 `can()` 自己写、自己测。

### Webhook：幂等是唯一要求

支付网关会重复发送 webhook。这不是异常，是设计如此（它无法确认你是否真的处理成功，所以宁可多发）。

处理原则：**同一个事件处理一百次，结果必须和处理一次完全相同。**

```python
@app.post('/webhook/payment')
async def handle_webhook(request: Request):
    # 1. 验签 —— 不验签等于任何人都能给自己开通订阅
    payload = await request.body()
    sig = request.headers.get('X-Signature', '')
    if not verify_signature(payload, sig, WEBHOOK_SECRET):
        logger.warning('webhook 验签失败 ip=%s', request.client.host)
        return Response(status_code=400)

    event = json.loads(payload)
    event_id = event['id']

    # 2. 幂等 —— 用事件 ID 做唯一键，靠数据库约束保证
    try:
        await db.execute(
            'INSERT INTO processed_events (id, type, received_at) VALUES ($1,$2,now())',
            event_id, event['type'],
        )
    except UniqueViolation:
        logger.info('重复事件已跳过 %s', event_id)
        return Response(status_code=200)   # 必须返回 200，否则它会一直重试

    # 3. 处理（和写入事件表在同一个事务里）
    async with db.transaction():
        await apply_event(event)

    return Response(status_code=200)
```

三个容易出错的点：

**验签不能省。** 不验签的 webhook 接口，等于开放了一个「任何人都能给自己开通订阅」的入口。这是真实发生过的事故。

**重复事件必须返回 200。** 返回 4xx/5xx 会让网关认为处理失败，继续重试，最后进入死信队列，而你的日志里全是噪音。

**幂等键靠数据库唯一约束，不靠先查后写。** `if not exists: insert` 在并发下会双双通过。让数据库的唯一索引来保证。

还有一条：**webhook 处理要快**（1 秒内返回）。重活扔进队列异步做，超时会触发重试，重试又会因为你的处理慢而再次超时，形成雪崩。

### 对账：定期发现不一致

即使做了上面所有事，你的库和支付网关之间还是会漂移 —— webhook 丢失、你的服务宕机、手工改数据、退款在网关侧发起但你没收到通知。

所以需要一个定期对账脚本。这是一人公司最容易跳过、也最不该跳过的一环，因为**没有人会替你发现有个用户付了钱却用不了**。

```python
async def reconcile(days: int = 7) -> list[dict]:
    """对账：以支付网关为准，找出本地状态不一致的用户。"""
    diffs = []
    remote_subs = await gateway.list_subscriptions(updated_since=days_ago(days))

    for r in remote_subs:
        local = await db.fetchrow(
            'SELECT * FROM subscriptions WHERE gateway_id=$1', r.id)

        if local is None:
            diffs.append({'kind': '本地缺失', 'gateway_id': r.id,
                          'email': r.customer_email, 'remote': r.status})
        elif local['status'] != map_status(r.status):
            diffs.append({'kind': '状态不一致', 'gateway_id': r.id,
                          'local': local['status'], 'remote': r.status})
        elif local['current_period_end'] != r.current_period_end:
            diffs.append({'kind': '周期不一致', 'gateway_id': r.id})

    # 反向：本地 active 但网关已经没有了
    local_actives = await db.fetch(
        "SELECT gateway_id FROM subscriptions WHERE status='active'")
    remote_ids = {r.id for r in remote_subs}
    for row in local_actives:
        if row['gateway_id'] not in remote_ids:
            diffs.append({'kind': '本地多出', 'gateway_id': row['gateway_id']})

    return diffs
```

每天跑一次，有差异就发邮件给自己。**不要让脚本自动修复** —— 早期数据量小，人工看一眼再决定更安全，自动修复写错了会批量搞坏数据。

反向检查（本地 active 但网关没有）尤其重要，它对应的是「用户已经不付钱了但还在免费用」，直接影响你的成本。

### 退款、升级与其他麻烦事

**退款策略要提前写在页面上。** 不写的话，每次退款请求你都要临时决策，而且用户会觉得你在敷衍。一个简单的策略：7 天内无理由全额退，超过 7 天按未使用天数比例退，明显滥用（比如跑满额度后申请退款）不退。

写下来的好处不只是省事，它还能减少退款请求 —— 明确的规则本身就降低了「试试看能不能退」的动机。

**升级/降级的差价处理。** 最简单的做法是**升级立即生效并按比例补差价，降级下个周期生效**。降级立即生效需要处理退差价，复杂度陡增，而降级的人本来就少。

**取消挽留要克制。** 加一个「能告诉我为什么取消吗」的可跳过输入框是好的（这是最真实的产品反馈来源）。设置层层挽留弹窗、把取消按钮藏起来，短期能留住几个人，长期换来的是差评和退款争议。

**测试环境要用完整的沙箱。** 支付网关都提供测试模式和测试卡号，把整条链路（付款成功、付款失败、续费失败、退款、webhook 重放）在测试环境各跑一遍。特别是 webhook 重放 —— 大多数网关的控制台支持手工重发某个事件，用它验证你的幂等。

### 动手 5 分钟

给你的支付链路做一次状态和幂等验证。

1. 画出你的订阅状态机，列出所有状态和合法转移；检查有没有 `PAST_DUE`（续费失败宽限期）。
2. 在测试环境把同一个 webhook 事件**重放三次**，确认用户的订阅状态和额度没有被改动三次。
3. 写一个对账脚本，跑一次，看有没有不一致。

**验收标准**：webhook 重放三次后数据完全一致，且你的幂等是靠数据库唯一约束实现的（不是先查后写）。如果对账脚本在测试数据上就发现了不一致，先别急着修数据，找清楚是哪条路径产生的 —— 那条路径在生产上会重复发生。

### 要点总结

- 收钱的复杂度不在调接口，在**支付系统和你的系统之间的状态同步**；核心原则是**支付网关是唯一真相来源**。
- 用**显式状态机**表示订阅，不用一堆布尔字段；非法转移记 error 日志，它是支付 bug 的第一信号。
- **`PAST_DUE` 宽限期不能省** —— 续费失败在真实世界非常普遍，立刻停服会赶走本来愿意付钱的用户。
- 权限映射用**全枚举字典集中一处**，新增状态时类型检查会提醒你补上；这段属于不可委托给 AI 的红线代码。
- Webhook 三条铁律：**必须验签**（否则谁都能给自己开通）、**重复事件返回 200**、**幂等靠数据库唯一约束而非先查后写**。
- Webhook 要在 1 秒内返回，重活扔队列；处理慢会触发重试雪崩。
- **对账脚本每天跑**，有差异发邮件但**不要自动修复**；反向检查（本地 active 但网关没有）直接关系你的成本。
- 退款策略**提前写在页面上**，明确规则本身就能减少退款请求；升级立即生效补差价，降级下周期生效。
