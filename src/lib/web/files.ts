import type { StorageSettings } from '../types'

/**
 * Web 环境的文件与存储设置实现。
 * 浏览器无法访问任意文件系统，因此：
 * - 导出：通过 Blob 下载（saveBackup 的 path 参数在 Web 下被忽略，改为触发下载）。
 * - 存储设置：返回固定的浏览器存储描述。
 */

export async function saveBackup(_path: string, contentBase64: string): Promise<void> {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `值得记-资产备份-${new Date().toISOString().slice(0, 10)}`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function getStorageSettings(): Promise<StorageSettings> {
  return {
    databaseRoot: '浏览器 IndexedDB',
    imageRoot: '浏览器 IndexedDB',
    activeDatabaseRoot: '浏览器 IndexedDB',
    activeImageRoot: '浏览器 IndexedDB',
    defaultDatabaseRoot: '浏览器 IndexedDB',
    defaultImageRoot: '浏览器 IndexedDB',
    settingsPath: '浏览器本地存储',
    restartRequired: false,
  }
}

export async function updateStorageSettings(_databaseRoot: string, _imageRoot: string): Promise<StorageSettings> {
  return getStorageSettings()
}

export async function restartApp(): Promise<void> {
  window.location.reload()
}