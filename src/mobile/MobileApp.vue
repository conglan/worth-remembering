<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Boxes, ChartNoAxesCombined, Database, House, LogOut, User } from 'lucide-vue-next'
import AuthView from '../views/AuthView.vue'
import AssetFormModal from '../components/AssetFormModal.vue'
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
  <div v-else class="flex h-dvh flex-col overflow-hidden bg-canvas">
      <header class="z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-line bg-[#f5f6f2]/95 px-5 pt-[env(safe-area-inset-top)]">
      <div class="flex items-center gap-3">
        <span class="flex size-9 items-center justify-center rounded-xl bg-forest text-sm font-semibold text-white">值</span>
        <span class="text-lg font-semibold tracking-wide">值得记</span>
      </div>
      <button class="flex size-9 items-center justify-center rounded-lg text-[#737b72] active:bg-[#eef1eb]" aria-label="退出登录" @click="logout"><LogOut :size="18" /></button>
    </header>

      <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <RouterView v-slot="{ Component }"><Transition name="page" mode="out-in"><component :is="Component" /></Transition></RouterView>
    </main>

      <nav class="z-40 grid shrink-0 grid-cols-4 border-t border-line bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" aria-label="底部导航">
      <RouterLink v-for="item in tabs" :key="item.name" :to="{ name: item.name }" class="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors" :class="route.name === item.name ? 'text-forest' : 'text-[#929a90]'">
        <component :is="item.icon" :size="20" :stroke-width="route.name === item.name ? 2.3 : 1.8" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <AssetFormModal />
    <AssetDetailsDrawer />
  </div>
</template>