<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { changePassword as apiChangePassword, isTauri } from '../lib/api'
import { FolderOpen, HardDrive, KeyRound, LoaderCircle, LogOut, Save, Settings2, ShieldCheck, UserRound } from 'lucide-vue-next'
import PasswordInput from '../components/PasswordInput.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { getStorageSettings, restartApp, updateStorageSettings } from '../lib/storage'
import type { StorageSettings } from '../lib/types'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
const displayName = ref(auth.currentUser?.displayName || '')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const storage = ref<StorageSettings | null>(null)
const databaseRoot = ref('')
const imageRoot = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)
const savingRoot = ref(false)
const restartOpen = ref(false)
const restarting = ref(false)
const loggingOut = ref(false)
const rootsChanged = computed(() => !!storage.value && (databaseRoot.value !== storage.value.databaseRoot || imageRoot.value !== storage.value.imageRoot))
const stripTrailingSlash = (value: string) => value.replace(/[\\/]+$/, '')
const userDatabaseFile = computed(() => storage.value && auth.currentUser ? `${stripTrailingSlash(storage.value.activeDatabaseRoot)}/users/${auth.currentUser.id}/assets.db` : '')
const userImageDirectory = computed(() => storage.value && auth.currentUser ? `${stripTrailingSlash(storage.value.activeImageRoot)}/users/${auth.currentUser.id}/images` : '')

