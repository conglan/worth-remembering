import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authStatus, login as apiLogin, logout as apiLogout, register as apiRegister, updateProfile as apiUpdateProfile } from '../lib/api'
import type { User } from '../lib/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const hasUsers = ref(false)
  const initialized = ref(false)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')

  async function initialize() {
    try {
      const status = await authStatus()
      hasUsers.value = status.hasUsers
      currentUser.value = status.currentUser
    } finally {
      initialized.value = true
    }
  }

  async function register(username: string, displayName: string, password: string) {
    const user = await apiRegister(username, displayName, password)
    currentUser.value = user
    hasUsers.value = true
    return user
  }

  async function login(username: string, password: string) {
    currentUser.value = await apiLogin(username, password)
  }

  async function logout() {
    await apiLogout()
    currentUser.value = null
  }

  async function updateProfile(displayName: string) {
    currentUser.value = await apiUpdateProfile(displayName)
  }

  return { currentUser, hasUsers, initialized, isAdmin, initialize, register, login, logout, updateProfile }
})
