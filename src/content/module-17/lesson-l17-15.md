## 生产级 UI 约束：用 Skills 让 AI 产出美观可用的前端

L17-13 讲了用 Superpowers skills 控制 AI 的行为流程。这一节讲一个更具体的场景：**用 Skills 让 AI 产出的 UI 代码不是"能跑就行"，而是美观、可访问、响应式、符合设计规范。**

这是 AI Coding 最大的痛点之一：AI 生成的后端逻辑通常能用，但生成的 UI 往往"功能对但丑"——间距不对、颜色不一致、没有 loading 状态、没有 error 状态、键盘不可用、屏幕缩小就崩。

### 为什么 AI 生成的前端不好看

四个根本原因：

1. **AI 没见过你的设计系统**。它知道 Tailwind 的 class 名字，但不知道你的品牌色是什么、间距档位是几档、圆角用多大。所以它"猜"——猜出来的结果就是每个组件风格都不一样。
2. **AI 只生成"阳光明媚"的状态**。你问"做一个登录表单"，AI 给你一个能填用户名密码的表单。但 loading 态呢？error 态呢？空态呢？表单验证呢？键盘操作呢？AI 不会主动想这些。
3. **AI 不考虑可访问性**。`<div onClick>` 而不是 `<button>`，没有 `aria-label`，没有 focus 样式，颜色对比度不够。AI 默认写的代码是"看得见的人用鼠标操作"的代码。
4. **AI 不知道"这个项目里已经有这个组件了"**。你说"加一个弹窗"，AI 从头写一个 Modal，而不是用项目里已有的 `<Dialog>` 组件。

**解决方案**：把设计约束固化为 AI 可消费的 Skills，让 AI 在生成 UI 代码时自动遵守。

### 三个 UI Skills 的架构

```
┌─────────────────────────────────────────────┐
│ design-tokens Skill                         │
│ 告诉 AI：颜色 / 间距 / 圆角 / 阴影 / 字体   │
│ 职责：风格一致性                             │
└─────────────────────────────────────────────┘
  ↓ 约束
┌─────────────────────────────────────────────┐
│ ui-generation Skill                         │
│ 告诉 AI：怎么写组件、状态矩阵怎么覆盖         │
│ 职责：组件质量                               │
└─────────────────────────────────────────────┘
  ↓ 产出
┌─────────────────────────────────────────────┐
│ ui-review Skill                             │
│ 检查：可访问性 / 响应式 / 状态覆盖 / 组件复用  │
│ 职责：质量把关                               │
└─────────────────────────────────────────────┘
```

### Skill 1：design-tokens —— 把设计系统固化为约束

不要让 AI "猜"你的设计系统。给它一份精确的定义文件：

```yaml
# design-tokens.yml
# 这是 AI 生成 UI 时唯一可用的颜色、间距、圆角、阴影值。
# 禁止使用此文件之外的值。

colors:
  brand:
    primary: "#6366f1"     # Indigo-500
    primary-hover: "#4f46e5"
    primary-light: "#e0e7ff"
    primary-dark: "#4338ca"
  ink:
    base: "#0f172a"        # Slate-900
    muted: "#64748b"       # Slate-500
    subtle: "#94a3b8"      # Slate-400
    inverse: "#ffffff"
  surface:
    page: "#f8fafc"        # Slate-50
    card: "#ffffff"
    elevated: "#ffffff"
    overlay: "rgba(0,0,0,0.5)"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"

radius:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"

shadow:
  sm: "0 1px 2px rgba(0,0,0,0.05)"
  md: "0 4px 6px rgba(0,0,0,0.07)"
  lg: "0 10px 15px rgba(0,0,0,0.1)"

typography:
  font-family: "'Inter', system-ui, sans-serif"
  font-mono: "'JetBrains Mono', monospace"
  sizes:
    xs: "12px"
    sm: "14px"
    base: "16px"
    lg: "18px"
    xl: "20px"
    2xl: "24px"
    3xl: "30px"
```

把这个文件注册为一个 skill：

