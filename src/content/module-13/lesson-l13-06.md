## 工具权限沙箱与数据安全

L13-05 讲了注入攻防——攻击者的最终目的多是诱导 Agent 调危险工具搞破坏。这一节是纵深防御的"最后一公里"：**即便 Agent 被注入诱导成功，工具权限最小化 + 沙箱 + 数据脱敏，让损害降到最低**。这节复用 M9 沙箱、L13-04 护栏，落到工具和数据安全。

### 工具是 Agent 的破坏面

先想清楚为什么工具是安全重点：

```
没有工具的 Agent：
  · 最多输出有害文字 → 危害有限（文字）
  · 注入成功也只能"说错话"

有工具的 Agent：
  · 能发邮件、删文件、调 API、执行代码
  · 注入成功 → 真实世界损害：数据外泄、文件被删、钱被转、代码被跑
  · 工具 = Agent 对真实世界施加影响的接口 = 主要破坏面
```

**安全原则**：**工具能力 = 破坏面**。给的权限越大，被注入后危害越大。所以工具安全的核心是**最小权限**——只给 Agent 完成任务必需的最小能力。

### 最小权限工具集设计

不是给 Agent 所有工具，而是按需给、给最窄：

```
反模式（权限过大）：
  给 Agent 一个"shell"工具 → 它能干任何事 → 注入即沦陷

最小权限（按任务裁剪）：
  研究Agent：只给 search + fetch，不给 send_email/delete
  客服Agent：只给 query_order，给 send_email 也限制收件人白名单
  编码Agent：给 code_exec（沙箱M9），不给访问生产数据库
```

```python
# 按任务配置工具集（最小权限）
TASK_TOOLS = {
    "research": ["web_search", "fetch_page", "summarize"],   # 无危险操作
    "customer_service": ["query_order", "refund_order"],     # 业务操作
    "coding": ["code_exec_sandboxed"],                        # 只在沙箱执行
}

def get_tools_for_task(task: str) -> list:
    """按任务返回最小工具集"""
    return [TOOLS[t] for t in TASK_TOOLS.get(task, [])]

# 危险工具始终要审批/白名单（L10-03 HITL）
DANGEROUS = {"refund_order", "send_email", "delete_record"}
```

**最小权限的几个维度**：
1. **工具种类**：只给任务需要的，不给万能工具
2. **参数范围**：给了 query_order，但限制只能查某时间范围/某客户
3. **动作白名单**：send_email 只能发给用户本人邮箱
4. **数据访问**：只能读不能写，或只能写某表

### 工具白名单与参数约束

即便给了工具，也要约束它的参数——防注入诱导调"合法工具干非法事"：

```python
# 危险工具带白名单/约束
def send_email(to: str, subject: str, body: str):
    """发邮件——收件人必须白名单"""
    ALLOWED_RECIPIENTS = load_user_verified_emails()  # 用户已验证的邮箱
    if to not in ALLOWED_RECIPIENTS:
        raise PermissionError(f"禁止向未验证邮箱 {to} 发信")
    return mail_api.send(to, subject, body)

def query_order(order_id: str):
    """查订单——格式约束 + 访问约束"""
    if not re.match(r"^ORD\d{10}$", order_id):
        raise ValueError("订单号格式错误")
    # 只能查当前用户的订单
    order = db.get(order_id)
    if order.user_id != current_user_id:
        raise PermissionError("无权访问他人订单")
    return order
```

**约束的三个层次**：
- **格式约束**：参数格式校验（防乱传）
- **白名单约束**：值必须在允许列表（防越界）
- **所有权约束**：只能操作自己的资源（防越权访问他人数据）

> 这是 OWASP 那套（防注入、防越权）在 Agent 工具上的延续——**工具本质是 API，传统 API 安全全部适用**，且因为 Agent 可能被诱导，约束要更严。

### 代码执行工具：沙箱化（复用 M9）

编码 Agent 要执行代码——这是最危险的能力。必须沙箱化（M9 全套）：

```python
# 不安全的代码执行（绝不可）
def exec_code_naive(code):
    exec(code)   # 在 Agent 进程跑 → 注入即沦陷

# 安全的代码执行（M9 沙箱）
def exec_code_sandboxed(code):
    """代码执行走 M9 的安全沙箱"""
    # AST + LLM 审查（M9 L09-04）
    ok, msg = check_code_safety(code)
    if not ok:
        return f"代码被拦截: {msg}"
    # Docker 沙箱执行（断网/非root/只读/cgroup）
    return run_sandboxed(code, timeout=10, mem="256m")
```

**回顾 M9 的安全要点**（这节是它的安全收口）：
- 代码执行必沙箱：namespace + cgroup + 只读 + cap_drop
- 执行前 AST + LLM 双层审查
- 输出审查防外泄
- 资源限制防滥用

> 没有沙箱的代码执行工具 = 把整台机器的控制权交给了一个可能被注入的 Agent。这是绝不可接受的——M9 的沙箱是代码执行工具的前提，不是可选增强。

### 数据脱敏：防泄露的最后一层

即便工具被诱导，如果数据本身已脱敏，泄露也无价值。**数据脱敏**要在多个环节做：

