<script setup lang="ts">
import { ref, watch } from 'vue'
import { PackageOpen } from 'lucide-vue-next'
import { resolveImage } from '../lib/storage'
import type { Asset } from '../lib/types'

const props = withDefaults(defineProps<{ asset: Asset; rounded?: string; fit?: 'cover' | 'contain' }>(), {
  fit: 'contain',
})
const source = ref<string | null>(null)
let requestId = 0

watch(() => props.asset.image, async (path) => {
  const current = ++requestId
  source.value = null
  if (!path) return
  try {
    const resolved = await resolveImage(path)
    if (current === requestId) source.value = resolved
  } catch {
    if (current === requestId) source.value = null
  }
}, { immediate: true })
</script>

<template>
  <div class="relative shrink-0 overflow-hidden bg-[#f0f1ec]" :class="rounded || 'rounded-xl'">
    <img v-if="source" :src="source" :alt="asset.name" class="h-full w-full transition-transform duration-500 group-hover:scale-[1.035]" :class="fit === 'cover' ? 'object-cover' : 'object-contain p-1'" loading="lazy" />
    <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[#a0a89b]">
      <PackageOpen :size="25" :stroke-width="1.35" />
      <span class="max-w-full truncate px-2 text-[8px] font-semibold tracking-[0.12em] text-[#a8aea4]">{{ asset.brand }}</span>
    </div>
  </div>
</template>
