## AI Coding 工作流框架（下）：Harness 质量门禁——三级防线让 AI 产出可控

L17-13 讲了 OpenSpec（定义"做什么"）和 Superpowers（指导"怎么做"）。但还有一个问题没解决：**谁检查？** AI 生成的代码，谁来保证它不破坏已有功能？谁来保证它符合项目约定？谁来保证没有安全漏洞？

这就是 Harness 门禁的职责——在 AI 产出代码的每一个关键节点，自动触发检查，不通过就阻断。

### 为什么"AI review AI"不够

你会想：AI 生成的代码，让另一个 AI 来 review 不就行了？问题是：

- **同源偏见**：同一个模型生成+review，模型倾向于认可自己风格的东西
- **上下文盲区**：review 的 AI 可能和生成的 AI 一样漏掉同一个边界条件
- **不可执行**：review 发现的问题，没人强制修——"建议"不构成阻塞

**Harness 门禁的核心逻辑**：把"检查"从"建议"变成"硬阻断"。门禁不通过，代码进不了仓库。

下图是 Harness 门禁管道的全景——从代码生成到最终归档，三级防线、九道门禁各自检查什么：

::interactive{type="harnessGatePipeline"}

### 三级防线架构

```
第一级：Pre-commit 门禁（Gate 0-3）
  ↓ 代码即将提交时触发
  ↓ 不过 → 拒绝提交，本地修
  ↓
第二级：Pre-push / CI 门禁（Gate 4-6）
  ↓ 代码推送到远程前/后触发
  ↓ 不过 → CI 红灯，PR 不可合并
  ↓
第三级：归档前门禁（Gate 7-8）
  ↓ OpenSpec archive 前触发
  ↓ 不过 → 拒绝归档，补全缺失产物
```

### Gate 0-8 全流程

#### Gate 0：类型检查（5 秒）

**触发时机**：每次 `git commit` 前。

```bash
# .husky/pre-commit
#!/bin/sh
pnpm tsc --noEmit
```

**阻断规则**：TypeScript 类型错误 → 拒绝提交。AI 生成的代码经常有类型不匹配，这个门禁是最低成本的拦截。

```text
示例阻断：
src/components/AgentPanel.tsx:42:7 - error TS2322:
  Type 'string' is not assignable to type 'Skill[]'.
  → 阻断！AI 把 skills 传成了字符串而不是 Skill 对象数组。
```

#### Gate 1：Lint 与格式化（3 秒）

**触发时机**：Gate 0 通过后。

```bash
# .husky/pre-commit（续）
pnpm eslint . --ext .ts,.tsx --max-warnings 0
pnpm prettier --check .
```

**阻断规则**：ESLint 有 warning 也不行（`--max-warnings 0`）。AI 生成的代码可能有未使用的 import、缺少依赖项的 useEffect 等。

#### Gate 2：课程一致性校验（2 秒）

**触发时机**：Gate 1 通过后。

```bash
pnpm check --strict
```

这是本项目的专属门禁。改课程数据或内容文件后，C1-C15 检查项全部通过才能提交。`--strict` 把 warning 也升级为 error。

#### Gate 3：安全扫描（30 秒）

**触发时机**：Gate 2 通过后。

```bash
# 检查是否引入了硬编码的密钥
git diff --cached | grep -E "(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*['\"][^$]" && exit 1

# 检查是否有已知的恶意依赖
pnpm audit --audit-level=high && exit 1
```

**阻断规则**：
- 硬编码密钥（`API_KEY = "sk-xxx"`）→ 拒绝提交
- `pnpm audit` 有 high/critical 漏洞 → 拒绝提交

**这是 AI 生成代码最常见的坑之一**：AI 在示例代码里写 `openai.api_key = "sk-..."` 然后忘记删。Gate 3 就是防止这种事发生。

#### Gate 4：测试门禁（2-5 分钟）

**触发时机**：pre-push 前（本地）或 CI 中。

```bash
pnpm test -- --coverage --coverageThreshold='{"global":{"branches":70,"functions":70,"lines":70,"statements":70}}'
```

**阻断规则**：
- 任何测试失败 → 拒绝推送
- 覆盖率低于 70% → 拒绝推送

**为什么覆盖率门禁重要**：AI 生成代码的优势是"快"，但"快"的代价是 AI 倾向于跳过测试。Gate 4 强制要求"有测试才给过"。

#### Gate 5：构建门禁（2-3 分钟）

**触发时机**：Gate 4 通过后，CI 中。

```bash
pnpm build
```

**阻断规则**：构建失败 → CI 红灯。AI 可能引入未安装的依赖、写错 import 路径、或者改了 types 但没更新使用处。

#### Gate 6：E2E 冒烟测试（5-10 分钟）

**触发时机**：Gate 5 通过后，CI 中。

```yaml
# .github/workflows/ci.yml
- name: E2E Smoke Test
  run: |
    pnpm dev &
    sleep 5
    curl -s http://localhost:5173 | grep "AI Agent"
    curl -s http://localhost:5173/curriculum | grep "课程大纲"
```

**阻断规则**：关键页面返回 404 或页面内容不包含预期的关键文本 → CI 红灯。

**冒烟测试不是全量测试**——只验证"应用能启动 + 关键页面能访问"。真正的 E2E 测试太重了，不适合每次提交都跑。

#### Gate 7：归档前 Review（人工确认）

**触发时机**：`/opsx:archive` 前。

```text
/opsx:archive 前，请逐条确认：
1. proposal.md 中的"不在范围"项是否确实没有引入？
2. specs/ 中的验收标准是否全部满足？
3. design.md 的技术方案是否与实际实现一致？
4. tasks.md 中的 task 是否全部标记完成？
5. 是否有未提交的代码或未归档的变更记录？
```

