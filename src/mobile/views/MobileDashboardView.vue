<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Plus } from 'lucide-vue-next'
import AssetImage from '../../components/AssetImage.vue'
import { useAssetStore } from '../../stores/assets'
import { useUiStore } from '../../stores/ui'
import { formatMoney, formatNumber, getAssetStatus, getDailyCost, getUsageDays, statusLabel } from '../../lib/asset'

const store = useAssetStore()
const ui = useUiStore()
const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const active = computed(() => store.assets.filter((asset) => getAssetStatus(asset) === 'active'))
const activeCny = computed(() => active.value.filter((asset) => asset.currency === 'CNY'))
const totalValue = computed(() => activeCny.value.reduce((sum, asset) => sum + asset.price, 0))
const currentDaily = computed(() => activeCny.value.reduce((sum, asset) => sum + getDailyCost(asset), 0))
const totalDays = computed(() => store.assets.reduce((sum, asset) => sum + getUsageDays(asset), 0))
const archived = computed(() => store.counts.retired + store.counts.sold)
const recentAssets = computed(() => store.assets.slice(0, 3))
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-5 pb-6">
    <header class="mb-5">
      <div class="eyebrow mb-2">{{ dateLabel }}</div>
      <h1 class="text-[26px] font-semibold tracking-[-0.04em] text-[#273129]">今天也值得记录</h1>
      <p class="mt-1.5 text-xs text-[#8a9287]">把拥有的日常，慢慢收进生活档案。</p>
    </header>

    <section class="overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-[0_12px_30px_rgba(40,77,59,0.16)]">
      <div class="flex items-center justify-between text-[11px] text-white/65">
        <span>正在陪伴你的资产</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1">{{ store.counts.active }} 件使用中</span>
      </div>
      <div class="mt-4 text-[32px] leading-none font-semibold tracking-[-0.04em] tabular">{{ formatMoney(totalValue) }}</div>
      <div class="mt-2 text-[11px] text-white/60">持有资产原值 · 人民币</div>
      <div class="mt-5 flex items-center justify-between border-t border-white/15 pt-4">
        <div>
          <div class="text-[10px] text-white/55">平均每天</div>
          <div class="mt-1 text-lg font-semibold tabular">{{ formatMoney(currentDaily, 'CNY', true) }}<span class="ml-1 text-[10px] font-normal text-white/65">/ 天</span></div>
        </div>
        <button class="flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-forest active:scale-[0.98]" @click="ui.openForm()"><Plus :size="16" />记资产</button>
      </div>
    </section>

    <div class="mt-3 grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-line bg-white p-4">
        <div class="text-[10px] text-[#8b9488]">累计陪伴</div>
        <div class="mt-2 text-xl font-semibold text-[#303a31] tabular">{{ formatNumber(totalDays) }}<span class="ml-1 text-xs font-normal text-[#8b9488]">天</span></div>
        <div class="mt-1 text-[10px] text-[#a2a99e]">归档 {{ archived }} 件</div>
      </div>
      <div class="rounded-2xl border border-line bg-white p-4">
        <div class="text-[10px] text-[#8b9488]">资产总数</div>
        <div class="mt-2 text-xl font-semibold text-[#303a31] tabular">{{ store.counts.all }}<span class="ml-1 text-xs font-normal text-[#8b9488]">件</span></div>
        <div class="mt-1 text-[10px] text-[#a2a99e]">每一件都有自己的故事</div>
      </div>
    </div>

    <section class="mt-7">
      <div class="mb-3 flex items-center justify-between">
        <div><h2 class="text-base font-semibold text-[#303a31]">最近记录</h2><p class="mt-1 text-[10px] text-[#929a90]">你的生活档案正在慢慢丰富</p></div>
        <RouterLink :to="{ name: 'assets' }" class="text-xs font-medium text-forest">查看全部 <ArrowRight :size="13" class="inline" /></RouterLink>
      </div>
      <div v-if="recentAssets.length" class="overflow-hidden rounded-2xl border border-line bg-white">
        <button v-for="asset in recentAssets" :key="asset.id" class="flex w-full items-center gap-3 border-b border-line p-3.5 text-left last:border-0 active:bg-[#f8faf6]" @click="ui.openDetails(asset.id)">
          <AssetImage :asset="asset" class="size-[58px] rounded-xl" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[10px] font-medium text-[#899287]">{{ asset.brand }} · {{ statusLabel(getAssetStatus(asset)) }}</span>
            <span class="mt-1 block truncate text-sm font-semibold text-[#303a31]">{{ asset.name }}</span>
            <span class="mt-1 block text-[10px] text-[#929a90]">已陪伴 {{ getUsageDays(asset) }} 天</span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block text-xs font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), asset.currency, true) }}</span>
            <span class="mt-1 block text-[9px] text-[#a0a79d]">每天</span>
          </span>
        </button>
      </div>
      <div v-else class="rounded-2xl border border-dashed border-[#d9dfd4] bg-white px-5 py-8 text-center">
        <div class="text-sm font-semibold text-[#4c594d]">从第一件值得的物品开始</div>
        <p class="mt-2 text-xs leading-5 text-[#929a90]">记录价格、日期和故事，留住日常里的珍贵。</p>
        <button class="btn-primary mt-4 !h-10" @click="ui.openForm()"><Plus :size="15" />记录第一件资产</button>
      </div>
    </section>
  </div>
</template>