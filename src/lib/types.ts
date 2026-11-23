export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'HKD'
export type AssetStatus = 'active' | 'retired' | 'sold'
export type AssetFilter = 'all' | AssetStatus
export type SortOption = 'purchaseDateDesc' | 'purchaseDateAsc' | 'priceDesc' | 'dailyCostDesc'

export interface Asset {
  id: string
  brand: string
  name: string
  image: string | null
  price: number
  currency: CurrencyCode
  purchaseDate: string
  purchaseLocation: string
  retired: boolean
  retirementDate: string | null
  sold: boolean
  salePrice: number | null
  saleCurrency: CurrencyCode
  saleNote: string
  note: string
  createdAt: string
  updatedAt: string
}

export type AssetDraft = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>

export interface DailyCostPoint {
  date: string
  label: string
  value: number
}

export interface StorageInfo {
  label: string
  description: string
}

export type UserRole = 'admin' | 'user'
export type UserStatus = 'active' | 'disabled'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface AuthStatus {
  hasUsers: boolean
  currentUser: User | null
}

export interface StorageSettings {
  databaseRoot: string
  imageRoot: string
  activeDatabaseRoot: string
  activeImageRoot: string
  defaultDatabaseRoot: string
  defaultImageRoot: string
  settingsPath: string
  restartRequired: boolean
}

export const CURRENCIES: Array<{ code: CurrencyCode; label: string; symbol: string }> = [
  { code: 'CNY', label: '人民币', symbol: '¥' },
  { code: 'USD', label: '美元', symbol: '$' },
  { code: 'EUR', label: '欧元', symbol: '€' },
  { code: 'GBP', label: '英镑', symbol: '£' },
  { code: 'JPY', label: '日元', symbol: '¥' },
  { code: 'HKD', label: '港币', symbol: 'HK$' },
]
