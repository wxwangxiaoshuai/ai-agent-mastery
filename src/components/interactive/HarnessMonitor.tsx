import { useState, useEffect, useRef } from 'react'

type CircuitState = 'closed' | 'open' | 'half_open'
type EventKind = 'ok' | 'retry' | 'fail' | 'open' | 'half_open' | 'close' | 'fallback'

interface LogEvent {
  id: number
  t: number
  kind: EventKind
  message: string
}

interface Metrics {
  total: number
  success: number
  failed: number
  retries: number
  fallbacks: number
  opens: number
}

const FAILURE_THRESHOLD = 3
const RECOVERY_MS = 2400
const MAX_RETRIES = 2

const stateLabel: Record<CircuitState, string> = {
  closed: 'Closed · 正常放行',
  open: 'Open · 熔断中',
  half_open: 'Half-Open · 试探中',
}

const stateStyle: Record<CircuitState, string> = {
  closed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  open: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  half_open: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
}

const kindStyle: Record<EventKind, string> = {
  ok: 'text-emerald-400',
  retry: 'text-amber-400',
  fail: 'text-rose-400',
  open: 'text-rose-300',
  half_open: 'text-amber-300',
  close: 'text-emerald-300',
  fallback: 'text-brand-300',
}

function emptyMetrics(): Metrics {
  return { total: 0, success: 0, failed: 0, retries: 0, fallbacks: 0, opens: 0 }
}

