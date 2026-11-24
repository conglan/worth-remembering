import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const MobileDashboard = () => import('./views/MobileDashboardView.vue')
const MobileAssets = () => import('./views/MobileAssetsView.vue')
const MobileInsights = () => import('./views/MobileInsightsView.vue')
const MobileData = () => import('./views/MobileDataView.vue')
const UsersView = () => import('../views/UsersView.vue')
const SettingsView = () => import('../views/SettingsView.vue')

export const mobileRouter = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: MobileDashboard, meta: { title: '资产总览' } },
    { path: '/assets', name: 'assets', component: MobileAssets, meta: { title: '我的资产' } },
    { path: '/insights', name: 'insights', component: MobileInsights, meta: { title: '成本洞察' } },
    { path: '/data', name: 'data', component: MobileData, meta: { title: '数据管理' } },
    { path: '/users', name: 'users', component: UsersView, meta: { title: '用户管理', admin: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { title: '设置管理', admin: true } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

mobileRouter.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' }
})

mobileRouter.afterEach((to) => {
  document.title = `${to.meta.title || '资产管理'} · 值得记`
})