onMounted(loadStorage)
async function loadStorage() {
  try {
    storage.value = await getStorageSettings()
    databaseRoot.value = storage.value.databaseRoot
    imageRoot.value = storage.value.imageRoot
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
}

async function saveProfile() {
  savingProfile.value = true
  try { await auth.updateProfile(displayName.value); ui.toast('个人资料已更新') }
  catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { savingProfile.value = false }
}

async function changePassword() {
  if (newPassword.value !== confirmPassword.value) { ui.toast('两次输入的新密码不一致', 'error'); return }
  savingPassword.value = true
  try {
    await apiChangePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
    ui.toast('密码已修改，下次登录请使用新密码')
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { savingPassword.value = false }
}

async function chooseDatabaseRoot() {
  if (!isTauri) return
  const { open: openDirectory } = await import('@tauri-apps/plugin-dialog')
  const path = await openDirectory({ directory: true, defaultPath: databaseRoot.value || undefined, title: '选择数据库存放目录' })
  if (path) databaseRoot.value = path
}

async function chooseImageRoot() {
  if (!isTauri) return
  const { open: openDirectory } = await import('@tauri-apps/plugin-dialog')
  const path = await openDirectory({ directory: true, defaultPath: imageRoot.value || undefined, title: '选择图片存放目录' })
  if (path) imageRoot.value = path
}

function resetRoots() {
  if (!storage.value) return
  databaseRoot.value = storage.value.defaultDatabaseRoot
  imageRoot.value = storage.value.defaultImageRoot
}

async function saveRoots() {
  savingRoot.value = true
  try {
    storage.value = await updateStorageSettings(databaseRoot.value, imageRoot.value)
    databaseRoot.value = storage.value.databaseRoot
    imageRoot.value = storage.value.imageRoot
    if (storage.value.restartRequired) {
      ui.toast('数据库与图片已复制到新目录，重启后生效')
      restartOpen.value = true
    } else {
      ui.toast('数据库与图片目录未发生变化')
    }
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { savingRoot.value = false }
}

async function confirmRestart() {
  restarting.value = true
  try { await restartApp() }
  catch (error) {
    restarting.value = false
    restartOpen.value = false
    ui.toast(error instanceof Error ? error.message : String(error), 'error')
  }
}

async function logout() {
  loggingOut.value = true
  try { await auth.logout() }
  catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error'); loggingOut.value = false }
}
</script>

<template>
  <div class="mx-auto max-w-[1200px] px-4 pt-6 pb-6 sm:px-6 md:px-8 md:pt-7">
    <header class="mb-6"><div class="eyebrow mb-2.5">SETTINGS · 设置管理</div><h1 class="text-[30px] font-semibold tracking-[-0.04em]">账号与存储设置</h1><p class="mt-2 text-[13px] text-[#8a9287]">管理当前账号资料、安全选项和本地数据位置。</p></header>

    <div class="grid gap-5 lg:grid-cols-2">
      <section class="panel p-5">
        <div class="flex items-center gap-3"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><UserRound :size="19" /></span><div><h2 class="text-sm font-semibold">个人资料</h2><p class="mt-1 text-[10px] text-[#9aa195]">@{{ auth.currentUser?.username }} · {{ auth.isAdmin ? '管理员' : '普通用户' }}</p></div></div>
        <form class="mt-5" @submit.prevent="saveProfile"><label class="field-label">显示名称</label><input v-model="displayName" class="field-input" required maxlength="30" /><button class="btn-primary mt-4 w-full" :disabled="savingProfile || displayName === auth.currentUser?.displayName"><LoaderCircle v-if="savingProfile" :size="15" class="animate-spin" /><Save v-else :size="15" />保存资料</button></form>
      </section>

      <section class="panel p-5">
        <div class="flex items-center gap-3"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><KeyRound :size="19" /></span><div><h2 class="text-sm font-semibold">修改密码</h2><p class="mt-1 text-[10px] text-[#9aa195]">密码使用 Argon2 哈希保存在本机</p></div></div>
        <form class="mt-5 space-y-3" @submit.prevent="changePassword"><PasswordInput v-model="currentPassword" required placeholder="当前密码" autocomplete="current-password" aria-label="当前密码" /><div class="grid gap-3 sm:grid-cols-2"><PasswordInput v-model="newPassword" required minlength="8" maxlength="128" placeholder="新密码，至少 8 位" autocomplete="new-password" aria-label="新密码" /><PasswordInput v-model="confirmPassword" required minlength="8" maxlength="128" placeholder="确认新密码" autocomplete="new-password" aria-label="确认新密码" /></div><button class="btn-primary w-full" :disabled="savingPassword"><LoaderCircle v-if="savingPassword" :size="15" class="animate-spin" /><ShieldCheck v-else :size="15" />更新密码</button></form>
      </section>
    </div>

    <section v-if="auth.isAdmin" class="panel mt-5 overflow-hidden">
      <div class="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <span class="flex size-9 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><HardDrive :size="17" /></span>
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5"><h2 class="text-sm font-semibold">数据库与图片位置</h2><p class="text-[10px] text-[#9aa195]">仅管理员可见，每位用户的数据仍独立存放</p></div>
      </div>
      <div class="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div class="flex flex-col gap-3">
          <div class="rounded-xl bg-[#f5f7f2] p-3">
            <div class="text-[10px] font-medium text-[#899283]">{{ storage?.restartRequired ? '重启前仍在使用的数据库文件' : '当前账号数据库文件' }}</div>
            <div class="mt-1 break-all font-mono text-[10px] leading-4 text-[#59645a]">{{ userDatabaseFile || '正在读取…' }}</div>
            <div class="mt-2.5 border-t border-[#e6e9e1] pt-2.5 text-[10px] font-medium text-[#899283]">{{ storage?.restartRequired ? '重启前仍在使用的图片目录' : '当前账号图片目录' }}</div>
            <div class="mt-1 break-all font-mono text-[10px] leading-4 text-[#59645a]">{{ userImageDirectory || '正在读取…' }}</div>
          </div>
          <div class="flex items-start gap-2 text-[10px] leading-4 text-[#929b8e]"><Settings2 :size="13" class="mt-0.5 shrink-0" />每位用户使用自己的 UUID 子目录；图片在数据库中只保存文件名。</div>
        </div>
        <div>
          <div class="mb-1.5 flex items-baseline justify-between gap-2"><label class="field-label !mb-0">数据库存放目录</label><span class="text-[9px] text-[#a0a79d]">系统库与各用户 assets.db</span></div>
          <div class="flex gap-2"><input v-model="databaseRoot" class="field-input min-w-0 flex-1 font-mono !text-[11px]" placeholder="例如：D:\worth-remembering-databases" /><button class="btn-secondary shrink-0 !px-3" aria-label="选择数据库存放目录" @click="chooseDatabaseRoot"><FolderOpen :size="17" /></button></div>
          <div class="mt-3 mb-1.5 flex items-baseline justify-between gap-2"><label class="field-label !mb-0">图片存放目录</label><span class="text-[9px] text-[#a0a79d]">按用户 ID 分目录保存</span></div>
          <div class="flex gap-2"><input v-model="imageRoot" class="field-input min-w-0 flex-1 font-mono !text-[11px]" placeholder="例如：D:\worth-remembering-images" /><button class="btn-secondary shrink-0 !px-3" aria-label="选择图片存放目录" @click="chooseImageRoot"><FolderOpen :size="17" /></button></div>
          <div v-if="storage?.restartRequired" class="mt-3 flex items-center gap-2 rounded-lg bg-[#faf3e6] px-3 py-2 text-[10px] leading-4 text-[#987743]"><span class="min-w-0 flex-1">已保存并复制完成，重启应用后切换到新目录。</span><button class="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#987743] px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-60" :disabled="restarting" @click="confirmRestart"><LoaderCircle v-if="restarting" :size="12" class="animate-spin" />重启生效</button></div>
          <div class="mt-3 flex gap-2"><button class="btn-secondary flex-1 text-xs" @click="resetRoots">恢复默认路径</button><button class="btn-primary flex-1 text-xs" :disabled="savingRoot || !databaseRoot.trim() || !imageRoot.trim() || !rootsChanged" @click="saveRoots"><LoaderCircle v-if="savingRoot" :size="15" class="animate-spin" /><Save v-else :size="15" />保存并复制</button></div>
        </div>
      </div>
    </section>

    <section class="panel mt-5 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="text-sm font-semibold">退出当前账号</h2><p class="mt-1.5 text-[10px] text-[#969e92]">退出后返回登录页，其他账号的数据不会出现在当前清单中。</p></div><button class="btn-secondary shrink-0 border-[#ead6d0] text-[#a55a4e] hover:bg-[#fcf4f2]" :disabled="loggingOut" @click="logout"><LoaderCircle v-if="loggingOut" :size="15" class="animate-spin" /><LogOut v-else :size="15" />退出登录</button></section>
    <p v-if="storage && auth.isAdmin" class="mt-4 break-all px-1 text-[9px] leading-4 text-[#a0a79d]">全局设置文件：{{ storage.settingsPath }}</p>

    <ConfirmDialog :open="restartOpen" title="重启应用以切换存储目录" description="新目录已复制完成。重启后应用将从新路径读取数据库和图片，需要重新登录，现在重启吗？" confirm-text="立即重启" :loading="restarting" @cancel="restartOpen = false" @confirm="confirmRestart" />
  </div>
</template>
