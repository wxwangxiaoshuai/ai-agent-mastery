# 静态图（src/components/diagrams）整体 Review

审查日期：2026-07-29
审查范围：`src/components/diagrams/` 下 19 个图组件 + `_shared/` 渲染层（约 2136 行）+ 19 处课程内嵌位置

---

## 一、总体结论

底子很好：统一的 `DiagramShell` + `n/g/e/ann` DSL、七色语义色板、暗亮双主题、泳道分层，
这套抽象比市面上大多数课程站的"截图式配图"专业得多。几何布局也是干净的——
我按 CSS 实际度量重算了全部 19 张图的节点包围盒，**零重叠、零越界**。

但有三类问题必须处理：

1. **一条渲染层的默认值 bug，影响 231 条连线里的 101 条（44%）**——这是最高优先级；
2. **两处图文直接矛盾**，其中一处是图和它所在的那一节课讲的完全不是一回事；
3. **亮色模式对比度不达标**，7 种节点色里 4 种文字低于 WCAG AA。

综合评分：结构 A- / 渲染实现 C+ / 内容准确性 B- / 可访问性 D+ / 移动端 D。

---

## 二、P0 —— 必须先修

### P0-1 未指定端口的连线全部退化成"顶部→顶部"

`_shared/nodes.tsx:14-15` 的 `QuadHandles` 把 handle 按 上-右-下-左 顺序渲染，
第一个 `type="source"` 的 handle 是 **Top（`st`）**。

`_shared/index.ts:112-113`：`e()` 在没有 `fromSide` / `sourceHandle` 时把 handle 留成 `undefined`。

React Flow v12 的 `getHandle()` 在 handleId 为空时取 `bounds[0]`（源码注释原文：
"if no handleId is given, we use the first handle"），而 `handleBounds` 按 DOM 顺序采集。
两者相乘的结果是：**所有没写端口的边，都从源节点顶部出发、扎进目标节点顶部**，
`sourcePosition`/`targetPosition` 也一并变成 `Top`，smoothstep 于是在节点上方拱起一道桥。

统计（按文件）：

| 文件 | 总边数 | 未指定端口 |
|------|-------|-----------|
| MultiAgentTopologyDiagram | 17 | **11** |
| PerplexityArchDiagram | 15 | **10** |
| AgentPlatformDiagram / DevinArchDiagram | 15 / 16 | **9 / 9** |
| MemoryLayersDiagram / HarnessGatePipelineDiagram / OpenSpecWorkflowDiagram / RAGPipelineDiagram | 13/10/15/9 | **7** |
| 其余 12 个文件 | — | 1~5 |
| **合计** | **231** | **101（44%）** |

后果分三层：

- 本该左右相邻的横向流程（`docs→chunk→embed→store`、`start→g0→g1→g2`）画成了一串跨在方块头顶的拱桥；
- 边标签定位在路径中点，也就是拱顶，会压住泳道标题（`.diagram-group__label` 固定在 `top:10px`）；
- **反向边被彻底掩盖**。典型：`MemoryLayersDiagram` 的 `summarize(x=720) → short_buf(x=520)`、
  `store_lt(720) → vec_db(400)`、`skill(720) → skill_db(400)`，`MultiAgentTopologyDiagram` 的
  `s_center(280) → s1(60)`、mesh 的 `m3(480) → m4(280)`——语义上是右往左的写入/回连，
  渲染出来和左往右的边长得一模一样，读者根本看不出方向。

**修法（三选一，推荐第 3 个）**

1. 调整 `QuadHandles` 里 handle 的 DOM 顺序，把右侧 source / 左侧 target 排到最前 —— 一行改动，但是隐式魔法，下一个人还会踩；
2. `e()` 里给默认值 `fromSide='e'` / `toSide='w'` —— 对 90% 的横向流程正确，反向边仍然错；
3. **在 `e()` 之外加一个 `layout(nodes, edges)` 后处理**：节点坐标是静态已知的，
   按 `dx/dy` 自动推断端口（|dx|>|dy| 走左右，否则走上下；dx<0 时自动翻成 `w→e`），
   显式写了 `fromSide/toSide` 的边保持不动。一次性把 101 条边全部纠正，且新增图默认就是对的。

