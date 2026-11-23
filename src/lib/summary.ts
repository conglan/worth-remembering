import type { Asset } from './types'

export type SummaryGranularity = 'daily' | 'monthly' | 'yearly'
export type SummaryMode = 'purchase' | 'holding'

export interface SummaryPoint {
  key: string
  label: string
  value: number
}

function pad(part: number): string {
  return String(part).padStart(2, '0')
}

function keyOf(date: Date, granularity: SummaryGranularity): string {
  if (granularity === 'yearly') return `${date.getFullYear()}`
  if (granularity === 'monthly') return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function labelOf(key: string, granularity: SummaryGranularity): string {
  if (granularity === 'yearly') return `${key} 年`
  if (granularity === 'monthly') {
    const [year, month] = key.split('-')
    return `${year}/${month}`
  }
  const [year, month, day] = key.split('-')
  return `${Number(month)}/${Number(day)}`
}

function parseKey(key: string): Date {
  const parts = key.split('-').map((part) => Number(part))
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
}

function addGranularity(date: Date, granularity: SummaryGranularity, amount: number): Date {
  const next = new Date(date)
  if (granularity === 'yearly') next.setFullYear(next.getFullYear() + amount)
  else if (granularity === 'monthly') next.setMonth(next.getMonth() + amount)
  else next.setDate(next.getDate() + amount)
  return next
}

/**
 * 按购入日期汇总支出：把每件资产的购入价格累加到其购入日/月/年。
 */
export function buildPurchaseSummary(assets: Asset[], granularity: SummaryGranularity): SummaryPoint[] {
  const totals = new Map<string, number>()
  for (const asset of assets) {
    const date = new Date(`${asset.purchaseDate}T00:00:00`)
    if (Number.isNaN(date.getTime())) continue
    const key = keyOf(date, granularity)
    totals.set(key, (totals.get(key) || 0) + asset.price)
  }
  return sortAndFill(totals, granularity)
}

/**
 * 按持有成本汇总：把每件资产的价格摊到其使用期内的每一天，再按日/月/年聚合。
 */
export function buildHoldingSummary(assets: Asset[], granularity: SummaryGranularity): SummaryPoint[] {
  const totals = new Map<string, number>()
  for (const asset of assets) {
    const start = new Date(`${asset.purchaseDate}T00:00:00`)
    if (Number.isNaN(start.getTime())) continue
    const end = asset.retired && asset.retirementDate
      ? new Date(`${asset.retirementDate}T00:00:00`)
      : new Date()
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
    const dailyCost = asset.price / days
    for (let cursor = new Date(start); cursor <= end; cursor = addGranularity(cursor, 'daily', 1)) {
      const key = keyOf(cursor, granularity)
      totals.set(key, (totals.get(key) || 0) + dailyCost)
    }
  }
  return sortAndFill(totals, granularity)
}

function sortAndFill(totals: Map<string, number>, granularity: SummaryGranularity): SummaryPoint[] {
  const keys = [...totals.keys()].sort()
  if (!keys.length) return []
  const first = parseKey(keys[0])
  const last = parseKey(keys[keys.length - 1])
  const points: SummaryPoint[] = []
  for (let cursor = new Date(first); cursor <= last; cursor = addGranularity(cursor, granularity, 1)) {
    const key = keyOf(cursor, granularity)
    points.push({ key, label: labelOf(key, granularity), value: Number((totals.get(key) || 0).toFixed(2)) })
  }
  return points
}

export function summarize(points: SummaryPoint[]): { total: number; average: number; peak: number } {
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const average = points.length ? total / points.length : 0
  const peak = points.reduce((max, point) => Math.max(max, point.value), 0)
  return { total, average, peak }
}