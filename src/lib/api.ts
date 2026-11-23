import { invoke } from '@tauri-apps/api/core'
import type { Asset, AuthStatus, StorageSettings, User } from './types'

/**
 * 统一后端调用入口。
 *
 * 在 Tauri 桌面环境中走原生 `invoke`；在浏览器（Web 调试 / PWA）中走
 * `src/lib/web/` 下的 IndexedDB 实现，使 UI 与功能无需编译 Rust 即可调试。
 */

export const isTauri = typeof window === 'undefined' || '__TAURI_INTERNALS__' in window

// ---------------------------------------------------------------------------
// 认证
// ---------------------------------------------------------------------------

export function authStatus(): Promise<AuthStatus> {
  if (isTauri) return invoke<AuthStatus>('auth_status')
  return import('./web/auth').then((module) => module.authStatus())
}

export function register(username: string, displayName: string, password: string): Promise<User> {
  if (isTauri) return invoke<User>('register', { username, displayName, password })
  return import('./web/auth').then((module) => module.register(username, displayName, password))
}

export function login(username: string, password: string): Promise<User> {
  if (isTauri) return invoke<User>('login', { username, password })
  return import('./web/auth').then((module) => module.login(username, password))
}

export function logout(): Promise<void> {
  if (isTauri) return invoke<void>('logout')
  return import('./web/auth').then((module) => module.logout())
}

export function listUsers(): Promise<User[]> {
  if (isTauri) return invoke<User[]>('list_users')
  return import('./web/auth').then((module) => module.listUsers())
}

export function createUser(username: string, displayName: string, password: string): Promise<User> {
  if (isTauri) return invoke<User>('create_user', { username, displayName, password })
  return import('./web/auth').then((module) => module.createUser(username, displayName, password))
}

export function setUserStatus(userId: string, status: string): Promise<void> {
  if (isTauri) return invoke<void>('set_user_status', { userId, status })
  return import('./web/auth').then((module) => module.setUserStatus(userId, status))
}

export function resetUserPassword(userId: string, password: string): Promise<void> {
  if (isTauri) return invoke<void>('reset_user_password', { userId, password })
  return import('./web/auth').then((module) => module.resetUserPassword(userId, password))
}

export function deleteUser(userId: string): Promise<void> {
  if (isTauri) return invoke<void>('delete_user', { userId })
  return import('./web/auth').then((module) => module.deleteUser(userId))
}

export function updateProfile(displayName: string): Promise<User> {
  if (isTauri) return invoke<User>('update_profile', { displayName })
  return import('./web/auth').then((module) => module.updateProfile(displayName))
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (isTauri) return invoke<void>('change_password', { currentPassword, newPassword })
  return import('./web/auth').then((module) => module.changePassword(currentPassword, newPassword))
}

// ---------------------------------------------------------------------------
// 资产
// ---------------------------------------------------------------------------

export function listAssets(): Promise<Asset[]> {
  if (isTauri) return invoke<Asset[]>('list_assets')
  return import('./web/assets').then((module) => module.listAssets())
}

export function saveAsset(asset: Asset): Promise<void> {
  if (isTauri) return invoke<void>('save_asset', { asset })
  return import('./web/assets').then((module) => module.saveAsset(asset))
}

export function replaceAssets(assets: Asset[]): Promise<void> {
  if (isTauri) return invoke<void>('replace_assets', { assets })
  return import('./web/assets').then((module) => module.replaceAssets(assets))
}

export function appendAssets(assets: Asset[]): Promise<void> {
  if (isTauri) return invoke<void>('append_assets', { assets })
  return import('./web/assets').then((module) => module.appendAssets(assets))
}

export function deleteAsset(id: string): Promise<void> {
  if (isTauri) return invoke<void>('delete_asset', { id })
  return import('./web/assets').then((module) => module.deleteAsset(id))
}

// ---------------------------------------------------------------------------
// 图片
// ---------------------------------------------------------------------------

export function saveAssetImage(assetId: string, dataUrl: string): Promise<string> {
  if (isTauri) return invoke<string>('save_asset_image', { assetId, dataUrl })
  return import('./web/assets').then((module) => module.saveAssetImage(assetId, dataUrl))
}

export function normalizeAssetImage(assetId: string, path: string): Promise<string> {
  if (isTauri) return invoke<string>('normalize_asset_image', { assetId, path })
  return import('./web/assets').then((module) => module.normalizeAssetImage(assetId, path))
}

export function readAssetImage(path: string): Promise<string> {
  if (isTauri) return invoke<string>('read_asset_image', { path })
  return import('./web/assets').then((module) => module.readAssetImage(path))
}

// ---------------------------------------------------------------------------
// 备份与存储设置
// ---------------------------------------------------------------------------

export function saveBackup(path: string, contentBase64: string): Promise<void> {
  if (isTauri) return invoke<void>('save_backup', { path, contentBase64 })
  return import('./web/files').then((module) => module.saveBackup(path, contentBase64))
}

export function getStorageSettings(): Promise<StorageSettings> {
  if (isTauri) return invoke<StorageSettings>('get_storage_settings')
  return import('./web/files').then((module) => module.getStorageSettings())
}

export function updateStorageSettings(databaseRoot: string, imageRoot: string): Promise<StorageSettings> {
  if (isTauri) return invoke<StorageSettings>('update_storage_settings', { databaseRoot, imageRoot })
  return import('./web/files').then((module) => module.updateStorageSettings(databaseRoot, imageRoot))
}

export function restartApp(): Promise<void> {
  if (isTauri) return invoke<void>('restart_app')
  return import('./web/files').then((module) => module.restartApp())
}