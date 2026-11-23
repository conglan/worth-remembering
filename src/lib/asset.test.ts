import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { buildDailyCosts, formatDateTime, getAssetStatus, getDailyCost, getUsageDays } from './asset'
import { assetsToExcel, excelToAssets } from './excel'
import { parseAssetsBackup } from './storage'
import type { Asset } from './types'
import { useAssetStore } from '../stores/assets'

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tauri-apps/api/core')>()
  return { ...actual, invoke: vi.fn() }
})

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'test', brand: 'Brand', name: 'Product', image: null, price: 1000, currency: 'CNY',
    purchaseDate: '2026-01-01', purchaseLocation: '', retired: false, retirementDate: null,
    sold: false, salePrice: null, saleCurrency: 'CNY', saleNote: '', note: '',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
  }
}

describe('资产成本计算', () => {
  it('购入当天计为第 1 天', () => {
    const item = asset()
    expect(getUsageDays(item, '2026-01-01')).toBe(1)
    expect(getUsageDays(item, '2026-01-10')).toBe(10)
    expect(getDailyCost(item, '2026-01-10')).toBe(100)
  })

  it('退役后使用天数定格，出售是退役的子状态', () => {
    const item = asset({ retired: true, retirementDate: '2026-01-05', sold: true, salePrice: 300 })
    expect(getUsageDays(item, '2026-02-01')).toBe(5)
    expect(getDailyCost(item, '2026-02-01')).toBe(200)
    expect(getAssetStatus(item)).toBe('sold')
  })

  it('逐日总费用只统计当天仍持有的同币种资产', () => {
    const current = asset({ price: 1000, purchaseDate: '2026-01-02' })
    const retired = asset({ id: 'old', price: 500, purchaseDate: '2026-01-01', retired: true, retirementDate: '2026-01-02' })
    const usd = asset({ id: 'usd', currency: 'USD', purchaseDate: '2026-01-01' })
    const points = buildDailyCosts([current, retired, usd], 'CNY', 3, '2026-01-03')
    expect(points.map((point) => point.value)).toEqual([250, 750, 500])
  })
})

describe('备份数据校验', () => {
  it('Excel 导出后可以无损读回核心资产字段', async () => {
    const original = asset({ retired: true, retirementDate: '2026-01-05', sold: true, salePrice: 300 })
    const file = await assetsToExcel([original])
    const [imported] = await excelToAssets(file)
    expect(imported).toMatchObject({
      id: original.id, brand: original.brand, name: original.name, price: original.price,
      purchaseDate: original.purchaseDate, retired: true, retirementDate: '2026-01-05', sold: true, salePrice: 300,
    })
  })

  it('Excel 可以嵌入并恢复资产图片', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    const original = asset({ image: `data:image/png;base64,${png}` })
    const file = await assetsToExcel([original])
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(Buffer.from(file))
    expect(workbook.worksheets[0].getImages()).toHaveLength(1)
    const [imported] = await excelToAssets(file)
    expect(imported.image).toBe(original.image)
  })

  it('导出时间转换成本地可读格式', () => {
    expect(formatDateTime('2026-11-21T08:00:00.000Z')).toBe('2026-11-21 16:00:00')
    expect(formatDateTime('2026-11-21 16:00:00')).toBe('2026-11-21 16:00:00')
  })

  it('导入时补全可选字段并保留资产字段', () => {
    const [imported] = parseAssetsBackup(JSON.stringify({ assets: [{ brand: 'SONY', name: 'Camera', price: 2000, purchaseDate: '2026-01-01' }] }))
    expect(imported.currency).toBe('CNY')
    expect(imported.retired).toBe(false)
    expect(imported.name).toBe('Camera')
  })

  it('拒绝缺少退役日期的退役资产', () => {
    expect(() => parseAssetsBackup(JSON.stringify([{ brand: 'A', name: 'B', price: 1, purchaseDate: '2026-01-01', retired: true }]))).toThrow('退役日期')
  })

  it('导入只新增资产，不覆盖或重复相同 ID', async () => {
    setActivePinia(createPinia())
    const store = useAssetStore()
    const existing = asset({ id: 'same', price: 100 })
    const incoming = asset({ id: 'new', name: 'New asset' })
    store.assets = [existing]
    vi.mocked(invoke).mockResolvedValue(undefined)
    const result = await store.importBackup(JSON.stringify([{ ...existing, price: 999 }, incoming, incoming]))
    expect(result).toEqual({ added: 1, skipped: 2 })
    expect(store.assets.map((item) => item.id)).toEqual(['same', 'new'])
    expect(store.assets[0].price).toBe(100)
    expect(invoke).toHaveBeenCalledWith('append_assets', { assets: [expect.objectContaining({ id: 'new' })] })
  })
})
