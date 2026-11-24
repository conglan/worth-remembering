<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Boxes, ChartNoAxesCombined, CheckCircle2, CircleAlert, Database, House, Info, LogOut, X } from 'lucide-vue-next'
import AuthView from '../views/AuthView.vue'
import MobileAssetForm from './MobileAssetForm.vue'
import AssetDetailsDrawer from '../components/AssetDetailsDrawer.vue'
import { useAssetStore } from '../stores/assets'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const assetStore = useAssetStore()
const auth = useAuthStore()
const ui = useUiStore()

const tabs = [
  { name: 'dashboard', label: '总览', icon: House },
  { name: 'assets', label: '资产', icon: Boxes },
  { name: 'insights', label: '洞察', icon: ChartNoAxesCombined },
  { name: 'data', label: '数据', icon: Database },
]

onMounted(async () => {
  try { await auth.initialize() }
  catch (error) { ui.toast(error instanceof Error ? error.message : '账号状态加载失败', 'error') }
})

watch(() => auth.currentUser?.id, async (id) => {
  ui.closeForm()
  ui.detailsId = null
  assetStore.reset()
  if (!id) return
  if (route.meta.admin && !auth.isAdmin) await router.replace({ name: 'dashboard' })
  try { await assetStore.initialize() }
  catch (error) { ui.toast(error instanceof Error ? error.message : '数据加载失败', 'error') }
})

async function logout() {
  await auth.logout()
  await router.replace({ name: 'dashboard' })
}
</script>

<template>
  <div v-if="!auth.initialized" class="flex h-dvh items-center justify-center bg-canvas text-forest"><span class="text-sm">正在打开值得记…</span></div>
  <AuthView v-else-if="!auth.currentUser" />
  <div v-else class="relative flex h-dvh flex-col overflow-hidden bg-canvas">
    <header class="z-30 flex h-[calc(3.5rem+var(--safe-top))] shrink-0 items-center justify-between border-b border-line bg-[#f5f6f2]/95 px-5 pt-[var(--safe-top)]">
      <div class="flex items-center gap-3">
        <span class="flex size-9 items-center justify-center rounded-xl bg-forest text-sm font-semibold text-white">值</span>
        <span class="text-lg font-semibold tracking-wide">值得记</span>
      </div>
      <button class="flex size-9 items-center justify-center rounded-lg text-[#737b72] active:bg-[#eef1eb]" aria-label="退出登录" @click="logout"><LogOut :size="18" /></button>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5.5rem+var(--safe-bottom))]">
      <RouterView v-slot="{ Component }"><Transition name="page" mode="out-in"><component :is="Component" /></Transition></RouterView>
    </main>

    <nav class="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.5rem+var(--safe-bottom))]" aria-label="底部导航">
      <div class="pointer-events-auto grid grid-cols-4 gap-1 rounded-[26px] border border-white/70 bg-white/85 p-1.5 shadow-[0_10px_28px_rgba(24,42,30,0.14)] backdrop-blur-xl">
        <RouterLink v-for="item in tabs" :key="item.name" :to="{ name: item.name }" class="flex h-[52px] flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-medium transition-all duration-200" :class="route.name === item.name ? 'bg-forest text-white shadow-[0_6px_16px_rgba(40,77,59,0.26)]' : 'text-[#8b948a]'">
          <component :is="item.icon" :size="19" :stroke-width="route.name === item.name ? 2.2 : 1.8" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <MobileAssetForm />
    <AssetDetailsDrawer />
  </div>

  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+var(--safe-top))] z-[100] flex flex-col items-center gap-2 px-4">
      <TransitionGroup name="toast">
        <div v-for="item in ui.toasts" :key="item.id" class="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl border border-line bg-white/95 px-4 py-3 text-[13px] shadow-xl backdrop-blur">
          <CheckCircle2 v-if="item.type === 'success'" :size="18" class="shrink-0 text-forest" />
          <CircleAlert v-else-if="item.type === 'error'" :size="18" class="shrink-0 text-[#b55448]" />
          <Info v-else :size="18" class="shrink-0 text-[#66816e]" />
          <span class="flex-1 leading-5">{{ item.message }}</span>
          <button class="text-[#9ba198] active:text-ink" aria-label="关闭提示" @click="ui.dismissToast(item.id)"><X :size="15" /></button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>