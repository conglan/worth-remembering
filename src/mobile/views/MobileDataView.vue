<script setup lang="ts">
import { ref } from 'vue'
import { Download, FileJson, FileSpreadsheet, FolderLock, Import, Info, LoaderCircle, Trash2, Upload } from 'lucide-vue-next'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { useAssetStore } from '../../stores/assets'
import { useUiStore } from '../../stores/ui'
import { assetsToUseitlongBackup, parseUseitlongBackup } from '../../lib/useitlong'

const store = useAssetStore()
const ui = useUiStore()
type BackupFormat = 'excel' | 'json' | 'useitlong'

const fileInput = ref<HTMLInputElement>()
const exportFormat = ref<BackupFormat>('excel')
const importFormat = ref<BackupFormat>('excel')
const pendingImportFormat = ref<BackupFormat>('excel')
const pendingImport = ref<string | ArrayBuffer>('')
const confirmAction = ref<'import' | 'clear' | null>(null)
const processing = ref(false)
const exporting = ref(false)
const importingUseitlong = ref(false)

async function download() {
  exporting.value = true
  try {
    const format = exportFormat.value
    const content = format === 'excel'
      ? await store.exportExcel()
      : format === 'json'
        ? store.exportBackup()
        : await assetsToUseitlongBackup(store.assets)
    const ext = format === 'excel' ? 'xlsx' : format === 'json' ? 'json' : 'useitlongbackup'
    const mime = format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : format === 'json' ? 'application/json;charset=utf-8' : 'application/zip'
    const blob = new Blob([content], { type: mime })
    const filename = `值得记-资产备份-${new Date().toISOString().slice(0, 10)}.${ext}`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
    ui.toast(`${format === 'excel' ? 'Excel' : format === 'json' ? 'JSON' : 'useitlong'} 备份文件已导出`)
      } catch (error) {
    ui.toast(error instanceof Error ? error.message : '导出失败，请重试', 'error')
  } finally {
    exporting.value = false
  }
}

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 100 * 1024 * 1024) { ui.toast('备份文件不能超过 100MB', 'error'); return }
  try {
    if (importFormat.value === 'useitlong') {
      importingUseitlong.value = true
      const assets = await parseUseitlongBackup(await file.arrayBuffer())
      if (!assets.length) { ui.toast('备份文件中没有找到资产数据', 'error'); return }
      const result = await store.importAssets(assets)
      ui.toast(result.skipped ? `已从 useitlong 导入 ${result.added} 件，跳过 ${result.skipped} 件相同 ID 的资产` : `已从 useitlong 导入 ${result.added} 件资产`)
    } else {
      pendingImportFormat.value = importFormat.value
      pendingImport.value = importFormat.value === 'excel' ? await file.arrayBuffer() : await file.text()
      confirmAction.value = 'import'
    }
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '备份文件读取失败', 'error')
  } finally {
    importingUseitlong.value = false
  }
}