同时建议把 `curve` 的默认值从 `'step'` 改成按跨度自适应：同排短边用直线/step，跨泳道回连用 bezier。

### P0-2 `HarnessGatePipelineDiagram` 与 L17-14 正文互相矛盾

图（`HarnessGatePipelineDiagram.tsx`）画的是 **四阶段**：

```
实现前 Gate 0-2：探索门禁 / 规格门禁 / 计划门禁
实现中 Gate 3-5：执行门禁 / Review 门禁 / 完成门禁
提交前 Gate 6-7：Pre-commit / Pre-push
归档   Gate 8  ：归档检查
```

`src/content/module-17/lesson-l17-14.md` 正文（第 24-34 行、第 195-207 行）讲的是 **三级防线**：

```
第一级 Pre-commit  Gate 0-3：类型检查 / Lint / 课程一致性校验 / 安全扫描
第二级 CI          Gate 4-6：测试 / 构建 / E2E 冒烟
第三级 归档前      Gate 7-8：人工确认 / 产物完整性
```

而图上方第 17 行的引导句是"下图是 Harness 门禁管道的全景——**三级防线、九道门禁**各自检查什么"，
`DiagramShell` 的 description 却写"**四个阶段** 9 道门禁"。**每一道 Gate 的编号和职责都对不上**，
学生对着图看正文会直接懵。这不是措辞出入，是两套不同的门禁模型。

顺带：`OpenSpecWorkflowDiagram` 用的是 `Gate 0-2 / 3-5 / 6-8` 的第三套切分，
同一个模块（L17-13 / L17-14）里三种口径并存。

**修法**：以正文的三级防线为准（它有具体命令、耗时、触发时机，明显是主真源），
重画为 3 条泳道 + Gate 0-8 的实际名称，并把 OpenSpec 图里的 `Gate 0-2 / 3-5 / 6-8`
同步改成 `Gate 0-3 / 4-6 / 7-8`。

### P0-3 `PatternMapDiagram` 与 L05-07 正文互相矛盾，且兜底分支自相矛盾

- 正文（`lesson-l05-07.md:20`）写"先看一张全景分类图，把所有模式在**坐标系**里定位——
  **横轴是自主程度，纵轴是任务复杂度**"。实际渲染的是一棵"是/否"决策树，
  既没有坐标轴，也没有自主程度/复杂度这两个维度。**承诺的图和给出的图是两种东西。**
- 决策树自身有逻辑漏洞：`q3 可并行？` 回答"否"才会往下走到 `q4`、`q5`，
  但 `q5` 回答"否"时兜底到 `fallback = 默认 → Parallelization`（`PatternMapDiagram.tsx:79, 133`）。
  **前面刚判定"不可并行"，兜底却推荐并行化。** 合理的兜底应是"单次 LLM 调用"或"自主 Agent"。
- 次要：`q1 可预定义步骤？→ 是 → Prompt Chaining` 也不严谨，
  Routing / Parallelization / Evaluator-Optimizer 同样是"步骤可预定义"的 workflow，
  第一问应该问"步骤是否**线性且固定**"。

**修法**：二选一——要么按正文补一张真正的二维定位图（自主程度 × 任务复杂度，
5 个模式散点 + 象限说明），要么改正文那句话为"决策树"。同时修掉 fallback 与第一问的措辞。

---

## 三、P1 —— 专业性与流程合理性

### P1-1 图文次序/内容不一致（4 处）

| 位置 | 正文说 | 图实际画 |
|------|--------|---------|
| `l11-02.md:26` | 收集结果 → **综合输出 → 质量检查** | 收集 → **质量检查 → 综合输出** |
| `l15-01.md:68` | 网关→队列→**缓存→限流**→Agent 服务 | 网关→**鉴权限流**→队列→Agent→**缓存** |
| `l08-01.md:10` | "每一层有明确的**容量上限和存活时间**" | 图上没有任何容量 / TTL 标注 |
| `l19-03.md:26` | "五个环节的数据指标、**问题诊断**、优化动作" | 只有 漏斗 / 指标 / 动作 三条泳道，无诊断层 |

第 1、2 条是正文写错（图的顺序才对），第 3、4 条是图欠了正文承诺的信息。

