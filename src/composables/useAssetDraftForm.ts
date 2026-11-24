import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import { getDailyCost, getUsageDays, todayISO } from '../lib/asset'
import type { AssetDraft } from '../lib/types'

function emptyDraft(): AssetDraft {
  return {
    brand: '', name: '', image: null, price: 0, currency: 'CNY', purchaseDate: todayISO(), purchaseLocation: '',
    retired: false, retirementDate: null, sold: false, salePrice: null, saleCurrency: 'CNY', saleNote: '', note: '',
  }
}

/**
 * 资产表单的共享状态与行为：桌面弹窗与移动端底部卡片共用同一套草稿、校验与保存逻辑。
 */
export function useAssetDraftForm() {
  const store = useAssetStore()
  const ui = useUiStore()
  const fileInput = ref<HTMLInputElement>()
  const saving = ref(false)
  const imageError = ref('')
  const errors = reactive<Record<string, string>>({})
  const draft = reactive<AssetDraft>(emptyDraft())

  const editing = computed(() => ui.editingId ? store.assets.find((asset) => asset.id === ui.editingId) : null)
  const preview = computed(() => ({ ...draft, id: 'preview', createdAt: '', updatedAt: '' }))
  const validPurchaseDate = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate))
  const usageDays = computed(() => validPurchaseDate.value ? getUsageDays(preview.value) : 0)
  const dailyCost = computed(() => validPurchaseDate.value && draft.price > 0 ? getDailyCost(preview.value) : 0)
  const canSave = computed(() => Boolean(
    draft.brand.trim() && draft.name.trim() && Number.isFinite(draft.price) && draft.price > 0
    && validPurchaseDate.value && (!draft.retired || draft.retirementDate),
  ))

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

  function close() { if (!saving.value) ui.closeForm() }

  function onKeydown(event: KeyboardEvent) { if (event.key === 'Escape' && ui.formOpen && !saving.value) ui.closeForm() }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); document.body.style.overflow = '' })

  return {
    draft, editing, preview, errors, imageError, saving, fileInput, usageDays, dailyCost, canSave,
    handleFile, validate, submit, close,
  }
}