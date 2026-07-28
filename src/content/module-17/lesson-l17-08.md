## 一人公司的 CI/CD 与发布流水线

大公司搞 CI/CD 是为了协调几十个人的改动。一个人做产品，没有协调问题，但有一个更要命的问题：**没有人会替你发现你搞砸了**。

没有同事在 staging 上撞见异常，没有 QA 在发布前点一遍，没有 oncall 在半夜收到告警。所有这些角色都得由流水线替你扮演。所以一人公司需要 CI/CD 的理由，和大公司完全不同 —— 不是为了效率，是为了**替代不存在的同事**。

### 最小可用流水线：三道闸门

不要一上来搭一套完整的 DevOps。先立三道闸门，每一道都能挡住一类你会犯的错。

| 闸门 | 挡什么 | 成本 |
|------|--------|------|
| 提交前（pre-commit） | 格式、明显语法错、密钥泄漏 | 一次配置，秒级 |
| 合并前（CI） | 类型错误、测试失败、构建失败 | 一次配置，分钟级 |
| 发布后（健康检查） | 部署上去但起不来、关键接口 500 | 一次配置，分钟级 |

三道加起来半天能搭完，之后每次改动自动执行。这半天是一人公司回报率最高的半天之一。

### 第一道：提交前拦住不该进仓库的东西

最重要的不是格式，是**密钥**。一个人做产品，`.env` 被误提交、API key 硬编码进代码，是真实高频事故 —— 而且是不可逆的（推上去以后即使删掉，历史里还在，必须换 key）。

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: check-added-large-files
        args: [--maxkb=1000]
      - id: check-merge-conflict
      - id: end-of-file-fixer
```

```bash
pip install pre-commit && pre-commit install
```

`gitleaks` 那条是这里唯一不能省的。其余的格式化 hook 顺带解决了一个 AI 相关的问题：不同轮次生成的代码风格会飘（这次用双引号下次用单引号），格式化统一掉之后，`git diff` 里剩下的就都是真实的逻辑变化，review 起来快很多。

### 第二道：CI 只跑必要的检查

一人公司的 CI 有个特有的失败模式：**跑得太慢，于是你开始跳过它**。一旦养成 `--no-verify` 和「先合了再说」的习惯，流水线就形同虚设。

所以 CI 的目标是**三分钟内出结果**。

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip

      - run: pip install -r requirements.txt -r requirements-dev.txt

      - name: 类型检查
        run: mypy src/

      - name: 测试
        run: pytest -q --timeout=60

      - name: 构建
        run: python -m build
```

三个关键配置容易被忽略：

`concurrency` + `cancel-in-progress` —— 你连推三次时，前两次的 CI 自动取消，不排队。一人开发连续推送很常见，这一条能省掉大量等待。

`timeout-minutes` —— 防止某个测试卡死把 runner 占满。免费额度是有限的。

`--timeout=60`（pytest-timeout）—— 单个测试卡死也不拖垮整体。

### 部署：能一键回滚比能一键发布重要

发布出问题的概率不是零，一个人做产品的时候更高。所以流水线设计的第一原则是**回滚必须比修复快**。

具体到实现，就是**不可变部署 + 版本切换**，而不是原地更新：

```yaml
# 接第一个 workflow，仅在 main 分支且 CI 通过后执行
  deploy:
    needs: check
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 构建镜像（用 commit sha 做标签，不用 latest）
        run: |
          IMAGE=ghcr.io/${{ github.repository }}:${{ github.sha }}
          docker build -t $IMAGE .
          echo "$IMAGE" >> $GITHUB_ENV

      - name: 推送并部署
        run: |
          docker push $IMAGE
          ssh deploy@$HOST "docker pull $IMAGE && \
            docker run -d --name app-${{ github.sha }} $IMAGE && \
            ./switch-traffic.sh app-${{ github.sha }}"
```

用 commit sha 做镜像标签而不是 `latest`，是这段里最重要的一行。有了它，回滚就是把流量切回上一个 sha 的容器 —— 十几秒的事，不需要重新构建，也不需要知道到底哪里坏了。

回滚脚本要提前写好并且**演练过**。半夜出事的时候，你不会想现场调试一个从没跑过的脚本。

```bash
#!/usr/bin/env bash
# rollback.sh —— 平时演练，出事时不用思考
set -euo pipefail
PREV=$(docker ps -a --filter 'name=app-' --format '{{.Names}}' | sed -n 2p)
[ -z "$PREV" ] && { echo '没有上一个版本'; exit 1; }
docker start "$PREV"
./switch-traffic.sh "$PREV"
echo "已回滚到 $PREV"
```

### 第三道：部署完要自己验一遍

