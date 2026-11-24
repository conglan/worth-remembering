<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, Plus, Search, Sparkles } from 'lucide-vue-next'
import AssetImage from '../../components/AssetImage.vue'
import { useAssetStore } from '../../stores/assets'
import { useUiStore } from '../../stores/ui'
import type { Asset, AssetStatus } from '../../lib/types'
import { formatMoney, getAssetStatus, getDailyCost, getUsageDays, statusLabel } from '../../lib/asset'

const store = useAssetStore()
const ui = useUiStore()
const filters = [
  { key: 'all', label: '全部', count: () => store.counts.all },
  { key: 'active', label: '使用中', count: () => store.counts.active },
  { key: 'retired', label: '已退役', count: () => store.counts.retired },
  { key: 'sold', label: '已出售', count: () => store.counts.sold },
] as const

const STATUS_DOT: Record<AssetStatus, string> = {
  active: 'bg-[#4f9864]',
  retired: 'bg-[#c2a05a]',
  sold: 'bg-[#a9b1a5]',
}

const dateSorted = computed(() => store.sortBy === 'purchaseDateDesc' || store.sortBy === 'purchaseDateAsc')
const groups = computed<Array<{ label: string; assets: Asset[] }>>(() => {
  if (!dateSorted.value) return [{ label: '', assets: store.filteredAssets }]
  const buckets = new Map<string, Asset[]>()
  for (const asset of store.filteredAssets) {
    const year = asset.purchaseDate.slice(0, 4)
    const list = buckets.get(year)
    if (list) list.push(asset)
    else buckets.set(year, [asset])
  }
  return Array.from(buckets, ([label, assets]) => ({ label, assets }))
})

function clearFilters() {
  store.searchQuery = ''
  store.activeFilter = 'all'
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-4 pb-6">
    <header class="mb-4 flex items-start justify-between gap-3">
      <div>
        <div class="eyebrow mb-2">ASSET COLLECTION</div>
        <h1 class="text-[28px] leading-none font-semibold tracking-[-0.04em] text-[#273129]">我的资产</h1>
        <p class="mt-2 text-xs text-[#8a9287]">共 {{ store.counts.all }} 件，记录每份拥有。</p>
      </div>
      <button class="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-white shadow-[0_8px_20px_rgba(40,77,59,0.26)] transition active:scale-95" aria-label="记一件资产" @click="ui.openForm()"><Plus :size="21" :stroke-width="2.2" /></button>
    </header>

    <label class="relative block">
      <Search :size="17" class="absolute top-3.5 left-3.5 text-[#99a195]" />
      <input v-model="store.searchQuery" class="h-11 w-full rounded-2xl border border-[#eaede4] bg-white pr-4 pl-10 text-sm outline-none placeholder:text-[#a2a99e] focus:border-[#b4c2b0]" placeholder="搜索品牌或产品" />
    </label>

    <div class="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="按状态筛选资产">
      <button v-for="filter in filters" :key="filter.key" class="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 whitespace-nowrap transition-all active:scale-95" :class="store.activeFilter === filter.key ? 'bg-forest text-white shadow-[0_6px_16px_rgba(40,77,59,0.22)]' : 'bg-white text-[#737d72] shadow-[0_1px_2px_rgba(24,42,30,0.04)]'" :aria-pressed="store.activeFilter === filter.key" @click="store.activeFilter = filter.key">
        <span class="text-[11px] font-medium">{{ filter.label }}</span>
        <span class="text-[10px] tabular" :class="store.activeFilter === filter.key ? 'text-white/60' : 'text-[#a3aa9f]'">{{ filter.count() }}</span>
      </button>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <span class="text-[11px] text-[#8f988d]">找到 {{ store.filteredAssets.length }} 件资产</span>
      <label class="relative flex h-8 items-center rounded-full border border-[#eaede4] bg-white pl-3 text-[11px] text-[#687265]">
        <select v-model="store.sortBy" class="appearance-none bg-transparent pr-7 outline-none" aria-label="资产排序">
          <option value="purchaseDateDesc">最近购入</option>
          <option value="purchaseDateAsc">最早购入</option>
          <option value="priceDesc">价格最高</option>
          <option value="dailyCostDesc">日成本最高</option>
        </select>
        <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 text-[#a3ab9f]" />
      </label>
    </div>

    <div v-if="store.filteredAssets.length" class="mt-3 space-y-5">
      <section v-for="group in groups" :key="group.label || 'all'">
        <div v-if="group.label" class="mb-2.5 flex items-center gap-2.5 px-1">
          <span class="text-[11px] font-semibold tracking-[0.14em] text-[#a0a89b] tabular">{{ group.label }}</span>
          <span class="h-px flex-1 bg-[#e6e9e0]" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <article v-for="asset in group.assets" :key="asset.id" class="group flex flex-col rounded-[22px] border border-[#eceee6] bg-white p-3 shadow-[0_2px_10px_rgba(24,42,30,0.035)] transition duration-200 active:scale-[0.975]" @click="ui.openDetails(asset.id)">
            <div class="flex items-start justify-between gap-2">
              <AssetImage :asset="asset" class="size-[60px] rounded-[15px]" fit="cover" />
              <span class="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[9px] font-medium text-[#7d8a7b]"><span class="size-1.5 rounded-full" :class="STATUS_DOT[getAssetStatus(asset)]" />{{ statusLabel(getAssetStatus(asset)) }}</span>
            </div>
            <div class="mt-2.5 min-w-0">
              <div class="truncate text-[10px] font-medium text-[#9aa195]">{{ asset.brand }}</div>
              <h2 class="mt-0.5 truncate text-[13px] font-semibold text-[#2f3a31]">{{ asset.name }}</h2>
            </div>
            <div class="mt-2.5 flex items-end justify-between gap-1.5 border-t border-[#f2f4ef] pt-2">
              <div class="min-w-0">
                <div class="truncate text-[15px] leading-none font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), asset.currency, true) }}</div>
                <div class="mt-1 text-[9px] text-[#a6ada2]">每日成本</div>
              </div>
              <div class="shrink-0 pb-0.5 text-[9px] text-[#a6ada2] tabular">{{ getUsageDays(asset) }} 天</div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-else class="mt-4 rounded-[24px] border border-dashed border-[#dbe1d5] bg-white px-5 py-10 text-center">
      <span class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#eef3e9] text-[#7f9a86]"><Sparkles :size="24" :stroke-width="1.6" /></span>
      <h2 class="mt-4 text-sm font-semibold text-[#465047]">{{ store.searchQuery || store.activeFilter !== 'all' ? '没有找到匹配的资产' : '从第一件值得的物品开始' }}</h2>
      <p class="mt-2 text-xs leading-5 text-[#969d92]">{{ store.searchQuery || store.activeFilter !== 'all' ? '换个关键词或筛选条件试试。' : '记录一件物品，开始建立自己的生活档案。' }}</p>
      <button class="btn-primary mt-4 !h-10" @click="store.searchQuery || store.activeFilter !== 'all' ? clearFilters() : ui.openForm()">
        {{ store.searchQuery || store.activeFilter !== 'all' ? '清除筛选' : '记录第一件资产' }}
      </button>
    </div>
  </div>
</template>