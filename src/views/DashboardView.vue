<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Archive, ArrowRight, Box, CalendarClock, CircleDollarSign, Plus } from 'lucide-vue-next'
import StatCard from '../components/StatCard.vue'
import CostChart from '../components/CostChart.vue'
import StatusOverview from '../components/StatusOverview.vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import { formatMoney, formatNumber, getAssetStatus, getDailyCost, getUsageDays } from '../lib/asset'

const store = useAssetStore()
const ui = useUiStore()
const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const active = computed(() => store.assets.filter((asset) => getAssetStatus(asset) === 'active'))
const activeCny = computed(() => active.value.filter((asset) => asset.currency === 'CNY'))
const totalValue = computed(() => activeCny.value.reduce((sum, asset) => sum + asset.price, 0))
const currentDaily = computed(() => activeCny.value.reduce((sum, asset) => sum + getDailyCost(asset), 0))
const totalDays = computed(() => store.assets.reduce((sum, asset) => sum + getUsageDays(asset), 0))
const archived = computed(() => store.counts.retired + store.counts.sold)
</script>

<template>
  <div>
    <div class="mx-auto max-w-[1500px] px-4 pt-7 pb-8 sm:px-6 md:px-8 md:pt-9">
    <header class="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div class="eyebrow mb-2.5">PERSONAL ASSETS · 个人资产</div>
        <h1 class="text-[30px] font-semibold tracking-[-0.04em] text-[#273129]">资产总览</h1>
        <p class="mt-2 text-[13px] text-[#8a9287]">记录拥有，也记录每一天的价值。</p>
      </div>
      <div class="flex items-center gap-4">
        <span class="hidden text-[11px] text-[#9ca398] lg:block">{{ dateLabel }}</span>
        <button class="btn-primary shadow-[0_6px_16px_rgba(40,77,59,0.12)]" @click="ui.openForm()"><Plus :size="17" />记一件资产</button>
      </div>
    </header>

    <div v-if="store.loading && !store.initialized" class="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="index in 4" :key="index" class="h-[139px] rounded-2xl bg-[#e9ece5]" />
    </div>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="持有资产原值" :value="formatMoney(totalValue)" :hint="`${activeCny.length} 件人民币资产 · 不含已退役`" :icon="CircleDollarSign" dark />
        <StatCard label="正在使用" :value="`${store.counts.active} 件`" :hint="active.length ? '每一件，都在认真陪伴' : '记录第一件正在使用的物品'" :icon="Box" />
        <StatCard label="累计陪伴" :value="`${formatNumber(totalDays)} 天`" :hint="`已归档 ${archived} 件物品的使用记录`" :icon="CalendarClock" />
        <StatCard label="当前每日成本" :value="formatMoney(currentDaily, 'CNY', true)" :hint="`每月约 ${formatMoney(currentDaily * 30)} · 按人民币统计`" :icon="Archive" trend="down" />
      </div>

      <div class="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(310px,0.88fr)]">
        <CostChart :assets="store.assets" :height="218" />
        <StatusOverview :assets="store.assets" />
      </div>

      <RouterLink :to="{ name: 'assets' }" class="panel group mt-5 flex items-center justify-between gap-4 p-5 transition-all hover:border-[#cbd5c6] hover:bg-[#fafcf8] sm:px-6">
        <div><h2 class="text-sm font-semibold text-[#465247]">每一件物品，都有自己的档案</h2><p class="mt-1.5 text-[11px] text-[#959d91]">进入资产清单，查看完整的购入信息、使用天数与每日成本。</p></div>
        <span class="flex shrink-0 items-center gap-2 text-xs font-medium text-forest">查看全部资产<ArrowRight :size="15" class="transition-transform group-hover:translate-x-1" /></span>
      </RouterLink>
    </template>
      <footer class="mt-7 flex items-center justify-between text-[9px] tracking-wide text-[#a7ada3]"><span>每一件值得，都有迹可循。</span><span>WORTH REMEMBERING · v1.0.0</span></footer>
    </div>
  </div>
</template>
