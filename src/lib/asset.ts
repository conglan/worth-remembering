import type { Asset, AssetStatus, CurrencyCode, DailyCostPoint } from './types'

export function todayISO(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function asLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function addDays(value: string, amount: number): string {
  const date = asLocalDate(value)
  date.setDate(date.getDate() + amount)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function getAssetStatus(asset: Asset): AssetStatus {
  if (asset.retired && asset.sold) return 'sold'
  if (asset.retired) return 'retired'
  return 'active'
}

export function getUsageDays(asset: Asset, referenceDate = todayISO()): number {
  const end = asset.retired && asset.retirementDate ? asset.retirementDate : referenceDate
  const startTime = asLocalDate(asset.purchaseDate).getTime()
  const endTime = asLocalDate(end).getTime()
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1)
}

export function getDailyCost(asset: Asset, referenceDate = todayISO()): number {
  return asset.price / getUsageDays(asset, referenceDate)
}

export function buildDailyCosts(
  assets: Asset[],
  currency: CurrencyCode,
  range: number,
  endDate = todayISO(),
): DailyCostPoint[] {
  const candidates = assets.filter((asset) => asset.currency === currency)
  return Array.from({ length: range }, (_, index) => {
    const date = addDays(endDate, index - range + 1)
    const value = candidates.reduce((total, asset) => {
      const retiredBefore = asset.retired && asset.retirementDate && date > asset.retirementDate
      if (date < asset.purchaseDate || retiredBefore) return total
      return total + getDailyCost(asset, endDate)
    }, 0)
    const parsed = asLocalDate(date)
    return {
      date,
      label: `${parsed.getMonth() + 1}/${parsed.getDate()}`,
      value: Number(value.toFixed(2)),
    }
  })
}

export function formatMoney(value: number, currency: CurrencyCode = 'CNY', precise = false): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: precise && currency !== 'JPY' ? 2 : 0,
    maximumFractionDigits: precise && currency !== 'JPY' ? 2 : 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)
}

export function formatDate(value: string | null, includeYear = true): string {
  if (!value) return '—'
  const date = asLocalDate(value)
  return new Intl.DateTimeFormat('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDateTime(value: string): string {
  if (!value || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function statusLabel(status: AssetStatus): string {
  return { active: '使用中', retired: '已退役', sold: '已出售' }[status]
}

export function statusDescription(asset: Asset): string {
  const status = getAssetStatus(asset)
  if (status === 'sold') return `已于 ${formatDate(asset.retirementDate)} 出售`
  if (status === 'retired') return `已于 ${formatDate(asset.retirementDate)} 退役`
  return `已陪伴 ${getUsageDays(asset)} 天`
}

export function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
