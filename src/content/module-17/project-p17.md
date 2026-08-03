## P17：用 AI Coding 从零交付一个可上线的 Web 应用

M17 讲了一整套一个人用 AI 造软件的工作流：边界判断、方案预研、规格驱动、上下文工程、UI 生成、测试重构、CI/CD、质量门禁、成本控制。这个项目把它们串成一次完整的交付，并且**强制使用 OpenSpec + Superpowers + UI Skills 工作流**——不是可选的"试试看"，而是项目的骨架。

**核心要求：做一个你自己真的会用的东西。** 不是练习题，不是 demo。你自己不用的产品，你判断不了它好不好用，也不会有动力把最后 20% 做完 —— 而最后 20% 恰恰是「能跑的代码」和「能上线的产品」之间的全部距离。

### 项目目标

从一个想法出发，交付一个陌生人打开链接就能用的 Web 应用，全程使用 OpenSpec + Superpowers 工作流：

- 用 L17-02 的方法做完想法验证，产出一页纸方案
- **用 OpenSpec 四步工作流**（L17-13）管理从探索到归档的完整规格生命周期
- **用 Superpowers 技能体系**（L17-13）驱动每个阶段的执行：brainstorming → writing-plans → TDD → subagent → review → verification
- 用 L17-04 的上下文工程建立项目约定文件
- 前端按 L17-05/06 的约束生成，**用 UI Skills（L17-15）固化为 AI 可执行的约束并通过自动审查**
- 关键逻辑有测试（L17-07），有三道 CI/CD 闸门（L17-08）
- **用 Harness 门禁（L17-14）在 pre-commit / CI / 归档前三个节点自动阻断**
- 全程记录 AI 参与度与返工点

规模控制：**一个核心功能，两到三个页面，一周内能做完**。范围大是这个项目最常见的失败原因。

### 验收标准

- [ ] 线上可访问（有域名或托管地址），陌生人能打开并完成主流程
- [ ] 一页纸方案文档（含问题、目标用户、最脆弱假设及其验证结果）
- [ ] **OpenSpec 工作流产物**：`openspec/changes/<feature>/` 目录下含 `proposal.md`、`specs/`、`design.md`、`tasks.md`，且 `proposal.md` 中"不在范围"至少 5 条、"风险"至少 3 条
- [ ] **Superpowers 流程产物**：brainstorming 发散→收敛记录、TDD 红→绿→重构循环日志、subagent 分配与 review 反馈记录
- [ ] **UI Skills 约束产物**：`design-tokens.json`（至少 10 个 token）、`ui-constraints.md`（含 a11y checklist、响应式 checklist、状态矩阵）、AI 审查通过记录
- [ ] 项目约定文件 `CONVENTIONS.md` 与 `AI_BOUNDARIES.md`
- [ ] UI 状态矩阵自检表（标注每格「已实现 / 明确不做」）
- [ ] 键盘走查记录（纯 Tab 完成主流程）
- [ ] 375px 宽度下无横向滚动、主按钮可点
- [ ] 关键逻辑测试（钱/权限/删除三类必须覆盖）
- [ ] **Harness 门禁**：pre-commit 含 gitleaks + 类型检查 + lint；CI 三分钟内出结果；归档前人工确认 + 产物完整性检查
- [ ] `/healthz` 检查真实依赖并返回 git sha
- [ ] 回滚脚本存在且**实测过**，记录恢复耗时
- [ ] **可复用 Skills 库**：至少提取 2 个本次项目中沉淀的 AI 行为约束，写成可复用的 skill 定义
- [ ] AI 参与度与返工点记录（见下）

### 分阶段实施

**第一阶段：验证与规格（约 1.5 小时）**

先别写代码。按 L17-02 的五个问题把想法过一遍：

```markdown
# 一页纸方案
## 问题
谁，在什么场景下，现在怎么解决，有多痛？

## 最脆弱的假设
写下来。如果这条不成立，整件事就不成立。

## 验证方式与结果
（不要写「我觉得」，写你实际做了什么、看到了什么）

## 范围
必须有：
明确不做：

## 成功标准
两周后什么现象出现，说明这事值得继续？
```