部署成功不等于服务可用。容器起来了但连不上数据库、环境变量少配一个、迁移没跑 —— 这些都会让「部署成功」和「服务可用」分家。

```yaml
      - name: 健康检查
        run: |
          for i in {1..10}; do
            if curl -fsS https://your-app.com/healthz | grep -q '"ok":true'; then
              echo '健康检查通过'; exit 0
            fi
            sleep 5
          done
          echo '健康检查失败，执行回滚'
          ssh deploy@$HOST './rollback.sh'
          exit 1
```

`/healthz` 不能只返回 200，要真的检查依赖：

```python
@app.get('/healthz')
async def healthz():
    checks = {}
    try:
        await db.execute('SELECT 1')
        checks['db'] = True
    except Exception as e:
        checks['db'] = False
        checks['db_error'] = str(e)[:200]

    checks['llm_key'] = bool(os.getenv('OPENAI_API_KEY'))
    checks['version'] = os.getenv('GIT_SHA', 'unknown')
    checks['ok'] = checks['db'] and checks['llm_key']

    return JSONResponse(checks, status_code=200 if checks['ok'] else 503)
```

把 `version` 放进去，你就能随时确认线上跑的到底是哪个 commit —— 这个信息在排查「我明明修了啊」的时候值千金。

### 数据库迁移是唯一不能回滚的东西

代码可以秒级回滚，数据库不行。删掉的列回不来，改过的数据回不去。

所以一人公司的迁移纪律只有一条：**迁移必须向后兼容，改结构和删旧字段永远分两次发布**。

以「重命名 `user.name` 为 `user.display_name`」为例：

```
第一次发布：加 display_name 列，双写（新代码同时写两个字段），读仍读 name
    ↓ 观察一周，确认没有遗漏的写入路径
第二次发布：读切到 display_name
    ↓ 再观察一周
第三次发布：停止双写，删除 name 列
```

麻烦，但每一步都可以单独回滚。一步到位的重命名一旦出错，你面对的是数据恢复而不是版本回退。

这条纪律和 AI 的关系是：**AI 生成迁移脚本时会默认一步到位**。你问它「把 name 改成 display_name」，它给你一句 `ALTER TABLE users RENAME COLUMN`。要它按三步走，得明确要求。

### 秘钥管理：别把 .env 当方案

一个人做产品，秘钥通常散落在四个地方：本地 `.env`、CI 的 secrets、服务器上的环境变量、你的记事本。轮换一次要改四处，于是你永远不轮换。

最小可行方案：**CI secrets 作为唯一来源，其余从它派生**。

```yaml
      - name: 注入配置
        run: |
          cat > .env.production <<CONF
          DATABASE_URL=${{ secrets.DATABASE_URL }}
          OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
          GIT_SHA=${{ github.sha }}
          CONF
          scp .env.production deploy@$HOST:/app/.env
```

本地开发用一份权限受限的独立 key（额度设低），线上用另一份。这样即使本地那份泄漏，损失有上限。

### 动手 5 分钟

给你的项目装上最小闸门，重点是回滚演练。

1. 加 `.pre-commit-config.yaml`，至少包含 gitleaks 和一个格式化 hook，跑 `pre-commit run --all-files` 看现有代码里有没有被扫出秘钥。
2. 写一个真正检查依赖的 `/healthz`，返回体里带上 `version`（git sha）。
3. 写一个 `rollback.sh`，然后**真的执行一次**：故意部署一个坏版本（比如启动时就抛异常），跑回滚脚本，计时。

**验收标准**：你能说出从「发现线上挂了」到「服务恢复」需要多少秒，且这个数字是你实测出来的而不是估的。如果超过 2 分钟，说明回滚路径上还有需要现场思考的步骤，把它脚本化。

### 要点总结

- 一人公司需要 CI/CD 的理由和大公司不同：不是为了协调，是为了**替代不存在的同事**（没人替你发现你搞砸了）。
- 三道闸门就够：**提交前**（秘钥/格式）、**合并前**（类型/测试/构建）、**发布后**（健康检查）。半天搭完，回报率极高。
- pre-commit 里 **gitleaks 是唯一不能省的**；秘钥误提交不可逆，推上去就必须换 key。
- CI 的目标是**三分钟出结果**，跑得慢你就会开始跳过它，那流水线就白搭了。
- **回滚必须比修复快**：用 commit sha 做镜像标签而非 latest，回滚就是切流量，十几秒的事。
- 回滚脚本要**提前演练**，半夜出事时你不会想现场调试一个没跑过的脚本。
- `/healthz` 要真检查依赖并带上 **version（git sha）**，用来确认线上到底跑的哪个 commit。
- **数据库迁移不能回滚**：改结构和删旧字段永远分多次发布，AI 默认给你一步到位的方案，必须明确要求分步。
