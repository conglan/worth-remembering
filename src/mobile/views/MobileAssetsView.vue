<script setup lang="ts">
import { ref } from 'vue'
import { Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import AssetImage from '../../components/AssetImage.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { useAssetStore } from '../../stores/assets'
import { useUiStore } from '../../stores/ui'
import type { Asset } from '../../lib/types'
import { formatMoney, getAssetStatus, getDailyCost, getUsageDays, statusLabel } from '../../lib/asset'

const store = useAssetStore()
const ui = useUiStore()
const deleteTarget = ref<Asset | null>(null)
const deleting = ref(false)
const filters = [
  { key: 'all', label: '全部', count: () => store.counts.all },
  { key: 'active', label: '使用中', count: () => store.counts.active },
  { key: 'retired', label: '已退役', count: () => store.counts.retired },
  { key: 'sold', label: '已出售', count: () => store.counts.sold },
] as const

function clearFilters() {
  store.searchQuery = ''
  store.activeFilter = 'all'
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await store.remove(deleteTarget.value.id)
    ui.toast(`已删除「${deleteTarget.value.name}」`)
    deleteTarget.value = null
  } catch (error) { ui.toast(error instanceof Error ? error.message : '删除失败', 'error') }
  finally { deleting.value = false }
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-5 pb-6">
    <header class="mb-5 flex items-start justify-between gap-3">
      <div>
        <div class="eyebrow mb-2">ASSET COLLECTION</div>
        <h1 class="text-[26px] font-semibold tracking-[-0.04em] text-[#273129]">我的资产</h1>
        <p class="mt-1.5 text-xs text-[#8a9287]">共 {{ store.counts.all }} 件，记录每份拥有。</p>
      </div>
      <button class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-white shadow-sm active:scale-95" aria-label="记一件资产" @click="ui.openForm()"><Plus :size="21" /></button>
    </header>

    <label class="relative block">
      <Search :size="17" class="absolute top-3.5 left-3.5 text-[#99a195]" />
      <input v-model="store.searchQuery" class="h-12 w-full rounded-2xl border border-line bg-white pr-4 pl-10 text-sm outline-none placeholder:text-[#a2a99e] focus:border-[#9cab99]" placeholder="搜索品牌或产品" />
    </label>

    <div class="mt-4 flex gap-2" role="group" aria-label="按状态筛选资产">
      <button v-for="filter in filters" :key="filter.key" class="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 whitespace-nowrap transition-colors" :class="store.activeFilter === filter.key ? 'border border-transparent bg-forest text-white' : 'border border-line bg-white text-[#737d72]'" :aria-pressed="store.activeFilter === filter.key" @click="store.activeFilter = filter.key">
        <span class="text-xs font-medium">{{ filter.label }}</span>
        <span class="text-[10px] tabular" :class="store.activeFilter === filter.key ? 'text-white/70' : 'text-[#9aa195]'">{{ filter.count() }}</span>
      </button>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <span class="text-[11px] text-[#8f988d]">找到 {{ store.filteredAssets.length }} 件资产</span>
      <select v-model="store.sortBy" class="h-9 rounded-xl border border-line bg-white px-3 text-xs text-[#687265] outline-none" aria-label="资产排序">
        <option value="purchaseDateDesc">最近购入</option>
        <option value="purchaseDateAsc">最早购入</option>
        <option value="priceDesc">价格最高</option>
        <option value="dailyCostDesc">日成本最高</option>
      </select>
    </div>

    <div v-if="store.filteredAssets.length" class="mt-3 space-y-3">
      <article v-for="asset in store.filteredAssets" :key="asset.id" class="rounded-2xl border border-line bg-white p-3.5 shadow-[0_2px_8px_rgba(24,42,30,0.025)]" @click="ui.openDetails(asset.id)">
        <div class="flex items-center gap-3">
          <AssetImage :asset="asset" class="size-[70px] rounded-xl" />
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-1.5">
              <span class="truncate text-[10px] font-medium text-[#92998e]">{{ asset.brand }}</span>
              <span class="shrink-0 rounded-full bg-[#edf2e9] px-2 py-0.5 text-[9px] text-[#55705a]">{{ statusLabel(getAssetStatus(asset)) }}</span>
            </div>
            <h2 class="truncate text-sm font-semibold text-[#303a31]">{{ asset.name }}</h2>
            <p class="mt-1.5 text-[10px] text-[#929a90]">购入 {{ formatMoney(asset.price, asset.currency) }} · {{ getUsageDays(asset) }} 天</p>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), asset.currency, true) }}</div>
            <div class="mt-1 text-[9px] text-[#9ba398]">每日成本</div>
          </div>
        </div>
        <div class="mt-3 flex justify-end gap-2 border-t border-[#f0f1ed] pt-2.5">
          <button class="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[#687265] active:bg-[#f1f3ee]" @click.stop="ui.openForm(asset.id)"><Pencil :size="14" />编辑</button>
          <button class="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[#a65b50] active:bg-[#fbf1ef]" @click.stop="deleteTarget = asset"><Trash2 :size="14" />删除</button>
        </div>
      </article>
    </div>
    <div v-else class="mt-4 rounded-2xl border border-dashed border-[#d9dfd4] bg-white px-5 py-10 text-center">
      <h2 class="text-sm font-semibold text-[#465047]">{{ store.searchQuery || store.activeFilter !== 'all' ? '没有找到匹配的资产' : '从第一件值得的物品开始' }}</h2>
      <p class="mt-2 text-xs leading-5 text-[#969d92]">{{ store.searchQuery || store.activeFilter !== 'all' ? '换个关键词或筛选条件试试。' : '记录一件物品，开始建立自己的生活档案。' }}</p>
      <button class="btn-primary mt-4 !h-10" @click="store.searchQuery || store.activeFilter !== 'all' ? clearFilters() : ui.openForm()">
        {{ store.searchQuery || store.activeFilter !== 'all' ? '清除筛选' : '记录第一件资产' }}
      </button>
    </div>

    <ConfirmDialog :open="!!deleteTarget" title="删除这件资产？" :description="`「${deleteTarget?.name || ''}」及其全部记录将被永久删除，此操作无法撤销。`" confirm-text="确认删除" danger :loading="deleting" @cancel="deleteTarget = null" @confirm="confirmDelete" />
  </div>
</template>