export function HarnessMonitor() {
  const [running, setRunning] = useState(false)
  const [failRate, setFailRate] = useState(0.45)
  const [circuit, setCircuit] = useState<CircuitState>('closed')
  const [failures, setFailures] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics)
  const [lastOutcome, setLastOutcome] = useState('等待注入请求…')

  const seq = useRef(0)
  const openedAt = useRef(0)
  const halfOpenUsed = useRef(0)
  const circuitRef = useRef<CircuitState>('closed')
  const failuresRef = useRef(0)
  const failRateRef = useRef(failRate)

  useEffect(() => {
    circuitRef.current = circuit
  }, [circuit])
  useEffect(() => {
    failuresRef.current = failures
  }, [failures])
  useEffect(() => {
    failRateRef.current = failRate
  }, [failRate])

  const pushLog = (kind: EventKind, message: string) => {
    seq.current += 1
    const id = seq.current
    setLogs((prev) => [{ id, t: Date.now(), kind, message }, ...prev].slice(0, 40))
  }

  const reset = () => {
    setRunning(false)
    setCircuit('closed')
    setFailures(0)
    setCooldownLeft(0)
    setLogs([])
    setMetrics(emptyMetrics())
    setLastOutcome('已重置。点击「开始模拟」观察 Harness 行为。')
    openedAt.current = 0
    halfOpenUsed.current = 0
    circuitRef.current = 'closed'
    failuresRef.current = 0
  }

  // Cooldown ticker while Open
  useEffect(() => {
    if (circuit !== 'open') {
      setCooldownLeft(0)
      return
    }
    const tick = () => {
      const left = Math.max(0, RECOVERY_MS - (Date.now() - openedAt.current))
      setCooldownLeft(left)
      if (left <= 0 && circuitRef.current === 'open') {
        circuitRef.current = 'half_open'
        halfOpenUsed.current = 0
        setCircuit('half_open')
        pushLog('half_open', '冷却结束 → Half-Open，放行 1 次试探请求')
      }
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [circuit])

  // Simulated request loop
  useEffect(() => {
    if (!running) return

    const runOnce = () => {
      setMetrics((m) => ({ ...m, total: m.total + 1 }))
      let state = circuitRef.current

      if (state === 'open') {
        setMetrics((m) => ({ ...m, fallbacks: m.fallbacks + 1, failed: m.failed + 1 }))
        pushLog('fallback', '熔断中：跳过外部调用，返回静态兜底')
        setLastOutcome('Open → 静态兜底（未打外部 API）')
        return
      }

      if (state === 'half_open' && halfOpenUsed.current >= 1) {
        setMetrics((m) => ({ ...m, fallbacks: m.fallbacks + 1, failed: m.failed + 1 }))
        pushLog('fallback', '半开名额已用尽，拒绝请求并兜底')
        setLastOutcome('Half-Open 名额用尽 → 兜底')
        return
      }

      if (state === 'half_open') {
        halfOpenUsed.current += 1
      }

      // Simulate retries on transient failure
      let ok = false
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const transientFail = Math.random() < failRateRef.current
        if (!transientFail) {
          ok = true
          break
        }
        if (attempt < MAX_RETRIES) {
          setMetrics((m) => ({ ...m, retries: m.retries + 1 }))
          pushLog('retry', `暂时性故障，重试 ${attempt + 1}/${MAX_RETRIES}（指数退避）`)
        }
      }

      if (ok) {
        failuresRef.current = 0
        setFailures(0)
        setMetrics((m) => ({ ...m, success: m.success + 1 }))
        if (state === 'half_open') {
          circuitRef.current = 'closed'
          setCircuit('closed')
          pushLog('close', '试探成功 → Closed，恢复正常放行')
          setLastOutcome('Half-Open 试探成功 → Closed')
        } else {
          pushLog('ok', '调用成功')
          setLastOutcome('Closed · 调用成功')
        }
        return
      }

      // Exhausted retries → record failure for breaker
      const nextFail = failuresRef.current + 1
      failuresRef.current = nextFail
      setFailures(nextFail)
      setMetrics((m) => ({ ...m, failed: m.failed + 1 }))
      pushLog('fail', `重试耗尽，记失败 ${nextFail}/${FAILURE_THRESHOLD}`)

      if (state === 'half_open') {
        openedAt.current = Date.now()
        circuitRef.current = 'open'
        setCircuit('open')
        setMetrics((m) => ({ ...m, opens: m.opens + 1, fallbacks: m.fallbacks + 1 }))
        pushLog('open', '试探失败 → Open，重新熔断')
        pushLog('fallback', '返回静态兜底')
        setLastOutcome('试探失败 → Open + 静态兜底')
        return
      }

      if (nextFail >= FAILURE_THRESHOLD) {
        openedAt.current = Date.now()
        circuitRef.current = 'open'
        setCircuit('open')
        setMetrics((m) => ({ ...m, opens: m.opens + 1, fallbacks: m.fallbacks + 1 }))
        pushLog('open', `连续失败 ${nextFail} 次 → Open`)
        pushLog('fallback', '熔断触发，返回静态兜底')
        setLastOutcome('Closed → Open（阈值触发）')
      } else {
        setMetrics((m) => ({ ...m, fallbacks: m.fallbacks + 1 }))
        pushLog('fallback', '调用失败，降级到备用/静态回复')
        setLastOutcome(`失败累计 ${nextFail}/${FAILURE_THRESHOLD}`)
      }
    }

    runOnce()
    const id = setInterval(runOnce, 900)
    return () => clearInterval(id)
  }, [running])

  const successRate =
    metrics.total === 0 ? 0 : Math.round((metrics.success / metrics.total) * 100)

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-ink-100">Agent Harness 监控面板</h4>
          <p className="mt-1 text-xs text-ink-500">
            模拟请求穿过重试 → 熔断 → 降级。调节故障率，观察 Closed / Open / Half-Open 三态。
          </p>
        </div>
        <div
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${stateStyle[circuit]}`}
        >
          {stateLabel[circuit]}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="text-[11px] text-ink-500">
            注入故障率：{(failRate * 100).toFixed(0)}%
          </span>
          <input
            type="range"
            min={0}
            max={90}
            value={Math.round(failRate * 100)}
            onChange={(e) => setFailRate(Number(e.target.value) / 100)}
            className="accent-[rgb(var(--brand-500))]"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
          >
            {running ? '暂停' : '开始模拟'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-ink-300 hover:border-ink-500 hover:text-ink-100"
          >
            重置
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: '请求', value: metrics.total },
          { label: '成功', value: metrics.success },
          { label: '失败', value: metrics.failed },
          { label: '重试', value: metrics.retries },
          { label: '降级', value: metrics.fallbacks },
          { label: '熔断次数', value: metrics.opens },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-ink-700/80 bg-ink-900/40 px-3 py-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-ink-500">{item.label}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink-100">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status row */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-700/80 bg-ink-900/40 p-3">
          <div className="text-[10px] text-ink-500">成功率</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-semibold tabular-nums text-ink-100">{successRate}%</span>
            <div className="mb-1 h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-ink-700/80 bg-ink-900/40 p-3">
          <div className="text-[10px] text-ink-500">连续失败 / 阈值</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-ink-100">
            {failures}
            <span className="text-sm font-normal text-ink-500"> / {FAILURE_THRESHOLD}</span>
          </div>
        </div>
        <div className="rounded-lg border border-ink-700/80 bg-ink-900/40 p-3">
          <div className="text-[10px] text-ink-500">熔断冷却剩余</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-ink-100">
            {circuit === 'open' ? `${(cooldownLeft / 1000).toFixed(1)}s` : '—'}
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-ink-300">
        最近结果：{lastOutcome}
      </div>

      {/* Event log */}
      <div className="rounded-lg border border-ink-700/80 bg-ink-900/50">
        <div className="border-b border-ink-700/80 px-3 py-2 text-[11px] font-medium text-ink-400">
          事件流（最新在上）
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto p-2 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="px-1 py-3 text-ink-600">尚无事件。提高故障率并开始模拟。</div>
          ) : (
            logs.map((ev) => (
              <div key={ev.id} className="flex gap-2 px-1 py-0.5">
                <span className="shrink-0 text-ink-600">
                  {new Date(ev.t).toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className={`shrink-0 uppercase ${kindStyle[ev.kind]}`}>{ev.kind}</span>
                <span className="text-ink-300">{ev.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        教学约定：阈值 {FAILURE_THRESHOLD} 次失败打开熔断；冷却 {RECOVERY_MS / 1000}s
        后半开试探；重试用尽才计入熔断（与 L07-02 / L07-04 / P7 一致）。
      </p>
    </div>
  )
}