「明确不做」那一栏要写满至少五条。写不出来说明你还没想清楚边界，这时候动手，AI 会顺着你的模糊描述把范围越铺越大。

然后用 OpenSpec 把方案转成规格：

```bash
# Step 1: OpenSpec explore —— 不写代码，先探索
npm install -g @fission-ai/openspec
openspec init
```

```text
/opsx:explore 基于一页纸方案，探索技术方案。
重点对比：
1. 技术栈选型（至少 2 种组合）
2. 数据模型设计（至少 2 种方案）
3. 关键风险点（至少 3 个）
4. 有没有现成的方案可以复用？
```

```text
# Step 2: Superpowers brainstorming —— 发散功能优先级
用 brainstorming skill 发散这个产品的功能优先级。
先发散（至少列出 15 个功能点子），再按"用户价值/实现成本"矩阵收敛到 5 个 MVP 功能。
```

```text
# Step 3: OpenSpec propose —— 生成四份规格文件
/opsx:propose 基于 explore 和 brainstorming 的结果，
生成完整的 proposal.md + specs/ + design.md + tasks.md。
重点：proposal 里要写清楚"不在范围"和"风险"。
```

规格写完有个自检：**把 specs/ 发给 AI，让它按规格写测试（不给实现）。如果它写出来的测试和你预期的行为对不上，说明规格有歧义**，改规格不改测试。

**第二阶段：上下文与骨架（约 1 小时）**

建两个文件，然后用 Superpowers writing-plans 拆任务：

```
CONVENTIONS.md   —— 目录结构、命名、错误处理方式、依赖红线、样式 token
AI_BOUNDARIES.md —— 哪些代码全权交给 AI、哪些受限、哪些红线不许碰
```

`AI_BOUNDARIES.md` 里至少要有三条红线。参考起点：鉴权与权限判断必须自己写、涉及扣费的计算必须自己写、数据删除逻辑必须自己写。

```text
# Step 4: Superpowers writing-plans
用 writing-plans skill 把 tasks.md 里的每个 task 拆成
"给初级工程师也能执行"的粒度。每个 task 包含：
输入 / 输出 / 验收标准 / 前置条件 / 预估时间。
```

搭骨架时的顺序建议：**先把数据模型和接口契约定下来，再让 AI 填实现**。反过来（先让它写实现再倒推模型）会得到一个到处都是特例的数据结构。

**第三阶段：功能实现（约 2 小时）**

这是 Superpowers 密集使用的阶段。每轮节奏：

```text
# Step 5: OpenSpec apply + Superpowers 密集执行
/opsx:apply 按 tasks.md 逐条实现。

每实现一个 task：
1. TDD skill：先写失败测试 → 写最小实现 → 测试通过 → 重构
2. subagent-driven-development skill：独立任务并行派发 subagent
3. requesting-code-review skill：每个 subagent 产出自动 review
4. verification-before-completion skill：完成前强制自检
```

每轮提交的粒度控制在「一条规则」。粒度大了，出问题无法二分定位。

每轮做完三问自检：为什么在这里 / 输入范围 / 坏了怎么表现。答不上来 → 要它解释或重写；答得上来 → 跑测试 → 提交。

**第四阶段：前端与 UI Skills 约束（约 1.5 小时）**

这是 L17-15 的落地。先定 token 和约束，再生成页面：

```text
# Step 6: UI Skills —— 设计 token 固化
用 UI Skills 的 design-tokens skill 帮我定义设计 token：

要求：
1. 至少 10 个 token：颜色（主色/辅色/背景/文字/边框）、间距（xs/sm/md/lg/xl）、字号、圆角
2. 输出格式：design-tokens.json（CSS 变量 + Tailwind 映射）
3. 暗色/亮色双主题各一套
4. 每个 token 标注用途（哪个组件在用）
```

