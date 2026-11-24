<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Camera, Check, ChevronsUpDown, LoaderCircle, X } from 'lucide-vue-next'
import AssetImage from '../components/AssetImage.vue'
import { useAssetDraftForm } from '../composables/useAssetDraftForm'
import { useUiStore } from '../stores/ui'
import { formatMoney, todayISO } from '../lib/asset'
import { CURRENCIES } from '../lib/types'

const ui = useUiStore()
const { draft, editing, preview, errors, imageError, saving, fileInput, usageDays, dailyCost, canSave, handleFile, validate, submit, close } = useAssetDraftForm()

// 价格用文本代理，避免未填写时显示出 0
const priceText = ref('')
const scroller = ref<HTMLElement | null>(null)
const stuck = ref(false)

watch([() => draft.price, () => ui.formOpen], () => {
  if (Number(priceText.value || 0) === draft.price) return
  priceText.value = draft.price > 0 ? String(draft.price) : ''
}, { immediate: true })

function updatePrice(event: Event) {
  priceText.value = (event.target as HTMLInputElement).value
  const parsed = Number(priceText.value)
  draft.price = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const currencySymbol = computed(() => CURRENCIES.find((item) => item.code === draft.currency)?.symbol || '')

function onScroll() {
  stuck.value = (scroller.value?.scrollTop || 0) > 36
}

async function save() {
  if (!validate()) {
    scroller.value?.scrollTo({ top: 0, behavior: 'smooth' })
    ui.toast('请补全品牌、名称、价格与日期', 'error')
    return
  }
  await submit()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="ui.formOpen" class="fixed inset-0 z-[60] bg-[#14231a]/40" @click.self="close">
        <section class="sheet-panel" role="dialog" aria-modal="true" :aria-label="editing ? '编辑资产' : '添加资产'">
          <header class="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 bg-[#f1f3ee]/90 px-4 backdrop-blur-md">
            <button type="button" class="flex size-9 items-center justify-center rounded-full bg-white text-[#3d4840] shadow-sm transition active:scale-95" aria-label="关闭表单" @click="close"><X :size="18" :stroke-width="2.5" /></button>
            <h2 class="text-[15px] font-semibold text-[#26312a] transition-opacity duration-200" :class="stuck ? 'opacity-100' : 'opacity-0'">{{ editing ? '编辑资产' : '添加资产' }}</h2>
            <button type="button" class="flex size-9 items-center justify-center rounded-full shadow-sm transition active:scale-95 disabled:opacity-60" :class="canSave ? 'bg-forest text-white' : 'bg-[#dde1d7] text-white'" :disabled="saving" aria-label="保存资产" @click="save">
              <LoaderCircle v-if="saving" :size="17" class="animate-spin" /><Check v-else :size="19" :stroke-width="3" />
            </button>
          </header>

          <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+var(--safe-bottom))]" @scroll.passive="onScroll">
            <h1 class="mt-2.5 text-[30px] leading-[1.2] font-semibold tracking-[-0.03em] text-[#1e2a22]">{{ editing ? '编辑资产' : '添加资产' }}</h1>
            <p class="mt-1.5 text-[12px] text-[#8d958a]">记录它的价格与陪伴，也记录每一天的价值。</p>

            <h2 class="sheet-section">产品信息</h2>
            <div class="sheet-card divide-y divide-[#eff1ec]">
              <label class="sheet-row">
                <input v-model="draft.brand" class="sheet-input" placeholder="品牌" maxlength="60" autocomplete="off" />
                <span v-if="!draft.brand" class="shrink-0 text-[11px] text-[#a6ada2]">必填</span>
              </label>
              <label class="sheet-row"><input v-model="draft.name" class="sheet-input" placeholder="产品名称" maxlength="100" /></label>
            </div>
            <p v-if="errors.brand || errors.name" class="sheet-error">{{ errors.brand || errors.name }}</p>

            <h2 class="sheet-section">照片</h2>
            <div class="sheet-card relative">
              <button type="button" class="flex h-[172px] w-full items-center justify-center" aria-label="选择产品照片" @click="fileInput?.click()">
                <AssetImage v-if="draft.image" :asset="preview" class="h-full w-full" rounded="rounded-none" fit="contain" />
                <span v-else class="flex size-16 items-center justify-center rounded-[20px] bg-[#eaf1e9] text-[#5d7f68]"><Camera :size="28" :stroke-width="1.8" /></span>
              </button>
              <button v-if="draft.image" type="button" class="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-[#a25449] shadow-sm" aria-label="移除图片" @click="draft.image = null"><X :size="15" /></button>
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="handleFile(($event.target as HTMLInputElement).files?.[0])" />
            </div>
            <p class="sheet-caption" :class="imageError ? 'text-[#b0564b]' : ''">{{ imageError || '建议选择主体清晰的照片，它会成为这件物品的封面。' }}</p>

            <h2 class="sheet-section">购买信息</h2>
            <div class="sheet-card divide-y divide-[#eff1ec]">
              <label class="sheet-row">
                <input :value="priceText" type="number" inputmode="decimal" min="0" step="0.01" class="sheet-input" placeholder="价格" @input="updatePrice" />
                <span class="shrink-0 text-[13px] text-[#9ca498]">{{ currencySymbol }}</span>
              </label>
              <label class="sheet-row justify-between">
                <span class="sheet-label">币种</span>
                <span class="relative flex items-center">
                  <select v-model="draft.currency" class="appearance-none bg-transparent pr-6 text-right text-[14px] text-[#5f6a60] outline-none" aria-label="币种">
                    <option v-for="item in CURRENCIES" :key="item.code" :value="item.code">{{ item.label }} {{ item.symbol }}</option>
                  </select>
                  <ChevronsUpDown :size="13" class="pointer-events-none absolute right-0 text-[#a3ab9f]" />
                </span>
              </label>
              <label class="sheet-row justify-between">
                <span class="sheet-label">购入日期</span>
                <input v-model="draft.purchaseDate" type="date" :max="todayISO()" class="pill-date-input" aria-label="购入日期" />
              </label>
            </div>
            <p v-if="errors.price || errors.purchaseDate" class="sheet-error">{{ errors.price || errors.purchaseDate }}</p>
            <p class="sheet-caption">每日成本 = 购入价格 ÷ 已使用天数，购入当天计为第 1 天。</p>

            <div class="sheet-card mt-3">
              <label class="sheet-row justify-between">
                <span class="sheet-label">购买地点</span>
                <input v-model="draft.purchaseLocation" class="min-w-0 flex-1 bg-transparent text-right text-[14px] text-forest outline-none placeholder:text-[#7f9a88]" placeholder="添加地点…" maxlength="120" />
              </label>
            </div>

            <h2 class="sheet-section">状态</h2>
            <div class="divide-y divide-[#eff1ec] sheet-card">
              <div class="sheet-row justify-between">
                <span class="sheet-label">是否退役</span>
                <button type="button" role="switch" :aria-checked="draft.retired" class="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors" :class="draft.retired ? 'bg-forest' : 'bg-[#dde1d7]'" @click="draft.retired = !draft.retired">
                  <span class="absolute top-[2px] size-[26px] rounded-full bg-white shadow-sm transition-all" :class="draft.retired ? 'left-[22px]' : 'left-[2px]'" />
                </button>
              </div>
              <template v-if="draft.retired">
                <label class="sheet-row justify-between">
                  <span class="sheet-label">退役日期</span>
                  <input v-model="draft.retirementDate" type="date" :min="draft.purchaseDate" :max="todayISO()" class="pill-date-input" aria-label="退役日期" />
                </label>
                <div class="sheet-row justify-between">
                  <span class="sheet-label">是否已出售</span>
                  <div class="flex rounded-full bg-[#f1f3ee] p-1">
                    <button type="button" class="h-7 rounded-full px-3 text-[12px] transition-colors" :class="!draft.sold ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8a9486]'" @click="draft.sold = false">未出售</button>
                    <button type="button" class="h-7 rounded-full px-3 text-[12px] transition-colors" :class="draft.sold ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8a9486]'" @click="draft.sold = true">已出售</button>
                  </div>
                </div>
                <template v-if="draft.sold">
                  <label class="sheet-row">
                    <span class="sheet-label">出售价格</span>
                    <input v-model.number="draft.salePrice" type="number" inputmode="decimal" min="0" step="0.01" class="sheet-input text-right" placeholder="选填" />
                  </label>
                  <label class="sheet-row justify-between">
                    <span class="sheet-label">出售币种</span>
                    <span class="relative flex items-center">
                      <select v-model="draft.saleCurrency" class="appearance-none bg-transparent pr-6 text-right text-[14px] text-[#5f6a60] outline-none" aria-label="出售币种">
                        <option v-for="item in CURRENCIES" :key="item.code" :value="item.code">{{ item.label }} {{ item.symbol }}</option>
                      </select>
                      <ChevronsUpDown :size="13" class="pointer-events-none absolute right-0 text-[#a3ab9f]" />
                    </span>
                  </label>
                  <div class="px-4 py-3">
                    <textarea v-model="draft.saleNote" rows="3" class="w-full resize-none bg-transparent text-[14px] leading-6 text-ink outline-none placeholder:text-[#a6ada2]" placeholder="出售渠道、交易情况等…" maxlength="1000" />
                  </div>
                </template>
              </template>
            </div>
            <p v-if="errors.retirementDate || errors.salePrice" class="sheet-error">{{ errors.retirementDate || errors.salePrice }}</p>
            <p class="sheet-caption flex items-start gap-1.5"><span class="mt-[5px] size-[7px] shrink-0 rounded-full bg-[#5f9c6c]" />使用中的资产会以这个颜色标记，表示当前正在使用。</p>

            <h2 class="sheet-section">备注</h2>
            <div class="sheet-card px-4 py-3">
              <textarea v-model="draft.note" rows="4" class="w-full resize-none bg-transparent text-[14px] leading-6 text-ink outline-none placeholder:text-[#a6ada2]" placeholder="添加备注" maxlength="1000" />
            </div>

            <div class="mt-4 flex items-center justify-between rounded-[18px] bg-[#e8ede4] px-4 py-3 text-[11px] text-[#77836f]">
              <span>预计使用<strong class="ml-1 font-semibold text-[#45524a] tabular">{{ usageDays }} 天</strong></span>
              <span>每日成本<strong class="ml-1 font-semibold text-forest tabular">{{ formatMoney(dailyCost, draft.currency, true) }}</strong></span>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>