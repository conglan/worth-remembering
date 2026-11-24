<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight, Check, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-vue-next'
import PasswordInput from '../components/PasswordInput.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const mode = ref<'login' | 'register'>(auth.hasUsers ? 'login' : 'register')
const username = ref('')
const displayName = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const error = ref('')
const registering = computed(() => mode.value === 'register')

watch(() => auth.hasUsers, (hasUsers) => {
  if (!hasUsers) mode.value = 'register'
})
watch(mode, () => { error.value = '' })

async function submit() {
  error.value = ''
  if (registering.value && password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  submitting.value = true
  try {
    if (registering.value) await auth.register(username.value, displayName.value || username.value, password.value)
    else await auth.login(username.value, password.value)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="grid min-h-dvh bg-[#f4f6f1] lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
    <section class="relative hidden overflow-hidden bg-forest p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div class="absolute -top-32 -right-32 size-[420px] rounded-full border border-white/10" />
      <div class="absolute -right-16 -bottom-40 size-[520px] rounded-full border border-white/10" />
      <div class="relative flex items-center gap-3">
        <span class="flex size-11 items-center justify-center rounded-[14px] bg-white/10"><Sparkles :size="21" /></span>
        <div><div class="text-xl font-semibold tracking-[0.12em]">值得记</div><div class="mt-1 text-[8px] tracking-[0.2em] text-white/50">WORTH REMEMBERING</div></div>
      </div>
      <div class="relative max-w-[480px]">
        <div class="eyebrow !text-white/45">PRIVATE · LOCAL · YOURS</div>
        <h1 class="mt-5 text-[42px] leading-[1.25] font-semibold tracking-[-0.04em]">各自珍藏，<br />各自的生活档案。</h1>
        <p class="mt-6 text-sm leading-7 text-white/60">在同一个桌面应用里，为每位使用者保留独立空间。资产、图片与备份彼此隔离，只在本机保存。</p>
        <div class="mt-10 space-y-4">
          <div class="flex items-center gap-3 text-xs text-white/75"><span class="flex size-8 items-center justify-center rounded-lg bg-white/10"><UsersRound :size="16" /></span>独立账号与独立资产数据库</div>
          <div class="flex items-center gap-3 text-xs text-white/75"><span class="flex size-8 items-center justify-center rounded-lg bg-white/10"><ShieldCheck :size="16" /></span>Argon2 密码哈希与本地权限隔离</div>
        </div>
      </div>
      <p class="relative text-[10px] tracking-wide text-white/35">每一件值得，都有迹可循。</p>
    </section>

    <section class="flex items-center justify-center px-5 pt-[calc(2.5rem+var(--safe-top))] pb-[calc(2.5rem+var(--safe-bottom))] sm:px-10">
      <div class="w-full max-w-[430px]">
        <div class="mb-8 flex items-center gap-3 lg:hidden"><span class="flex size-10 items-center justify-center rounded-xl bg-forest text-white"><Sparkles :size="19" /></span><span class="text-xl font-semibold tracking-[0.12em]">值得记</span></div>
        <div class="eyebrow mb-3">{{ registering ? 'CREATE YOUR SPACE' : 'WELCOME BACK' }}</div>
        <h2 class="text-[30px] font-semibold tracking-[-0.035em]">{{ registering ? (auth.hasUsers ? '创建独立账号' : '创建管理员账号') : '登录你的生活档案' }}</h2>
        <p class="mt-2.5 text-[13px] leading-6 text-[#8a9287]">{{ registering ? (auth.hasUsers ? '注册后即可记录只属于你的资产。' : '这是第一个账号，将自动获得用户与存储管理权限。') : '使用本地账号继续，数据不会离开这台设备。' }}</p>

        <div v-if="auth.hasUsers" class="mt-7 flex rounded-xl bg-[#e9ede5] p-1">
          <button class="h-9 flex-1 rounded-lg text-xs font-medium transition-all" :class="!registering ? 'bg-white text-forest shadow-sm' : 'text-[#828b7e]'" @click="mode = 'login'">登录</button>
          <button class="h-9 flex-1 rounded-lg text-xs font-medium transition-all" :class="registering ? 'bg-white text-forest shadow-sm' : 'text-[#828b7e]'" @click="mode = 'register'">注册新账号</button>
        </div>

        <form class="mt-7 space-y-5" @submit.prevent="submit">
          <div v-if="registering"><label class="field-label" for="display-name">显示名称</label><div class="relative"><UserRound :size="16" class="absolute top-3.5 left-3.5 text-[#96a091]" /><input id="display-name" v-model="displayName" class="field-input !pl-10" placeholder="例如：小林" maxlength="30" autocomplete="nickname" /></div></div>
          <div><label class="field-label" for="username">用户名</label><div class="relative"><UserRound :size="16" class="absolute top-3.5 left-3.5 text-[#96a091]" /><input id="username" v-model.trim="username" class="field-input !pl-10" placeholder="3–32 个字符，不含空格" required minlength="3" maxlength="32" autocomplete="username" /></div></div>
          <div><label class="field-label" for="password">密码</label><PasswordInput id="password" v-model="password" placeholder="至少 8 个字符" required minlength="8" maxlength="128" :autocomplete="registering ? 'new-password' : 'current-password'"><template #icon><LockKeyhole :size="16" class="absolute top-3.5 left-3.5 text-[#96a091]" /></template></PasswordInput></div>
          <div v-if="registering"><label class="field-label" for="confirm-password">确认密码</label><PasswordInput id="confirm-password" v-model="confirmPassword" placeholder="再次输入密码" required minlength="8" maxlength="128" autocomplete="new-password"><template #icon><KeyRound :size="16" class="absolute top-3.5 left-3.5 text-[#96a091]" /></template></PasswordInput></div>
          <p v-if="error" class="rounded-xl bg-[#fbefec] px-4 py-3 text-xs leading-5 text-[#a55347]" role="alert">{{ error }}</p>
          <button class="btn-primary w-full" :disabled="submitting"><LoaderCircle v-if="submitting" :size="16" class="animate-spin" /><Check v-else-if="registering" :size="16" /><ArrowRight v-else :size="16" />{{ submitting ? '请稍候' : registering ? (auth.hasUsers ? '注册并进入' : '创建管理员并进入') : '登录' }}</button>
        </form>
        <p class="mt-7 text-center text-[10px] leading-5 text-[#9ca398]">本地账号仅用于隔离此设备上的数据，不会连接外部服务。</p>
      </div>
    </section>
  </main>
</template>