```json
// design-tokens.json 示例结构
{
  "colors": {
    "primary": { "value": "#3B82F6", "cssVar": "--color-primary", "tailwind": "blue-500" },
    "background": { "value": "#0F172A", "cssVar": "--color-bg", "tailwind": "slate-900" }
  },
  "spacing": {
    "xs": { "value": "4px", "cssVar": "--space-xs" },
    "sm": { "value": "8px", "cssVar": "--space-sm" }
  }
}
```

```text
# Step 7: UI Skills —— 约束文档 + 自动审查
1. 用 UI Skills 生成 ui-constraints.md，包含：
   - a11y checklist（颜色对比度、焦点可见、aria label、语义 HTML）
   - 响应式 checklist（375px/768px/1024px 三个断点）
   - 状态矩阵（loading/empty/error/edge 每格的要求）

2. 生成页面后，用 UI Skills 的审查 skill 自动检查：
   - 所有按钮是否有可区分的 aria-label？
   - 所有图片是否有 alt 文本？
   - 焦点环是否可见？
   - 375px 下是否有横向滚动？
   - 颜色对比度是否满足 WCAG AA？
```

然后打开 L17-06 的状态矩阵，对你的每个页面逐格过一遍。把决定要做的那些写成一段 Prompt 约束，一次性让 AI 补齐，不要一格一格地问。

最后做两件五分钟的事：拔掉鼠标 Tab 走一遍主流程；浏览器切 375px 从上滚到底。

**第五阶段：流水线与 Harness 门禁（约 1 小时）**

把 L17-14 的三级门禁完整落地：

```bash
# 1. 安装 husky（Git hooks 管理）
pnpm add -D husky
pnpm exec husky init

# 2. 配置 pre-commit hook（Gate 0-3）
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
echo "Gate 0: Type check..."
pnpm tsc --noEmit || exit 1

echo "Gate 1: Lint..."
pnpm eslint . --ext .ts,.tsx --max-warnings 0 || exit 1

echo "Gate 2: Curriculum check..."
pnpm check --strict || exit 1

echo "Gate 3: Security scan..."
git diff --cached | grep -E "(API_KEY|SECRET|TOKEN)\s*=\s*['\"][^$]" && exit 1 || true
pnpm audit --audit-level=high && exit 1 || true

echo "Pre-commit gates passed"
EOF
chmod +x .husky/pre-commit
```

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

# 防止同一分支多次 push 导致并发构建堆积
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Gate 3 - Curriculum Check
        run: pnpm check

      - name: Gate 4 - Tests
        run: pnpm test -- --coverage

      - name: Gate 5 - Build
        run: pnpm build

      - name: Gate 6 - E2E Smoke
        run: |
          pnpm dev &
          sleep 5
          curl -s http://localhost:5173 | grep "AI Agent" || exit 1
```

加一个回滚脚本，然后**故意部署一个坏版本**，跑回滚，计时。这个演练是整个项目里最容易被跳过、也最不该跳过的一步。

**第六阶段：归档与 Skills 沉淀（约 0.5 小时）**

```text
# Step 8: OpenSpec archive
/opsx:archive <feature-name>

归档前确认（Gate 7-8）：
1. proposal.md 的"不在范围"有没有引入？
2. specs/ 的验收标准是否全部满足？
3. design.md 的技术方案是否与实际实现一致？
4. tasks.md 的 task 是否全部标记完成？
5. 归档产物完整性检查（proposal + specs + design + tasks 全部存在）
```

**可复用 Skills 库**：从本次项目中提取至少 2 个可复用的 AI 行为约束，写成 skill 定义。例如：

```markdown
# skills/ui-review.md —— 可复用的 UI 审查 skill

## 触发条件
任何涉及 UI 组件创建或修改的 task 完成后，自动触发此 skill。

## 行为
1. 检查所有交互元素是否有可区分的 aria-label
2. 检查 375px 宽度下无横向滚动
3. 检查颜色对比度满足 WCAG AA（至少 4.5:1）
4. 检查焦点环可见
5. 不通过 → 阻断 task 完成标记

## 沉淀来源
P17 项目中发现 AI 生成的按钮缺少 aria-label、375px 下表格溢出。
```

```markdown
# skills/pre-commit-guard.md —— 可复用的提交前检查 skill

