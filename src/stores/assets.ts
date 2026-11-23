import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAssetStatus, getDailyCost, makeId, todayISO } from '../lib/asset'
import { assetsToExcel, excelToAssets } from '../lib/excel'
import { appendAssets, deleteAsset, loadAssets, parseAssetsBackup, replaceAssets, saveAsset, serializeAssets, storageInfo } from '../lib/storage'
import type { Asset, AssetDraft, AssetFilter, SortOption } from '../lib/types'

export const useAssetStore = defineStore('assets', () => {
  const assets = ref<Asset[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const activeFilter = ref<AssetFilter>('all')
  const searchQuery = ref('')
  const sortBy = ref<SortOption>('purchaseDateDesc')
  const viewMode = ref<'list' | 'grid'>('list')

  const filteredAssets = computed(() => {
    const query = searchQuery.value.trim().toLocaleLowerCase()
    return assets.value
      .filter((asset) => activeFilter.value === 'all' || getAssetStatus(asset) === activeFilter.value)
      .filter((asset) => !query || `${asset.brand} ${asset.name} ${asset.purchaseLocation} ${asset.note}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        if (sortBy.value === 'purchaseDateAsc') return a.purchaseDate.localeCompare(b.purchaseDate)
        if (sortBy.value === 'priceDesc') return b.price - a.price
        if (sortBy.value === 'dailyCostDesc') return getDailyCost(b) - getDailyCost(a)
        return b.purchaseDate.localeCompare(a.purchaseDate)
      })
  })

  const counts = computed(() => ({
    all: assets.value.length,
    active: assets.value.filter((asset) => getAssetStatus(asset) === 'active').length,
    retired: assets.value.filter((asset) => getAssetStatus(asset) === 'retired').length,
    sold: assets.value.filter((asset) => getAssetStatus(asset) === 'sold').length,
  }))

  const currencies = computed(() => [...new Set(assets.value.map((asset) => asset.currency))])

  async function initialize() {
    if (initialized.value || loading.value) return
    loading.value = true
    try {
      assets.value = await loadAssets()
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  function reset() {
    assets.value = []
    initialized.value = false
    loading.value = false
    activeFilter.value = 'all'
    searchQuery.value = ''
    sortBy.value = 'purchaseDateDesc'
    viewMode.value = 'list'
  }

  async function save(draft: AssetDraft, id?: string) {
    const existing = id ? assets.value.find((asset) => asset.id === id) : undefined
    const timestamp = new Date().toISOString()
    const asset: Asset = {
      ...draft,
      id: existing?.id || makeId(),
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    }
    await saveAsset(asset)
    const index = assets.value.findIndex((item) => item.id === asset.id)
    if (index >= 0) assets.value[index] = asset
    else assets.value.unshift(asset)
    return asset
  }

  async function remove(id: string) {
    await deleteAsset(id)
    assets.value = assets.value.filter((asset) => asset.id !== id)
  }

  async function importBackup(source: string) {
    return importAssets(parseAssetsBackup(source))
  }

  async function importExcel(source: ArrayBuffer) {
    return importAssets(await excelToAssets(source))
  }

  async function importAssets(imported: typeof assets.value) {
    const existingIds = new Set(assets.value.map((asset) => asset.id))
    const candidates = imported.filter((asset) => {
      if (existingIds.has(asset.id)) return false
      existingIds.add(asset.id)
      return true
    })
    const additions = await appendAssets(candidates)
    assets.value = [...assets.value, ...additions]
    return { added: additions.length, skipped: imported.length - candidates.length }
  }

  async function clear() {
    await replaceAssets([])
    assets.value = []
  }

  function exportBackup() {
    return serializeAssets(assets.value)
  }

  function exportExcel() {
    return assetsToExcel(assets.value)
  }

  return {
    assets, loading, initialized, activeFilter, searchQuery, sortBy, viewMode,
    filteredAssets, counts, currencies, storageInfo, today: todayISO(),
      initialize, reset, save, remove, importBackup, importExcel, importAssets, clear, exportBackup, exportExcel,
  }
})
