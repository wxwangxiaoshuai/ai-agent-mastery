## 代码库上下文工程：让 AI 真正理解你的项目

M3 讲上下文工程时，处理的是"给模型什么信息才能答对问题"。这一节是同一件事在代码库上的应用，而且赌注更高：**同样的模型，给对上下文和给错上下文，产出质量差一个数量级。**

::interactive{type="conventionCheck"}

一个具体的对照。同样的需求"加一个导出功能"：

- 上下文为零时，AI 给你一个自成一派的实现：新的错误处理风格、新的日志方式、新引入的依赖、和项目里已有的导出逻辑毫不相关。
- 上下文给对时，它给你的代码看起来像是项目原作者写的。

差别不在模型，在你喂了什么。

### 三层上下文，各解决一类问题

**第一层：项目约定（每次都要有）。** 技术栈、目录结构、命名规范、禁止事项。这一层是静态的，写一次用很久。

**第二层：任务相关代码（按需检索）。** 要改的文件、它的调用方、同类功能的参考实现。这一层是动态的，每个任务都不同。

**第三层：负面约束（最容易漏）。** 不要做什么、已经踩过的坑、废弃的旧写法。这一层没人主动写，但它防住的问题最多。

大多数人只做了第二层——把要改的文件贴进去。第一层和第三层的缺失，正是"AI 写的代码不像我项目里的代码"的根本原因。

### 第一层：项目约定文件

现在主流的 AI Coding 工具都支持项目级约定文件（不同工具文件名不同，作用一致）。写这份文件有个关键原则：**写模型猜不到的，别写模型能猜到的。**

反面例子：

```markdown
# 项目说明
本项目使用 Python 和 React。
请编写高质量、可维护的代码。
请添加适当的注释。
请遵循最佳实践。
```

这四句话对模型的行为没有任何影响——它本来就会这么做（或者本来就做不到）。

正面例子：

```markdown
# 项目约定

## 技术栈
Python 3.12 + FastAPI + SQLAlchemy 2.0（注意是 2.0 风格，不是 1.4 的 Query API）
前端 React 18 + TypeScript + Tailwind 3，无 UI 库，组件自己写

## 目录约定
- routers/    路由，一个资源一个文件，只做参数校验与调用 service
- services/   业务逻辑，不 import fastapi，可被脚本直接调用
- models/     SQLAlchemy 模型，不写业务方法
- 依赖方向单向：routers → services → models，反向 import 一律不允许

## 命名
- 函数用动词开头：get_user / create_note / mark_read
- 布尔变量用 is_/has_ 前缀
- 数据库表名复数，模型类名单数

## 错误处理
- service 层抛领域异常（见 exceptions.py），不抛 HTTPException
- router 层统一用 exception_handler 转成 HTTP 响应
- 禁止裸 except，禁止 except Exception: pass

## 禁止事项
- 不要引入新的第三方依赖，需要时先问我
- 不要用 SQLAlchemy 1.4 的 session.query()，用 2.0 的 select()
- 不要在 service 层写 print，用 logger
- 不要写 "# TODO: 完善错误处理" 这类占位注释，要么写完要么不写

## 前端
- 样式只用 Tailwind 原子类，不写自定义 CSS，不用 @apply
- 颜色只用 tailwind.config 里定义的 token，不写 #hex
- 组件不接受超过 5 个 props，超了就拆
```

区别一目了然：每一条都是"这个项目特有的、模型不可能猜到的"信息。特别是 SQLAlchemy 2.0 那条——不写的话，模型会按训练数据里更常见的 1.4 风格来写，而这两种风格混在一起是维护噩梦。

**一个检验标准：把这份文件给一个从没见过你项目的人类工程师，他能不能写出风格一致的代码？** 能，说明写够了；不能，缺的部分就是要补的。

### 第二层：任务相关代码的检索式供给

项目大了之后，"把相关代码贴进去"不再可行——上下文窗口装不下，装下了也会被稀释（M3 的中段遗忘问题在这里同样成立）。

实用的做法是按"三个同心圆"来选：

**圆心：要改的文件。** 完整给。

**内圈：直接相关的。** 它 import 的模块签名、import 它的调用方、它操作的数据模型定义。这些给签名和关键片段，不用给完整实现。

**外圈：一个同类功能的完整实现。** 这一条最重要也最常被漏。想加导出功能？把已有的导入功能完整贴上去。**模型模仿具体例子的能力，远强于遵守抽象描述的能力。**

一个简单的收集脚本：

