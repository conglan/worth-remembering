<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import AssetList from '../components/AssetList.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useAssetStore } from '../stores/assets'
import { useUiStore } from '../stores/ui'
import type { Asset } from '../lib/types'

const store = useAssetStore()
const ui = useUiStore()
const deleteTarget = ref<Asset | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await store.remove(deleteTarget.value.id)
    ui.toast(`已删除「${deleteTarget.value.name}」`)
    deleteTarget.value = null
  } catch (error) { ui.toast(error instanceof Error ? error.message : '删除失败', 'error') }
  finally { deleting.value = false }
}
</script>

<template>
  <div>
    <div class="mx-auto max-w-[1500px] px-4 pt-7 pb-8 sm:px-6 md:px-8 md:pt-9">
      <header class="mb-7 flex items-end justify-between gap-5">
        <div>
          <div class="eyebrow mb-2.5">ASSET COLLECTION · 资产档案</div>
          <h1 class="text-[30px] font-semibold tracking-[-0.04em]">我的资产</h1>
          <p class="mt-2 text-[13px] text-[#8a9287]">所有拥有与告别，都整整齐齐地收藏在这里。</p>
        </div>
        <button class="btn-primary shrink-0" @click="ui.openForm()"><Plus :size="17" /><span class="hidden min-[420px]:inline">记一件资产</span><span class="min-[420px]:hidden">记资产</span></button>
      </header>
      <AssetList @delete="deleteTarget = $event" />
    </div>
    <ConfirmDialog :open="!!deleteTarget" title="删除这件资产？" :description="`「${deleteTarget?.name || ''}」及其全部记录将被永久删除，此操作无法撤销。`" confirm-text="确认删除" danger :loading="deleting" @cancel="deleteTarget = null" @confirm="confirmDelete" />
  </div>
</template>