## 触发条件
每次 git commit 前自动触发。

## 行为
1. 检查是否有硬编码的密钥（API_KEY、SECRET、TOKEN、PASSWORD）
2. 检查是否有 console.log 遗留
3. 检查是否有未使用的 import
4. 不通过 → 拒绝提交，打印具体违规位置

## 沉淀来源
P17 项目中发现 AI 在示例代码里写了 `openai.api_key = "sk-..."` 然后忘记删。
```

这些 skill 定义放在 `skills/` 目录下，可以带到下一个项目继续用。**这是 L17-13 里"复利资产"的落地——每次项目沉淀 2-3 条 skill，第三个项目 AI 的产出质量会有明显提升。**

### 关键产出：AI 参与度与返工点记录

这份记录比代码本身更有价值 —— 代码是这一次的产物，记录是你下次能做得更快的依据。

建议用表格逐任务记：

| 任务 | 委托方式 | 工作流 | AI 产出可用度 | 返工原因 | 下次怎么改进 |
|------|---------|--------|--------------|---------|-------------|
| 用户列表 CRUD | 全权 | subagent+TDD | 直接可用 | — | 这类继续全权 |
| 权限中间件 | 不可委托 | 自己写 | — | — | 保持 |
| 搜索排序 | 受限 | TDD+review | 改了 3 轮 | 规格里没写并列时怎么排 | 规格补「排序必须全序」 |
| 骨架屏 | 全权 | UI Skills 审查 | 返工 1 轮 | 没说高度要和真实行一致 | 加进 CONVENTIONS.md |
| 暗色模式 | 全权 | OpenSpec propose→apply | 改了 2 轮 | design.md 没写代码高亮色方案 | design.md 补「代码高亮色单独处理」 |

填完之后回答三个问题：

1. **返工最多的是哪一类任务？** 这类任务下次要么升级委托方式（受限→自己写），要么补规格。
2. **哪些返工的根因是「我没说清楚」而不是「AI 不行」？** 这部分占比通常在七成以上，是你能直接改进的部分。
3. **有没有哪条约束加进 CONVENTIONS.md 或 Skills 库之后，同类返工就消失了？** 把它固化下来。

第 3 条是这份记录的复利所在：每个项目沉淀三五条约定或二三个 skill，第三个项目的返工率会明显低于第一个。

### 常见翻车点

**范围失控。** 一周做不完的第一信号是「明确不做」写不满五条。发现范围大了就砍，砍到只剩一个核心功能。

**从代码倒推规格。** 先让 AI 写，写完再补一份描述它的规格 —— 这样的规格没有约束力，它只是实现的复读机。规格必须先于实现。**OpenSpec 的 explore→propose→apply 顺序就是防这个。**

**跳过 OpenSpec 的 explore。** 直接 propose 然后 apply，中间少了"不写代码先探索"。结果是写到一半发现方案有问题，返工成本远高于 explore 花的时间。

**上下文全量投喂。** 每次把整个仓库丢进去，token 贵、效果差、还容易引入不相关的改动。按 L17-04 的同心圆给上下文。

**测试跟着实现写。** 让 AI 读实现写测试，测试会把 bug 一起固化。测试从 specs/ 来，用 Superpowers 的 TDD skill 强制红→绿→重构。

**跳过回滚演练。** 「回滚脚本我写了，应该没问题」—— 没跑过的脚本在半夜出事时的成功率，比你想象的低得多。

**只在理想数据下点过。** 自己造的测试数据永远是干净的。用超长文本、空列表、断网状态各点一遍。

**跳过 UI Skills 审查。** 让 AI 生成页面后不跑审查 skill，结果是 375px 下横向滚动、按钮没有 aria-label、颜色对比度不达标。审查 skill 跑一次只要 30 秒，但能拦住大量"看起来能跑、用起来难受"的问题。

**门禁配了但不跑。** pre-commit hook 配好了但用 `--no-verify` 跳过，CI 配好了但从没看过红灯。门禁的价值是"阻断过一次"之后才体现的——没被阻断过，说明门禁设得太松或者根本没跑。

### 交付形式

一个 Git 仓库，包含：

```
README.md                    # 这是什么、怎么本地跑、线上地址
openspec/
  changes/
    <feature>/
      proposal.md            # OpenSpec 提案（不在范围 ≥5 条，风险 ≥3 条）
      specs/                 # 需求规格
      design.md              # 技术方案
      tasks.md               # 实现清单（含完成状态）
  specs/                     # 当前生效的规格