```markdown
# .claude/skills/design-tokens/SKILL.md

## 设计约束

在生成任何 UI 代码前，先读取 `design-tokens.yml`。
所有颜色、间距、圆角、阴影、字体必须使用 tokens 中定义的值。
**禁止使用 tokens 之外的值。** 如果需要新值，先更新 tokens 文件。

## Tailwind 映射

本项目使用 Tailwind CSS。tokens 已映射到 `tailwind.config.ts` 的 `theme.extend`。
使用 Tailwind class 而非内联样式。

## 暗色模式

本项目默认暗色模式。所有组件必须同时适配暗色和亮色。
使用 CSS 变量（定义在 `:root` 和 `html.light` 中），不要用 Tailwind 的 `dark:` 前缀。
```

**关键**：`design-tokens` skill 不只是一个"参考文档"——它是 Superpowers 体系下的一个**硬约束 skill**。AI 在生成 UI 代码时，Superpowers 的 `verification-before-completion` 会检查"是否使用了 tokens 之外的值"。如果用了，打回重写。

### Skill 2：ui-generation —— 状态矩阵驱动生成

一个组件不是只有一个"正常"状态。每个组件有**状态矩阵**：

```
              │ 正常        │ Loading    │ Empty      │ Error      │
──────────────┼─────────────┼────────────┼────────────┼────────────┤
Button        │ 可点击       │ 禁用+spinner│ -          │ -          │
Form          │ 可填写       │ 提交中      │ -          │ 验证错误    │
List          │ 有数据       │ 加载骨架屏  │ 空态提示    │ 错误+重试   │
Dialog        │ 打开         │ 确认中      │ -          │ 操作失败    │
Data Display  │ 有数据       │ 骨架屏      │ 空态插图    │ 错误+重试   │
```

`ui-generation` skill 要求 AI 在生成每个组件时，**必须覆盖所有适用的状态**：

```markdown
# .claude/skills/ui-generation/SKILL.md

## 组件生成规则

每生成一个 UI 组件，必须覆盖以下状态（按适用情况）：

1. **正常态**：默认渲染。数据从 props 来，不写死假数据。
2. **Loading 态**：数据加载中。用骨架屏（Skeleton）而非 spinner，除非操作 < 1 秒。
3. **Empty 态**：数据为空。给出友好提示 + 引导操作（如"创建第一条"）。
4. **Error 态**：请求失败。显示错误信息 + 重试按钮。
5. **Edge 态**：极端情况。超长文本截断、大量数据分页、屏幕宽度 < 320px 不崩溃。

## 组件编写规范

- 交互元素必须用 `<button>` 而非 `<div onClick>`。如果是链接，必须用 `<a href>`。
- 表单必须有 `<label>` 关联到 `<input>`（`htmlFor` + `id`）。
- 图片必须有 `alt` 属性。装饰性图片用 `alt=""`。
- 颜色对比度必须满足 WCAG AA（4.5:1 正常文本，3:1 大文本）。
- 所有交互元素必须有 focus 可见样式（`focus:ring-2 focus:ring-brand-primary`）。
- 响应式：移动优先。先写 mobile 布局，再用 `md:` `lg:` 断点增强。

## 禁止事项

- 禁止用 `<div onClick>` 做按钮——用 `<button>`。
- 禁止硬编码颜色——用 design tokens。
- 禁止写死假数据——从 props 取。
- 禁止忽略 loading/empty/error 状态——每个组件至少覆盖两种状态。
- 禁止在组件里写 `useEffect` 发请求——数据获取逻辑抽到 hooks 或 loader 里。
```

### Skill 3：ui-review —— 自动审查 UI 产出

`ui-review` skill 在 AI 生成 UI 代码后自动执行审查。它检查六件事：

