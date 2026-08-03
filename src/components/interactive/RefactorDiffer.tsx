/**
 * 重构前后代码快照对比器 —— M17 L17-07
 * 学员切换"重构前""重构后"视图，对比同一段代码在重构前后的差异
 */
import { useState } from 'react'

interface Version {
  label: string
  code: string
  highlights?: number[] // 高亮的行号
}

const VERSIONS: Record<string, Version> = {
  before: {
    label: '重构前',
    code: `def calc_discount(total: float, plan: str, coupon: str | None) -> float:
    """计算订单折扣金额"""
    if plan == "free":
        if coupon == "SAVE10" and total > 50:
            return total * 0.9
        return total
    elif plan == "pro":
        discount = total * 0.85
        if coupon == "SAVE10" and discount > 50:
            discount = discount * 0.9
        return discount
    elif plan == "team":
        discount = total * 0.8
        if coupon == "SAVE500" and discount > 500:
            discount = discount - 500
        elif coupon == "SAVE10" and discount > 50:
            discount = discount * 0.9
        return discount
    else:
        raise ValueError(f"Unknown plan: {plan}")`,
  },
  after: {
    label: '重构后',
    code: `from enum import Enum

Plan = Enum('Plan', ['FREE', 'PRO', 'TEAM'])
Coupon = Enum('Coupon', ['SAVE10', 'SAVE500'])

PLAN_DISCOUNTS = {Plan.FREE: 1.0, Plan.PRO: 0.85, Plan.TEAM: 0.8}

def calc_discount(total: float, plan: Plan, coupon: Coupon | None = None) -> float:
    """计算订单抵扣后金额"""
    discounted = total * PLAN_DISCOUNTS[plan]
    return apply_coupon(discounted, coupon)

def apply_coupon(amount: float, coupon: Coupon | None) -> float:
    """应用优惠券（独立函数，可单独测试）"""
    if coupon is None:
        return amount
    if coupon == Coupon.SAVE10 and amount > 50:
        return amount * 0.9
    if coupon == Coupon.SAVE500 and amount > 500:
        return amount - 500
    return amount`,
  },
}

const IMPROVEMENTS = [
  { label: '枚举替换字符串', desc: 'plan/coupon 从魔法字符串改为 Enum，IDE 补全 + 编译时检查' },
  { label: '函数拆分', desc: '折扣计算与优惠券逻辑分离，各自可独立测试和修改' },
  { label: '常量提取', desc: '折扣率集中到 PLAN_DISCOUNTS，新增计划类型只需加一行' },
  { label: '消除嵌套', desc: '多层 if/elif 扁平化为查表 + 函数调用，圈复杂度从 6 降到 2' },
]

export function RefactorDiffer() {
  const [tab, setTab] = useState<'before' | 'after'>('before')
  const [showImprovements, setShowImprovements] = useState(false)

  const v = VERSIONS[tab]

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab('before')}
          className={`px-3 py-1 text-sm rounded ${
            tab === 'before'
              ? 'bg-red-100 text-red-700 font-semibold'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          重构前
        </button>
        <button
          onClick={() => setTab('after')}
          className={`px-3 py-1 text-sm rounded ${
            tab === 'after'
              ? 'bg-green-100 text-green-700 font-semibold'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          重构后
        </button>
        <button
          onClick={() => setShowImprovements(!showImprovements)}
          className="ml-auto text-xs text-blue-500 hover:text-blue-700 underline"
        >
          {showImprovements ? '隐藏改进点' : '看改了什么'}
        </button>
      </div>

      {/* 代码块 */}
      <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto leading-relaxed">
        <code>{v.code}</code>
      </pre>

      {/* 改进点分析 */}
      {showImprovements && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 mb-1">具体改进了什么：</p>
          {IMPROVEMENTS.map((imp, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-green-500 mt-0.5">✓</span>
              <div>
                <span className="font-medium text-gray-700">{imp.label}</span>
                <span className="text-gray-400"> — {imp.desc}</span>
              </div>
            </div>
          ))}
          <p className="mt-2 text-xs text-gray-400 border-t pt-2">
            ⚠️ 重构的关键原则：<strong>diff 里只能看到结构调整，不能看到逻辑修改</strong>。
            如果两者混在一起，出问题时你无法二分定位。
          </p>
        </div>
      )}
    </div>
  )
}
