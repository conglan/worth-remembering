<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowDownRight, ArrowUpRight } from 'lucide-vue-next'

defineProps<{
  label: string
  value: string
  hint: string
  icon: Component
  dark?: boolean
  trend?: 'up' | 'down'
}>()
</script>

<template>
  <article class="panel relative min-w-0 overflow-hidden p-5" :class="dark ? 'border-forest bg-forest text-white shadow-[0_10px_30px_rgba(40,77,59,0.13)]' : ''">
    <div class="flex items-start justify-between gap-3">
      <span class="text-xs font-medium" :class="dark ? 'text-white/65' : 'text-[#7f877d]'">{{ label }}</span>
      <span class="flex size-8 items-center justify-center rounded-lg" :class="dark ? 'bg-white/10 text-white/80' : 'bg-[#f2f4ef] text-[#718070]'">
        <component :is="icon" :size="16" :stroke-width="1.8" />
      </span>
    </div>
    <div class="tabular mt-2 truncate text-[27px] font-semibold tracking-[-0.035em]" :class="dark ? 'text-white' : 'text-[#283129]'">{{ value }}</div>
    <div class="mt-2 flex items-center gap-1.5 text-[11px]" :class="dark ? 'text-white/55' : 'text-[#92998f]'">
      <ArrowUpRight v-if="trend === 'up'" :size="12" />
      <ArrowDownRight v-else-if="trend === 'down'" :size="12" />
      <span class="truncate">{{ hint }}</span>
    </div>
    <div v-if="dark" class="pointer-events-none absolute -right-7 -bottom-10 size-28 rounded-full border border-white/[0.06]" />
    <div v-if="dark" class="pointer-events-none absolute -right-2 -bottom-16 size-32 rounded-full border border-white/[0.06]" />
  </article>
</template>