```markdown
# .claude/skills/ui-review/SKILL.md

## 审查清单

每生成一个 UI 组件后，逐条检查：

### 1. 可访问性（A11y）
- [ ] 交互元素是否使用了正确的语义标签（button / a / input / select）？
- [ ] 表单输入是否有 label 关联？
- [ ] 图片是否有 alt 属性？
- [ ] 颜色对比度是否满足 WCAG AA？
- [ ] 是否可以通过键盘完整操作（Tab / Enter / Escape）？
- [ ] focus 样式是否可见？

### 2. 响应式
- [ ] 移动端（320px）布局是否不崩溃？
- [ ] 平板端（768px）布局是否合理？
- [ ] 桌面端（1024px+）是否利用了大屏空间？
- [ ] 是否有横向滚动条（不应该有）？

### 3. 状态覆盖
- [ ] 是否覆盖了 Loading 态？
- [ ] 是否覆盖了 Empty 态？
- [ ] 是否覆盖了 Error 态？
- [ ] 是否处理了极端情况（超长文本、大量数据）？

### 4. 设计一致性
- [ ] 所有颜色、间距、圆角是否来自 design tokens？
- [ ] 字体大小是否在 typography 档位中？
- [ ] 是否使用了项目已有的组件而非重复实现？

### 5. 代码质量
- [ ] 组件是否有明确的 TypeScript props 类型？
- [ ] 数据获取逻辑是否在组件外（hooks / loader）？
- [ ] 是否避免了不必要的 re-render（useMemo / useCallback）？

### 6. 禁止模式
- [ ] 没有 `<div onClick>` 做按钮
- [ ] 没有硬编码颜色
- [ ] 没有写死假数据
- [ ] 没有在组件里直接发请求
```

### 实战：用 UI Skills 生成一个搜索组件

假设你要 AI 生成一个"搜索+结果列表"组件。传统 prompt：

```text
# 传统方式（不推荐）
做一个搜索框，输入关键词后显示搜索结果列表。
```

AI 产出：一个 `<input>` + `<ul>` 列表。没有 loading 态，没有 error 态，没有空态，搜索框没有 label，列表项是 `<div onClick>`。

**用 UI Skills 后的 prompt**：

```text
# 用 UI Skills（推荐）
请用 design-tokens 和 ui-generation skill 生成一个搜索组件：
- 搜索框 + 结果列表
- 数据源：POST /api/search { query: string } → { items: SearchResult[] }
- 组件名：SearchPanel
```

AI 产出（经过 skills 约束）：

```typescript
// SearchPanel.tsx —— AI 在 UI Skills 约束下生成的代码
import { useState, useCallback } from 'react'
import { useSearch } from '@/hooks/useSearch'
import { SearchResult } from '@/types'
import { Skeleton } from '@/components/Skeleton'
import { ErrorBlock } from '@/components/ErrorBlock'
import { EmptyState } from '@/components/EmptyState'

interface SearchPanelProps {
  onSelect: (item: SearchResult) => void
}

export function SearchPanel({ onSelect }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const { results, isLoading, error, retry } = useSearch(query)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }, [])

  return (
    <div className="flex flex-col gap-md" role="search">
      {/* 搜索框：有 label、有 aria、有 focus 样式 */}
      <div className="flex flex-col gap-xs">
        <label htmlFor="search-input" className="text-sm text-ink-muted">
          搜索
        </label>
        <input
          id="search-input"
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="输入关键词搜索..."
          className="w-full px-md py-sm rounded-md border border-ink-subtle
                     bg-surface-card text-ink-base
                     focus:ring-2 focus:ring-brand-primary focus:border-transparent
                     placeholder:text-ink-subtle"
          autoComplete="off"
        />
      </div>

      {/* 结果区域：三种状态各自覆盖 */}
      {isLoading && (
        <div className="flex flex-col gap-sm" aria-label="加载中">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {error && (
        <ErrorBlock
          message={`搜索失败：${error.message}`}
          onRetry={retry}
        />
      )}

      {!isLoading && !error && results.length === 0 && query.length > 0 && (
        <EmptyState
          icon="search"
          title="没有找到结果"
          description={`未找到与"${query}"相关的内容，试试其他关键词`}
          action={{ label: '清空搜索', onClick: () => setQuery('') }}
        />
      )}

      {!isLoading && !error && results.length > 0 && (
        <ul className="flex flex-col gap-sm" role="listbox" aria-label="搜索结果">
          {results.map((item) => (
            <li key={item.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="w-full text-left p-md rounded-md bg-surface-card
                           hover:bg-brand-primary-light
                           focus:ring-2 focus:ring-brand-primary
                           transition-colors"
              >
                <h3 className="text-base font-medium text-ink-base truncate">
                  {item.title}
                </h3>
                <p className="text-sm text-ink-muted mt-xs line-clamp-2">
                  {item.description}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**对比传统方式，Skills 约束下的产出多出了**：
- `<label htmlFor="search-input">` 关联到 `<input id="search-input">`——可访问性
- `role="search"` `role="listbox"` `role="option"`——语义化
- `aria-label="加载中"` `aria-selected={false}`——屏幕阅读器
- `focus:ring-2 focus:ring-brand-primary`——键盘可操作
- `isLoading` → `<Skeleton>` 骨架屏——Loading 态
- `error` → `<ErrorBlock>` + 重试按钮——Error 态
- `results.length === 0` → `<EmptyState>` + 清空操作——Empty 态
- `truncate` + `line-clamp-2`——边界情况（超长文本）
- 颜色来自 design tokens（`bg-surface-card` `text-ink-muted` `brand-primary`）——设计一致性
- 数据获取在 `useSearch` hook 里，组件只负责渲染——关注点分离

### 用 ui-review skill 自动审查

AI 生成完 `SearchPanel.tsx` 后，`ui-review` skill 自动运行：

```text
🔍 UI Review: SearchPanel.tsx

