import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from './auth'
import { useAssetStore } from './assets'
import type { Asset, User } from '../lib/types'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const admin: User = {
  id: 'admin-id', username: 'admin', displayName: '管理员', role: 'admin', status: 'active',
  createdAt: '2026-01-01 08:00:00', updatedAt: '2026-01-01 08:00:00', lastLoginAt: null,
}

const asset: Asset = {
  id: 'private-asset', brand: 'PRIVATE', name: '用户私有资产', image: null, price: 100, currency: 'CNY',
  purchaseDate: '2026-01-01', purchaseLocation: '', retired: false, retirementDate: null,
  sold: false, salePrice: null, saleCurrency: 'CNY', saleNote: '', note: '',
  createdAt: '2026-01-01 08:00:00', updatedAt: '2026-01-01 08:00:00',
}

describe('本地账号与用户切换', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(invoke).mockReset()
  })

  it('恢复会话并在注册后保存当前管理员', async () => {
    const auth = useAuthStore()
    vi.mocked(invoke).mockResolvedValueOnce({ hasUsers: false, currentUser: null })
    await auth.initialize()
    expect(auth.initialized).toBe(true)
    expect(auth.currentUser).toBeNull()

    vi.mocked(invoke).mockResolvedValueOnce(admin)
    await auth.register('admin', '管理员', '12345678')
    expect(auth.hasUsers).toBe(true)
    expect(auth.currentUser).toEqual(admin)
    expect(auth.isAdmin).toBe(true)
    expect(vi.mocked(invoke)).toHaveBeenLastCalledWith('register', { username: 'admin', displayName: '管理员', password: '12345678' })
  })

  it('退出后清空当前用户', async () => {
    const auth = useAuthStore()
    vi.mocked(invoke).mockResolvedValueOnce({ hasUsers: true, currentUser: admin })
    await auth.initialize()
    vi.mocked(invoke).mockResolvedValueOnce(undefined)
    await auth.logout()
    expect(auth.currentUser).toBeNull()
    expect(auth.isAdmin).toBe(false)
  })

  it('切换账号前重置上一用户的资产与筛选状态', () => {
    const store = useAssetStore()
    store.assets = [asset]
    store.initialized = true
    store.searchQuery = 'PRIVATE'
    store.activeFilter = 'sold'
    store.reset()
    expect(store.assets).toEqual([])
    expect(store.initialized).toBe(false)
    expect(store.searchQuery).toBe('')
    expect(store.activeFilter).toBe('all')
  })
})