**阻断规则**：上述 5 条中任何一条不满足 → 拒绝归档。这是**唯一的人工门禁**——机器检查不了的"设计一致性"问题，人来做最终确认。

#### Gate 8：归档产物完整性（自动）

**触发时机**：Gate 7 通过后，自动执行。

```bash
# 检查归档目录是否完整
ls openspec/changes/archive/dark-mode/proposal.md 2>/dev/null || exit 1
ls openspec/changes/archive/dark-mode/specs/ 2>/dev/null || exit 1
ls openspec/changes/archive/dark-mode/design.md 2>/dev/null || exit 1
ls openspec/changes/archive/dark-mode/tasks.md 2>/dev/null || exit 1
```

**阻断规则**：归档目录缺少任何一份文件 → 拒绝归档。

### 门禁配置：按项目风险等级

不是所有项目都需要 9 个 Gate。按风险等级配置：

| 风险等级 | 适用场景 | 门禁配置 |
|---------|---------|---------|
| **低** | 个人项目、原型验证 | Gate 0（类型检查）+ Gate 5（构建） |
| **中** | 团队项目、有用户使用 | Gate 0-5（加测试 + 安全） |
| **高** | 生产环境、涉及支付/隐私 | Gate 0-8（全部门禁） |

**原则**：低风险项目不要过度工程化。个人原型项目搞 9 个 Gate 是浪费时间。但一旦有人用，至少加 Gate 3（安全）和 Gate 4（测试）。

### 门禁与 OpenSpec + Superpowers 的协作

回头看 L17-13 的工作流，门禁嵌在什么位置：

```text
User: "我想做暗色模式"
  ↓
OpenSpec /opsx:explore   → 探索方案
OpenSpec /opsx:propose   → 生成 proposal + specs + design + tasks
  ↓
Superpowers brainstorming → 发散方案
Superpowers writing-plans  → 实现计划
  ↓
Superpowers subagent + TDD + review + verification
  ↓ Gate 0-3（pre-commit）：类型检查、Lint、课程校验、安全扫描
  ↓ 不通过 → 本地修，不提交
  ↓
git commit → git push
  ↓ Gate 4-6（CI）：测试、构建、E2E 冒烟
  ↓ 不通过 → CI 红灯，PR 不可合并
  ↓
OpenSpec /opsx:archive
  ↓ Gate 7-8（归档前）：人工确认 + 产物完整性
  ↓ 不通过 → 拒绝归档
```

**关键设计**：Gate 0-3 在本地跑（秒级反馈），Gate 4-6 在 CI 跑（分钟级反馈），Gate 7-8 在归档前跑（人工确认）。**分层阻断，越早发现问题成本越低。**

### 实战：为 P17 项目配置三级门禁

```bash
# 1. 安装 husky（Git hooks 管理）
pnpm add -D husky
pnpm exec husky init

# 2. 配置 pre-commit hook（Gate 0-3）
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
echo "🔍 Gate 0: Type check..."
pnpm tsc --noEmit || exit 1

echo "🔍 Gate 1: Lint..."
pnpm eslint . --ext .ts,.tsx --max-warnings 0 || exit 1

echo "🔍 Gate 2: Curriculum check..."
pnpm check --strict || exit 1

echo "🔍 Gate 3: Security scan..."
git diff --cached | grep -E "(API_KEY|SECRET|TOKEN)\s*=\s*['\"][^$]" && exit 1 || true
pnpm audit --audit-level=high && exit 1 || true

echo "✅ Pre-commit gates passed"
EOF
chmod +x .husky/pre-commit

# 3. 配置 CI 工作流（Gate 4-6）
# .github/workflows/ci.yml
```

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install

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

### 动手 5 分钟

1. 为你的 P17 项目安装 husky 并配置 pre-commit hook（Gate 0-3）。
2. 故意写一行类型错误（如 `const x: number = "hello"`），尝试提交，验证 Gate 0 是否阻断。
3. 写一个 `.github/workflows/ci.yml`，包含 Gate 4（测试）和 Gate 5（构建）。
4. 按"低/中/高"风险等级，确定你的 P17 项目需要哪些 Gate，记录在 proposal.md 的"门禁策略"一节。

**验收标准**：pre-commit hook 能阻断类型错误和安全漏洞（故意写一行 `API_KEY = "sk-test"` 然后提交，看 Gate 3 是否拦截）。CI 工作流文件存在且语法正确。

### 要点总结

- **"AI review AI"不够**：同源偏见、上下文盲区、不可执行。Harness 门禁把"检查"从"建议"变成"硬阻断"。
- **三级防线**：pre-commit（Gate 0-3，秒级反馈）→ CI（Gate 4-6，分钟级反馈）→ 归档前（Gate 7-8，人工确认）。分层阻断，越早发现问题成本越低。
- **Gate 0-3（pre-commit）**：类型检查 → Lint → 课程校验 → 安全扫描。AI 最常犯的错（类型错误、硬编码密钥、未使用的 import）在这一层拦截。
- **Gate 4-6（CI）**：测试覆盖率 70%+ → 构建成功 → E2E 冒烟通过。AI 倾向于跳过测试，Gate 4 强制要求"有测试才给过"。
- **Gate 7-8（归档前）**：人工确认设计一致性 + 自动检查产物完整性。这是唯一的人工门禁——机器检查不了的，人来做最终确认。
- **按风险等级配置门禁，不要过度工程化**。个人原型项目 Gate 0+5 就够了，生产环境才需要全部门禁。