✅ 可访问性：
  - 语义标签：input、button、ul/li ✓
  - label 关联：htmlFor="search-input" ✓
  - focus 样式：focus:ring-2 ✓
  - 颜色对比度：bg-surface-card + text-ink-base 满足 WCAG AA ✓

✅ 响应式：
  - 移动端：flex-col 布局，w-full 输入框 ✓
  - 无横向滚动条 ✓

✅ 状态覆盖：
  - Loading：Skeleton 骨架屏 ✓
  - Empty：EmptyState + 清空操作 ✓
  - Error：ErrorBlock + 重试 ✓
  - Edge：truncate + line-clamp-2 ✓

✅ 设计一致性：
  - 所有颜色来自 design tokens ✓
  - 间距：gap-md、p-md、px-md、py-sm ✓
  - 圆角：rounded-md ✓

✅ 代码质量：
  - TypeScript props 类型：SearchPanelProps ✓
  - 数据获取在 useSearch hook ✓
  - useCallback 避免不必要的 re-render ✓

❌ 禁止模式：未发现

总评：PASS（6/6 类别通过）
```

如果审查不通过——比如 AI 用了 `<div onClick>` 而不是 `<button>`——`ui-review` 会标出问题并打回。AI 收到反馈后修复，再次审查通过后才算完成。

### 四个 Skills 的协作关系

在完整工作流中，四个 Skills 的协作：

```text
step 1: design-tokens skill
  → 读取 tokens 文件，激活设计约束
  → AI 知道"只能用什么颜色/间距/圆角"

step 2: ui-generation skill
  → 激活状态矩阵规则
  → AI 生成组件，覆盖所有状态

step 3: ui-review skill
  → 自动审查 6 个维度
  → 不通过 → 打回修复 → 重新审查

step 4: verification-before-completion skill（Superpowers 通用）
  → 最终检查：ui-review 是否通过？所有状态是否覆盖？
  → 全部通过 → 标记 task 完成
```

### 实战：用 Python 验证设计约束

Skills 定义了约束，但怎么验证 AI 的产出是否真的遵守了？写脚本自动检查：

```python
# scripts/check_design_tokens.py —— 验证设计 token 完整性 + AI 产出合规性
import sys, re, json
from pathlib import Path
from typing import Any

