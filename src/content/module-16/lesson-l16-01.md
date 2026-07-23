## Computer Use：让 Agent 操控图形界面

前面 15 个模块，Agent 的能力都靠"调用 API/工具"扩展。但有个巨大盲区——**那些没有 API 的软件**：老旧内部系统、桌面软件、需点点的网页操作。Computer Use 换了个思路：不靠 API，**直接看屏幕、点鼠标、敲键盘**，像人一样操作 GUI。这是 Agent 能力边界的重大扩展，也是可靠性挑战的深水区。

### 从"调 API"到"操作 GUI"

先理解 Computer Use 解决了 API 时代够不着的场景：

```
API 时代（前 15 模块）：
  · Agent 调用工具 = 调用有 API 的服务
  · 局限：对方没 API 就没法操作
  · 盲区：老旧内部系统、桌面软件、需点击的网页

Computer Use 时代：
  · Agent 不调 API，直接看屏幕像素、点鼠标、敲键盘
  · 能操作"任何人类能操作的 GUI"
  · 价值：打通"无 API 但有 GUI"的海量遗留系统
```

**核心洞察**：现实世界有海量的"没有 API 但有界面"的系统——银行旧后台、医院系统、企业内部 OA、某些 SaaS 的特定操作。Computer Use 让 Agent 不必等这些系统做 API，直接像人一样操作。**这是 Agent 从"数字世界"伸向"人机界面世界"的触手**。

### Computer Use 的工作机制

它怎么"看屏幕点鼠标"？本质是一个 **视觉-动作循环**：

```
Computer Use 循环：
  1. 截屏：抓取当前屏幕
  2. 视觉理解：多模态模型看懂屏幕（哪个是按钮、光标在哪、当前状态）
  3. 决策：基于任务和当前屏幕，决定下一步动作
  4. 执行动作：点击(x,y) / 输入文本 / 滚动 / 快捷键
  5. 观察：截下一帧，看动作效果
  6. 循环 1-5 直到任务完成
```

```python
# Computer Use 概念流程（实际用 Claude Computer Use API）
def computer_use(task: str):
    """让 Agent 用屏幕操作完成任务"""
    screen = take_screenshot()
    history = []
    while not done:
        # 多模态模型看屏幕 + 决策下一步
        action = model.computer_use(
            task=task,
            screenshot=screen,
            history=history,
        )
        # action 形如：{"type":"click","x":120,"y":340}
        #          或 {"type":"type","text":"hello"}
        execute_action(action)
        history.append({"screen": screen, "action": action})
        screen = take_screenshot()   # 看动作效果
        if task_completed(history): break
    return history
```

**和 ReAct Loop 的关系**（M5）：Computer Use 本质是 ReAct——Thought（看屏幕决策）→ Action（点/输）→ Observation（下一帧）。只是 Action 不是"调 API"，是"操作 GUI"。**M5 的 Agent Loop 在这里换了"手脚"**。

### GUI Agent 的可靠性挑战

乐观过后看清现实——**Computer Use 的可靠性远低于调 API**：

```
为什么 GUI 操作比 API 不可靠：
  1. 视觉理解误差
     · 模型看像素判断"按钮在哪"，可能点偏（坐标差几像素）
     · 不同分辨率/缩放，坐标体系变
  2. 状态不确定
     · 页面加载慢，点了但元素还没出来 → 点空
     · 弹窗/动画/动态内容，模型难预判
  3. 错误难以检测
     · 点错按钮，界面变了，模型不一定意识到错了
     · 没有 API 的明确成功/失败返回
  4. 步数多累积错误
     · 一个操作可能要几十步点击，每步都可能错，累积放大
  5. 环境脆弱
     · UI 改版（按钮位置变了）→ Agent 脚本失效
     · 不同版本/浏览器表现不同
```

**量化对比**：

| 维度 | 调 API | Computer Use |
|------|--------|--------------|
| 成功率 | 高（99%+） | 低-中（70-90%） |
| 速度 | 快（毫秒-秒） | 慢（每步要截屏+视觉理解，秒级） |
| 成本 | 低 | 高（每步多模态调用） |
| 稳定性 | 高（API 契约稳定） | 低（UI 变就崩） |
| 覆盖面 | 受限（要有 API） | 广（任何 GUI） |

> 关键认知：**Computer Use 是"能用但不可靠"的技术**。它打开了新场景，但成功率和成本都远不如 API。能调 API 就调 API，Computer Use 是**没有 API 时的兜底方案**，不是首选。

### 适用场景

Computer Use 真正发挥价值的场景：

```
适合 Computer Use：
  · 遗留系统无 API：银行旧后台、医院/政府系统
  · 跨多个无 API 应用的流程自动化：打开A系统导出→导入B系统
  · 需要GUI交互的测试：UI 自动化测试
  · 辅助操作：帮用户完成繁琐的点点流程

不适合：
  · 有 API 的场景（直接用 API，更可靠更便宜）
  · 高频实时任务（Computer Use 慢，扛不住高频）
  · 高精度要求（视觉坐标误差不可接受）
  · UI 频繁变动的系统（脚本易失效）
```

**决策树**：

```
这个操作有 API 吗？
├─ 有 → 调 API（别用 Computer Use）
└─ 没有，但有 GUI
    ├─ 操作低频、可容忍失败 → Computer Use
    └─ 操作高频/高精度 → 推动对方做 API，或人工
```