```python
# scripts/ctx.py —— 按同心圆收集上下文，输出可直接粘贴的文本
import subprocess, sys, io
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def head(path: str, n: int = 80) -> str:
    """给内圈文件的前 n 行 —— 通常足够看清签名和风格。"""
    p = ROOT / path
    lines = p.read_text(encoding="utf-8").splitlines()[:n]
    return f"<file path='{path}' truncated='{len(lines) >= n}'>\n" + "\n".join(lines) + "\n</file>"

def full(path: str) -> str:
    p = ROOT / path
    return f"<file path='{path}'>\n{p.read_text(encoding='utf-8')}\n</file>"

def build(center: list[str], inner: list[str], reference: list[str]) -> str:
    parts = ["<project_conventions>", (ROOT / "CONVENTIONS.md").read_text(encoding="utf-8"), "</project_conventions>"]
    parts.append("<!-- 圆心：本次要改的文件 -->")
    parts += [full(p) for p in center]
    parts.append("<!-- 内圈：相关签名，只给前 80 行 -->")
    parts += [head(p) for p in inner]
    parts.append("<!-- 外圈：同类功能的完整参考实现，请模仿它的风格 -->")
    parts += [full(p) for p in reference]
    return "\n\n".join(parts)

if __name__ == "__main__":
    print(build(
        center=["services/export.py"],
        inner=["models/note.py", "routers/notes.py"],
        reference=["services/import_.py"],
    ))
```

注意用 XML 风格标签把每个文件包起来，并在标签里标明路径。这解决两个问题：模型知道每段代码来自哪、以及**这些是数据不是指令**（L13-05 讲过的不可信内容隔离，在这里同样适用——你的代码库里如果有用户提交的内容，它可能包含注入）。

### 第三层：负面约束——项目的伤疤清单

这一层的内容来源是**你踩过的坑**。每次 AI 写出一段你要返工的代码，就往这份清单里加一条。

```markdown
# 已知的坑（AI 反复犯的错，请勿重蹈）

- 时间一律存 UTC，展示时才转时区。曾经因为混用本地时间，
  跨时区用户的"今天"统计全错了。
- 分页不要用 OFFSET，笔记表已经 50 万行，深翻页会超时。用游标分页。
- 不要在循环里调用 db.commit()，会产生 N 次事务。批量操作用一次 commit。
- 用户输入的 HTML 一律走 sanitize()，不要相信前端已经处理过。
- 不要"顺手"重构无关代码。一次改动只做一件事，否则 diff 没法 review。
```

最后一条尤其值得写。AI 有强烈的"顺手优化"倾向——你让它改一个函数，它把整个文件的格式重排了一遍。对一个人维护的项目，这会让 code review 彻底失效：你面对一个 400 行的 diff，其中只有 12 行是真正的改动。

### 上下文污染：给多了也是错

上下文不是越多越好，三种典型的污染：

**一、旧代码污染。** 你贴了一个五年前风格的老模块作为参考，AI 就照着老风格写。**参考实现要挑你满意的那个，不是最近改过的那个。**

**二、废弃代码污染。** 代码库里躺着一个已经不用但没删的模块，AI 读到了，以为是可用的，调用了它。定期删死代码，对人和对 AI 都有好处。

**三、噪声稀释。** 把整个目录一股脑塞进去，真正相关的那 50 行被 5000 行淹没。M3 讲的注意力稀释在这里完全成立——**精准的 500 行胜过粗放的 5000 行**。

判断上下文是否合适有个简单办法：**问 AI 一个只有读了上下文才能回答的问题**。

```text
"在你能看到的代码里，创建笔记之后会触发哪些副作用？
 按发生顺序列出，并注明各自在哪个文件。"
```

它答不上来或者答错了，说明上下文没给对——这时候你改需求描述是没用的，得回去改上下文。

### 让 AI 维护它自己的上下文

一个能显著降低维护成本的做法：**让 AI 在完成任务后更新约定文件**。

```text
"这次改动引入了新的约定（导出功能统一走 exporters/ 目录，
 每个格式一个文件，实现 Exporter 协议）。
 请在 CONVENTIONS.md 的合适位置补充这条约定，
 保持现有的文档风格，不要重排其他内容。"
```

这样约定文件会跟着项目一起长，而不是写完就烂在那里。**一份三个月没更新的约定文件，作用可能是负的**——它会引导 AI 写出符合旧架构的代码。

### 动手 5 分钟

给你的项目建一份约定文件，并当场验证它有没有用。

