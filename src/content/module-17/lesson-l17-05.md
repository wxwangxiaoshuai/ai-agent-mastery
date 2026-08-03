
::interactive{type="uiStateMatrix"}
## AI 生成生产级前端 UI（上）：设计系统与组件约束

> 本课标注"前端特例"——涉及 UI 组件与设计系统，使用 TypeScript/React。

独立开发者做产品，前端往往是最没底的一环。后端跑不跑得通有明确判据，前端"好不好看"却没有——于是很多人的做法是：让 AI 生成一个界面，看着还行就上线了。
上线之后就会发现问题：每个页面的按钮圆角都不一样、间距忽大忽小、五种深浅不同的灰色、在窄屏上错位。**这不是审美问题，是一致性问题**，而一致性恰恰是"看起来专业"和"看起来是练手项目"之间最大的差别。

这一节和下一节解决这件事。上半节讲一致性（设计系统与组件约束），下半节讲健壮性（状态、可访问性、响应式）。

### 为什么 AI 默认产出的是 demo 级 UI

不是模型能力不够，是**你的需求描述里没有任何一致性信息**。

你说"做一个用户列表页"，模型要决定：卡片圆角多大、内边距多少、标题多大、次要文字什么颜色、按钮什么样式……这些它都得**当场发明**。下次你说"做一个设置页"，它再发明一遍。两次发明的结果不可能一样。

人类设计师解决这个问题的办法叫设计系统：把这些决定**提前做一次，然后到处复用**。给 AI 用也是一样的道理——**把决定前置，AI 就不用发明了**。

### 第一步：定义 token，而不是描述风格

很多人的做法是在 Prompt 里写"风格现代简洁，配色以蓝色为主"。这种描述的问题是**不可执行**——"现代简洁"每次解读都不一样。

可执行的形式是 token：

```js
// tailwind.config.js —— 这份配置就是给 AI 的设计契约
export default {
  theme: {
    extend: {
      colors: {
        // 语义化命名，而不是 blue-500 这种表现化命名。
        // 好处：以后换主色只改这里，AI 也不会去猜"哪个蓝算主色"。
        brand: { 300: '#93b4ff', 500: '#4f7cff', 600: '#3d63d8' },
        ink:   { 100: '#f2f4f8', 300: '#c3c9d6', 400: '#8f97a8',
                 500: '#6b7382', 700: '#333a48', 800: '#1f242e', 900: '#141822' },
        danger: { 400: '#f87171', 500: '#ef4444' },
      },
      borderRadius: {
        // 只留三档，AI 就不会在 6px / 7px / 8px 之间随机漫步
        card: '12px',
        control: '8px',
      },
      spacing: {
        // 保留 Tailwind 默认梯度即可，关键是在约定里写死"只用 4 的倍数"
      },
    },
  },
}
```

然后在项目约定里写死用法：

```markdown
## 视觉约定（严格执行）
- 颜色只能用 brand-* / ink-* / danger-*，禁止出现 #hex 和 rgb()
- 圆角只能用 rounded-card（容器）和 rounded-control（按钮/输入框）
- 间距只用 4 的倍数：p-2 p-3 p-4 p-6 p-8，禁止 p-5 p-7
- 字号只用 text-xs / text-sm / text-base / text-lg / text-2xl，中间档不用
- 阴影只用 shadow-sm，不用 shadow-md 及以上（我们靠边框而不是阴影分层）
```

这份约定的价值在于**它把无穷的可能性收敛成有限的选择**。AI 不需要有品味，它只需要在你给的 5 个字号里挑一个——这件事它做得很好。

### 第二步：给一个参考组件，胜过一千字描述

约定解决"能用什么"，参考实现解决"怎么组合"。这是上一节"同心圆外圈"在 UI 上的具体应用。

准备一个你满意的组件，作为所有后续组件的模板：

```tsx
// components/Card.tsx —— 项目的组件范式模板
// 任何新组件都应该长得像它：同样的 props 风格、同样的类名组织、同样的注释密度。

interface CardProps {
  title: string
  /** 右上角的操作区，通常放一两个按钮 */
  actions?: React.ReactNode
  /** 紧凑模式用于列表内嵌，减少内边距 */
  dense?: boolean
  children: React.ReactNode
}

export function Card({ title, actions, dense = false, children }: CardProps) {
  return (
    <section
      className={`rounded-card border border-ink-700 bg-ink-800/40 ${
        dense ? 'p-3' : 'p-6'
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}
```

给 AI 的时候明确说明它的地位：

```text
以下是本项目的组件范式模板。请严格模仿它的：
props 命名风格、可选参数的默认值写法、className 的组织顺序、
注释的位置和密度、以及语义化标签的使用（section/header 而不是全用 div）。

<reference>
...Card.tsx 全文...
</reference>

现在用同样的范式实现一个 <EmptyState> 组件。
```

**"模仿这个"比"要求那样"有效得多。** 这是 Few-shot 在代码生成上的直接体现（M2 讲过的原理，在这里效果尤其明显）。

### 第三步：约束组件的 API 而不只是外观

外观一致只是第一层。更深的一致性在于**组件接口的一致性**——这决定了你半年后能不能顺手改。

几条值得写进约定的接口规范：

```markdown
## 组件接口约定
- props 不超过 5 个。超了说明这个组件承担了两件事，拆开。
- 布尔 props 用肯定式：用 disabled 不用 notEnabled，用 dense 不用 notSpacious。
- 所有布尔 props 必须有默认值，且默认值是"最常见的情况"。
- 组件不自己发请求。数据由父层传入，组件只负责渲染。
  （例外：明确标注为 Container 的组件）
