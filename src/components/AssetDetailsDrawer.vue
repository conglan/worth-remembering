<script setup lang="ts">
import { computed, ref } from 'vue'
import { Archive, ArrowUpRight, CalendarDays, Clock3, MapPin, NotebookText, Pencil, ShoppingBag, Trash2, X } from 'lucide-vue-next'
import AssetImage from './AssetImage.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import { formatDate, formatMoney, getAssetStatus, getDailyCost, getUsageDays, statusLabel } from '../lib/asset'

const store = useAssetStore()
const ui = useUiStore()
const confirmDelete = ref(false)
const deleting = ref(false)
const asset = computed(() => store.assets.find((item) => item.id === ui.detailsId))
const status = computed(() => asset.value ? getAssetStatus(asset.value) : 'active')

async function remove() {
  if (!asset.value) return
  deleting.value = true
  try {
    await store.remove(asset.value.id)
    confirmDelete.value = false
    ui.detailsId = null
    ui.toast('资产已删除')
  } catch (error) { ui.toast(error instanceof Error ? error.message : '删除失败', 'error') }
  finally { deleting.value = false }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="asset" class="fixed inset-0 z-[55] bg-[#17261d]/30 backdrop-blur-[2px]" @click="ui.detailsId = null">
        <aside class="drawer-panel ml-auto flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-[#fbfcf9] shadow-2xl" role="dialog" aria-modal="true" :aria-label="asset.name" @click.stop>
          <header class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-5">
            <span class="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur" :class="status === 'active' ? 'text-[#426c4d]' : status === 'retired' ? 'text-[#8a7042]' : 'text-[#6d756c]'">{{ statusLabel(status) }}</span>
            <button class="flex size-9 items-center justify-center rounded-xl bg-white/90 text-[#667064] shadow-sm backdrop-blur transition-colors hover:text-ink" aria-label="关闭详情" @click="ui.detailsId = null"><X :size="19" /></button>
          </header>
          <AssetImage :asset="asset" class="h-[280px] w-full shrink-0 rounded-none" fit="contain" />
          <div class="flex-1 px-6 py-6 sm:px-7">
            <div class="eyebrow">{{ asset.brand }}</div>
            <h2 class="mt-2 text-[25px] font-semibold tracking-[-0.03em] text-[#2c362e]">{{ asset.name }}</h2>
            <div class="mt-2 flex items-center gap-1.5 text-xs text-[#939b8f]"><MapPin :size="13" />{{ asset.purchaseLocation || '未记录购买地点' }}</div>

            <div class="mt-6 grid grid-cols-2 gap-3">
              <div class="rounded-2xl border border-line bg-white p-4"><Clock3 :size="16" class="text-[#879582]" /><div class="tabular mt-3 text-[22px] font-semibold">{{ getUsageDays(asset) }}<span class="ml-1 text-xs font-normal text-[#939b90]">天</span></div><div class="mt-1 text-[10px] text-[#9ca398]">总使用天数</div></div>
              <div class="rounded-2xl border border-line bg-white p-4"><CalendarDays :size="16" class="text-[#879582]" /><div class="tabular mt-3 text-[22px] font-semibold text-forest">{{ formatMoney(getDailyCost(asset), asset.currency, true) }}</div><div class="mt-1 text-[10px] text-[#9ca398]">每日成本费用</div></div>
            </div>

            <section class="mt-6 rounded-2xl border border-line bg-white p-5">
              <h3 class="mb-4 flex items-center gap-2 text-xs font-semibold text-[#536052]"><ShoppingBag :size="14" />购入信息</h3>
              <dl class="space-y-3.5 text-xs">
                <div class="flex justify-between gap-4"><dt class="text-[#969e92]">购入价格</dt><dd class="font-medium tabular">{{ formatMoney(asset.price, asset.currency, true) }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="text-[#969e92]">购入日期</dt><dd class="tabular">{{ formatDate(asset.purchaseDate) }}</dd></div>
                <div v-if="asset.retired" class="flex justify-between gap-4"><dt class="text-[#969e92]">退役日期</dt><dd class="tabular">{{ formatDate(asset.retirementDate) }}</dd></div>
                <div v-if="asset.sold" class="flex justify-between gap-4"><dt class="text-[#969e92]">出售价格</dt><dd class="font-medium tabular">{{ asset.salePrice === null ? '未记录' : formatMoney(asset.salePrice, asset.saleCurrency, true) }}</dd></div>
              </dl>
            </section>

            <section v-if="asset.note || asset.saleNote" class="mt-4 rounded-2xl border border-line bg-white p-5">
              <h3 class="mb-3 flex items-center gap-2 text-xs font-semibold text-[#536052]"><NotebookText :size="14" />物品手记</h3>
              <p v-if="asset.note" class="text-xs leading-6 whitespace-pre-wrap text-[#788275]">{{ asset.note }}</p>
              <div v-if="asset.saleNote" class="mt-3 border-t border-line pt-3"><div class="mb-1 text-[10px] text-[#a0a69d]">出售备注</div><p class="text-xs leading-6 whitespace-pre-wrap text-[#788275]">{{ asset.saleNote }}</p></div>
            </section>

            <div class="mt-5 flex items-center gap-2 rounded-xl bg-[#eef3ea] px-4 py-3 text-[10px] leading-5 text-[#7f8e79]"><Archive :size="15" class="shrink-0" />每日成本 = 购入价格 ÷ 总使用天数，购入当天计为第 1 天。</div>
          </div>
          <footer class="sticky bottom-0 flex gap-3 border-t border-line bg-[#fbfcf9]/95 px-6 py-4 backdrop-blur sm:px-7">
            <button class="btn-secondary text-[#a25449] hover:border-[#e4c9c3] hover:bg-[#fcf4f2]" @click="confirmDelete = true"><Trash2 :size="15" />删除</button>
            <button class="btn-primary flex-1" @click="ui.openForm(asset.id)"><Pencil :size="15" />编辑资产<ArrowUpRight :size="14" class="ml-auto" /></button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
  <ConfirmDialog :open="confirmDelete" title="删除这件资产？" :description="`「${asset?.name || ''}」及其全部记录将被永久删除，此操作无法撤销。`" confirm-text="确认删除" danger :loading="deleting" @cancel="confirmDelete = false" @confirm="remove" />
</template>
