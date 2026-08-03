## 规格驱动开发：把想法写成 AI 能执行的规格

M2 讲过：模糊的 Prompt 进，垃圾输出出。在 AI Coding 里，这条规律有个更具体的名字——**规格质量决定代码质量**。

大多数人用 AI 写代码的方式是"我说一句、它写一段、不对我再说一句"。这在写小函数时没问题，在写功能模块时会变成灾难：每一轮修正都可能推翻上一轮的假设，来回五六次之后，你得到的是一个补丁摞补丁的东西，而且**没有任何地方记录着它到底该做什么**。

规格驱动开发（Spec-Driven Development）就是把这件事倒过来：**先把"该做什么"写清楚，再让 AI 写"怎么做"**。

::interactive{type="specTemplate"}

### 一次真实的对比

需求："给笔记加个搜索功能。"

**方式 A（对话式）：**

> 我：给笔记加个搜索功能
>
> AI：（生成了一个 SQL LIKE 模糊查询的端点）
>
> 我：要支持中文分词
>
> AI：（改成了全文索引，但改了表结构）
>
> 我：不能改表结构，线上有数据
>
> AI：（改回 LIKE，加了个 jieba 预处理）
>
> 我：搜索结果要按相关度排序
>
> AI：（加了个打分函数，但和前面的分词逻辑重复了）

四轮之后，代码能跑，但里面有两套分词逻辑，而且没人知道"相关度"到底是怎么算的。

**方式 B（规格式）：**

```markdown
## 功能：笔记搜索

### 输入
- query: str，1-100 字符，可含中英文
- user_id: str，只搜该用户自己的笔记
- limit: int，默认 20，最大 100

### 输出
- 按相关度降序的笔记列表，每项含 id / title / 高亮片段 / score

### 相关度定义
- 标题命中权重 3，正文命中权重 1
- 多个词全部命中的排在部分命中之前
- 分数归一化到 0-1

### 约束
- 不改现有表结构（线上有数据，本期不做迁移）
- 中文按 jieba 精确模式分词，英文按空格+小写
- 单次查询 P95 < 200ms（当前单用户笔记量 < 5000）

### 边界情况
- query 全是空格 → 返回空列表，不报错
- query 含特殊字符 → 转义后按字面匹配，不能被注入
- 无结果 → 返回空列表 + 建议（去掉最长的那个词再试）

### 不做什么
- 不做拼写纠错
- 不做跨用户搜索
- 不做搜索历史
```

把这份规格丢给 AI，一轮就能拿到接近可用的实现。更重要的是：**这份规格会留在仓库里**。三个月后你想改相关度算法，规格告诉你原来的定义是什么；你想加拼写纠错，规格里的"不做什么"提醒你这是有意省略的，不是忘了。

### 规格的六个部分

从上面的例子提炼出模板：

**一、输入。** 类型、范围、必填与否。这一节写不清楚，AI 会替你假设，而它的假设通常比你的宽松。

**二、输出。** 结构、排序、分页。特别注意：**空结果和错误结果是两种不同的输出**，都要写。

**三、核心规则。** 业务逻辑本身。这是唯一需要你动脑的部分，也是最不该省的部分。

**四、约束。** 性能、兼容性、不能碰的东西。约束是 AI 最容易忽略的——它不知道你线上有数据。

**五、边界情况。** 空、超长、特殊字符、并发、重复提交。这一节的长度基本决定了代码的健壮程度。

**六、不做什么。** 这一节被低估得最厉害。它同时防两件事：防 AI 过度实现（写出你不需要的可插拔框架），防未来的你困惑（"当初为什么没做拼写纠错？"）。

### 规格的可执行形式：测试

文字规格有一个天然缺陷：**它不会在被违反时报警**。

所以规格的最佳形态其实是测试。把上面那份规格翻译成测试：