> 反模式：**有 API 还用 Computer Use**。"调 API 要对接文档麻烦，不如直接点界面"——Computer Use 的不可靠+慢+贵，远超对接 API 的成本。**Computer Use 是最后手段，不是偷懒手段**。

### 可靠性增强

要用 Computer Use，怎么提升可靠性：

```
1. 步骤验证
   · 每步动作后检查"预期变化发生了吗"
   · 点了提交按钮→等"提交成功"提示出现，没出现则重试/报错

2. 视觉锚点而非坐标
   · 别硬编码"点(120,340)"——分辨率变就失效
   · 用视觉特征找元素（"点击'登录'按钮"），让模型定位

3. 状态恢复
   · 中途失败能回滚到已知状态（关掉弹窗、返回首页）
   · checkpoint 每步屏幕状态（M7）

4. 人介入
   · 关键操作前暂停确认（L10-03 HITL）
   · 连续失败 N 次转人工

5. 限定环境
   · 固定分辨率/浏览器/版本，减少变量
   · 沙箱/虚拟机里操作，不碰真实生产环境
```

```python
def reliable_computer_use(task):
    for step in range(MAX_STEPS):
        screen = take_screenshot()
        action = model.decide(task, screen, history)
        execute(action)
        next_screen = take_screenshot()
        # 验证：动作是否产生了预期变化
        if not verify_expected_change(screen, next_screen, action):
            if step > 3: human_intervene()   # 连续失败转人工
            continue
    return result
```

### 安全边界

Computer Use 能操作 GUI = 能做"人能做的事" = **破坏面极大**。安全边界尤其重要：

```
安全红线：
  · 沙箱/虚拟机隔离：在隔离环境操作，不直接碰真实生产
  · 最小权限账号：用受限账号操作，别用管理员
  · 危险操作审批：删除/提交/转账前 HITL（L10-03）
  · 网络限制：操作环境网络白名单，防 Agent 跑去访问别的
  · 审计录屏：全程录屏留痕（出了问题能回放）
  · 不可逆操作禁用/审批：rm/发送/支付等
```

> Computer Use 的安全比调 API 更严峻——它能操作任意 GUI，意味着能做任意人在 GUI 里能做的事。**沙箱+最小权限+HITL+审计录屏**是必选项，不是可选。L13-06 的纵深防御在这里强度要更高。

### Computer Use 与 RPA 的关系

Computer Use 和传统 RPA（机器人流程自动化）都在"自动化 GUI 操作"，但思路不同：

```
传统 RPA：
  · 录制人操作，回放固定脚本
  · 稳定但脆弱——UI 变了脚本就废
  · 适合：固定流程、UI 稳定

Computer Use：
  · 模型实时看屏幕决策，不靠录制脚本
  · 灵活能适应 UI 变化，但不可靠
  · 适合：流程多变、UI 不稳定

融合趋势：
  · RPA + AI：固定流程用脚本，异常时 AI 兜底
  · Computer Use 也能生成可复用脚本（重复操作固化）
```

**工程取舍**：固定流程优先 RPA（稳），流程多变才上 Computer Use（灵活）。两者不互斥，融合用。

### 前沿的现实评估

Computer Use 是前沿，但要清醒看它的成熟度：

```
现状（2026）：
  · 能做简单 GUI 任务（填表、点按钮、复制粘贴）
  · 复杂任务成功率仍低（多步累积错误）
  · 成本高（每步多模态调用）
  · 适合辅助而非完全自主

未来：
  · 模型视觉理解更强 → 成功率升
  · 专门优化的动作模型 → 成本降
  · 与 API/RPA 融合 → 取长补短
```

> 别把 Computer Use 当"万能自动化"。它是**有边界的工具**——在"无 API 但有 GUI"的特定场景有价值，但不是所有自动化的未来。保持关注，按场景用，别盲目追新（L14-01 决策框架的延续）。

### 要点总结

- Computer Use 让 Agent 不靠 API 直接看屏幕点鼠标敲键盘，打通"无API但有GUI"的遗留系统
- 工作机制：截屏→视觉理解→决策→执行动作→观察下一帧循环，本质是 ReAct 换了"手脚"
- 可靠性远低于API：视觉坐标误差、状态不确定、错误难检测、步数累积错误、环境脆弱
- 量化对比：API 成功率99%+快便宜稳，Computer Use 70-90%慢贵不稳但覆盖面广
- 适合：遗留无API系统、跨无API流程、GUI测试；不适合：有API/高频/高精度/UI常变
- 决策：有API就用API，Computer Use是无API时的兜底，不是首选——别有API还用
- 可靠性增强：步步骤证、视觉锚点非坐标、状态恢复、HITL、限定环境
- 安全边界极严：沙箱+最小权限+危险操作HITL+网络白名单+审计录屏——能操作GUI=破坏面极大
- 与RPA：RPA固定脚本稳但脆弱，Computer Use灵活但不可靠——固定流程用RPA，多变用Computer Use，融合
- 别当万能自动化：有边界的工具，特定场景有价值，保持关注按场景用别盲目追新
- 下一节 L16-02：Agent 之间怎么通信——A2A 协议