1. 写 `CONVENTIONS.md`，只写模型猜不到的：具体版本、目录职责、依赖方向、命名规范、禁止事项。删掉所有"请编写高质量代码"这类废话。
2. 加一节"已知的坑"，从你最近三次返工 AI 代码的经历里各提炼一条。
3. 验证：不给任何其他上下文，只给这份文件，让 AI 写一个新的 service 函数。看它的错误处理风格、日志方式、import 顺序是否和项目一致。

**验收标准**：只凭约定文件生成的代码，你不需要为了"风格对齐"做任何修改。需要改的地方，就是约定文件里缺的那一条——补上去。

### 约定文件的自动验证：检查 AI 产出是否遵守约定

约定文件写了三层，但 AI 有时候会忽略。写一个简单的验证脚本，在合并前检查 AI 产出是否越过了约定里的禁止事项：

```python
"""scripts/check_conventions.py —— 检查代码是否遵守 CONVENTIONS.md 的关键约定"""

import ast
import sys
from pathlib import Path

def check_import_direction(filepath: Path) -> list[str]:
    """检查依赖方向：routers → services → models，禁止反向 import。"""
    issues = []
    content = filepath.read_text(encoding="utf-8")
    tree = ast.parse(content)

    for node in ast.walk(tree):
        # ast.ImportFrom 有 .module 属性；ast.Import 没有，用 names[0].name 代替
        if isinstance(node, ast.ImportFrom):
            module = node.module or ""
        elif isinstance(node, ast.Import):
            module = node.names[0].name if node.names else ""
        else:
            continue
        # 检查 service 层是否 import 了 fastapi（违反"不 import fastapi"）
        if "services" in str(filepath) and "fastapi" in module:
            issues.append(f"{filepath}: import fastapi in service layer")

    # 检查 model 层是否有业务方法（独立于 import 检查，避免重复报告）
    if "models" in str(filepath):
        for n in ast.walk(tree):
            if isinstance(n, ast.FunctionDef) and n.name not in ("__init__", "__repr__", "__str__"):
                if not n.name.startswith("_"):
                    issues.append(f"{filepath}:{n.lineno}: model 中出现方法 {n.name}，约定禁止在 model 中写业务方法")

    return issues

def check_no_print_in_service(filepath: Path) -> list[str]:
    """检查 service 层是否用了 print（应用 logger）。"""
    if "services" not in str(filepath):
        return []
    content = filepath.read_text(encoding="utf-8")
    tree = ast.parse(content)
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
            return [f"{filepath}:{node.lineno}: 在 service 层使用 print，约定要求用 logger"]
    return []

def main():
    all_issues = []
    for f in Path("src").rglob("*.py"):
        all_issues.extend(check_import_direction(f))
        all_issues.extend(check_no_print_in_service(f))

    if all_issues:
        print("约定检查未通过：")
        for issue in all_issues:
            print(f"  {issue}")
        sys.exit(1)

    print("约定检查通过。")
    sys.exit(0)

if __name__ == "__main__":
    main()
```

这个脚本和 L17-01 的边界检查、L17-03 的规格约束检查一起，构成了 AI 产出的三道自动防线——**边界检查盯红线、规格约束盯合规、约定检查盯风格**。三道都在 pre-commit 时跑，比人工 review 覆盖得全且不会累。

### 要点总结

- 三层上下文：**项目约定**（静态，写一次用很久）、**任务相关代码**（动态，按需检索）、**负面约束**（最易漏，防住的问题最多）。多数人只做了第二层。
- 约定文件的核心原则：**写模型猜不到的，别写模型能猜到的**。"请编写高质量代码"对行为零影响；"用 SQLAlchemy 2.0 的 select() 不要用 1.4 的 query()"能救你一个季度。
- 检验标准：把约定文件给一个没见过项目的人类工程师，他能否写出风格一致的代码。
- 任务上下文按同心圆选：**圆心**（要改的文件，完整给）、**内圈**（相关签名，给片段）、**外圈**（一个同类功能的完整实现）。外圈最重要——模型模仿具体例子远强于遵守抽象描述。
- 用 XML 标签包裹每个文件并标明路径，既让模型知道来源，也做到"这是数据不是指令"的隔离。
- **负面约束来自你踩过的坑**，每次返工就加一条。特别记得写"不要顺手重构无关代码"——400 行的 diff 里只有 12 行有效改动会让 review 失效。
- 上下文污染三种：旧代码污染（参考实现要挑满意的不是最近的）、废弃代码污染（定期删死代码）、噪声稀释（精准 500 行胜过粗放 5000 行）。
- 验证上下文是否到位：**问一个只有读了上下文才答得出的问题**。答错了就回去改上下文，改需求描述没用。
