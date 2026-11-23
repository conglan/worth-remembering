<script setup lang="ts">
import { ref } from 'vue'
import { isTauri, saveBackup } from '../lib/api'
import { assetsToUseitlongBackup, parseUseitlongBackup } from '../lib/useitlong'
import { ChevronRight, Database, Download, FileJson, FileSpreadsheet, FolderLock, HardDrive, Import, Info, LoaderCircle, ShieldCheck, Trash2, Upload } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'

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
    let content: ArrayBuffer | string
    let filename: string
    let mime: string
    if (format === 'excel') {
      content = await store.exportExcel()
      filename = `值得记-资产备份-${new Date().toISOString().slice(0, 10)}.xlsx`
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    } else if (format === 'json') {
      content = store.exportBackup()
      filename = `值得记-资产备份-${new Date().toISOString().slice(0, 10)}.json`
      mime = 'application/json;charset=utf-8'
    } else {
      content = await assetsToUseitlongBackup(store.assets)
      filename = `值得记-资产备份-${new Date().toISOString().slice(0, 10)}.useitlongbackup`
      mime = 'application/zip'
    }
    const blob = new Blob([content], { type: mime })
    if (isTauri) {
      const { save: saveBackupFile } = await import('@tauri-apps/plugin-dialog')
      const path = await saveBackupFile({ defaultPath: filename, filters: [{ name: format === 'excel' ? 'Excel 工作簿' : format === 'json' ? 'JSON 备份' : 'useitlong 备份', extensions: [format === 'excel' ? 'xlsx' : format === 'json' ? 'json' : 'useitlongbackup'] }] })
      if (!path) return
      await saveBackup(path, await blobToBase64(blob))
    } else {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    }
    ui.toast(`${format === 'excel' ? 'Excel' : format === 'json' ? 'JSON' : 'useitlong'} 备份文件已导出`)
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '导出失败，请重试', 'error')
  } finally {
    exporting.value = false
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
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
  <div>
    <div class="mx-auto max-w-[1500px] px-4 pt-7 pb-8 sm:px-6 md:px-8 md:pt-9">
      <header class="mb-7">
        <div class="eyebrow mb-2.5">LOCAL DATA · 本地数据</div>
        <h1 class="text-[30px] font-semibold tracking-[-0.04em]">数据管理</h1>
        <p class="mt-2 text-[13px] text-[#8a9287]">你的资产档案由你掌握，随时备份，随时带走。</p>
      </header>

      <section class="panel overflow-hidden">
        <div class="flex flex-col gap-5 bg-forest p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div class="flex items-center gap-4">
            <span class="flex size-12 items-center justify-center rounded-2xl bg-white/10">
              <FolderLock :size="23" />
            </span>
            <div>
              <div class="flex items-center gap-2 text-base font-semibold">
                {{ store.storageInfo.label }}
                <span class="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-normal text-white/75">
                  <span class="size-1.5 rounded-full bg-[#a8c7a7]" />运行正常
                </span>
              </div>
              <p class="mt-2 text-xs text-white/60">{{ store.storageInfo.description }}</p>
            </div>
          </div>
          <div class="sm:text-right">
            <div class="tabular text-3xl font-semibold">{{ store.assets.length }}</div>
            <div class="mt-1 text-[10px] text-white/55">件本地资产记录</div>
          </div>
        </div>
        <div class="grid gap-px bg-line sm:grid-cols-3">
          <div class="flex items-center gap-3 bg-white p-5">
            <ShieldCheck :size="18" class="text-[#73866f]" />
            <div>
              <div class="text-xs font-medium">账号彼此隔离</div>
              <div class="mt-1 text-[10px] text-[#9da49a]">资产、图片与备份互不相通</div>
            </div>
          </div>
          <div class="flex items-center gap-3 bg-white p-5">
            <HardDrive :size="18" class="text-[#73866f]" />
            <div>
              <div class="text-xs font-medium">本地优先</div>
              <div class="mt-1 text-[10px] text-[#9da49a]">数据不会离开当前设备</div>
            </div>
          </div>
          <div class="flex items-center gap-3 bg-white p-5">
            <FileSpreadsheet :size="18" class="text-[#73866f]" />
            <div>
              <div class="text-xs font-medium">双格式备份</div>
              <div class="mt-1 text-[10px] text-[#9da49a]">Excel / JSON，自由选择迁移方式</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 第一行：导入资产备份 + 导出资产备份 -->
            <div class="mt-5 grid gap-5 lg:grid-cols-2">
              <section class="panel p-6">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest">
                      <Import :size="19" />
                    </span>
                    <h2 class="text-base font-semibold">导入资产备份</h2>
                  </div>
                  <div class="flex rounded-lg bg-[#f1f3ee] p-1">
                    <button
                      class="rounded-md px-3 py-1.5 text-[11px] transition-all"
                      :class="importFormat === 'excel' ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8c9588]'"
                      @click="importFormat = 'excel'"
                    >Excel</button>
                    <button
                      class="rounded-md px-3 py-1.5 text-[11px] transition-all"
                      :class="importFormat === 'json' ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8c9588]'"
                      @click="importFormat = 'json'"
                    >JSON</button>
                    <button
                      class="rounded-md px-3 py-1.5 text-[11px] transition-all"
                      :class="importFormat === 'useitlong' ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8c9588]'"
                      @click="importFormat = 'useitlong'"
                    >useitlong</button>
                  </div>
                </div>
                <p class="mt-3 text-xs leading-6 text-[#8d9689]">选择对应格式的备份文件。导入只会新增资产，相同 ID 的记录会跳过，不会覆盖现有数据。</p>
                <button class="btn-secondary mt-5 w-full" :disabled="importingUseitlong" @click="fileInput?.click()">
                  <LoaderCircle v-if="importingUseitlong" :size="15" class="animate-spin" />
                  <Import v-else :size="15" />
                  {{ importingUseitlong ? '正在解析' : `选择 ${importFormat === 'excel' ? 'Excel' : importFormat === 'json' ? 'JSON' : 'useitlong'} 文件` }}
                  <ChevronRight :size="14" class="ml-auto" />
                </button>
                <input
                  ref="fileInput"
                  type="file"
                  :accept="importFormat === 'excel' ? '.xlsx' : importFormat === 'json' ? '.json,application/json' : '.useitlongbackup,application/zip'"
                  class="hidden"
                  @change="selectFile"
                />
                <p class="mt-3 text-[10px] leading-5 text-[#a0a79d]">
                  {{ importFormat === 'excel' ? '支持本应用导出的 .xlsx 工作表，可恢复表格中嵌入的图片。' : importFormat === 'json' ? '支持本应用导出的标准 .json 备份。' : '支持 useitlong 的 ZIP 备份格式（backup.json + images），自动转换品牌、名称、价格、购入日期、退役状态与图片。' }}
                </p>
              </section>

              <section class="panel p-6">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest">
                      <Download :size="19" />
                    </span>
                    <h2 class="text-base font-semibold">导出资产备份</h2>
                  </div>
                  <div class="flex rounded-lg bg-[#f1f3ee] p-1">
                    <button
                      class="rounded-md px-3 py-1.5 text-[11px] transition-all"
                      :class="exportFormat === 'excel' ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8c9588]'"
                      @click="exportFormat = 'excel'"
                    >Excel</button>
                    <button
                      class="rounded-md px-3 py-1.5 text-[11px] transition-all"
                      :class="exportFormat === 'json' ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8c9588]'"
                      @click="exportFormat = 'json'"
                    >JSON</button>
                    <button
                      class="rounded-md px-3 py-1.5 text-[11px] transition-all"
                      :class="exportFormat === 'useitlong' ? 'bg-white font-medium text-forest shadow-sm' : 'text-[#8c9588]'"
                      @click="exportFormat = 'useitlong'"
                    >useitlong</button>
                  </div>
                </div>
                <p class="mt-3 text-xs leading-6 text-[#8d9689]">Excel 便于查看和编辑，JSON 适合完整迁移，useitlong 格式可与 useitlong 应用共用。</p>
                <button class="btn-primary mt-5 w-full" :disabled="!store.assets.length || exporting" @click="download">
                  <LoaderCircle v-if="exporting" :size="15" class="animate-spin" />
                  <FileSpreadsheet v-else-if="exportFormat === 'excel'" :size="15" />
                  <FileJson v-else-if="exportFormat === 'json'" :size="15" />
                  <Upload v-else :size="15" />
                  {{ exporting ? '正在生成' : `导出 ${exportFormat === 'excel' ? 'Excel' : exportFormat === 'json' ? 'JSON' : 'useitlong'}（${store.assets.length} 件）` }}
                  <ChevronRight :size="14" class="ml-auto" />
                </button>
                <p class="mt-3 text-[10px] leading-5 text-[#a0a79d]">
                  {{ exportFormat === 'excel' ? '包含使用天数、每日成本和图片缩略图，同时保留可用的图片路径。' : exportFormat === 'json' ? '包含完整图片数据，适合作为完整备份。' : '导出为 useitlong 兼容的 ZIP 格式，包含资产数据和图片，可直接在 useitlong 中导入。' }}
                </p>
              </section>
            </div>

            <!-- 最后一行：数据维护 -->
            <section class="panel mt-5 p-6">
              <div class="flex items-center gap-3">
                <span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest">
                  <Database :size="19" />
                </span>
                <h2 class="text-base font-semibold">数据维护</h2>
              </div>
              <div class="mt-4 divide-y divide-line">
                <div class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div class="text-xs font-medium text-[#9d554b]">清空全部资产</div>
                    <p class="mt-1.5 text-[10px] text-[#989f94]">永久移除当前所有记录，清空前请务必备份</p>
                  </div>
                  <button
                    class="btn-secondary h-9 self-start border-[#ead6d0] text-xs text-[#a55a4e] hover:bg-[#fcf4f2] sm:self-auto"
                    :disabled="!store.assets.length"
                    @click="confirmAction = 'clear'"
                  >
                    <Trash2 :size="14" />清空数据
                  </button>
                </div>
              </div>
            </section>

      <div class="mt-5 flex items-start gap-2 px-1 text-[10px] leading-5 text-[#9ba298]">
        <Info :size="13" class="mt-0.5 shrink-0" />这里执行的导入和清空只影响当前账号，不会影响其他用户；资产图片在数据库中仅保存文件名。
      </div>
    </div>

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