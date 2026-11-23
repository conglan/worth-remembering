import type { CellValue, Row, Workbook, Worksheet } from 'exceljs'
import { formatDateTime, getDailyCost, getUsageDays } from './asset'
import { readAssetImage } from './api'
import { parseAssetsBackup } from './storage'
import type { Asset } from './types'

const HEADERS = ['资产 ID', '品牌', '产品名称', '图片', '图片路径', '购入价格', '购入币种', '购入日期', '购买地点', '是否退役', '退役日期', '是否已出售', '出售价格', '出售币种', '出售备注', '备注', '总使用天数', '每日成本费用', '创建时间', '更新时间']
const COLUMN_WIDTHS = [22, 18, 28, 14, 32, 12, 11, 14, 28, 11, 14, 12, 12, 11, 32, 42, 14, 16, 24, 24]
const IMAGE_COLUMN = 3

type PreparedImage = { base64: string; extension: 'jpeg' | 'png' }

export async function assetsToExcel(assets: Asset[]): Promise<ArrayBuffer> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = '值得记'
  workbook.lastModifiedBy = '值得记'
  workbook.created = new Date()
  workbook.modified = new Date()
  const worksheet = workbook.addWorksheet('资产档案', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  })
  worksheet.columns = HEADERS.map((header, index) => ({ header, width: COLUMN_WIDTHS[index] }))
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } }
  worksheet.getRow(1).height = 26
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF284D3B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  const images = await Promise.all(assets.map((asset) => prepareImage(asset.image)))
  assets.forEach((asset, index) => {
    const row = worksheet.addRow([
      asset.id, asset.brand, asset.name, '', asset.image?.startsWith('data:') ? '' : asset.image || '',
      asset.price, asset.currency, asset.purchaseDate, asset.purchaseLocation, asset.retired ? '是' : '否',
      asset.retirementDate || '', asset.sold ? '是' : '否', asset.salePrice ?? '', asset.saleCurrency,
      asset.saleNote, asset.note, getUsageDays(asset), Number(getDailyCost(asset).toFixed(2)), formatDateTime(asset.createdAt), formatDateTime(asset.updatedAt),
    ])
    row.height = images[index] ? 52 : 22
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E6DE' } } }
    })
    row.getCell(6).numFmt = '#,##0.00'
    row.getCell(13).numFmt = '#,##0.00'
    row.getCell(18).numFmt = '#,##0.00'
    const image = images[index]
    if (image) {
      const imageId = workbook.addImage(image)
      worksheet.addImage(imageId, {
        tl: { col: IMAGE_COLUMN + 0.12, row: index + 1.12 },
        ext: { width: 72, height: 54 },
        editAs: 'oneCell',
      })
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as unknown as ArrayBuffer).buffer
}

export async function excelToAssets(source: ArrayBuffer): Promise<Asset[]> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  await workbook.xlsx.load(source as unknown as Buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Excel 中没有可读取的工作表。')
  const headers = readHeaders(worksheet)
  if (!headers.has('品牌') || !headers.has('产品名称')) throw new Error('Excel 缺少“品牌”或“产品名称”列，请使用本应用导出的模板。')
  const embeddedImages = readEmbeddedImages(workbook, worksheet)
  const normalized: Array<Record<string, unknown>> = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const value = (header: string) => cellValue(row, headers.get(header))
    const brand = text(value('品牌')).trim()
    const name = text(value('产品名称')).trim()
    if (!brand && !name && !text(value('资产 ID'))) return
    const imagePath = text(value('图片路径'))
    normalized.push({
      id: text(value('资产 ID')),
      brand,
      name,
      image: imagePath || embeddedImages.get(rowNumber) || null,
      price: number(value('购入价格')),
      currency: text(value('购入币种')) || 'CNY',
      purchaseDate: dateText(value('购入日期')),
      purchaseLocation: text(value('购买地点')),
      retired: isYes(value('是否退役')),
      retirementDate: dateText(value('退役日期')) || null,
      sold: isYes(value('是否已出售')),
      salePrice: text(value('出售价格')) === '' ? null : number(value('出售价格')),
      saleCurrency: text(value('出售币种')) || 'CNY',
      saleNote: text(value('出售备注')),
      note: text(value('备注')),
      createdAt: text(value('创建时间')),
      updatedAt: text(value('更新时间')),
    })
  })
  return parseAssetsBackup(JSON.stringify(normalized))
}

function readHeaders(worksheet: Worksheet) {
  const headers = new Map<string, number>()
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    headers.set(cell.text.trim(), column)
  })
  return headers
}

function cellValue(row: Row, column?: number): CellValue {
  return column ? row.getCell(column).value : null
}

function text(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return String(value)
  if ('richText' in value) return value.richText.map((part) => part.text).join('')
  if ('text' in value) return String(value.text)
  if ('result' in value && value.result !== undefined) return text(value.result)
  return ''
}

function number(value: CellValue): number {
  if (typeof value === 'number') return value
  return Number(text(value).replace(/[^\d.-]/g, '') || 0)
}

function dateText(value: CellValue): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const raw = text(value).trim()
  const matched = raw.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/)
  if (matched) return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`
  const serial = Number(raw)
  if (raw && Number.isFinite(serial) && serial > 20_000 && serial < 80_000) {
    return new Date(Math.round((serial - 25_569) * 86_400_000)).toISOString().slice(0, 10)
  }
  return raw
}

function isYes(value: CellValue): boolean {
  return ['是', 'true', '1', 'yes'].includes(text(value).trim().toLowerCase())
}

function readEmbeddedImages(workbook: Workbook, worksheet: Worksheet) {
  const images = new Map<number, string>()
  for (const item of worksheet.getImages()) {
    const media = workbook.getImage(Number(item.imageId))
    const base64 = media.base64 || (media.buffer ? bytesToBase64(new Uint8Array(media.buffer)) : '')
    if (base64) images.set(Math.floor(item.range.tl.row) + 1, `data:image/${media.extension};base64,${base64}`)
  }
  return images
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

async function prepareImage(source: string | null): Promise<PreparedImage | null> {
  if (!source) return null
  try {
    const dataUrl = await readImage(source)
    if (typeof document === 'undefined') return directImage(dataUrl)
    const image = await loadImage(dataUrl)
    const scale = Math.min(1, 160 / image.naturalWidth, 120 / image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return directImage(dataUrl)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { base64: canvas.toDataURL('image/jpeg', 0.84).split(',')[1], extension: 'jpeg' }
  } catch {
    return null
  }
}

async function readImage(source: string): Promise<string> {
  if (source.startsWith('data:')) return source
  if (!/^(?:https?:|asset:|\/)/i.test(source)) return readAssetImage(source)
  const response = await fetch(source)
  if (!response.ok) throw new Error('图片读取失败')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

function directImage(dataUrl: string): PreparedImage {
  const matched = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i)
  if (!matched) throw new Error('当前环境无法转换图片')
  return { base64: matched[2], extension: matched[1].toLowerCase() === 'png' ? 'png' : 'jpeg' }
}
