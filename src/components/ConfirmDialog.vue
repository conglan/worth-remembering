<script setup lang="ts">
import { AlertTriangle, LoaderCircle, X } from 'lucide-vue-next'

withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmText?: string
  danger?: boolean
  loading?: boolean
}>(), { confirmText: '确认', danger: false, loading: false })
const emit = defineEmits<{ cancel: []; confirm: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center bg-[#17261d]/35 p-5 backdrop-blur-[3px]" @click.self="!loading && emit('cancel')">
        <div class="modal-panel w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" :aria-label="title">
          <div class="flex items-start justify-between">
            <span class="flex size-10 items-center justify-center rounded-xl" :class="danger ? 'bg-[#fbefec] text-[#ae5c4e]' : 'bg-[#edf2e9] text-forest'"><AlertTriangle :size="20" /></span>
            <button class="icon-button -mt-1 -mr-2" :disabled="loading" aria-label="关闭" @click="emit('cancel')"><X :size="18" /></button>
          </div>
          <h2 class="mt-4 text-lg font-semibold">{{ title }}</h2>
          <p class="mt-2 text-[13px] leading-6 text-[#828a7f]">{{ description }}</p>
          <div class="mt-6 flex justify-end gap-2.5">
            <button class="btn-secondary" :disabled="loading" @click="emit('cancel')">取消</button>
            <button class="btn-primary" :class="danger ? 'bg-[#a95347] hover:bg-[#93473d]' : ''" :disabled="loading" @click="emit('confirm')">
              <LoaderCircle v-if="loading" :size="15" class="animate-spin" />{{ loading ? '处理中' : confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
