<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createUser as apiCreateUser, deleteUser as apiDeleteUser, listUsers as apiListUsers, resetUserPassword as apiResetUserPassword, setUserStatus as apiSetUserStatus } from '../lib/api'
import { KeyRound, LoaderCircle, ShieldCheck, Trash2, UserCheck, UserPlus, UserRound, UserX, UsersRound, X } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PasswordInput from '../components/PasswordInput.vue'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import type { User, UserStatus } from '../lib/types'

const auth = useAuthStore()
const ui = useUiStore()
const users = ref<User[]>([])
const loading = ref(true)
const processing = ref(false)
const createOpen = ref(false)
const username = ref('')
const displayName = ref('')
const password = ref('')
const resetTarget = ref<User | null>(null)
const resetPassword = ref('')
const deleteTarget = ref<User | null>(null)

onMounted(loadUsers)

async function loadUsers() {
  loading.value = true
  try { users.value = await apiListUsers() }
  catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { loading.value = false }
}

async function createUser() {
  processing.value = true
  try {
    await apiCreateUser(username.value, displayName.value || username.value, password.value)
    createOpen.value = false
    username.value = ''; displayName.value = ''; password.value = ''
    await loadUsers()
    ui.toast('用户已创建，独立数据目录已就绪')
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { processing.value = false }
}

async function changeStatus(user: User) {
  const status: UserStatus = user.status === 'active' ? 'disabled' : 'active'
  processing.value = true
  try {
    await apiSetUserStatus(user.id, status)
    user.status = status
    ui.toast(status === 'active' ? '账号已启用' : '账号已禁用')
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { processing.value = false }
}

async function submitReset() {
  if (!resetTarget.value) return
  processing.value = true
  try {
    await apiResetUserPassword(resetTarget.value.id, resetPassword.value)
    ui.toast(`已重设「${resetTarget.value.displayName}」的密码`)
    resetTarget.value = null; resetPassword.value = ''
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { processing.value = false }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  processing.value = true
  try {
    await apiDeleteUser(deleteTarget.value.id)
    ui.toast('用户已删除，其资产目录已归档保留')
    deleteTarget.value = null
    await loadUsers()
  } catch (error) { ui.toast(error instanceof Error ? error.message : String(error), 'error') }
  finally { processing.value = false }
}
</script>

<template>
  <div class="mx-auto max-w-[1500px] px-4 pt-7 pb-8 sm:px-6 md:px-8 md:pt-9">
    <header class="mb-7 flex items-end justify-between gap-5">
      <div><div class="eyebrow mb-2.5">USER MANAGEMENT · 用户管理</div><h1 class="text-[30px] font-semibold tracking-[-0.04em]">每个账号，都有独立空间</h1><p class="mt-2 text-[13px] text-[#8a9287]">管理此设备上的本地用户，资产数据库与图片目录互不相通。</p></div>
      <button class="btn-primary shrink-0" @click="createOpen = true"><UserPlus :size="17" />新增用户</button>
    </header>

    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      <div class="panel flex items-center gap-4 p-5"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><UsersRound :size="19" /></span><div><div class="text-2xl font-semibold tabular">{{ users.length }}</div><div class="mt-1 text-[10px] text-[#929a8e]">全部本地用户</div></div></div>
      <div class="panel flex items-center gap-4 p-5"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><UserCheck :size="19" /></span><div><div class="text-2xl font-semibold tabular">{{ users.filter(user => user.status === 'active').length }}</div><div class="mt-1 text-[10px] text-[#929a8e]">正常使用的账号</div></div></div>
      <div class="panel flex items-center gap-4 p-5"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><ShieldCheck :size="19" /></span><div><div class="text-2xl font-semibold tabular">{{ users.filter(user => user.role === 'admin').length }}</div><div class="mt-1 text-[10px] text-[#929a8e]">管理员</div></div></div>
    </div>

    <section class="panel overflow-hidden">
      <div class="border-b border-line px-6 py-5"><h2 class="text-sm font-semibold">本地用户列表</h2><p class="mt-1 text-[10px] text-[#9aa195]">删除用户不会直接删除其资产文件，数据目录会移入 deleted-users。</p></div>
      <div v-if="loading" class="flex h-48 items-center justify-center text-[#8d9788]"><LoaderCircle :size="22" class="animate-spin" /></div>
      <div v-else class="divide-y divide-line">
        <div v-for="user in users" :key="user.id" class="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#edf1e9] text-sm font-semibold text-forest">{{ user.displayName.slice(0, 1).toUpperCase() }}</span>
          <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="text-sm font-semibold">{{ user.displayName }}</span><span class="rounded-full px-2 py-0.5 text-[9px]" :class="user.role === 'admin' ? 'bg-[#e7eee3] text-forest' : 'bg-[#f0f1ed] text-[#81897d]'">{{ user.role === 'admin' ? '管理员' : '普通用户' }}</span><span class="rounded-full px-2 py-0.5 text-[9px]" :class="user.status === 'active' ? 'bg-[#edf5ea] text-[#5f7c60]' : 'bg-[#f3eeeb] text-[#a06a5d]'">{{ user.status === 'active' ? '正常' : '已禁用' }}</span></div><div class="mt-1.5 text-[11px] text-[#91998d]">@{{ user.username }}<span v-if="user.id === auth.currentUser?.id" class="ml-2 text-forest">当前账号</span></div></div>
          <div class="text-[10px] leading-5 text-[#9aa195] lg:w-40"><div>创建于 {{ user.createdAt.slice(0, 10) }}</div><div>最近登录 {{ user.lastLoginAt || '尚未登录' }}</div></div>
          <div class="flex flex-wrap items-center gap-2">
            <button class="btn-secondary h-9 !px-3 text-[11px]" @click="resetTarget = user"><KeyRound :size="14" />重设密码</button>
            <button class="btn-secondary h-9 !px-3 text-[11px]" :disabled="user.id === auth.currentUser?.id || processing" @click="changeStatus(user)"><UserCheck v-if="user.status === 'disabled'" :size="14" /><UserX v-else :size="14" />{{ user.status === 'active' ? '禁用' : '启用' }}</button>
            <button class="icon-button text-[#a55a4e] hover:bg-[#fbefec]" :disabled="user.id === auth.currentUser?.id || processing" :aria-label="`删除 ${user.displayName}`" @click="deleteTarget = user"><Trash2 :size="16" /></button>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body"><Transition name="modal"><div v-if="createOpen" class="fixed inset-0 z-[70] flex items-center justify-center bg-[#17261d]/35 p-5 backdrop-blur-[3px]" @click.self="createOpen = false"><form class="modal-panel w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="新增用户" @submit.prevent="createUser"><div class="flex items-start justify-between"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><UserPlus :size="19" /></span><button type="button" class="icon-button" aria-label="关闭" @click="createOpen = false"><X :size="18" /></button></div><h2 class="mt-4 text-lg font-semibold">新增普通用户</h2><p class="mt-2 text-xs text-[#8d9689]">创建后会自动建立独立数据库与图片目录。</p><div class="mt-6 space-y-4"><div><label class="field-label">显示名称</label><input v-model="displayName" class="field-input" maxlength="30" placeholder="例如：小林" /></div><div><label class="field-label">用户名</label><input v-model.trim="username" class="field-input" required minlength="3" maxlength="32" placeholder="3–32 个字符，不含空格" /></div><div><label class="field-label">初始密码</label><PasswordInput v-model="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="至少 8 个字符" aria-label="初始密码" /></div></div><button class="btn-primary mt-6 w-full" :disabled="processing"><LoaderCircle v-if="processing" :size="15" class="animate-spin" /><UserRound v-else :size="15" />创建用户</button></form></div></Transition></Teleport>
    <Teleport to="body"><Transition name="modal"><div v-if="resetTarget" class="fixed inset-0 z-[70] flex items-center justify-center bg-[#17261d]/35 p-5 backdrop-blur-[3px]" @click.self="resetTarget = null"><form class="modal-panel w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="重设密码" @submit.prevent="submitReset"><div class="flex items-start justify-between"><span class="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-forest"><KeyRound :size="19" /></span><button type="button" class="icon-button" aria-label="关闭" @click="resetTarget = null"><X :size="18" /></button></div><h2 class="mt-4 text-lg font-semibold">重设「{{ resetTarget.displayName }}」的密码</h2><p class="mt-2 text-xs leading-5 text-[#8d9689]">新密码立即生效，请线下告知该用户。</p><label class="field-label mt-6">新密码</label><PasswordInput v-model="resetPassword" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="至少 8 个字符" aria-label="新密码" /><button class="btn-primary mt-6 w-full" :disabled="processing"><LoaderCircle v-if="processing" :size="15" class="animate-spin" />确认重设</button></form></div></Transition></Teleport>
    <ConfirmDialog :open="!!deleteTarget" title="删除这个用户？" :description="`「${deleteTarget?.displayName || ''}」将无法再登录。其数据库和图片会移入 deleted-users 目录保留，不会直接删除。`" confirm-text="确认删除" danger :loading="processing" @cancel="deleteTarget = null" @confirm="confirmDelete" />
  </div>
</template>
