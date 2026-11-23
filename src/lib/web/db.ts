/**
 * 极简 IndexedDB 封装，用于 Web 调试 / PWA 环境模拟 SQLite。
 * 数据库按用户隔离：资产数据以 `userId` 为前缀存储。
 */

const DB_NAME = 'worth-remembering'
const DB_VERSION = 1

export interface StoredUser {
  id: string
  username: string
  normalizedUsername: string
  displayName: string
  passwordHash: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface StoredAsset {
  id: string
  userId: string
  brand: string
  name: string
  image: string | null
  price: number
  currency: string
  purchaseDate: string
  purchaseLocation: string
  retired: boolean
  retirementDate: string | null
  sold: boolean
  salePrice: number | null
  saleCurrency: string
  saleNote: string
  note: string
  createdAt: string
  updatedAt: string
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('usersByUsername')) db.createObjectStore('usersByUsername', { keyPath: 'normalizedUsername' })
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('session')) db.createObjectStore('session', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return databasePromise
}

function transaction<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDatabase().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const objectStore = tx.objectStore(store)
    const request = action(objectStore)
    tx.oncomplete = () => resolve(request.result as T)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }))
}

export function dbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return transaction<T | undefined>(store, 'readonly', (objectStore) => objectStore.get(key))
}

export function dbGetAll<T>(store: string): Promise<T[]> {
  return transaction<T[]>(store, 'readonly', (objectStore) => objectStore.getAll())
}

export function dbPut<T>(store: string, value: T): Promise<void> {
  return transaction<void>(store, 'readwrite', (objectStore) => objectStore.put(value as unknown as object))
}

export function dbDelete(store: string, key: IDBValidKey): Promise<void> {
  return transaction<void>(store, 'readwrite', (objectStore) => objectStore.delete(key))
}

export function dbClear(store: string): Promise<void> {
  return transaction<void>(store, 'readwrite', (objectStore) => objectStore.clear())
}

export function now(): string {
  const date = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

/** 使用 Web Crypto 的 PBKDF2 派生密码哈希（Web 调试用，桌面端仍为 Argon2）。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    material,
    256,
  )
  const saltHex = Array.from(salt).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `pbkdf2$${saltHex}$${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'pbkdf2' || !saltHex || !hashHex) return false
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    material,
    256,
  )
  const computed = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return computed === hashHex
}