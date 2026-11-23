<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-vue-next'
import AssetCard from './AssetCard.vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import type { Asset, AssetFilter } from '../lib/types'

const emit = defineEmits<{ delete: [asset: Asset] }>()
const store = useAssetStore()
const ui = useUiStore()
const currentPage = ref(1)
const pageSize = ref(5)
const tabs: Array<{ key: AssetFilter; label: string }> = [
  { key: 'all', label: '所有' }, { key: 'active', label: '启用' }, { key: 'retired', label: '已退役' }, { key: 'sold', label: '已出售' },
]
const hasFilters = computed(() => store.activeFilter !== 'all' || !!store.searchQuery)
const totalPages = computed(() => Math.max(1, Math.ceil(store.filteredAssets.length / pageSize.value)))
const pagedAssets = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return store.filteredAssets.slice(start, start + pageSize.value)
})
const pageStart = computed(() => store.filteredAssets.length ? (currentPage.value - 1) * pageSize.value + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, store.filteredAssets.length))
const pageItems = computed<Array<number | string>>(() => {
  const total = totalPages.value
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  const pages: Array<number | string> = [1]
  const start = Math.max(2, currentPage.value - 1)
  const end = Math.min(total - 1, currentPage.value + 1)
  if (start > 2) pages.push('left-gap')
  for (let page = start; page <= end; page++) pages.push(page)
  if (end < total - 1) pages.push('right-gap')
  pages.push(total)
  return pages
})

function goToPage(page: number) {
  currentPage.value = Math.min(Math.max(1, page), totalPages.value)
}
function clearFilters() { store.activeFilter = 'all'; store.searchQuery = '' }
watch([() => store.activeFilter, () => store.searchQuery, () => store.sortBy, () => store.viewMode, pageSize], () => { currentPage.value = 1 })
watch(totalPages, (total) => { if (currentPage.value > total) currentPage.value = total })
</script>

