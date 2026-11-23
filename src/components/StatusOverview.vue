<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Clock3 } from 'lucide-vue-next'
import { formatMoney, getAssetStatus, getDailyCost } from '../lib/asset'
import type { Asset } from '../lib/types'

const props = defineProps<{ assets: Asset[] }>()
const circumference = 2 * Math.PI * 45
const counts = computed(() => ({
  active: props.assets.filter((asset) => getAssetStatus(asset) === 'active').length,
  retired: props.assets.filter((asset) => getAssetStatus(asset) === 'retired').length,
  sold: props.assets.filter((asset) => getAssetStatus(asset) === 'sold').length,
}))
const segments = computed(() => {
  const total = Math.max(props.assets.length, 1)
  let offset = 0
  return [
    { key: 'active', label: '使用中', color: '#466f53', count: counts.value.active },
    { key: 'retired', label: '已退役', color: '#c4a56a', count: counts.value.retired },
    { key: 'sold', label: '已出售', color: '#b7bcb4', count: counts.value.sold },
  ].map((item) => {
    const length = (item.count / total) * circumference
    const segment = { ...item, dash: `${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`, offset: -offset }
    offset += length
    return segment
  })
})
const costliest = computed(() => [...props.assets].filter((asset) => getAssetStatus(asset) === 'active' && asset.currency === 'CNY').sort((a, b) => getDailyCost(b) - getDailyCost(a))[0])
</script>

<template>
  <section class="panel p-5 sm:p-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-[#39433a]">资产状态</h2>
      <span class="text-[10px] text-[#9ba197]">共 {{ assets.length }} 件</span>
    </div>
    <div class="mt-5 flex items-center gap-6">
      <div class="relative size-[122px] shrink-0">
        <svg viewBox="0 0 110 110" class="size-full -rotate-90" aria-label="资产状态占比">
          <circle cx="55" cy="55" r="45" fill="none" stroke="#f0f2ed" stroke-width="9" />
          <circle v-for="item in segments" :key="item.key" cx="55" cy="55" r="45" fill="none" :stroke="item.color" stroke-width="9" stroke-linecap="round" :stroke-dasharray="item.dash" :stroke-dashoffset="item.offset" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="tabular text-[26px] font-semibold tracking-tight">{{ counts.active }}</span>
          <span class="mt-0.5 text-[10px] text-[#969d92]">正在陪伴</span>
        </div>
      </div>
      <div class="min-w-0 flex-1 space-y-3.5">
        <div v-for="item in segments" :key="item.key" class="flex items-center text-xs">
          <span class="mr-2 size-2 rounded-full" :style="{ backgroundColor: item.color }" />
          <span class="text-[#7b8378]">{{ item.label }}</span>
          <span class="tabular ml-auto font-medium text-[#424b43]">{{ item.count }}</span>
          <span class="tabular ml-2 w-7 text-right text-[10px] text-[#a0a69c]">{{ assets.length ? Math.round(item.count / assets.length * 100) : 0 }}%</span>
        </div>
      </div>
    </div>
    <div class="mt-6 border-t border-line pt-4">
      <div class="flex items-center gap-2 text-[10px] text-[#989f94]"><Clock3 :size="12" />每日成本最高</div>
      <div v-if="costliest" class="mt-2.5 flex items-center justify-between gap-3">
        <span class="truncate text-xs font-medium text-[#515b51]">{{ costliest.name }}</span>
        <span class="flex shrink-0 items-center gap-1 text-xs font-semibold text-forest tabular">{{ formatMoney(getDailyCost(costliest), 'CNY', true) }}<ArrowUpRight :size="12" /></span>
      </div>
      <div v-else class="mt-2 text-xs text-[#a0a69d]">暂无使用中的资产</div>
    </div>
  </section>
</template>
