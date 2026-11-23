import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const DashboardView = () => import('./views/DashboardView.vue')
const AssetsView = () => import('./views/AssetsView.vue')
const InsightsView = () => import('./views/InsightsView.vue')
const DataView = () => import('./views/DataView.vue')
const UsersView = () => import('./views/UsersView.vue')
const SettingsView = () => import('./views/SettingsView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { title: '资产总览' } },
    { path: '/assets', name: 'assets', component: AssetsView, meta: { title: '我的资产' } },
    { path: '/insights', name: 'insights', component: InsightsView, meta: { title: '成本洞察' } },
    { path: '/data', name: 'data', component: DataView, meta: { title: '数据管理' } },
    { path: '/users', name: 'users', component: UsersView, meta: { title: '用户管理', admin: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { title: '设置管理', admin: true } },
  ],
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' }
})

router.afterEach((to) => {
  document.title = `${to.meta.title || '资产管理'} · 值得记`
})
