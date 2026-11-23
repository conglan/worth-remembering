import { formatDateTime } from './asset'
import { appendAssets as apiAppendAssets, deleteAsset as apiDeleteAsset, listAssets as apiListAssets, normalizeAssetImage, readAssetImage, replaceAssets as apiReplaceAssets, saveAsset as apiSaveAsset, saveAssetImage } from './api'
import { CURRENCIES, type Asset, type StorageInfo, type StorageSettings } from './types'

export const storageInfo: StorageInfo = { label: '用户独立数据库', description: '每个账号拥有独立的资产数据库与图片目录' }

async function prepareImages(assets: Asset[]): Promise<Asset[]> {
  const prepared = structuredClone(assets)
  for (const asset of prepared) {
    if (asset.image?.startsWith('data:')) {
      asset.image = await saveAssetImage(asset.id, asset.image)
    } else if (asset.image && !asset.image.startsWith('/')) {
      asset.image = await normalizeAssetImage(asset.id, asset.image)
    }
  }
  return prepared
}

export async function loadAssets(): Promise<Asset[]> {
  return apiListAssets()
}

export async function saveAsset(asset: Asset): Promise<void> {
  const [prepared] = await prepareImages([asset])
  await apiSaveAsset(prepared)
  asset.image = prepared.image
}

export async function deleteAsset(id: string): Promise<void> {
  return apiDeleteAsset(id)
}

export async function replaceAssets(assets: Asset[]): Promise<void> {
  const prepared = await prepareImages(assets)
  return apiReplaceAssets(prepared)
}

export async function appendAssets(assets: Asset[]): Promise<Asset[]> {
  if (!assets.length) return []
  const prepared = await prepareImages(assets)
  await apiAppendAssets(prepared)
  return prepared
}

export async function resolveImage(path: string | null): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('/') || path.startsWith('data:')) return path
  return readAssetImage(path)
}

export function getStorageSettings(): Promise<StorageSettings> {
  return import('./api').then((module) => module.getStorageSettings())
}

export function updateStorageSettings(databaseRoot: string, imageRoot: string): Promise<StorageSettings> {
  return import('./api').then((module) => module.updateStorageSettings(databaseRoot, imageRoot))
}

export function restartApp(): Promise<void> {
  return import('./api').then((module) => module.restartApp())
}

export function serializeAssets(assets: Asset[]): string {
  const exportedAt = formatDateTime(new Date().toISOString())
  const records = assets.map((asset) => ({ ...asset, createdAt: formatDateTime(asset.createdAt), updatedAt: formatDateTime(asset.updatedAt) }))
  return JSON.stringify({ app: 'worth-remembering', version: 1, exportedAt, assets: records }, null, 2)
}

export function parseAssetsBackup(source: string): Asset[] {
  const parsed = JSON.parse(source)
  const list = Array.isArray(parsed) ? parsed : parsed.assets
  if (!Array.isArray(list)) throw new Error('备份文件中没有找到资产数据。')
  const currencies = CURRENCIES.map((item) => item.code)
  return list.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 条资产格式不正确。`)
    if (!item.brand?.trim() || !item.name?.trim()) throw new Error(`第 ${index + 1} 条资产缺少品牌或产品名称。`)
    if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) throw new Error(`第 ${index + 1} 条资产价格不正确。`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.purchaseDate)) throw new Error(`第 ${index + 1} 条资产购入日期不正确。`)
    const retired = Boolean(item.retired)
    if (retired && !/^\d{4}-\d{2}-\d{2}$/.test(item.retirementDate ?? '')) throw new Error(`第 ${index + 1} 条资产缺少退役日期。`)
    const timestamp = new Date().toISOString()
    return {
      id: String(item.id || crypto.randomUUID()),
      brand: String(item.brand).trim(), name: String(item.name).trim(), image: item.image || null,
      price: Number(item.price), currency: currencies.includes(item.currency) ? item.currency : 'CNY',
      purchaseDate: item.purchaseDate, purchaseLocation: String(item.purchaseLocation || ''),
      retired, retirementDate: retired ? item.retirementDate : null, sold: retired && Boolean(item.sold),
      salePrice: retired && item.salePrice !== null && item.salePrice !== '' ? Number(item.salePrice) : null,
      saleCurrency: currencies.includes(item.saleCurrency) ? item.saleCurrency : 'CNY',
      saleNote: String(item.saleNote || ''), note: String(item.note || ''),
      createdAt: item.createdAt || timestamp, updatedAt: item.updatedAt || timestamp,
    } satisfies Asset
  })
}
