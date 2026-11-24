<script setup lang="ts">
import { computed, ref } from 'vue'
import CostChart from '../../components/CostChart.vue'
import SummaryChart from '../../components/SummaryChart.vue'
import { useAssetStore } from '../../stores/assets'
import { formatMoney, getAssetStatus, getDailyCost, getUsageDays } from '../../lib/asset'
import { buildHoldingSummary, buildPurchaseSummary, summarize, type SummaryGranularity, type SummaryMode } from '../../lib/summary'

const store = useAssetStore()
const tab = ref<'insights' | 'summary'>('insights')

const activeCny = computed(() => store.assets.filter((asset) => getAssetStatus(asset) === 'active' && asset.currency === 'CNY'))
const daily = computed(() => activeCny.value.reduce((sum, asset) => sum + getDailyCost(asset), 0))
const ranked = computed(() => [...activeCny.value].sort((a, b) => getDailyCost(b) - getDailyCost(a)).slice(0, 5))
const maxCost = computed(() => ranked.value[0] ? getDailyCost(ranked.value[0]) : 1)
const longest = computed(() => [...store.assets].sort((a, b) => getUsageDays(b) - getUsageDays(a))[0])

const granularity = ref<SummaryGranularity>('monthly')
const mode = ref<SummaryMode>('purchase')
const points = computed(() => mode.value === 'purchase' ? buildPurchaseSummary(store.assets, granularity.value) : buildHoldingSummary(store.assets, granularity.value))
const stats = computed(() => summarize(points.value))
const unitLabel = computed(() => granularity.value === 'daily' ? '日' : granularity.value === 'monthly' ? '月' : '年')
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-5 pb-6">
    <header class="mb-5">
      <div class="eyebrow mb-2">COST INSIGHTS</div>
      <h1 class="text-[26px] font-semibold tracking-[-0.04em] text-[#273129]">成本洞察</h1>
      <p class="mt-1.5 text-xs text-[#8a9287]">看见每件物品在日常里的真实成本。</p>
    </header>

    <div class="mb-4 grid grid-cols-2 rounded-2xl bg-[#e9ede5] p-1">
      <button class="h-10 rounded-xl text-xs font-medium transition-colors" :class="tab === 'insights' ? 'bg-white text-forest shadow-sm' : 'text-[#828b7e]'" @click="tab = 'insights'">每日成本</button>
      <button class="h-10 rounded-xl text-xs font-medium transition-colors" :class="tab === 'summary' ? 'bg-white text-forest shadow-sm' : 'text-[#828b7e]'" @click="tab = 'summary'">费用汇总</button>
    </div>

    <template v-if="tab === 'insights'">
      <section class="rounded-[24px] bg-forest p-5 text-white shadow-[0_12px_30px_rgba(40,77,59,0.14)]">
        <div class="text-[11px] text-white/65">当前每日总成本</div>
        <div class="mt-2 text-[30px] font-semibold tracking-[-0.04em] tabular">{{ formatMoney(daily, 'CNY', true) }}</div>
        <div class="mt-1 text-[10px] text-white/60">所有使用中的人民币资产</div>
        <div class="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
          <div><div class="text-[10px] text-white/55">预计每月</div><div class="mt-1 text-sm font-semibold tabular">{{ formatMoney(daily * 30, 'CNY', true) }}</div></div>
          <div><div class="text-[10px] text-white/55">预计每年</div><div class="mt-1 text-sm font-semibold tabular">{{ formatMoney(daily * 365) }}</div></div>
        </div>
      </section>

      <div class="mt-3 rounded-2xl border border-line bg-white p-4">
        <div class="text-[10px] text-[#8b9488]">陪伴最久</div>
        <div class="mt-1.5 truncate text-sm font-semibold text-[#374138]">{{ longest?.name || '还没有资产记录' }}</div>
        <div class="mt-1 text-xs text-forest">{{ longest ? `${getUsageDays(longest)} 天` : '记录一件资产，开始计算' }}</div>
      </div>

      <div class="mt-3"><CostChart :assets="store.assets" :initial-range="30" :height="190" title="每日成本趋势" /></div>

      <section class="panel mt-3 p-4">
        <div class="mb-4"><h2 class="text-sm font-semibold">每日成本排行</h2><p class="mt-1 text-[10px] text-[#9aa195]">使用中的人民币资产</p></div>
        <div v-if="ranked.length" class="space-y-4">
          <div v-for="(asset, index) in ranked" :key="asset.id">
            <div class="mb-2 flex items-center gap-2 text-xs">
              <span class="w-5 text-[10px] text-[#a4aba0]">0{{ index + 1 }}</span>
              <span class="min-w-0 flex-1 truncate font-medium text-[#566056]">{{ asset.name }}</span>
              <span class="font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), 'CNY', true) }}</span>
            </div>
            <div class="ml-7 h-1.5 overflow-hidden rounded-full bg-[#edf0e9]"><div class="h-full rounded-full bg-[#6c8972]" :style="{ width: `${Math.max(4, getDailyCost(asset) / maxCost * 100)}%`, opacity: 1 - index * 0.12 }" /></div>
          </div>
        </div>
        <div v-else class="py-6 text-center text-xs text-[#9da59a]">暂无使用中的资产</div>
      </section>

      <p class="mt-3 rounded-2xl bg-[#eef2e9] px-4 py-3 text-[10px] leading-5 text-[#758171]">每日成本 = 购入价格 ÷ 总使用天数。不同币种分别统计，不进行汇率换算。</p>
    </template>

    <template v-else>
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-2xl border border-line bg-white p-3"><div class="text-[9px] text-[#929a90]">累计总费用</div><div class="mt-2 truncate text-sm font-semibold tabular">{{ formatMoney(stats.total, 'CNY', true) }}</div></div>
        <div class="rounded-2xl border border-line bg-white p-3"><div class="text-[9px] text-[#929a90]">平均每{{ unitLabel }}</div><div class="mt-2 truncate text-sm font-semibold tabular">{{ formatMoney(stats.average, 'CNY', true) }}</div></div>
        <div class="rounded-2xl border border-line bg-white p-3"><div class="text-[9px] text-[#929a90]">峰值</div><div class="mt-2 truncate text-sm font-semibold tabular">{{ formatMoney(stats.peak, 'CNY', true) }}</div></div>
      </div>

      <section class="panel mt-3 p-4">
        <h2 class="text-sm font-semibold text-[#39433a]">费用汇总趋势</h2>
        <p class="mt-1 text-[10px] text-[#969d92]">{{ mode === 'purchase' ? '按购入日期统计实际支出' : '把价格摊到使用期内的每一天' }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <div class="flex rounded-lg bg-[#f2f4ef] p-1">
            <button v-for="item in (['purchase', 'holding'] as SummaryMode[])" :key="item" class="h-8 rounded-md px-2.5 text-[10px]" :class="mode === item ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#92998f]'" @click="mode = item">{{ item === 'purchase' ? '购入支出' : '持有成本' }}</button>
          </div>
          <div class="flex rounded-lg bg-[#f2f4ef] p-1">
            <button v-for="item in (['daily', 'monthly', 'yearly'] as SummaryGranularity[])" :key="item" class="h-8 rounded-md px-3 text-[10px]" :class="granularity === item ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#92998f]'" @click="granularity = item">{{ item === 'daily' ? '日' : item === 'monthly' ? '月' : '年' }}</button>
          </div>
        </div>
        <SummaryChart :assets="store.assets" :granularity="granularity" :mode="mode" :height="220" />
      </section>
    </template>
      </div>
    </template>