### P1-2 `MultiAgentTopologyDiagram` 的成本论断是错的

description 写"自上而下：协调成本递增"，而排列顺序是 链式 → 星型 → 网状 → 层级。
网状是 O(n²) 通信，层级是 O(n)，**层级的协调成本明显低于网状**，递增关系在最后一步断掉。
建议改成"链式 → 星型 → 层级 → 网状"，或把 description 改为"四种形状的连接代价与故障半径各不相同"。

另外，网状拓扑的 6 条对等连线全部带 `markerEnd` 箭头（`DiagramShell.tsx` 无条件注入），
把"对等双向"画成了单向有向图。建议给 `DiagramEdgeData` 加 `undirected?: boolean`，
对等链路去掉箭头或改双向箭头。

### P1-3 六个"悬空机制节点"——只进不出的死胡同

用入/出度扫了一遍全部 19 张图，下列节点有入边无出边，流程读到这里就断了：

- `CursorArchDiagram`：`diff`（Diff 预览）、`hitl`、`rollback`
- `DevinArchDiagram`：`hitl`、`limit`（步数上限）、`rollback`

`diff` 尤其要命——Cursor 的核心交互就是**用户 accept / reject diff**，
图里 `user` 节点只有出边没有入边，用户从头到尾没参与闭环。
`limit` 也一样：触发步数上限之后发生什么（转人工？放弃？回滚？）没有交代。

**修法**：给这些机制节点补出边（`diff → user`「接受/拒绝」、`limit → hitl`「转人工」、
`rollback → loop`「回到上一 Checkpoint」），或者把纯机制项从"节点"降级为
`annotation` / 泳道注记，避免它们看起来像流程步骤。

### P1-4 内容缺口（按图列）

| 图 | 缺什么 | 为什么要紧 |
|----|--------|-----------|
| `ReActLoopDiagram` | 无入口节点（唯一一张没有输入节点的图）；无 max-steps / 终止条件 | 循环从哪来、什么时候一定停，是 M5 的核心 |
| `FunctionCallingSequence` | **并行工具调用**、工具报错分支 | 现代 API 早已支持并行 tool_calls，图里只画串行 |
| `HITLFlowDiagram` | 只有 approve / reject，缺 **edit（改后批准）** | LangGraph HITL 的规范动作是 approve/edit/reject |
| `CircuitBreakerDiagram` | Half-Open 的并发探测限额、连续成功阈值 | 三态本身画对了，但工程落地就卡在这两个参数 |
| `DeploymentArchDiagram` | 熔断**打开时的降级路径**、重试、扩缩容 | 只画了"放行"，等于只画了 happy path |
| `AgentPlatformDiagram` | 无模型层 / 模型路由；无评估与可观测面 | 部署图有模型层，平台图反而没有，两图不自洽 |
| `ContextAssemblyDiagram` | 上下文压缩、Prompt Caching | M3 有专门两节课（L03-04 / L03-05）讲，图里没体现 |
| `RAGPipelineDiagram` | 文档解析/清洗、元数据过滤 | 与交互组件 `RAGPipelineDemo`（"七道工序"）口径不一 |

### P1-5 命名与建模瑕疵

- `FunctionCallingSequence` 被 CLAUDE.md 和正文称为"**时序图**"，但它是泳道流程图——
  没有生命线、没有时间轴、时间方向是横向的。UML 时序图读者会误解。建议改称"调用链泳道图"。
- `AgentPlatformDiagram` 把租户 A / 租户 B 画在"接入层"泳道**内部**。租户是系统外部的 actor，
  应该放在分层栈之外，否则分层边界的含义被破坏。
- `AgentPlatformDiagram` 把"计费计量"归到基础设施层——计费是平台/商业能力，不是基础设施。
- `LangGraphStateDiagram` 把 `checkpoint` 画成与 Node A/B/C 完全同形的节点。
  Checkpointer 在 LangGraph 里不是图节点，是持久化侧车，同形会误导。建议改成虚线容器或注记样式。
- `DevinArchDiagram` 把 `done`（完成）放在"验证层"泳道里；终态应该独立于泳道。
- `MemoryLayersDiagram` 的"工作记忆 = 当前对话"与"短期记忆 = 摘要 + 滑动窗口"边界模糊，
  多数文献里 working memory 与 short-term memory 是同义。课程自定义无妨，但图上应标出区分依据
  （比如各层的 TTL / 容量——正好补上 P1-1 里 L08-01 欠的那句承诺）。

