import type { Asset } from '../types'
import { dbDelete, dbGet, dbGetAll, dbPut, type StoredAsset } from './db'

const SESSION_KEY = 'current-user-id'

async function currentUserId(): Promise<string | null> {
  const record = await dbGet<{ key: string; value: string }>('session', SESSION_KEY)
  return record?.value ?? null
}

function toAsset(stored: StoredAsset): Asset {
  return {
    id: stored.id,
    brand: stored.brand,
    name: stored.name,
    image: stored.image,
    price: stored.price,
    currency: stored.currency as Asset['currency'],
    purchaseDate: stored.purchaseDate,
    purchaseLocation: stored.purchaseLocation,
    retired: stored.retired,
    retirementDate: stored.retirementDate,
    sold: stored.sold,
    salePrice: stored.salePrice,
    saleCurrency: stored.saleCurrency as Asset['currency'],
    saleNote: stored.saleNote,
    note: stored.note,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  }
}

function toStored(asset: Asset, userId: string): StoredAsset {
  return {
    id: asset.id,
    userId,
    brand: asset.brand,
    name: asset.name,
    image: asset.image,
    price: asset.price,
    currency: asset.currency,
    purchaseDate: asset.purchaseDate,
    purchaseLocation: asset.purchaseLocation,
    retired: asset.retired,
    retirementDate: asset.retirementDate,
    sold: asset.sold,
    salePrice: asset.salePrice,
    saleCurrency: asset.saleCurrency,
    saleNote: asset.saleNote,
    note: asset.note,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId()
  if (!id) throw new Error('请先登录')
  return id
}

export async function listAssets(): Promise<Asset[]> {
  const userId = await requireUserId()
  const all = await dbGetAll<StoredAsset>('assets')
  return all
    .filter((asset) => asset.userId === userId)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || b.createdAt.localeCompare(a.createdAt))
    .map(toAsset)
}

export async function saveAsset(asset: Asset): Promise<void> {
  const userId = await requireUserId()
  await dbPut('assets', toStored(asset, userId))
}

export async function replaceAssets(assets: Asset[]): Promise<void> {
  const userId = await requireUserId()
  const all = await dbGetAll<StoredAsset>('assets')
  for (const existing of all) {
    if (existing.userId === userId) await dbDelete('assets', existing.id)
  }
  for (const asset of assets) await dbPut('assets', toStored(asset, userId))
}

export async function appendAssets(assets: Asset[]): Promise<void> {
  const userId = await requireUserId()
  for (const asset of assets) {
    const existing = await dbGet<StoredAsset>('assets', asset.id)
    if (!existing) await dbPut('assets', toStored(asset, userId))
  }
}

export async function deleteAsset(id: string): Promise<void> {
  await requireUserId()
  await dbDelete('assets', id)
}

// ---------------------------------------------------------------------------
// 图片：Web 环境直接以 data URL 存储，无需文件系统。
// ---------------------------------------------------------------------------

export async function saveAssetImage(_assetId: string, dataUrl: string): Promise<string> {
  return dataUrl
}

export async function normalizeAssetImage(_assetId: string, path: string): Promise<string> {
  return path
}

export async function readAssetImage(path: string): Promise<string> {
  return path
}