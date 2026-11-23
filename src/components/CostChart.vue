<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { CalendarDays, ChevronDown } from 'lucide-vue-next'
import { addDays, buildDailyCosts, formatMoney, todayISO } from '../lib/asset'
import { CURRENCIES, type Asset, type CurrencyCode } from '../lib/types'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(defineProps<{ assets: Asset[]; initialRange?: number; height?: number; title?: string }>(), {
  initialRange: 30,
  height: 240,
  title: '每日持有成本',
})

const range = ref(props.initialRange)
const currency = ref<CurrencyCode>('CNY')
const chartElement = ref<HTMLDivElement>()
let chart: echarts.EChartsType | undefined
let observer: ResizeObserver | undefined

const points = computed(() => buildDailyCosts(props.assets, currency.value, range.value))
const average = computed(() => points.value.reduce((sum, item) => sum + item.value, 0) / Math.max(points.value.length, 1))
const current = computed(() => points.value.at(-1)?.value || 0)
const previousAverage = computed(() => {
  const previous = buildDailyCosts(props.assets, currency.value, range.value, addDays(todayISO(), -range.value))
  return previous.reduce((sum, item) => sum + item.value, 0) / Math.max(previous.length, 1)
})
const change = computed(() => previousAverage.value ? ((average.value - previousAverage.value) / previousAverage.value) * 100 : 0)

function renderChart() {
  if (!chartElement.value) return
  chart ||= echarts.init(chartElement.value)
  chart.setOption({
    animationDuration: 550,
    grid: { left: 12, right: 14, top: 20, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#243b2e',
      borderWidth: 0,
      padding: [10, 13],
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: '#b8c6b6', type: 'dashed' } },
      formatter: (params: Array<{ axisValue: string; value: number; dataIndex: number }>) => {
        const item = params[0]
        const point = points.value[item.dataIndex]
        return `<div style="color:#b9c8bd;font-size:10px;margin-bottom:5px">${point.date}</div><div style="font-weight:600">${formatMoney(item.value, currency.value, true)} <span style="font-size:10px;font-weight:400;color:#b9c8bd">/ 天</span></div>`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.value.map((item) => item.label),
      axisLine: { lineStyle: { color: '#eceee8' } },
      axisTick: { show: false },
      axisLabel: { color: '#9aa196', fontSize: 10, margin: 14, interval: range.value === 7 ? 0 : range.value === 30 ? 5 : 14 },
    },
    yAxis: {
      type: 'value',
      splitNumber: 3,
      axisLabel: { color: '#a2a99e', fontSize: 10, formatter: (value: number) => `¥${Math.round(value)}` },
      splitLine: { lineStyle: { color: '#eef0eb', type: 'dashed' } },
    },
    series: [{
      name: '每日总费用', type: 'line', data: points.value.map((item) => item.value),
      smooth: 0.32, symbol: 'circle', symbolSize: 6, showSymbol: false,
      lineStyle: { width: 2.2, color: '#3f6b50' },
      itemStyle: { color: '#3f6b50', borderColor: '#fff', borderWidth: 2 },
      areaStyle: { color: 'rgba(93, 130, 99, 0.09)' },
      emphasis: { scale: 1.4 },
    }],
  }, true)
}

watch([points, currency], () => nextTick(renderChart), { deep: true })
watch(() => props.assets, () => {
  if (!props.assets.some((asset) => asset.currency === currency.value) && props.assets.length) currency.value = props.assets[0].currency
}, { deep: true })

onMounted(() => {
  renderChart()
  observer = new ResizeObserver(() => chart?.resize())
  if (chartElement.value) observer.observe(chartElement.value)
})
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose() })
</script>

<template>
  <section class="panel min-w-0 p-5 sm:p-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <div class="flex items-center gap-2">
          <CalendarDays :size="16" class="text-[#7c897a]" />
          <h2 class="text-sm font-semibold text-[#39433a]">{{ title }}</h2>
        </div>
        <div class="mt-4 flex items-baseline gap-2">
          <span class="tabular text-[28px] font-semibold tracking-[-0.035em] text-[#29332b]">{{ formatMoney(average, currency, true) }}</span>
          <span class="text-[11px] text-[#969d92]">日均成本</span>
        </div>
        <div class="mt-1.5 text-[10px] text-[#a0a69d]">今日 {{ formatMoney(current, currency, true) }} · 较上一周期 {{ change >= 0 ? '+' : '' }}{{ change.toFixed(1) }}%</div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <select v-model="currency" class="h-8 appearance-none rounded-lg border border-line bg-white pr-7 pl-2.5 text-[11px] text-[#657064] outline-none" aria-label="图表币种">
            <option v-for="item in CURRENCIES" :key="item.code" :value="item.code">{{ item.code }}</option>
          </select>
          <ChevronDown :size="12" class="pointer-events-none absolute top-2.5 right-2 text-[#969e93]" />
        </div>
        <div class="flex rounded-lg bg-[#f2f4ef] p-1">
          <button v-for="days in [7, 30, 90]" :key="days" class="h-6 rounded-md px-2.5 text-[10px] transition-all" :class="range === days ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#92998f] hover:text-ink'" @click="range = days">{{ days }}天</button>
        </div>
      </div>
    </div>
    <div ref="chartElement" class="mt-3 w-full" :style="{ height: `${height}px` }" />
  </section>
</template>