---

## 四、P2 —— 美观与可读性

### P2-1 亮色模式对比度不达标（实测）

节点文字 12px 粗体，属 WCAG 普通文本，AA 阈值 4.5:1。按 `theme.css:185+` 与
`index.css` 亮色 token 实算：

| 颜色 | 亮色文字对比度 | 判定 | 9px caption（`opacity:.65`） |
|------|---------------|------|----------------------------|
| amber | **2.91:1** | ✗ | 1.98:1 |
| emerald | **3.43:1** | ✗ | 2.19:1 |
| fuchsia | **4.17:1** | ✗ | 2.64:1 |
| danger | **4.24:1** | ✗ | 2.73:1 |
| violet | 5.04:1 | ✓ | 2.79:1 |
| brand | 10.56:1 | ✓ | 4.11:1 |
| ink | 16.87:1 | ✓ | 5.98:1 |

amber 最糟，而 amber 恰恰是所有"决策 / 门禁 / 判断"节点的专用色。
暗色模式实测 7.6:1 ~ 14.6:1，全部通过——问题只出在亮色。

根因：`index.css` 的亮色 override 把 `--*-300` / `--*-400` 加深了，**但 `--*-500` 原样保留**
（`index.css:114,117` 与暗色的 `:50,53` 数值完全相同）。而 `.diagram-node` 亮色规则
用的是 `-400` 做文字色、`-500/0.1` 做底色——文字加深了一档，底色没跟着压暗，对比度就不够。

连带影响 **连线**：`edges.tsx` 的 `ACCENT_STROKE` 全部走 `--*-500`，亮色下
emerald 连线 2.54:1、amber 连线 2.15:1，都低于非文本元素的 3.0:1 下限——白底上几乎看不见。

**修法**：亮色下节点文字改用 `--*-300`（已是深色档，如 amber-300 = `180 83 9`），
连线改用 `--*-400`；caption 的 `opacity: .65` 在亮色下提到 `.85` 或直接改用实色。

### P2-2 移动端基本不可读

`DiagramShell` 固定 `minZoom = 0.4`、`zoomOnScroll = false`，且没有 `<Controls />`、
没有全屏入口、没有横向滚动提示。图宽 720~900px；390px 手机上内容列约 310px，
fitView 需要 0.34 倍才装得下，被 `minZoom` 卡在 0.4 → 内容左右被裁掉，
且 12px 字实际渲染成 4.8px。用户可以拖动平移，但**没有任何视觉提示告诉他可以拖**。

**修法**（按性价比排序）：窄屏下把 `minZoom` 降到 0.2 并加 `<Controls showInteractive={false} />`；
或给窄屏加"点击全屏查看"；或对 4 张最宽的图（Memory / Devin / Perplexity / OpenSpec，860~900px）
出一版竖排布局。

### P2-3 声明宽度与 CSS 约束打架（19 处）

`n()` 写进 `style.width` 的值会被 `.diagram-node` 的 `min-width` / `max-width` 夹住，
两者不一致时 React Flow 按声明值算 handle 坐标、浏览器按 CSS 值绘制，**箭头会落在框内或脱开框**：

- `< min-width`（框比声明宽，箭头扎进色块内部）：`MultiAgentTopology` 的 12 个节点
  （sm 类 min-width 68，却声明 56 / 64）+ `h_a/h_b/h_c`（声明 90，min 96）、
  `OpenSpecWorkflow` 的 `user` / `output`（90 vs 96）、`HarnessGatePipeline` 的 `start` / `done`（70 vs 96）；
- `> max-width`（框比声明窄，箭头悬空）：`PatternMapDiagram` 的 `fallback`（声明 110，sm 类 max 100）。

**修法**：`n()` 里对显式 width 做一次 clamp 并在开发环境 warn，或干脆去掉 CSS 的 min/max-width，
把尺寸责任完全交给 DSL。

### P2-4 零散的观感问题

