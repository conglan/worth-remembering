<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CalendarDays, Check, ChevronDown, ImagePlus, LoaderCircle, MapPin, Pencil, Trash2, Upload, X } from 'lucide-vue-next'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import AssetImage from './AssetImage.vue'
import { formatMoney, getDailyCost, getUsageDays, todayISO } from '../lib/asset'
import { CURRENCIES, type AssetDraft } from '../lib/types'

const store = useAssetStore()
const ui = useUiStore()
const fileInput = ref<HTMLInputElement>()
const saving = ref(false)
const imageError = ref('')
const errors = reactive<Record<string, string>>({})

function emptyDraft(): AssetDraft {
  return {
    brand: '', name: '', image: null, price: 0, currency: 'CNY', purchaseDate: todayISO(), purchaseLocation: '',
    retired: false, retirementDate: null, sold: false, salePrice: null, saleCurrency: 'CNY', saleNote: '', note: '',
  }
}
const draft = reactive<AssetDraft>(emptyDraft())
const editing = computed(() => ui.editingId ? store.assets.find((asset) => asset.id === ui.editingId) : null)
const preview = computed(() => ({ ...draft, id: 'preview', createdAt: '', updatedAt: '' }))
const validPurchaseDate = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate))
const usageDays = computed(() => validPurchaseDate.value ? getUsageDays(preview.value) : 0)
const dailyCost = computed(() => validPurchaseDate.value && draft.price > 0 ? getDailyCost(preview.value) : 0)

function reset() {
  Object.assign(draft, editing.value ? {
    brand: editing.value.brand, name: editing.value.name, image: editing.value.image, price: editing.value.price,
    currency: editing.value.currency, purchaseDate: editing.value.purchaseDate, purchaseLocation: editing.value.purchaseLocation,
    retired: editing.value.retired, retirementDate: editing.value.retirementDate, sold: editing.value.sold,
    salePrice: editing.value.salePrice, saleCurrency: editing.value.saleCurrency, saleNote: editing.value.saleNote, note: editing.value.note,
  } : emptyDraft())
  Object.keys(errors).forEach((key) => delete errors[key])
  imageError.value = ''
}

watch(() => ui.formOpen, (open) => {
  if (open) reset()
  document.body.style.overflow = open ? 'hidden' : ''
})
watch(() => draft.retired, (retired) => {
  if (retired && !draft.retirementDate) draft.retirementDate = todayISO()
  if (!retired) { draft.retirementDate = null; draft.sold = false; draft.salePrice = null; draft.saleNote = '' }
})

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'))
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('无法识别这张图片。'))
    element.src = source
  })
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', 0.84)
}

async function handleFile(file?: File) {
  imageError.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) { imageError.value = '请选择 JPG、PNG 或 WebP 图片。'; return }
  if (file.size > 10 * 1024 * 1024) { imageError.value = '图片不能超过 10MB。'; return }
  try { draft.image = await compressImage(file) }
  catch (error) { imageError.value = error instanceof Error ? error.message : '图片处理失败。' }
}

function validate(): boolean {
  Object.keys(errors).forEach((key) => delete errors[key])
  if (!draft.brand.trim()) errors.brand = '请填写品牌'
  if (!draft.name.trim()) errors.name = '请填写产品名称'
  if (!Number.isFinite(draft.price) || draft.price <= 0) errors.price = '请输入大于 0 的购入价格'
  if (!draft.purchaseDate) errors.purchaseDate = '请选择购入日期'
  if (draft.retired && !draft.retirementDate) errors.retirementDate = '请选择退役日期'
  if (draft.retired && draft.retirementDate && draft.retirementDate < draft.purchaseDate) errors.retirementDate = '退役日期不能早于购入日期'
  if (draft.salePrice !== null && (!Number.isFinite(draft.salePrice) || draft.salePrice < 0)) errors.salePrice = '出售价格不能小于 0'
  return Object.keys(errors).length === 0
}

async function submit() {
  if (!validate()) return
  saving.value = true
  try {
    const normalized: AssetDraft = { ...draft, brand: draft.brand.trim(), name: draft.name.trim(), purchaseLocation: draft.purchaseLocation.trim(), note: draft.note.trim(), saleNote: draft.saleNote.trim() }
    await store.save(normalized, editing.value?.id)
    ui.toast(editing.value ? '资产信息已更新' : '新资产已加入你的生活档案')
    ui.closeForm()
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '保存失败，请稍后重试', 'error')
  } finally { saving.value = false }
}

