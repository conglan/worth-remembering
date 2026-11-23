import type { Asset, CurrencyCode } from './types'
import { CURRENCIES } from './types'
import { readAssetImage } from './api'

/**
 * useitlong 备份解析器。
 *
 * .useitlongbackup 是一个 ZIP 压缩包，内含：
 * - backup.json：资产数组（brand/name/price/currency/purchaseDate/status/imageID/endOfUseDate…）
 * - images/：以 imageID 命名的 PNG 图片
 */

interface UseitlongRecord {
  id?: string
  brand?: string
  name?: string
  price?: number
  currency?: string
  purchaseDate?: string
  status?: string
  imageID?: string
  endOfUseDate?: string
  updatedAt?: string
  value?: number
}

const SUPPORTED = new Set<string>(CURRENCIES.map((item) => item.code))

function toDate(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toCurrency(value: string | undefined): CurrencyCode {
  return value && SUPPORTED.has(value) ? (value as CurrencyCode) : 'CNY'
}

function toTimestamp(value: string | undefined): string {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

async function imageToDataUrl(blob: Blob, extension: string): Promise<string | null> {
  if (!blob || blob.size === 0) return null
  const mime = extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : 'image/png'
  const typed = new Blob([blob], { type: mime })
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(typed)
  })
}

export async function parseUseitlongBackup(source: ArrayBuffer): Promise<Asset[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(source)
  const jsonFile = zip.file('backup.json')
  if (!jsonFile) throw new Error('备份文件中没有找到 backup.json。')
  const text = await jsonFile.async('string')
  const parsed = JSON.parse(text)
  const records: UseitlongRecord[] = Array.isArray(parsed) ? parsed : parsed.assets
  if (!Array.isArray(records)) throw new Error('备份文件格式不正确。')

  const assets: Asset[] = []
  for (const record of records) {
    if (!record || typeof record !== 'object') continue
    const brand = String(record.brand || '').trim()
    const name = String(record.name || '').trim()
    if (!brand || !name) continue
    const retired = String(record.status || '').toUpperCase() === 'RETIRED'
    const imageId = record.imageID || record.id
    let image: string | null = null
    if (imageId) {
          const candidates = [
            { path: `images/${imageId}.png`, extension: 'png' },
            { path: `images/${imageId}.jpg`, extension: 'jpg' },
            { path: `images/${imageId}.jpeg`, extension: 'jpeg' },
            { path: `images/${imageId}.webp`, extension: 'webp' },
          ]
          for (const candidate of candidates) {
            const file = zip.file(candidate.path)
            if (file) {
              image = await imageToDataUrl(await file.async('blob'), candidate.extension)
              if (image) break
            }
          }
        }
    const timestamp = toTimestamp(record.updatedAt)
    assets.push({
      id: String(record.id || crypto.randomUUID()),
      brand,
      name,
      image,
      price: Number(record.price ?? record.value ?? 0),
      currency: toCurrency(record.currency),
      purchaseDate: toDate(record.purchaseDate) || new Date().toISOString().slice(0, 10),
      purchaseLocation: '',
      retired,
      retirementDate: retired ? toDate(record.endOfUseDate) || null : null,
      sold: false,
      salePrice: null,
      saleCurrency: 'CNY',
      saleNote: '',
      note: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
  return assets
}

  /**
   * 将资产导出为 useitlong 兼容的 .useitlongbackup 格式（ZIP）。
   *
   * 结构：
   * - backup.json：资产数组（brand/name/price/currency/purchaseDate/status/imageID/endOfUseDate/updatedAt/value）
   * - images/：以资产 id 命名的图片文件
   */
  export async function assetsToUseitlongBackup(assets: Asset[]): Promise<ArrayBuffer> {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const imagesFolder = zip.folder('images')!

    const records: Array<Record<string, unknown>> = []
    for (const asset of assets) {
      const retired = asset.retired
      const record: Record<string, unknown> = {
        id: asset.id,
        brand: asset.brand,
        name: asset.name,
        price: asset.price,
        currency: asset.currency,
        purchaseDate: toIsoDateTime(asset.purchaseDate),
        status: retired ? 'RETIRED' : 'ACTIVE',
        imageID: asset.id,
        value: asset.price,
        updatedAt: toIsoDateTime(asset.updatedAt),
      }
      if (retired && asset.retirementDate) {
        record.endOfUseDate = toIsoDateTime(asset.retirementDate)
      }
      records.push(record)

      if (asset.image) {
        const dataUrl = await resolveImageDataUrl(asset.image)
        if (dataUrl) {
          const { base64, extension } = splitDataUrl(dataUrl)
          if (base64) {
            imagesFolder.file(`${asset.id}.${extension}`, base64, { base64: true })
          }
        }
      }
    }

    zip.file('backup.json', JSON.stringify(records, null, 2))
    return zip.generateAsync({ type: 'arraybuffer' })
  }

  function toIsoDateTime(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00Z`
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return new Date().toISOString()
    return date.toISOString()
  }

  async function resolveImageDataUrl(source: string): Promise<string | null> {
    if (source.startsWith('data:')) return source
    if (/^(?:https?:|asset:|\/)/i.test(source)) {
      try {
        const response = await fetch(source)
        if (!response.ok) return null
        const blob = await response.blob()
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    }
    try {
      return await readAssetImage(source)
    } catch {
      return null
    }
  }

  function splitDataUrl(dataUrl: string): { base64: string; extension: string } {
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/)
    if (match) return { base64: match[2], extension: match[1] === 'jpeg' ? 'jpg' : match[1] }
    // 兜底：尝试解析任意 data URL
    const generic = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (generic) {
      const mime = generic[1]
      const extension = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png'
      return { base64: generic[2], extension }
    }
    return { base64: '', extension: 'png' }
  }