import type { AuthStatus, User } from '../types'
import { dbClear, dbDelete, dbGet, dbGetAll, dbPut, hashPassword, normalizeUsername, now, verifyPassword, type StoredUser } from './db'

const SESSION_KEY = 'current-user-id'

function toUser(stored: StoredUser): User {
  return {
    id: stored.id,
    username: stored.username,
    displayName: stored.displayName,
    role: stored.role,
    status: stored.status,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    lastLoginAt: stored.lastLoginAt,
  }
}

async function currentUserId(): Promise<string | null> {
  const record = await dbGet<{ key: string; value: string }>('session', SESSION_KEY)
  return record?.value ?? null
}

async function setCurrentUserId(id: string | null): Promise<void> {
  if (id === null) await dbDelete('session', SESSION_KEY)
  else await dbPut('session', { key: SESSION_KEY, value: id })
}

function validateCredentials(username: string, password: string): void {
  const trimmed = username.trim()
  const length = [...trimmed].length
  if (length < 3 || length > 32 || [...trimmed].some((character) => /\s/.test(character))) {
    throw new Error('用户名需为 3–32 个字符，且不能包含空格')
  }
  validatePassword(password)
}

function validatePassword(password: string): void {
  const length = [...password].length
  if (length < 8 || length > 128) throw new Error('密码需为 8–128 个字符')
}

function validateDisplayName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || [...trimmed].length > 30) throw new Error('显示名称需为 1–30 个字符')
  return trimmed
}

async function nextRole(): Promise<'admin' | 'user'> {
  const users = await dbGetAll<StoredUser>('users')
  return users.length === 0 ? 'admin' : 'user'
}

async function insertUser(username: string, displayName: string | undefined, password: string, role: 'admin' | 'user'): Promise<User> {
  const trimmed = username.trim()
  const normalized = normalizeUsername(trimmed)
  const existing = await dbGet<StoredUser>('usersByUsername', normalized)
  if (existing) throw new Error('用户名已存在')
  const timestamp = now()
  const stored: StoredUser = {
    id: crypto.randomUUID(),
    username: trimmed,
    normalizedUsername: normalized,
    displayName: validateDisplayName(displayName || trimmed),
    passwordHash: await hashPassword(password),
    role,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
  }
  await dbPut('users', stored)
  await dbPut('usersByUsername', stored)
  return toUser(stored)
}

export async function authStatus(): Promise<AuthStatus> {
  const users = await dbGetAll<StoredUser>('users')
  const id = await currentUserId()
  const current = id ? await dbGet<StoredUser>('users', id) : undefined
  return { hasUsers: users.length > 0, currentUser: current ? toUser(current) : null }
}

export async function register(username: string, displayName: string, password: string): Promise<User> {
  validateCredentials(username, password)
  const role = await nextRole()
  const user = await insertUser(username, displayName, password, role)
  await setCurrentUserId(user.id)
  return user
}

export async function login(username: string, password: string): Promise<User> {
  const stored = await dbGet<StoredUser>('usersByUsername', normalizeUsername(username))
  if (!stored || !(await verifyPassword(password, stored.passwordHash))) {
    throw new Error('用户名或密码不正确')
  }
  if (stored.status !== 'active') throw new Error('用户名或密码不正确，或账号已被禁用')
  const timestamp = now()
  stored.lastLoginAt = timestamp
  stored.updatedAt = timestamp
  await dbPut('users', stored)
  await dbPut('usersByUsername', stored)
  await setCurrentUserId(stored.id)
  return toUser(stored)
}

export async function logout(): Promise<void> {
  await setCurrentUserId(null)
}

export async function listUsers(): Promise<User[]> {
  const users = await dbGetAll<StoredUser>('users')
  return users.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toUser)
}

export async function createUser(username: string, displayName: string, password: string): Promise<User> {
  validateCredentials(username, password)
  return insertUser(username, displayName, password, 'user')
}

export async function setUserStatus(userId: string, status: string): Promise<void> {
  if (!['active', 'disabled'].includes(status)) throw new Error('用户状态不正确')
  const stored = await dbGet<StoredUser>('users', userId)
  if (!stored) throw new Error('用户不存在')
  stored.status = status as 'active' | 'disabled'
  stored.updatedAt = now()
  await dbPut('users', stored)
  await dbPut('usersByUsername', stored)
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  validatePassword(password)
  const stored = await dbGet<StoredUser>('users', userId)
  if (!stored) throw new Error('用户不存在')
  stored.passwordHash = await hashPassword(password)
  stored.updatedAt = now()
  await dbPut('users', stored)
  await dbPut('usersByUsername', stored)
}

export async function deleteUser(userId: string): Promise<void> {
  const stored = await dbGet<StoredUser>('users', userId)
  if (!stored) throw new Error('用户不存在')
  await dbDelete('users', userId)
  await dbDelete('usersByUsername', stored.normalizedUsername)
  // 清理该用户的资产数据
  const assets = await dbGetAll<{ id: string; userId: string }>('assets')
  for (const asset of assets) {
    if (asset.userId === userId) await dbDelete('assets', asset.id)
  }
}

export async function updateProfile(displayName: string): Promise<User> {
  const id = await currentUserId()
  if (!id) throw new Error('请先登录')
  const stored = await dbGet<StoredUser>('users', id)
  if (!stored) throw new Error('请先登录')
  stored.displayName = validateDisplayName(displayName)
  stored.updatedAt = now()
  await dbPut('users', stored)
  await dbPut('usersByUsername', stored)
  return toUser(stored)
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const id = await currentUserId()
  if (!id) throw new Error('请先登录')
  const stored = await dbGet<StoredUser>('users', id)
  if (!stored) throw new Error('请先登录')
  if (!(await verifyPassword(currentPassword, stored.passwordHash))) throw new Error('当前密码不正确')
  validatePassword(newPassword)
  stored.passwordHash = await hashPassword(newPassword)
  stored.updatedAt = now()
  await dbPut('users', stored)
  await dbPut('usersByUsername', stored)
}

/** 仅供测试或重置使用。 */
export async function clearAll(): Promise<void> {
  await dbClear('users')
  await dbClear('usersByUsername')
  await dbClear('assets')
  await dbClear('session')
}