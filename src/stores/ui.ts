import { ref } from 'vue'
import { defineStore } from 'pinia'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export const useUiStore = defineStore('ui', () => {
  const formOpen = ref(false)
  const editingId = ref<string | null>(null)
  const detailsId = ref<string | null>(null)
  const mobileNavOpen = ref(false)
  const sidebarCollapsed = ref(window.localStorage.getItem('worth-remembering:sidebar-collapsed') === '1')
  const toasts = ref<Toast[]>([])
  let toastId = 0

  function openForm(id?: string) {
    detailsId.value = null
    editingId.value = id || null
    formOpen.value = true
  }

  function closeForm() {
    formOpen.value = false
    editingId.value = null
  }

  function openDetails(id: string) {
    detailsId.value = id
  }

  function toast(message: string, type: Toast['type'] = 'success') {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    window.setTimeout(() => dismissToast(id), 3200)
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    window.localStorage.setItem('worth-remembering:sidebar-collapsed', sidebarCollapsed.value ? '1' : '0')
  }

  return { formOpen, editingId, detailsId, mobileNavOpen, sidebarCollapsed, toasts, openForm, closeForm, openDetails, toggleSidebar, toast, dismissToast }
})