docs/
  one-pager.md               # 一页纸方案
  brainstorm-record.md       # Superpowers brainstorming 发散→收敛记录
  ui-state-matrix.md         # 状态矩阵自检表
  ui-review-report.md        # UI Skills 审查通过记录
  ai-log.md                  # AI 参与度与返工点记录
  tdd-log.md                 # TDD 红→绿→重构循环日志
CONVENTIONS.md
AI_BOUNDARIES.md
design-tokens.json           # UI Skills 设计 token
ui-constraints.md            # UI Skills 约束文档（a11y + 响应式 + 状态矩阵）
skills/                      # 可复用 Skills 库（≥2 个 skill 定义）
  ui-review.md
  pre-commit-guard.md
src/                         # 代码
tests/                       # 测试
.github/workflows/           # CI/CD（含 Gate 4-6）
.husky/pre-commit            # Gate 0-3
scripts/rollback.sh          # 回滚（附实测耗时）
```

### 自检问题

交付前问自己：

- 陌生人不看任何说明，能完成主流程吗？（找一个真的陌生人试，看他在哪卡住）
- 我能逐段解释仓库里的每一处代码吗？答不上来的地方标出来了吗？
- 线上挂了，我从发现到恢复需要多少秒？这个数字是实测的吗？
- `openspec/changes/` 下的四份文件都在吗？proposal 的"不在范围"写满五条了吗？
- brainstorming 记录里有明确的发散阶段和收敛阶段吗？还是直接跳到了结论？
- UI Skills 审查跑过了吗？审查报告里有几个"不通过"？修了吗？
- pre-commit hook 被触发过吗？有没有被 `--no-verify` 跳过？
- 如果明天有人愿意付钱，我需要多久能加上收款？（这个问题引出 M18）

::interactive{type="acceptanceChecklist"}

### 要点总结

- **做你自己真会用的东西**：不用它，你就判断不了好坏，也不会有动力做完最后 20%。
- 规模控制在**一个核心功能、两三个页面、一周做完**；范围大是首要失败原因。
- **OpenSpec 四步**：explore（不写代码先探索）→ propose（四份规格文件）→ apply（逐 task 实现）→ archive（归档+更新知识库）。顺序不能乱。
- **Superpowers 六 skill 组合**：brainstorming → writing-plans → TDD → subagent → code-review → verification。每个 task 都走这个闭环。
- **UI Skills 三步**：定义 design-tokens.json → 写 ui-constraints.md → 自动审查。审查不过，task 不算完成。
- **Harness 三级门禁**：pre-commit（Gate 0-3，秒级）→ CI（Gate 4-6，分钟级）→ 归档前（Gate 7-8，人工确认）。分层阻断，越早发现问题成本越低。
- 「明确不做」要写满**至少五条**，写不出来说明边界没想清楚。
- 规格自检法：**让 AI 按 specs/ 写测试（不给实现）**，测试和预期对不上就是规格有歧义。
- 实现节奏是「一条规则一次提交」，每轮做**三问自检**（为什么在这里 / 输入范围 / 坏了怎么表现）。
- 状态矩阵**一次性批量补**，不要一格一格问；键盘走查和 375px 走查各五分钟，回报极高。
- **回滚必须实测**并记录耗时；没跑过的脚本在真出事时不可信。
- 最有价值的产出不是代码，是 **AI 参与度与返工点记录** + **可复用 Skills 库**：七成以上的返工根因是「我没说清楚」，这部分能靠沉淀约定和 skill 直接消除。