function onKeydown(event: KeyboardEvent) { if (event.key === 'Escape' && ui.formOpen && !saving.value) ui.closeForm() }
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="ui.formOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-[#17261d]/40 p-0 backdrop-blur-[4px] md:p-6" @click.self="!saving && ui.closeForm()">
        <div class="modal-panel flex max-h-[92dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl" role="dialog" aria-modal="true" :aria-label="editing ? '编辑资产' : '记录新资产'">
          <header class="flex shrink-0 items-start justify-between border-b border-line px-6 py-5 sm:px-8">
            <div>
              <div class="eyebrow mb-1.5">{{ editing ? 'EDIT ASSET' : 'NEW ASSET' }}</div>
              <h2 class="text-xl font-semibold tracking-tight">{{ editing ? '编辑资产' : '记录一件值得的物品' }}</h2>
              <p class="mt-1.5 text-xs text-[#939a90]">它的价值，不止于价格，也在每一天的陪伴里。</p>
            </div>
            <button class="icon-button -mr-2" aria-label="关闭表单" @click="ui.closeForm"><X :size="20" /></button>
          </header>

          <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div class="grid gap-6 sm:grid-cols-[148px_1fr]">
                <div>
                  <label class="field-label">物品图片 <span class="font-normal text-[#a3aaa0]">选填</span></label>
                  <div class="group relative flex size-[148px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#d7ddd2] bg-[#f7f8f4] transition-colors hover:border-[#91a18e]" @dragover.prevent @drop.prevent="handleFile($event.dataTransfer?.files[0])">
                    <AssetImage v-if="draft.image" :asset="preview" class="h-full w-full" rounded="rounded-none" fit="contain" />
                    <button v-if="draft.image" type="button" class="absolute inset-0 flex items-center justify-center gap-1.5 bg-[#1c3024]/45 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100" @click="fileInput?.click()"><Pencil :size="14" />更换图片</button>
                    <button v-else type="button" class="flex h-full w-full flex-col items-center justify-center text-[#8c9788]" @click="fileInput?.click()">
                      <span class="mb-2 flex size-10 items-center justify-center rounded-xl bg-white shadow-sm"><ImagePlus :size="20" /></span>
                      <span class="text-xs font-medium">添加图片</span><span class="mt-1 text-[9px] text-[#a4aba0]">点击或拖拽上传</span>
                    </button>
                    <button v-if="draft.image" type="button" class="absolute top-2 right-2 flex size-6 items-center justify-center rounded-lg bg-white/90 text-[#9e5b50] shadow-sm" aria-label="移除图片" @click="draft.image = null"><Trash2 :size="12" /></button>
                  </div>
                  <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="handleFile(($event.target as HTMLInputElement).files?.[0])" />
                  <p class="mt-2 text-[9px] leading-4" :class="imageError ? 'text-[#b0564b]' : 'text-[#a0a79d]'">{{ imageError || 'JPG / PNG / WebP，最大 10MB' }}</p>
                </div>
                <div class="grid content-start gap-4 sm:grid-cols-2">
                  <label><span class="field-label">品牌 <span class="text-[#b55e50]">*</span></span><input v-model="draft.brand" class="field-input" :class="errors.brand ? 'border-[#c8786d]' : ''" placeholder="例如：SONY" maxlength="60" /><span v-if="errors.brand" class="mt-1 block text-[10px] text-[#b0564b]">{{ errors.brand }}</span></label>
                  <label><span class="field-label">产品名称 <span class="text-[#b55e50]">*</span></span><input v-model="draft.name" class="field-input" :class="errors.name ? 'border-[#c8786d]' : ''" placeholder="例如：WH-1000XM5" maxlength="100" /><span v-if="errors.name" class="mt-1 block text-[10px] text-[#b0564b]">{{ errors.name }}</span></label>
                  <label><span class="field-label">购入价格 <span class="text-[#b55e50]">*</span></span><input v-model.number="draft.price" type="number" min="0" step="0.01" class="field-input" :class="errors.price ? 'border-[#c8786d]' : ''" placeholder="0.00" /><span v-if="errors.price" class="mt-1 block text-[10px] text-[#b0564b]">{{ errors.price }}</span></label>
                  <label><span class="field-label">币种 <span class="text-[#b55e50]">*</span></span><span class="relative block"><select v-model="draft.currency" class="field-input"><option v-for="item in CURRENCIES" :key="item.code" :value="item.code">{{ item.label }} · {{ item.code }}</option></select><ChevronDown :size="14" class="pointer-events-none absolute top-3.5 right-3 text-[#929a8e]" /></span></label>
                </div>
              </div>

              <div class="mt-6 grid gap-4 sm:grid-cols-2">
                <label><span class="field-label">购入日期 <span class="text-[#b55e50]">*</span></span><span class="relative block"><input v-model="draft.purchaseDate" type="date" :max="todayISO()" class="field-input" :class="errors.purchaseDate ? 'border-[#c8786d]' : ''" /><CalendarDays :size="14" class="pointer-events-none absolute top-3.5 right-3 hidden text-[#929a8e]" /></span><span v-if="errors.purchaseDate" class="mt-1 block text-[10px] text-[#b0564b]">{{ errors.purchaseDate }}</span></label>
                <label><span class="field-label">购买地点 <span class="font-normal text-[#a3aaa0]">选填</span></span><span class="relative block"><input v-model="draft.purchaseLocation" class="field-input pr-9" placeholder="门店、城市或购买平台" maxlength="120" /><MapPin :size="14" class="pointer-events-none absolute top-3.5 right-3 text-[#a1a89d]" /></span></label>
              </div>
              <label class="mt-4 block"><span class="field-label">备注 <span class="font-normal text-[#a3aaa0]">选填</span></span><textarea v-model="draft.note" class="field-input" placeholder="记录它的规格、购买理由，或与它有关的故事…" maxlength="1000" /></label>

              <section class="mt-6 rounded-2xl border border-[#e2e7dd] bg-[#f7f9f4] p-5">
                <div class="flex items-center justify-between">
                  <div><h3 class="text-[13px] font-semibold text-[#4c584d]">这件物品已经退役了吗？</h3><p class="mt-1 text-[10px] text-[#97a092]">退役后将停止计算持有时间，但保留完整记录</p></div>
                  <button type="button" role="switch" :aria-checked="draft.retired" class="relative h-6 w-11 rounded-full transition-colors" :class="draft.retired ? 'bg-forest' : 'bg-[#d8ded4]'" @click="draft.retired = !draft.retired"><span class="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all" :class="draft.retired ? 'left-[22px]' : 'left-0.5'" /></button>
                </div>
                <div v-if="draft.retired" class="mt-5 border-t border-[#e2e7dd] pt-5">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <label><span class="field-label">退役日期 <span class="text-[#b55e50]">*</span></span><input v-model="draft.retirementDate" type="date" :min="draft.purchaseDate" :max="todayISO()" class="field-input bg-white" :class="errors.retirementDate ? 'border-[#c8786d]' : ''" /><span v-if="errors.retirementDate" class="mt-1 block text-[10px] text-[#b0564b]">{{ errors.retirementDate }}</span></label>
                    <div><span class="field-label">是否已出售 <span class="text-[#b55e50]">*</span></span><div class="flex h-11 items-center gap-2 rounded-xl bg-[#edf0e9] p-1"><button type="button" class="flex h-full flex-1 items-center justify-center gap-1 rounded-lg text-xs transition-all" :class="!draft.sold ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8a9486]'" @click="draft.sold = false"><Check v-if="!draft.sold" :size="12" />否，仍保留</button><button type="button" class="flex h-full flex-1 items-center justify-center gap-1 rounded-lg text-xs transition-all" :class="draft.sold ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8a9486]'" @click="draft.sold = true"><Check v-if="draft.sold" :size="12" />是，已出售</button></div></div>
                  </div>
                  <div v-if="draft.sold" class="mt-4 grid gap-4 sm:grid-cols-2">
                    <label><span class="field-label">出售价格 <span class="font-normal text-[#a3aaa0]">选填</span></span><input v-model.number="draft.salePrice" type="number" min="0" step="0.01" class="field-input bg-white" placeholder="0.00" /><span v-if="errors.salePrice" class="mt-1 block text-[10px] text-[#b0564b]">{{ errors.salePrice }}</span></label>
                    <label><span class="field-label">出售币种 <span class="text-[#b55e50]">*</span></span><span class="relative block"><select v-model="draft.saleCurrency" class="field-input bg-white"><option v-for="item in CURRENCIES" :key="item.code" :value="item.code">{{ item.label }} · {{ item.code }}</option></select><ChevronDown :size="14" class="pointer-events-none absolute top-3.5 right-3 text-[#929a8e]" /></span></label>
                    <label class="sm:col-span-2"><span class="field-label">出售备注 <span class="font-normal text-[#a3aaa0]">选填</span></span><textarea v-model="draft.saleNote" class="field-input min-h-20 bg-white" placeholder="出售渠道、交易情况等…" maxlength="1000" /></label>
                  </div>
                </div>
              </section>
            </div>

            <footer class="flex shrink-0 flex-col gap-4 border-t border-line bg-[#fcfcfa] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div class="flex items-center gap-5 text-[11px] text-[#8e9789]">
                <span>预计使用 <strong class="ml-1 font-semibold text-[#4b574c] tabular">{{ usageDays }} 天</strong></span>
                <span class="h-4 w-px bg-line" />
                <span>每日成本 <strong class="ml-1 font-semibold text-forest tabular">{{ formatMoney(dailyCost, draft.currency, true) }}</strong></span>
              </div>
              <div class="flex gap-2.5"><button type="button" class="btn-secondary" :disabled="saving" @click="ui.closeForm">取消</button><button type="submit" class="btn-primary min-w-[112px]" :disabled="saving"><LoaderCircle v-if="saving" :size="15" class="animate-spin" /><Upload v-else :size="15" />{{ saving ? '保存中' : editing ? '保存修改' : '收入档案' }}</button></div>
            </footer>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