def load_tokens(path: str = "design-tokens.json") -> dict[str, Any] | None:
    """加载设计 token 文件，支持 JSON 和 YAML 格式。"""
    p = Path(path)
    if not p.exists():
        print(f"✗ 设计 token 文件不存在：{path}")
        return None

    if p.suffix in (".yml", ".yaml"):
        try:
            import yaml  # type: ignore
            return yaml.safe_load(p.read_text())
        except ImportError:
            print("⚠ 需要 pip install pyyaml 来读取 YAML 格式")
            return None

    return json.loads(p.read_text())

def validate_tokens(tokens: dict) -> list[str]:
    """验证 token 定义的完整性。"""
    issues = []

    # 基础结构检查
    for key in ["colors", "spacing", "radius", "typography"]:
        if key not in tokens:
            issues.append(f"缺少 token 类别：{key}")

    # 检查颜色至少 3 个品牌色 + 4 个墨色色阶
    if "colors" in tokens:
        colors = tokens["colors"]
        brand = colors.get("brand", {}) or colors.get("primary", {})
        ink = colors.get("ink", {})

        brand_count = len(brand) if isinstance(brand, dict) else 1
        ink_count = len(ink) if isinstance(ink, dict) else 1

        if brand_count < 3:
            issues.append(f"品牌色数量不足（{brand_count}<3）")
        if ink_count < 4:
            issues.append(f"墨色色阶不足（{ink_count}<4）")

    # 检查间距至少 4 档
    if "spacing" in tokens:
        sp = tokens["spacing"]
        if isinstance(sp, dict) and len(sp) < 4:
            issues.append(f"间距档位不足（{len(sp)}<4）")

    return issues

def check_ui_code_compliance(filepath: str, tokens: dict | None) -> list[str]:
    """检查 UI 代码是否使用 tokens 之外的硬编码颜色或间距。"""
    issues = []
    content = Path(filepath).read_text() if Path(filepath).exists() else ""

    if not content:
        return [f"文件不存在：{filepath}"]

    # 提取 tokens 中定义的可接受值
    allowed_tokens: set[str] = set()
    if tokens:
        for category in tokens.values():
            if isinstance(category, dict):
                for val in category.values():
                    if isinstance(val, str) and (val.startswith("#") or val.endswith("px")):
                        allowed_tokens.add(val)

    # 检查硬编码的颜色（十六进制）
    hex_colors = set(re.findall(r'#[0-9a-fA-F]{6}', content.lower()))
    hardcoded = hex_colors - allowed_tokens
    if hardcoded:
        issues.append(f"硬编码颜色（tokens 外）：{', '.join(sorted(hardcoded)[:5])}")

    # 检查硬编码的 px 值
    px_values = set(re.findall(r'(\d+)px', content))
    # 忽略 0px、常见的 token 值
    suspicious = {v for v in px_values if v != "0" and v not in {"4", "8", "16", "24", "32", "48"}}
    if suspicious:
        issues.append(f"可疑的硬编码间距（px）：{', '.join(sorted(suspicious)[:5])}")

    # 检查 div onClick（应使用 button）
    if re.search(r'<div[^>]*\bonClick', content) and "<button" not in content.lower():
        issues.append("检测到 <div onClick>，应使用 <button>")

    # 检查图片 alt 属性
    img_tags = re.findall(r'<img[^>]*>', content)
    no_alt = [t for t in img_tags if 'alt=' not in t]
    if no_alt:
        issues.append(f"检测到 {len(no_alt)} 个 <img> 缺少 alt 属性")

    return issues

def calculate_contrast_ratio(fg: str, bg: str) -> float:
    """计算 WCAG 颜色对比度。"""
    def _lum(hex_color: str) -> float:
        hex_color = hex_color.lstrip("#")
        r, g, b = [int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)]
        # sRGB → 线性 RGB
        r = r / 12.92 if r <= 0.04045 else ((r + 0.055) / 1.055) ** 2.4
        g = g / 12.92 if g <= 0.04045 else ((g + 0.055) / 1.055) ** 2.4
        b = b / 12.92 if b <= 0.04045 else ((b + 0.055) / 1.055) ** 2.4
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    l1, l2 = _lum(fg), _lum(bg)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