- 组件不写死文案里的业务术语，通过 props 传入。
- 不导出 default，统一具名导出（方便全局搜索和重命名）。
```

最重要的是"组件不自己发请求"这条。AI 很喜欢生成"自给自足"的组件——一个 `<UserList>` 内部自己 fetch、自己管 loading、自己处理错误。看起来很方便，但这样的组件无法测试、无法复用、无法在多个地方共享同一份数据。**这类问题在 demo 阶段完全暴露不出来，在第三个页面复用时才爆。**

### 第四步：把设计约束做成可自动检查的

写进文档的约定会被违反，能自动检查的约定才会被遵守。

```js
// eslint.config.js 片段 —— 把视觉约定变成 lint 规则
export default [
  {
    rules: {
      // 禁止在 className 里写死颜色
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message: '禁止写死 hex 颜色，请使用 tailwind.config 里的 token',
        },
        {
          selector: "JSXAttribute[name.name='style']",
          message: '禁止 inline style，一律用 Tailwind 原子类',
        },
      ],
    },
  },
]
```

再配一个更粗糙但很有效的检查——直接 grep：

```bash
# scripts/check-ui.sh —— 三条最容易被违反的视觉约定
set -e
fail=0

if grep -rnE '#[0-9a-fA-F]{6}' src/components src/pages --include='*.tsx'; then
  echo "✗ 发现写死的 hex 颜色"; fail=1
fi

if grep -rnE 'rounded-(sm|md|lg|xl|2xl|3xl|full)' src --include='*.tsx' | grep -v 'rounded-full'; then
  echo "✗ 发现非约定圆角（只允许 rounded-card / rounded-control / rounded-full）"; fail=1
fi

if grep -rnE 'className="[^"]*\bp-(5|7|9|11)\b' src --include='*.tsx'; then
  echo "✗ 发现非 4 倍数间距"; fail=1
fi

exit $fail
```

把它接进 pre-commit 或 CI（L17-08 会讲流水线）。**这几十行脚本挡住的一致性衰减，比你反复在 Prompt 里强调有效得多**——因为它不依赖你记得强调。

### 常见失败：AI 引入了整套 UI 库

一个高频事故：你让 AI 做一个下拉选择器，它 `import` 了一个 UI 库，然后这个库的样式和你的设计系统完全不搭，你为了统一又装了它的主题包，最后包体积涨了 400KB，而你只用了一个组件。

防这件事只需要在约定里加一句，但必须写得非常具体：

```markdown
## 依赖红线
- 不引入任何 UI 组件库（antd / MUI / chakra / shadcn 等一律不用）
- 不引入任何 CSS-in-JS 方案
- 需要复杂交互组件（下拉、日期选择、拖拽）时，先问我，不要自行选型
- 唯一允许的例外：lucide-react（图标）
```

写"不要引入不必要的依赖"是没用的——模型觉得它引入的每个依赖都是必要的。**必须点名。**

### 一个务实的提醒：一致性优先于精致

独立开发者容易在 UI 上陷入无底洞：这个阴影再柔一点、这个动画再顺一点。花两周把界面打磨到很精致，然后发现没人用。

判断该在 UI 上投多少的一个标准：**你的界面现在是"看起来不专业"还是"不够惊艳"？** 前者会实质影响转化和信任，值得修；后者在你有 100 个付费用户之前，基本不影响什么。

而"看起来不专业"的成因，九成是一致性问题——间距乱、颜色多、控件样式不统一。**把一致性做好，是投入产出比最高的 UI 工作**，而这恰好是可以靠约束 AI 系统性解决的，不需要审美天赋。

### 动手 5 分钟

给你的项目建立最小可用的设计约束，并验证它有没有生效。

1. 在 `tailwind.config` 里把颜色收敛成 3 组语义 token（brand / ink / danger），圆角收敛成 2 档。
2. 挑一个你最满意的现有组件作为范式模板，在文件顶部写清"新组件请模仿本文件的 props 风格与类名组织"。
3. 只给约定 + 范式组件，让 AI 生成一个新组件。然后跑一遍上面的 `check-ui.sh`。

**验收标准**：生成的组件通过所有 grep 检查，且和你的范式组件放在一起看不出是两个人写的。有出入的地方，就是约定里缺的那条——补进去，这份约定会在接下来几十个组件上持续生效。

### 要点总结

- **AI 产出 demo 级 UI 不是能力问题，是你的需求里没有一致性信息**——它每次都得当场发明圆角、间距、字号，两次发明不可能一样。
- 解法是把决定前置：**定义 token 而不是描述风格**。"现代简洁"不可执行，"圆角只用 rounded-card 和 rounded-control"可执行。
- 收敛可能性比提高品味有效：把字号收到 5 档、颜色收到 3 组、间距限制为 4 的倍数。**AI 不需要有品味，只需要在有限选项里挑。**
- **给一个满意的参考组件，胜过一千字风格描述。** 明确要求模仿它的 props 风格、类名组织、注释密度、语义标签用法。
- 接口一致性比外观一致性更影响长期维护。最关键的一条：**组件不自己发请求**——自给自足的组件在 demo 阶段没问题，第三次复用时才爆。
- **能自动检查的约定才会被遵守。** 几十行 grep 脚本挡住的一致性衰减，比反复在 Prompt 里强调有效得多。
- 依赖红线必须**点名**（antd / MUI / chakra 一律不用）。写"不要引入不必要的依赖"无效——模型认为自己引入的都是必要的。
- 判断 UI 该投多少：**"看起来不专业"值得修，"不够惊艳"在有 100 个付费用户前不用管**。而前者九成是一致性问题，恰好可以系统性解决。