<template>
  <section class="panel flex h-[calc(100dvh-220px)] min-h-[560px] max-h-[860px] flex-col overflow-hidden">
    <div class="flex shrink-0 flex-col gap-4 border-b border-line px-5 pt-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex w-full items-center gap-2 lg:w-auto">
        <h2 class="mr-2 shrink-0 whitespace-nowrap text-[15px] font-semibold text-[#333d34]">资产清单</h2>
        <div class="flex flex-1 items-center justify-between gap-0 overflow-x-auto sm:justify-start sm:gap-1">
          <button v-for="tab in tabs" :key="tab.key" class="relative flex h-10 shrink-0 items-center gap-1 px-2 text-xs whitespace-nowrap transition-colors sm:gap-1.5 sm:px-2.5" :class="store.activeFilter === tab.key ? 'font-medium text-forest' : 'text-[#8a9287] hover:text-ink'" @click="store.activeFilter = tab.key">
            {{ tab.label }}<span class="text-[10px] tabular" :class="store.activeFilter === tab.key ? 'text-[#6c8974]' : 'text-[#b0b5ac]'">{{ store.counts[tab.key] }}</span>
            <span v-if="store.activeFilter === tab.key" class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-forest" />
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2 pb-4 lg:pb-4">
        <label class="relative min-w-0 flex-1 lg:w-[190px] lg:flex-none">
          <Search :size="14" class="absolute top-2.5 left-3 text-[#9ca398]" />
          <input v-model="store.searchQuery" class="h-8.5 w-full rounded-lg border border-line bg-[#fafbf8] pr-7 pl-8.5 text-[11px] outline-none transition-all placeholder:text-[#a6aca2] focus:border-[#9cab99] focus:bg-white" placeholder="搜索品牌或产品" />
          <button v-if="store.searchQuery" class="absolute top-2 right-2 text-[#9da49a]" aria-label="清空搜索" @click="store.searchQuery = ''"><X :size="13" /></button>
        </label>
        <div class="relative hidden sm:block">
          <SlidersHorizontal :size="12" class="absolute top-2.5 left-2.5 text-[#969e92]" />
          <select v-model="store.sortBy" class="h-8.5 appearance-none rounded-lg border border-line bg-white pr-7 pl-7 text-[10px] text-[#7b8478] outline-none" aria-label="资产排序">
            <option value="purchaseDateDesc">最近购入</option><option value="purchaseDateAsc">最早购入</option><option value="priceDesc">价格最高</option><option value="dailyCostDesc">日成本最高</option>
          </select>
          <ChevronDown :size="11" class="pointer-events-none absolute top-3 right-2 text-[#a0a69c]" />
        </div>
        <div class="flex rounded-lg border border-line p-0.5">
          <button class="flex size-7 items-center justify-center rounded-md" :class="store.viewMode === 'list' ? 'bg-[#edf1e9] text-forest' : 'text-[#a0a69c]'" aria-label="列表视图" @click="store.viewMode = 'list'"><List :size="14" /></button>
          <button class="flex size-7 items-center justify-center rounded-md" :class="store.viewMode === 'grid' ? 'bg-[#edf1e9] text-forest' : 'text-[#a0a69c]'" aria-label="网格视图" @click="store.viewMode = 'grid'"><LayoutGrid :size="13" /></button>
        </div>
      </div>
    </div>

    <div v-if="store.filteredAssets.length && store.viewMode === 'list'" class="flex min-h-0 flex-1 flex-col">
      <div class="hidden h-9 shrink-0 items-center gap-4 border-b border-line bg-[#fbfcf9] px-5 text-[9px] font-medium tracking-wider text-[#a2a89e] md:flex">
        <span class="w-[60px]">图片</span><span class="flex-1">品牌 / 产品</span><span class="hidden w-[112px] lg:block">购入日期</span><span class="hidden w-[108px] sm:block">购入价格</span><span class="hidden w-[90px] xl:block">使用天数</span><span class="w-[104px]">每日成本</span><span class="w-10">状态</span><span class="w-7" />
      </div>
      <div class="min-h-0 flex-1 divide-y divide-line overflow-y-auto" data-testid="asset-scroll-body">
        <AssetCard v-for="asset in pagedAssets" :key="asset.id" :asset="asset" mode="list" @open="ui.openDetails(asset.id)" @edit="ui.openForm(asset.id)" @delete="emit('delete', asset)" />
      </div>
    </div>
    <div v-else-if="store.filteredAssets.length" class="min-h-0 flex-1 overflow-y-auto" data-testid="asset-scroll-body">
      <div class="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <AssetCard v-for="asset in pagedAssets" :key="asset.id" :asset="asset" mode="grid" @open="ui.openDetails(asset.id)" @edit="ui.openForm(asset.id)" @delete="emit('delete', asset)" />
      </div>
    </div>
    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
      <img src="/images/empty-assets.png" alt="等待被记录的珍藏物品" class="mb-1 size-[170px] rounded-full object-cover mix-blend-multiply" />
      <h3 class="text-base font-semibold text-[#465047]">{{ hasFilters ? '没有找到匹配的资产' : '从第一件值得的物品开始' }}</h3>
      <p class="mt-2 max-w-sm text-xs leading-5 text-[#969d92]">{{ hasFilters ? '试试其他关键词或清除当前筛选条件。' : '记录它的价格、日期和故事，让每一份拥有都有迹可循。' }}</p>
      <button class="btn-secondary mt-5" @click="hasFilters ? clearFilters() : ui.openForm()"><Plus v-if="!hasFilters" :size="15" /><X v-else :size="14" />{{ hasFilters ? '清除筛选' : '记录第一件资产' }}</button>
    </div>

    <footer v-if="store.filteredAssets.length" class="flex shrink-0 flex-col gap-3 border-t border-line bg-[#fcfcfa] px-5 py-3 text-[10px] text-[#929a8e] sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div class="flex items-center justify-between gap-3 sm:justify-start">
        <span>第 {{ pageStart }}–{{ pageEnd }} 件，共 {{ store.filteredAssets.length }} 件</span>
        <label class="flex items-center gap-1.5">每页
          <select v-model.number="pageSize" class="h-7 rounded-md border border-line bg-white px-1.5 text-[10px] outline-none" aria-label="每页显示条数">
            <option :value="5">5 条</option><option :value="10">10 条</option><option :value="20">20 条</option><option :value="50">50 条</option>
          </select>
        </label>
      </div>
      <nav class="flex items-center justify-between gap-1 sm:justify-end" aria-label="资产分页">
        <button class="icon-button size-7" :disabled="currentPage === 1" aria-label="上一页" @click="goToPage(currentPage - 1)"><ChevronLeft :size="14" /></button>
        <template v-for="item in pageItems" :key="String(item)">
          <span v-if="typeof item === 'string'" class="px-1 text-[#abb1a7]">…</span>
          <button v-else class="size-7 rounded-md text-[10px] tabular transition-colors" :class="currentPage === item ? 'bg-forest font-medium text-white' : 'text-[#818a7d] hover:bg-[#edf1e9]'" :aria-label="`第 ${item} 页`" :aria-current="currentPage === item ? 'page' : undefined" @click="goToPage(item)">{{ item }}</button>
        </template>
        <button class="icon-button size-7" :disabled="currentPage === totalPages" aria-label="下一页" @click="goToPage(currentPage + 1)"><ChevronRight :size="14" /></button>
      </nav>
    </footer>
  </section>
</template>