- `GrowthEngineDiagram` 有 4 条边的 label 是 `'→'`——箭头已经画出来了，标签重复且无信息，纯噪声。
- `GrowthEngineDiagram` 同一走廊里塞了双向边：`漏斗→指标`（向下）、`指标→动作`（向下）、
  `动作→漏斗`（向上，跨两条泳道）共 15 条虚线挤在 5 个纵列里，必然叠线。
  建议"改善"回环合并成一条整体的反馈弧，或改用一个"每周复盘"汇聚节点。
- `ContextAssemblyDiagram` 的 `merge` 中枢落在 y=262，而泳道是 130-248 与 330-470，
  它悬在两条泳道之间的空隙里，视觉上无所依托。建议把"组装与输出"泳道上沿提到 250。
- `SupervisorPatternDiagram` 的 `collect`(x=80) 与上游 `w1/w2/w3`(x=120/320/520) 不对齐，
  三条汇入线整体左偏。
- 全站 19 张图的 `height` 是逐个手写的魔法数（340~660），与内容包围盒无关联，
  改一次布局就得手调高度。建议由节点包围盒自动推导。

---

## 五、P3 —— 工程与可维护性

1. **19 个图组件全部在 `MarkdownRenderer.tsx:31-49` 静态 import**，
   任何一节课（哪怕不含图）都会把全部图组件 + `@xyflow/react` 打进首屏 chunk。
   `@xyflow/react` 不是小库，且这些图**全都是静态的**
   （`nodesDraggable / nodesConnectable / elementsSelectable / nodesFocusable` 全为 false）。
   建议：`React.lazy` + `Suspense` 按需加载；更彻底的做法是给纯静态图换成构建期生成的 SVG，
   把这个依赖从课程正文路径上完全摘掉。
2. **`role="img"` 反而毁了可访问性**。`DiagramShell.tsx:80` 给容器加 `role="img"`，
   ARIA 规范下 `img` 角色的后代会被当作 presentational——泳道名、节点文字、边标签
   对屏幕阅读器**全部消失**，只剩 `aria-label`（= 标题）和 `aria-describedby`（= 一句 description）。
   对一门以图讲架构的课来说，这等于把图的全部信息对无障碍用户屏蔽了。
   建议改成 `<figure>` + `<figcaption>`，或额外提供一段 `sr-only` 的结构化文字描述
   （泳道 → 节点 → 边，正好可以从 DSL 自动生成）。
3. **`pnpm check` 缺少针对图的校验**。现有 C2 只验证组件"已注册且文件存在"。建议补：
   - **C16**：每条边的 `source`/`target` 必须存在于该图的节点集合（当前是全通过，但没有守护）；
   - **C17**：不允许有入度=0 且出度=0 的孤立节点（当前 `PatternMapDiagram` 的 `hint` 注记会命中，
     可对 `annotation` 类型豁免）；
   - **C18**：显式 `width` 必须落在其 size 类的 `[min,max]` 区间内（当前会报 19 处）；
   - **C19**：节点包围盒不得重叠、不得超出所属泳道（当前全通过，值得锁住）；
   - **C20**：边未显式指定端口时报 warn（当前会报 101 处，修完 P0-1 后归零）。
4. **静态图与交互组件重复覆盖同一概念**：`reActLoop`/`agentLoop`、`ragPipelineDiagram`/`ragPipeline`、
   `memoryLayersDiagram`/`memoryLayers`、`multiAgentTopologyDiagram`/`topology` 四组。
   L11-01 里两者连续出现（第 7 行与第 11 行），中间只隔一句话。
   不一定是问题（静态图给全貌、交互给手感），但两者的口径必须一致——
   目前 RAG 那一组就不一致（交互版"七道工序" vs 静态版 5 步）。
5. **三个课程内容文件尾部有 NUL 字节填充**（与图无关，但顺手发现，属文件损坏）：
   `module-02/lesson-l02-01.md`（430 字节）、`module-14/lesson-l14-03.md`（701）、
   `module-14/lesson-l14-04.md`（918）。`file` 命令已把 l14-03 识别为 `data`，
   grep 会跳过这些文件。建议截断尾部 NUL 并在 check 里加一条二进制字节检测。

---

## 六、逐图速查

