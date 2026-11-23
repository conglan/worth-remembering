<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, MapPin, MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next'
import AssetImage from './AssetImage.vue'
import { formatDate, formatMoney, getAssetStatus, getDailyCost, getUsageDays, statusLabel } from '../lib/asset'
import type { Asset } from '../lib/types'

const props = defineProps<{ asset: Asset; mode: 'list' | 'grid' }>()
const emit = defineEmits<{ open: [asset: Asset]; edit: [asset: Asset]; delete: [asset: Asset] }>()
const menuOpen = ref(false)
const status = computed(() => getAssetStatus(props.asset))
const statusClass = computed(() => ({
  active: 'bg-[#e9f1e7] text-[#426c4d]',
  retired: 'bg-[#f3eee2] text-[#8a7042]',
  sold: 'bg-[#eeeeeb] text-[#777d75]',
}[status.value]))
</script>

<template>
  <article v-if="mode === 'list'" class="group relative flex min-h-[88px] cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#fafbf8] sm:gap-4 sm:px-5" tabindex="0" @click="emit('open', asset)" @keydown.enter="emit('open', asset)">
    <AssetImage :asset="asset" class="size-[72px]" fit="contain" />
    <div class="min-w-0 flex-1">
      <div class="mb-1 flex items-center gap-2">
        <span class="truncate text-[9px] font-semibold tracking-[0.13em] text-[#92998e]">{{ asset.brand }}</span>
        <span class="hidden rounded-md px-2 py-0.5 text-[10px] font-medium" :class="statusClass">{{ statusLabel(status) }}</span>
      </div>
      <h3 class="truncate text-[14px] font-medium text-[#303831]">{{ asset.name }}</h3>
      <div class="mt-1.5 hidden items-center gap-1 text-[10px] text-[#9ba198] min-[420px]:flex"><MapPin :size="11" />{{ asset.purchaseLocation || '未记录购买地点' }}</div>
    </div>
    <div class="hidden w-[112px] shrink-0 lg:block">
      <div class="text-xs text-[#626b62] tabular">{{ formatDate(asset.purchaseDate) }}</div>
      <div class="mt-1.5 text-[10px] text-[#a0a69d]">购入日期</div>
    </div>
    <div class="hidden w-[108px] shrink-0 sm:block">
      <div class="text-[13px] font-medium text-[#3d463e] tabular">{{ formatMoney(asset.price, asset.currency) }}</div>
      <div class="mt-1.5 text-[10px] text-[#a0a69d]">购入价格</div>
    </div>
    <div class="hidden w-[90px] shrink-0 xl:block">
      <div class="text-[13px] text-[#4d564e] tabular">{{ getUsageDays(asset) }} <span class="text-[10px] text-[#9aa096]">天</span></div>
      <div class="mt-1.5 text-[10px] text-[#a0a69d]">总使用天数</div>
    </div>
    <div class="w-[86px] shrink-0 text-right sm:w-[104px] sm:text-left">
      <div class="text-[13px] font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), asset.currency, true) }}</div>
      <div class="mt-1.5 text-[10px] text-[#a0a69d]">每日成本</div>
    </div>
    <span class="hidden rounded-md px-2 py-1 text-[10px] font-medium md:inline-block" :class="statusClass">{{ statusLabel(status) }}</span>
    <button class="icon-button -mr-2 ml-0 hidden sm:inline-flex" aria-label="更多操作" @click.stop="menuOpen = !menuOpen"><MoreHorizontal :size="18" /></button>
    <button v-if="menuOpen" class="fixed inset-0 z-10 cursor-default" aria-label="关闭菜单" @click.stop="menuOpen = false" />
    <div v-if="menuOpen" class="absolute top-12 right-4 z-20 w-32 rounded-xl border border-line bg-white p-1.5 shadow-xl">
      <button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[#f3f5f0]" @click.stop="emit('edit', asset); menuOpen = false"><Pencil :size="14" />编辑资产</button>
      <button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a55449] hover:bg-[#fbf1ef]" @click.stop="emit('delete', asset); menuOpen = false"><Trash2 :size="14" />删除资产</button>
    </div>
  </article>

  <article v-else class="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg" tabindex="0" @click="emit('open', asset)" @keydown.enter="emit('open', asset)">
    <AssetImage :asset="asset" class="aspect-[1.45] w-full rounded-none" fit="contain" />
    <span class="absolute top-3 right-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-medium shadow-sm backdrop-blur" :class="statusClass">{{ statusLabel(status) }}</span>
    <div class="p-4">
      <div class="text-[9px] font-semibold tracking-[0.13em] text-[#92998e]">{{ asset.brand }}</div>
      <div class="mt-1.5 flex items-center justify-between gap-2">
        <h3 class="truncate text-sm font-medium">{{ asset.name }}</h3>
        <ChevronRight :size="15" class="shrink-0 text-[#a0a79d]" />
      </div>
      <div class="mt-4 flex items-end justify-between border-t border-line pt-3">
        <div><div class="text-[10px] text-[#9ba198]">购入价格</div><div class="mt-1 text-sm font-medium tabular">{{ formatMoney(asset.price, asset.currency) }}</div></div>
        <div class="text-right"><div class="text-[10px] text-[#9ba198]">每日成本</div><div class="mt-1 text-sm font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), asset.currency, true) }}</div></div>
      </div>
    </div>
  </article>
</template>
