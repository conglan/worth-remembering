<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { CheckCircle2, CircleAlert, Info, LoaderCircle, Menu, X } from 'lucide-vue-next'
import SidebarNav from './components/SidebarNav.vue'
import AssetFormModal from './components/AssetFormModal.vue'
import AssetDetailsDrawer from './components/AssetDetailsDrawer.vue'
import AuthView from './views/AuthView.vue'
import { useAssetStore } from './stores/assets'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'

const route = useRoute()
const router = useRouter()
const assetStore = useAssetStore()
const auth = useAuthStore()
const ui = useUiStore()

onMounted(async () => {
  try { await auth.initialize() }
  catch (error) { ui.toast(error instanceof Error ? error.message : '账号状态加载失败', 'error') }
})

watch(() => auth.currentUser?.id, async (id) => {
  ui.closeForm()
  ui.detailsId = null
  ui.mobileNavOpen = false
  assetStore.reset()
  if (!id) return
  if (route.meta.admin && !auth.isAdmin) await router.replace({ name: 'dashboard' })
  try { await assetStore.initialize() }
  catch (error) { ui.toast(error instanceof Error ? error.message : '数据加载失败', 'error') }
})
</script>

<template>
  <div v-if="!auth.initialized" class="flex min-h-screen items-center justify-center bg-canvas text-forest"><LoaderCircle :size="28" class="animate-spin" /><span class="ml-3 text-sm">正在打开值得记…</span></div>
  <AuthView v-else-if="!auth.currentUser" />
  <div v-else class="min-h-screen bg-canvas">
    <SidebarNav class="hidden md:flex" />

    <header class="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-line bg-[#f5f6f2]/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div class="flex items-center gap-3"><span class="flex size-9 items-center justify-center rounded-xl bg-forest text-sm font-semibold text-white">值</span><span class="text-lg font-semibold tracking-wide">值得记</span></div>
      <button class="icon-button" aria-label="打开导航" @click="ui.mobileNavOpen = true"><Menu :size="21" /></button>
    </header>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="ui.mobileNavOpen" class="fixed inset-0 z-50 bg-[#15251c]/30 backdrop-blur-sm md:hidden" @click="ui.mobileNavOpen = false">
          <div class="modal-panel h-full w-[280px] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" @click.stop>
            <button class="icon-button absolute top-4 right-4 z-10" aria-label="关闭导航" @click="ui.mobileNavOpen = false"><X :size="20" /></button>
            <SidebarNav :collapsible="false" @navigate="ui.mobileNavOpen = false" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <main class="min-h-screen transition-[padding] duration-200" :class="ui.sidebarCollapsed ? 'md:pl-[76px]' : 'md:pl-[232px]'">
      <RouterView v-slot="{ Component }"><Transition name="page" mode="out-in"><component :is="Component" /></Transition></RouterView>
    </main>

    <AssetFormModal />
    <AssetDetailsDrawer />
  </div>

  <Teleport to="body">
    <div class="pointer-events-none fixed top-[calc(1.25rem+env(safe-area-inset-top))] right-5 z-[100] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2">
      <TransitionGroup name="toast">
        <div v-for="item in ui.toasts" :key="item.id" class="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-xl">
          <CheckCircle2 v-if="item.type === 'success'" :size="19" class="shrink-0 text-forest" />
          <CircleAlert v-else-if="item.type === 'error'" :size="19" class="shrink-0 text-[#b55448]" />
          <Info v-else :size="19" class="shrink-0 text-[#66816e]" />
          <span class="flex-1 leading-5">{{ item.message }}</span>
          <button class="text-[#9ba198] hover:text-ink" aria-label="关闭提示" @click="ui.dismissToast(item.id)"><X :size="16" /></button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
