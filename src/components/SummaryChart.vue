<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { formatMoney } from '../lib/asset'
import { buildHoldingSummary, buildPurchaseSummary, type SummaryGranularity, type SummaryMode, type SummaryPoint } from '../lib/summary'
import type { Asset } from '../lib/types'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(defineProps<{ assets: Asset[]; granularity: SummaryGranularity; mode: SummaryMode; height?: number }>(), {
  height: 320,
})

const chartElement = ref<HTMLDivElement>()
let chart: echarts.EChartsType | undefined
let observer: ResizeObserver | undefined

const points = computed<SummaryPoint[]>(() => {
  if (props.mode === 'purchase') return buildPurchaseSummary(props.assets, props.granularity)
  return buildHoldingSummary(props.assets, props.granularity)
})

const modeLabel = computed(() => (props.mode === 'purchase' ? '购入支出' : '持有成本'))
const unitLabel = computed(() => (props.granularity === 'daily' ? '日' : props.granularity === 'monthly' ? '月' : '年'))

function renderChart() {
  if (!chartElement.value) return
  chart ||= echarts.init(chartElement.value)
  chart.setOption({
    animationDuration: 450,
    grid: { left: 12, right: 14, top: 20, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#243b2e',
      borderWidth: 0,
      padding: [10, 13],
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ axisValue: string; value: number; dataIndex: number }>) => {
        const item = params[0]
        const point = points.value[item.dataIndex]
        return `<div style="color:#b9c8bd;font-size:10px;margin-bottom:5px">${point.label}</div><div style="font-weight:600">${formatMoney(item.value, 'CNY', true)} <span style="font-size:10px;font-weight:400;color:#b9c8bd">/ ${unitLabel.value}</span></div>`
      },
    },
    xAxis: {
      type: 'category',
      data: points.value.map((point) => point.label),
      axisLine: { lineStyle: { color: '#eceee8' } },
      axisTick: { show: false },
      axisLabel: { color: '#9aa196', fontSize: 10, margin: 12, interval: 'auto' },
    },
    yAxis: {
      type: 'value',
      splitNumber: 3,
      axisLabel: { color: '#a2a99e', fontSize: 10, formatter: (value: number) => `¥${Math.round(value)}` },
      splitLine: { lineStyle: { color: '#eef0eb', type: 'dashed' } },
    },
    series: [{
      name: modeLabel.value,
      type: props.mode === 'purchase' ? 'bar' : 'line',
      data: points.value.map((point) => point.value),
      barMaxWidth: 26,
      smooth: 0.32,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: false,
      itemStyle: { color: props.mode === 'purchase' ? '#6c8972' : '#3f6b50', borderRadius: props.mode === 'purchase' ? [4, 4, 0, 0] : 0 },
      lineStyle: { width: 2.2, color: '#3f6b50' },
      areaStyle: props.mode === 'purchase' ? undefined : { color: 'rgba(93, 130, 99, 0.09)' },
    }],
  }, true)
}

watch([points, () => props.mode, () => props.granularity], () => nextTick(renderChart), { deep: true })

onMounted(() => {
  renderChart()
  observer = new ResizeObserver(() => chart?.resize())
  if (chartElement.value) observer.observe(chartElement.value)
})
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose() })
</script>

<template>
  <div ref="chartElement" class="w-full" :style="{ height: `${height}px` }" />
</template>