```python
# tests/test_search.py
# 这份测试就是搜索功能的规格 —— 改行为必须先改这里。

import pytest
from app.search import search_notes

def test_title_ranks_above_body(seeded_db):
    """标题命中权重 3、正文权重 1 —— 标题命中的必须排前面。"""
    results = search_notes(user_id="u1", query="向量")
    assert results[0].id == "note_title_hit"
    assert results[0].score > results[1].score

def test_all_terms_beat_partial(seeded_db):
    """全部词命中的排在部分命中之前。"""
    results = search_notes(user_id="u1", query="向量 检索")
    ids = [r.id for r in results]
    assert ids.index("note_both") < ids.index("note_only_vector")

def test_cross_user_isolation(seeded_db):
    """只搜自己的笔记 —— 这条挂了是数据泄露，不是功能 bug。"""
    results = search_notes(user_id="u1", query="u2的秘密")
    assert results == []

def test_blank_query_returns_empty_not_error():
    """全空格不报错，返回空列表。"""
    assert search_notes(user_id="u1", query="   ") == []

def test_special_chars_are_escaped(seeded_db):
    """特殊字符按字面匹配，不能被注入。"""
    results = search_notes(user_id="u1", query="'; DROP TABLE notes; --")
    assert results == []  # 没有笔记含这段字面文本

def test_limit_is_capped():
    """limit 上限 100，超出要夹紧而不是报错。"""
    results = search_notes(user_id="u1", query="a", limit=9999)
    assert len(results) <= 100
```

这套测试有三个作用：**它是规格**（说明该做什么）、**它是验收标准**（判断 AI 写对了没有）、**它是回归网**（未来改动不会悄悄破坏它）。

一个高效的工作流因此成立：

```
写规格 → 写测试（可以让 AI 写，但断言你要逐条看）
      → 让 AI 实现直到测试全绿
      → 你 review 实现（这时你已经知道它该干嘛了，读得很快）
```

注意第二步的"断言你要逐条看"。**AI 写的测试最常见的毛病是断言过弱**——比如 `assert results is not None`，这种断言永远绿，什么也没保证。

### 让 AI 帮你写规格：先扩后收

自己从零写规格很累，尤其是边界情况那一节——人的想象力对边界的覆盖天生很差。这一步适合让 AI 先发散：

```text
"我要实现笔记搜索功能。核心规则如下：<你的核心规则>。
 请列出这个功能所有可能的边界情况和异常输入，
 尽量穷举，包括你觉得我可能没想到的。
 只列问题，不要给实现。"
```

它会给你一份 20 条的清单，其中大概 12 条是你没想过的，5 条是不适用的，3 条是它想多了。**然后由你来收敛**：对每一条做决定——本期做、本期不做但记下来、不适用。

这个"先扩后收"的模式适用范围很广：让 AI 发散穷举，让你自己收敛决策。发散是它的强项，决策是你的责任。

### 规格粒度：多大算合适

太细的规格等于自己写代码，太粗的规格等于没写。经验上的合适粒度是：

- **一份规格对应一个能独立验收的功能**，通常是半天到两天的工作量。
- **规格的长度大约是实现代码的 1/5 到 1/10**。远超这个比例说明你在写伪代码，远低于说明你在写标题。
- **规格里不出现具体的函数名、类名、文件路径**——那是实现的事。规格只说"做什么"，说了"怎么做"就限制了 AI 的空间，也让规格更容易过时。

一个例外：如果你的项目有强约定（比如所有 router 必须放在 `routers/` 下、必须用某个基类），那这些属于"约束"而不是"实现细节"，应该写进去——但更好的做法是把它们放进项目级的约定文件（下一节讲），而不是每份规格里重复一遍。

### 规格会过时，这不是问题

新手常问：需求一直变，规格写了不是白写吗？

规格确实会过时，但它过时的方式和代码不一样。**代码过时了你看不出来，规格过时了你一眼就能看出来**——因为规格是人话。

实践上的处理办法：

- 规格和代码放在一起（`docs/specs/search.md` 或直接放在模块的 docstring 里）。
- 改行为时先改规格，再改测试，再改实现。顺序反了，规格必然烂掉。
- 定期（比如每次发版）扫一遍规格目录，删掉已经不适用的。**留着一份错的规格，比没有规格更糟。**

### 动手 5 分钟

给你下一个要做的功能写一份规格，然后用它跑一次完整流程。