async function runConfirmedAction() {
  processing.value = true
  try {
    if (confirmAction.value === 'import') {
      const result = pendingImportFormat.value === 'excel'
        ? await store.importExcel(pendingImport.value as ArrayBuffer)
        : await store.importBackup(pendingImport.value as string)
      ui.toast(result.skipped ? `已新增 ${result.added} 件，跳过 ${result.skipped} 件相同 ID 的资产` : `已新增 ${result.added} 件资产`)
    } else if (confirmAction.value === 'clear') {
      await store.clear()
      ui.toast('全部资产已清空')
    }
    confirmAction.value = null
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '操作失败，请检查备份文件', 'error')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-5 pb-6">
    <header class="mb-5">
      <div class="eyebrow mb-2">YOUR DATA</div>
      <h1 class="text-[26px] font-semibold tracking-[-0.04em] text-[#273129]">数据管理</h1>
      <p class="mt-1.5 text-xs text-[#8a9287]">备份或迁移你的生活档案。</p>
    </header>

    <section class="rounded-[24px] bg-forest p-5 text-white shadow-[0_12px_30px_rgba(40,77,59,0.14)]">
      <div class="flex items-center gap-3">
        <span class="flex size-11 items-center justify-center rounded-2xl bg-white/10"><FolderLock :size="21" /></span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">{{ store.storageInfo.label }}</div>
          <div class="mt-1 text-[10px] text-white/60">{{ store.storageInfo.description }}</div>
        </div>
        <div class="text-right"><div class="text-xl font-semibold tabular">{{ store.assets.length }}</div><div class="text-[9px] text-white/60">件记录</div></div>
      </div>
    </section>

    <section class="panel mt-3 p-4">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><Import :size="18" /></span>
        <div><h2 class="text-sm font-semibold">导入备份</h2><p class="mt-1 text-[10px] text-[#929a90]">仅新增资产，相同 ID 自动跳过</p></div>
      </div>
      <select v-model="importFormat" class="field-input mt-4 !h-11" aria-label="导入格式">
        <option value="excel">Excel 工作簿 (.xlsx)</option>
        <option value="json">JSON 备份 (.json)</option>
        <option value="useitlong">useitlong 备份 (.useitlongbackup)</option>
      </select>
      <button class="btn-secondary mt-3 w-full" :disabled="importingUseitlong" @click="fileInput?.click()">
        <LoaderCircle v-if="importingUseitlong" :size="16" class="animate-spin" /><Import v-else :size="16" />
        {{ importingUseitlong ? '正在解析文件' : '选择备份文件' }}
      </button>
      <input ref="fileInput" type="file" :accept="importFormat === 'excel' ? '.xlsx' : importFormat === 'json' ? '.json,application/json' : '.useitlongbackup,application/zip'" class="hidden" @change="selectFile" />
    </section>

    <section class="panel mt-3 p-4">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><Download :size="18" /></span>
        <div><h2 class="text-sm font-semibold">导出备份</h2><p class="mt-1 text-[10px] text-[#929a90]">将当前 {{ store.assets.length }} 件资产保存到文件</p></div>
      </div>
      <select v-model="exportFormat" class="field-input mt-4 !h-11" aria-label="导出格式">
        <option value="excel">Excel 工作簿 (.xlsx)</option>
        <option value="json">JSON 完整备份 (.json)</option>
        <option value="useitlong">useitlong 备份 (.useitlongbackup)</option>
      </select>
      <button class="btn-primary mt-3 w-full" :disabled="!store.assets.length || exporting" @click="download">
        <LoaderCircle v-if="exporting" :size="16" class="animate-spin" />
        <FileSpreadsheet v-else-if="exportFormat === 'excel'" :size="16" /><FileJson v-else-if="exportFormat === 'json'" :size="16" /><Upload v-else :size="16" />
        {{ exporting ? '正在生成备份' : '导出文件' }}
      </button>
    </section>

    <section class="panel mt-3 p-4">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-xl bg-[#fbefec] text-[#a65b50]"><Trash2 :size="18" /></span>
        <div class="min-w-0 flex-1"><h2 class="text-sm font-semibold text-[#9d554b]">清空全部资产</h2><p class="mt-1 text-[10px] leading-4 text-[#989f94]">此操作不可撤销，请先导出备份。</p></div>
      </div>
      <button class="btn-secondary mt-3 w-full border-[#ead6d0] text-[#a55a4e] hover:bg-[#fcf4f2]" :disabled="!store.assets.length" @click="confirmAction = 'clear'"><Trash2 :size="14" />清空数据</button>
    </section>

    <p class="mt-4 px-1 text-[10px] leading-5 text-[#9ba298]"><Info :size="13" class="mr-1 inline" />数据操作仅影响当前账号；请妥善保管导出的备份文件。</p>

    <ConfirmDialog
      :open="!!confirmAction"
      :title="confirmAction === 'clear' ? '清空全部资产？' : '导入并新增资产？'"
      :description="confirmAction === 'clear' ? '所有资产记录将被永久删除，且无法撤销。建议先导出备份。' : '新资产会加入当前清单；相同资产 ID 将跳过，现有记录不会被覆盖或删除。'"
      :confirm-text="confirmAction === 'clear' ? '确认清空' : '确认导入'"
      :danger="confirmAction === 'clear'"
      :loading="processing"
      @cancel="confirmAction = null"
      @confirm="runConfirmedAction"
    />
  </div>
</template>