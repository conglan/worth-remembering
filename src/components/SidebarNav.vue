<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowUpRight, Boxes, ChartNoAxesCombined, Database, LayoutDashboard, LoaderCircle, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Settings2, ShieldCheck, Sparkles, UsersRound } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

const props = withDefaults(defineProps<{ collapsible?: boolean }>(), { collapsible: true })
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const auth = useAuthStore()
const loggingOut = ref(false)
const collapsed = computed(() => props.collapsible && ui.sidebarCollapsed)
const navItems = computed(() => [
  { name: 'dashboard', label: '资产总览', icon: LayoutDashboard },
  { name: 'assets', label: '我的资产', icon: Boxes },
  { name: 'insights', label: '成本洞察', icon: ChartNoAxesCombined },
    { name: 'data', label: '数据管理', icon: Database },
  ...(auth.isAdmin ? [
    { name: 'users', label: '用户管理', icon: UsersRound },
    { name: 'settings', label: '设置管理', icon: Settings2 },
  ] : []),
])

function toggleSidebar() {
  if (!props.collapsible) return
  ui.toggleSidebar()
  emit('navigate')
}

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await auth.logout()
    emit('navigate')
    await router.replace({ name: 'dashboard' })
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '退出登录失败', 'error')
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-40 flex flex-col overflow-y-auto border-r border-line bg-[#fafbf8] py-6 transition-[width,padding] duration-200"
    :class="collapsed ? 'w-[76px] px-3' : 'w-[232px] px-4'"
  >
    <div class="mb-8 flex items-center gap-3" :class="collapsed ? 'justify-center' : 'px-2'">
      <div class="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-forest text-white shadow-sm">
        <span class="text-[19px] font-semibold">值</span>
        <Sparkles class="absolute top-1 right-1 opacity-45" :size="9" />
      </div>
      <div v-if="!collapsed" class="min-w-0">
        <div class="text-[19px] font-semibold tracking-[0.12em] text-ink">值得记</div>
        <div class="mt-0.5 text-[8px] font-medium tracking-[0.16em] text-[#979d93]">WORTH REMEMBERING</div>
      </div>
    </div>

    <button class="btn-primary w-full" :class="[collapsed ? '!px-0' : '', 'mb-7']" :title="collapsed ? '记一件资产' : undefined" @click="ui.openForm(); emit('navigate')">
      <Plus :size="17" /><span v-if="!collapsed">记一件资产</span>
    </button>

    <div class="mb-3 flex items-center" :class="collapsed ? 'justify-center' : 'justify-between px-3'">
      <div v-if="!collapsed" class="eyebrow">我的空间</div>
      <button
        v-if="collapsible"
        class="icon-button size-6 shrink-0"
        :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        :aria-expanded="!collapsed"
        @click="toggleSidebar"
      >
        <PanelLeftOpen v-if="collapsed" :size="15" />
        <PanelLeftClose v-else :size="15" />
      </button>
    </div>

    <nav class="space-y-1.5">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        :title="collapsed ? item.label : undefined"
        class="group flex h-11 items-center rounded-xl text-[13px] font-medium transition-all"
        :class="[collapsed ? 'justify-center' : 'gap-3 px-3', route.name === item.name ? 'bg-[#e8eee5] text-forest' : 'text-[#737b72] hover:bg-[#f0f2ed] hover:text-ink']"
        @click="emit('navigate')"
      >
        <component :is="item.icon" :size="18" :stroke-width="route.name === item.name ? 2.2 : 1.8" />
        <span v-if="!collapsed">{{ item.label }}</span>
        <span v-if="!collapsed && route.name === item.name" class="ml-auto size-1.5 rounded-full bg-forest" />
      </RouterLink>
    </nav>

    <div class="mt-auto">
      <div v-if="!collapsed" class="mb-5 rounded-2xl border border-[#e4e8df] bg-[#f2f5ee] p-4 [@media(max-height:800px)]:hidden">
        <div class="mb-3 flex size-8 items-center justify-center rounded-lg bg-white text-forest shadow-sm">
          <ShieldCheck :size="17" />
        </div>
        <div class="text-xs font-semibold text-[#425047]">只属于你的生活档案</div>
        <p class="mt-1.5 text-[11px] leading-5 text-[#879086]">完全离线，数据只留在这台设备，安心记录每一件拥有。</p>
        <RouterLink :to="{ name: 'data' }" class="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-forest hover:underline" @click="emit('navigate')">
          管理我的数据 <ArrowUpRight :size="12" />
        </RouterLink>
      </div>
      <div v-if="!collapsed" class="flex items-center gap-3 border-t border-line px-2 pt-5">
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium text-[#535b53]">{{ auth.currentUser?.displayName }}</div>
          <div class="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[10px] text-[#979d94]"><span class="size-1.5 shrink-0 rounded-full bg-[#6c9278]" />{{ auth.isAdmin ? '管理员' : '普通用户' }}</div>
        </div>
        <button class="icon-button shrink-0" :disabled="loggingOut" aria-label="退出当前账号" title="退出当前账号" @click="logout"><LoaderCircle v-if="loggingOut" :size="16" class="animate-spin" /><LogOut v-else :size="16" /></button>
      </div>
      <div v-else class="flex justify-center border-t border-line pt-4">
        <button class="icon-button" :disabled="loggingOut" :title="`退出当前账号（${auth.currentUser?.displayName}）`" aria-label="退出当前账号" @click="logout"><LoaderCircle v-if="loggingOut" :size="16" class="animate-spin" /><LogOut v-else :size="16" /></button>
      </div>
    </div>
  </aside>
</template>