1. 按六段模板写规格：输入、输出、核心规则、约束、边界情况、不做什么。「不做什么」至少写 3 条。
2. 让 AI 穷举边界情况，把它列出的你没想到的那些补进规格（或明确标注本期不做）。
3. 把规格翻译成测试，逐条检查断言强度——把所有 `assert x is not None` 这类弱断言改成具体值断言。

**验收标准**：规格写完后，AI 一轮生成的实现能通过 80% 以上的测试。通不过说明规格还有歧义，回去看是哪一条没写清楚——这个反馈比代码本身更有价值。

### 规格的自检工具：用 AST 检查关键约束

规格里的"不做什么"和"约束"是给 AI 看的，但 AI 可能忽略。这里给一个轻量自检脚本——不替代测试，但能在合并前抓到 AI 最常犯的三类"越过约束"的错：

```python
"""scripts/check_spec_constraints.py —— 检查实现是否遵守了规格中的关键约束"""

import ast
import sys
from pathlib import Path

def check_file(filepath: Path, constraints: dict) -> list[str]:
    """检查单个文件是否违反规格约束。"""
    issues = []
    tree = ast.parse(filepath.read_text(encoding="utf-8"))

    # 约束1：不改表结构 → 检查是否有 ALTER TABLE / DROP COLUMN
    if constraints.get("no_schema_change"):
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                if "ALTER TABLE" in node.value or "DROP COLUMN" in node.value:
                    issues.append(f"{filepath}:{node.lineno}: 疑似修改表结构，规格要求不改表")

    # 约束2：不引入新依赖 → 检查是否有直接 import 非标准库/项目模块
    if constraints.get("no_new_deps"):
        stdlib = {"os", "sys", "json", "re", "pathlib", "datetime", "typing", "collections",
                  "math", "functools", "itertools", "hashlib", "uuid", "logging", "io",
                  "csv", "base64", "unittest", "argparse", "subprocess", "tempfile",
                  "dataclasses", "enum", "abc", "copy", "asyncio", "textwrap", "time"}
        project_prefixes = {"app", "src", "tests", "core", "models", "services", "routers", "utils"}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top = alias.name.split(".")[0]
                    if top not in stdlib and top not in project_prefixes:
                        issues.append(f"{filepath}:{node.lineno}: import {alias.name} —— 是否为新依赖？")

    # 约束3：不出现特定模式（如裸 except）
    if constraints.get("no_bare_except"):
        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                issues.append(f"{filepath}:{node.lineno}: 裸 except，规格要求指定异常类型")

    return issues

def main():
    constraints = {
        "no_schema_change": True,
        "no_new_deps": True,
        "no_bare_except": True,
    }

    all_issues = []
    for f in Path("src").rglob("*.py"):
        all_issues.extend(check_file(f, constraints))

    if all_issues:
        print("规格约束检查未通过：")
        for issue in all_issues:
            print(f"  {issue}")
        sys.exit(1)

    print("规格约束检查通过。")
    sys.exit(0)

if __name__ == "__main__":
    main()
```

这个脚本解决的是"规格写了但 AI 没遵守"的问题——pre-commit 时跑一遍，让机器帮你做 AI 最容易忽略的检查。和 L17-01 的边界检查脚本互补：边界检查盯"红线代码"，规格约束检查盯"AI 产出的合规性"。

### 要点总结

- **对话式开发的问题不是效率，是没有任何地方记录"它该做什么"**。来回修正五轮后，代码是补丁摞补丁的，而且不可回溯。
- 规格六段式：输入、输出、核心规则、约束、边界情况、**不做什么**。最后一段被低估得最厉害——它同时防止 AI 过度实现和未来的你困惑。
- **规格的最佳形态是测试**：它同时是规格、验收标准和回归网。文字规格不会在被违反时报警，测试会。
- AI 写的测试最常见毛病是**断言过弱**（`assert x is not None` 永远绿）。断言必须由你逐条过。
- **先扩后收**：让 AI 穷举边界情况（它擅长发散），你自己决定每一条做不做（你负责决策）。
- 粒度参考：一份规格对应一个可独立验收的功能，长度约为实现代码的 1/5 到 1/10，不出现具体函数名和文件路径。
- 改行为的顺序永远是：**先改规格 → 再改测试 → 最后改实现**。顺序反了规格必烂。留着一份错规格比没有更糟。