| 图 | 所在课 | 结构 | 主要问题 |
|----|--------|------|---------|
| ReActLoopDiagram | L05-01 | 好 | 无入口节点、无终止条件 |
| RAGPipelineDiagram | L04-01 | 好 | 7/9 边无端口；与交互版工序数不一致 |
| ContextAssemblyDiagram | L03-02 | 好 | merge 悬在泳道间隙；缺压缩/缓存 |
| FunctionCallingSequence | L06-03 | 中 | 不是时序图却叫时序图；缺并行调用与错误分支 |
| CircuitBreakerDiagram | L07-04 | **最好** | 仅缺 Half-Open 参数细节 |
| MemoryLayersDiagram | L08-01 | 中 | 7/13 边无端口且多为反向；正文承诺的容量/TTL 未画 |
| LangGraphStateDiagram | L10-02 | 好 | checkpoint 与图节点同形 |
| HITLFlowDiagram | L10-03 | 好 | 缺 edit 分支 |
| MultiAgentTopologyDiagram | L11-01 | 中 | 成本递增论断错误；对等边带箭头；12 处宽度冲突；11/17 边无端口 |
| SupervisorPatternDiagram | L11-02 | 好 | 与正文次序相反；collect 左偏 |
| CursorArchDiagram | L14-02 | 中 | diff/hitl/rollback 三个死胡同；用户不闭环 |
| DevinArchDiagram | L14-03 | 中 | hitl/limit/rollback 三个死胡同；done 位置不当；9/16 边无端口 |
| PerplexityArchDiagram | L14-04 | 好 | 10/15 边无端口 |
| AgentPlatformDiagram | L14-05 | 中 | 租户画进层内；无模型层；计费归属存疑 |
| DeploymentArchDiagram | L15-01 | 中 | 与正文次序不符；缺降级/重试/扩缩容 |
| OpenSpecWorkflowDiagram | L17-13 | 中 | Gate 切分与 L17-14 冲突 |
| HarnessGatePipelineDiagram | L17-14 | **差** | **门禁定义与所在课正文完全不同**；无失败阻断分支（自我描述说"不通过就阻断"） |
| PatternMapDiagram | L05-07 | **差** | **正文承诺坐标系，实际是决策树**；fallback 自相矛盾 |
| GrowthEngineDiagram | L19-03 | 中 | `'→'` 空标签；双向边叠线；缺正文承诺的诊断层 |

---

## 七、建议的修复顺序

**第一批（改动小、收益最大）**

1. P0-1：在 `_shared` 加端口自动推断，一次性修掉 101 条边。改完把全部 19 张图截图对比一遍。
2. P0-2：重画 `HarnessGatePipelineDiagram` 对齐 L17-14 正文，同步 `OpenSpecWorkflowDiagram` 的 Gate 编号。
3. P0-3：修 `PatternMapDiagram` 的 fallback，并把 L05-07 那句"坐标系/横轴纵轴"改掉。
4. P2-1：亮色模式节点文字换 `-300`、连线换 `-400`，caption 提高不透明度。

**第二批**

5. P1-1 的 4 处图文不一致；P1-2 的成本论断与对等边箭头。
6. P1-3 的 6 个悬空节点补出边。
7. P2-3 的 19 处宽度冲突 + `n()` 里加 clamp。
8. P3-2 的 `role="img"` 换 `figure/figcaption`。

**第三批**

9. P1-4 的内容缺口（优先 DeploymentArch 的降级路径、HITL 的 edit 分支、FunctionCalling 的并行调用）。
10. P2-2 移动端方案。
11. P3-1 懒加载；P3-3 新增 C16-C20 校验项；P3-5 清理 NUL 字节。

---

## 附：本次审查用到的核验手段

- 按 `theme.css` 的实际 padding / font-size / min-max-width 复算全部 19 张图的节点包围盒，
  检测重叠、泳道越界、间距过近 —— **零命中**（布局本身是干净的）。
- 解析 231 条边，统计端口指定情况，并对照 React Flow v12 `getHandle()` 的默认取值规则。
- 对全部图做入度/出度扫描，定位悬空节点与孤立节点。
- 按 WCAG 2.1 相对亮度公式实算暗/亮两套主题下 7 种节点色的文字对比度与连线对比度。
- 逐一比对 19 处 `::interactive` 内嵌位置的上文引导句与图的实际内容。
