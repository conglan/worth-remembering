<script setup lang="ts">
import { computed, ref } from 'vue'
import { BarChart3, CalendarDays, CalendarRange, CircleHelp, Coins, Crown, Lightbulb, Plus, TrendingDown, TrendingUp, WalletCards } from 'lucide-vue-next'
import CostChart from '../components/CostChart.vue'
import SummaryChart from '../components/SummaryChart.vue'
import StatCard from '../components/StatCard.vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import { formatMoney, getAssetStatus, getDailyCost, getUsageDays } from '../lib/asset'
import { buildHoldingSummary, buildPurchaseSummary, summarize, type SummaryGranularity, type SummaryMode } from '../lib/summary'

const store = useAssetStore()
const ui = useUiStore()

const tab = ref<'insights' | 'summary'>('insights')

// ---- 成本洞察 ----
const activeCny = computed(() => store.assets.filter((asset) => getAssetStatus(asset) === 'active' && asset.currency === 'CNY'))
const daily = computed(() => activeCny.value.reduce((sum, asset) => sum + getDailyCost(asset), 0))
const ranked = computed(() => [...activeCny.value].sort((a, b) => getDailyCost(b) - getDailyCost(a)).slice(0, 5))
const maxCost = computed(() => ranked.value[0] ? getDailyCost(ranked.value[0]) : 1)
const longest = computed(() => [...store.assets].sort((a, b) => getUsageDays(b) - getUsageDays(a))[0])

// ---- 费用汇总 ----
const granularity = ref<SummaryGranularity>('monthly')
const mode = ref<SummaryMode>('purchase')
const points = computed(() => {
  if (mode.value === 'purchase') return buildPurchaseSummary(store.assets, granularity.value)
  return buildHoldingSummary(store.assets, granularity.value)
})
const stats = computed(() => summarize(points.value))
const unitLabel = computed(() => (granularity.value === 'daily' ? '日' : granularity.value === 'monthly' ? '月' : '年'))
</script>