```
1. 输入脱敏：用户输入含 PII → 脱敏后再处理
   "我的手机13800001111" → "我的手机[PHONE]"
   → Agent 上下文里不含真实手机号 → 即便泄露也无价值

2. 工具结果脱敏：工具返回含敏感数据 → 脱敏后塞进上下文
   db.query 返回 {"ssn": "110..."} → 塞进 prompt 前脱敏成 {"ssn": "[SSN]"}

3. 输出脱敏：Agent 输出含敏感 → 脱敏后送用户（L13-04 输出护栏）
```

```python
import re

MASKERS = [
    (r"\d{17}[\dXx]", "[ID]"),          # 身份证
    (r"1[3-9]\d{9}", "[PHONE]"),         # 手机
    (r"\d{16,19}", "[CARD]"),            # 银行卡
    (r"sk-[a-zA-Z0-9]{48}", "[KEY]"),    # API密钥
]

def mask_pii(text: str) -> tuple[str, int]:
    """脱敏 PII，返回(脱敏后, 替换数)"""
    masked = text
    count = 0
    for pat, rep in MASKERS:
        new, n = re.subn(pat, rep, masked)
        masked, count = new, count + n
    return masked, count

def safe_tool_result_to_context(result: dict) -> str:
    """工具结果塞进上下文前脱敏"""
    text = str(result)
    masked, _ = mask_pii(text)
    return masked   # 上下文里只剩脱敏后的
```

**脱敏的价值**：L13-05 的注入攻击里，攻击者诱导 Agent "把用户历史发到 evil@x.com"——如果历史在上下文里已脱敏，发出去的只是 `[PHONE] [ID]`，无价值。**脱敏让"泄露"变得无害**，是纵深防御的数据层。

### 审计日志：全程留痕

安全事件要能追溯——谁、何时、调了什么工具、什么参数、什么结果：

```python
@dataclass
class ToolAuditLog:
    timestamp: str
    user_id: str
    session_id: str
    tool_name: str
    args_hash: str        # 参数 hash（敏感参数不存原文）
    result_status: str    # success / blocked / failed
    block_reason: str = ""

class ToolAuditor:
    def log(self, entry: ToolAuditLog):
        # 写审计存储（不可篡改）
        audit_store.append(entry)
        # 异常检测
        self._detect_anomaly(entry)

    def _detect_anomaly(self, e: ToolAuditLog):
        # 高频调危险工具 → 告警
        if e.tool_name in DANGEROUS:
            recent = count_recent(e.user_id, e.tool_name, minutes=10)
            if recent > 5:
                alert(f"用户{e.user_id} 10分钟内调{e.tool_name} {recent}次，疑似滥用")
```

**审计的要点**：
- **不可篡改**：审计日志要只追加，不能改/删（否则攻击者抹痕迹）
- **敏感参数不存原文**：参数记 hash 或脱敏，别把密钥又记进审计
- **异常检测**：高频调危险工具、用户频繁触发护栏 → 告警
- **与 trace 关联**：审计日志关联 L13-03 的 trace_id，能还原完整链路

### 敏感操作的审批（复用 L10-03 HITL）

最高危的操作——**不自动执行，要人工审批**：

```python
def execute_tool(tool_name, args, user_id):
    """工具执行统一入口，带审批"""
    # 1. 权限检查
    if tool_name not in get_tools_for_task(current_task):
        return "工具不在当前任务权限内"
    # 2. 参数约束
    ok, msg = validate_args(tool_name, args)
    if not ok:
        return f"参数校验失败: {msg}"
    # 3. 危险操作 → 审批
    if tool_name in DANGEROUS:
        return request_human_approval(tool_name, args, user_id)  # L10-03
    # 4. 审计
    auditor.log(ToolAuditLog(...))
    # 5. 执行
    return TOOLS[tool_name](**args)
```

**三层防线叠加**：权限检查（不该有就没有）→ 参数约束（合法工具防越界）→ 审批（危险动作人审）→ 审计（全程留痕）。注入要突破所有层才能造成损害——纵深防御的目标。

### 要点总结

- 工具是 Agent 的破坏面——注入的最终危害是诱导调危险工具，工具权限=破坏面
- 最小权限：按任务裁剪工具种类、参数范围、动作白名单、数据访问；不给万能工具
- 工具约束三层：格式约束（防乱传）、白名单约束（防越界）、所有权约束（防越权访问他人数据）
- 代码执行工具必沙箱化（复用 M9 全套）——无沙箱的代码执行=把机器交给可能被注入的Agent，绝不可
- 数据脱敏三环节：输入脱敏、工具结果进上下文前脱敏、输出脱敏——让"泄露"变无害，是纵深防御数据层
- 审计日志：不可篡改、敏感参数记hash不记原文、异常检测（高频调危险工具告警）、关联trace
- 敏感操作审批（L10-03 HITL）：三层防线叠加 权限→约束→审批→审计，注入要全突破才损害
- 这是 L13-05 注入防御的最后一公里：假设注入成功，工具/数据层让损害最小
- 下一节 L13-07：从安全回到测试——为"会做决策的 Agent"建立测试金字塔