if __name__ == "__main__":
    print("=" * 60)
    print("设计 Token 验证 + UI 代码合规检查")
    print("=" * 60)

    tokens = load_tokens()
    if tokens:
        token_issues = validate_tokens(tokens)
        if token_issues:
            for i in token_issues:
                print(f"  ✗ {i}")
        else:
            print("  ✓ 设计 token 定义完整")

        # 验证关键颜色组合的对比度
        colors = tokens.get("colors", {})
        ink = colors.get("ink", {})
        surface = colors.get("surface", {})
        if ink and surface:
            text_on_bg = calculate_contrast_ratio(
                ink.get("base", "#000000"),
                surface.get("page", "#ffffff"),
            )
            aa_pass = text_on_bg >= 4.5
            print(f"  {'✓' if aa_pass else '✗'} 正文/背景对比度 = {text_on_bg:.1f}:1"
                  f" {'(WCAG AA 通过)' if aa_pass else '(不满足 WCAG AA 4.5:1)'}")

    # 检查项目中最近的 UI 文件
    import glob
    ui_files = glob.glob("src/**/*.tsx", recursive=True)[:5]
    for f in ui_files:
        issues = check_ui_code_compliance(f, tokens)
        if issues:
            print(f"\n  {f}:")
            for i in issues:
                print(f"    ✗ {i}")
        else:
            print(f"\n  ✓ {f} — 合规")
```

这个脚本既验证 token 定义本身的完整性（颜色、间距、圆角、字体是否齐全），又验证 AI 生成的 UI 代码是否遵守 tokens（有没有硬编码颜色、有没有 `<div onClick>` 等禁止模式）。建议放进 pre-commit hook——AI 生成代码后自动跑一次，不合规就阻断提交。

### 动手 5 分钟

1. 为你的 P17 项目创建 `design-tokens.yml`，定义颜色、间距、圆角、阴影、字体。至少包含 3 个品牌色、4 个墨色色阶、4 个间距档位。
2. 把上面的 `check_design_tokens.py` 复制到项目中，跑一次验证 token 完整性。看看你的 token 文件还缺什么。
3. 写一个 `ui-generation` skill 的 SKILL.md，包含你的组件编写规范（至少 5 条规则 + 3 条禁止事项）。
4. （进阶）在 Superpowers 中注册 `ui-review` skill，让它自动审查你后续生成的每个 UI 组件。

**验收标准**：`design-tokens.yml` 完整且能被 AI 读取（路径正确），`check_design_tokens.py` 至少发现 2 处问题（token 缺失或 UI 合规问题），`ui-review` 审查清单至少覆盖 5 个维度。

### 要点总结

- **AI 生成的前端不好看，四个根本原因**：没见过你的设计系统、只生成"阳光明媚"状态、不考虑可访问性、不知道项目已有组件。
- **三个 UI Skills 架构**：`design-tokens`（风格一致性）→ `ui-generation`（组件质量）→ `ui-review`（质量把关）。三者形成闭环。
- **`design-tokens` skill**：把颜色、间距、圆角、阴影、字体固化为精确值，AI 禁止使用 tokens 之外的值。这是风格一致性的基础。
- **`ui-generation` skill**：强制 AI 在生成每个组件时覆盖状态矩阵——正常态、Loading 态、Empty 态、Error 态、Edge 态。禁止 `<div onClick>`、硬编码颜色、写死假数据。
- **`ui-review` skill**：自动审查 6 个维度——可访问性、响应式、状态覆盖、设计一致性、代码质量、禁止模式。不通过就打回修复。
- **Skills 约束下的产出 vs 传统方式**：多出 label 关联、ARIA 属性、focus 样式、骨架屏、Error 态+重试、Empty 态+引导、边界处理、design tokens 一致性。这些都是 AI 默认不会主动做的事。