<template>
  <div class="mx-auto flex h-[calc(100dvh-4rem)] max-w-[1500px] flex-col overflow-hidden px-4 pt-7 sm:px-6 md:h-screen md:px-8 md:pt-9">
    <header class="mb-6 flex shrink-0 flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div class="eyebrow mb-2.5">COST INSIGHTS · 成本洞察</div>
        <h1 class="text-[30px] font-semibold tracking-[-0.04em]">每一天，价值几何</h1>
        <p class="mt-2 text-[13px] text-[#8a9287]">把价格摊开在日常里，看见物品真正的使用成本。</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex rounded-xl bg-[#e9ede5] p-1">
          <button
            class="h-9 rounded-lg px-4 text-xs font-medium transition-all"
            :class="tab === 'insights' ? 'bg-white text-forest shadow-sm' : 'text-[#828b7e] hover:text-ink'"
            @click="tab = 'insights'"
          >成本洞察</button>
          <button
            class="h-9 rounded-lg px-4 text-xs font-medium transition-all"
            :class="tab === 'summary' ? 'bg-white text-forest shadow-sm' : 'text-[#828b7e] hover:text-ink'"
            @click="tab = 'summary'"
          >费用汇总</button>
        </div>
        <button class="btn-primary" @click="ui.openForm()"><Plus :size="17" />记一件资产</button>
      </div>
    </header>

    <!-- 成本洞察 Tab -->
    <template v-if="tab === 'insights'">
      <div class="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="insights-fixed-summary">
        <StatCard label="当前每日总成本" :value="formatMoney(daily, 'CNY', true)" hint="所有使用中的人民币资产" :icon="Coins" dark />
        <StatCard label="预计每月成本" :value="formatMoney(daily * 30, 'CNY', true)" hint="按当前每日成本 × 30 天" :icon="CalendarRange" />
        <StatCard label="预计每年成本" :value="formatMoney(daily * 365)" hint="静态估算，实际会随时间降低" :icon="WalletCards" />
        <StatCard label="陪伴最久" :value="longest ? `${getUsageDays(longest)} 天` : '0 天'" :hint="longest?.name || '还没有资产记录'" :icon="Crown" />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8" data-testid="insights-scroll-body">
        <div class="mt-5"><CostChart :assets="store.assets" :initial-range="90" :height="330" title="逐日总费用趋势" /></div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
          <section class="panel p-6">
            <div class="flex items-center justify-between"><div><h2 class="text-sm font-semibold">每日成本排行</h2><p class="mt-1 text-[10px] text-[#9aa195]">使用中的资产 · 人民币</p></div><TrendingDown :size="18" class="text-[#8c9988]" /></div>
            <div v-if="ranked.length" class="mt-6 space-y-5">
              <div v-for="(asset, index) in ranked" :key="asset.id">
                <div class="mb-2 flex items-center gap-3 text-xs"><span class="w-4 text-[10px] text-[#a4aba0] tabular">0{{ index + 1 }}</span><span class="min-w-0 flex-1 truncate font-medium text-[#566056]">{{ asset.name }}</span><span class="text-[10px] text-[#a0a79d] tabular">{{ getUsageDays(asset) }} 天</span><span class="w-20 text-right font-semibold text-forest tabular">{{ formatMoney(getDailyCost(asset), 'CNY', true) }}</span></div>
                <div class="ml-7 h-1.5 overflow-hidden rounded-full bg-[#edf0e9]"><div class="h-full rounded-full bg-[#6c8972] transition-all duration-700" :style="{ width: `${Math.max(4, getDailyCost(asset) / maxCost * 100)}%`, opacity: 1 - index * 0.12 }" /></div>
              </div>
            </div>
            <div v-else class="py-12 text-center text-xs text-[#9da59a]">暂无使用中的资产</div>
          </section>
          <section class="panel bg-[#eef2e9] p-6">
            <span class="flex size-9 items-center justify-center rounded-xl bg-white text-forest shadow-sm"><Lightbulb :size="18" /></span>
            <h2 class="mt-5 text-base font-semibold">如何理解每日成本？</h2>
            <p class="mt-3 text-xs leading-6 text-[#758171]">每日成本将购入价格平均到每一个使用日。使用越久，摊到每天的成本越低；退役后，使用天数和成本便定格下来。</p>
            <div class="mt-5 rounded-xl border border-[#dce4d6] bg-white/65 p-4"><div class="flex items-center gap-2 text-[11px] font-medium text-[#53654f]"><CircleHelp :size="14" />计算口径</div><div class="mt-3 text-[11px] leading-6 text-[#84907f]">每日成本 = 购入价格 ÷ 总使用天数<br />购入日与退役日均计入使用天数<br />不同币种独立统计，不做汇率换算</div></div>
          </section>
        </div>
      </div>
    </template>

    <!-- 费用汇总 Tab -->
    <template v-else>
      <div class="grid shrink-0 gap-4 sm:grid-cols-3">
        <StatCard label="累计总费用" :value="formatMoney(stats.total, 'CNY', true)" hint="当前口径下的合计" :icon="Coins" dark />
        <StatCard :label="`平均每${unitLabel}`" :value="formatMoney(stats.average, 'CNY', true)" hint="按当前粒度平均" :icon="CalendarDays" />
        <StatCard label="峰值" :value="formatMoney(stats.peak, 'CNY', true)" :hint="`单${unitLabel}最高`" :icon="TrendingUp" />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
        <section class="panel mt-5 p-5 sm:p-6">
          <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div class="flex items-center gap-2"><BarChart3 :size="16" class="text-[#7c897a]" /><h2 class="text-sm font-semibold text-[#39433a]">费用汇总趋势</h2></div>
              <p class="mt-2 text-[11px] text-[#969d92]">{{ mode === 'purchase' ? '按购入日期统计实际支出' : '把价格摊到使用期内的每一天' }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <div class="flex rounded-lg bg-[#f2f4ef] p-1">
                <button v-for="item in (['purchase', 'holding'] as SummaryMode[])" :key="item" class="h-7 rounded-md px-3 text-[11px] transition-all" :class="mode === item ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#92998f] hover:text-ink'" @click="mode = item">{{ item === 'purchase' ? '购入支出' : '持有成本' }}</button>
              </div>
              <div class="flex rounded-lg bg-[#f2f4ef] p-1">
                <button v-for="item in (['daily', 'monthly', 'yearly'] as SummaryGranularity[])" :key="item" class="h-7 rounded-md px-3 text-[11px] transition-all" :class="granularity === item ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#92998f] hover:text-ink'" @click="granularity = item">{{ item === 'daily' ? '日' : item === 'monthly' ? '月' : '年' }}</button>
              </div>
            </div>
          </div>
          <SummaryChart :assets="store.assets" :granularity="granularity" :mode="mode" :height="340" />
        </section>
      </div>
    </template>
  </div>
</template>