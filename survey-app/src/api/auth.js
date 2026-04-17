import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import {
  clearStoredTokens,
  clearStoredUser,
  getStoredTokens,
  saveStoredTokens,
  saveStoredUser,
} from '../lib/tokenStorage.js'
import { ApiError } from '../lib/apiError.js'

const LOCAL_AUTH_FALLBACK_ENABLED = import.meta.env.VITE_LOCAL_AUTH_FALLBACK !== 'false'

function shouldUseLocalFallback(error) {
  if (!LOCAL_AUTH_FALLBACK_ENABLED) {
    return false
  }

  if (error instanceof ApiError) {
    return [404, 405, 501].includes(error.status)
  }

  return error instanceof TypeError
}

function buildLocalSession(data = {}) {
  const email = String(data.email || '').trim()
  const name = String(data.name || data.userName || '').trim() || email.split('@')[0] || 'Пользователь'

  return {
    accessToken: `local_${Date.now()}`,
    refreshToken: '',
    user: {
      id: 'local_user',
      name,
      email,
    },
  }
}

function extractAccessToken(payload) {
  if (typeof payload === 'string') {
    return payload
  }

  return payload?.accessToken || payload?.token || payload?.jwt || ''
}

function extractRefreshToken(payload) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  return payload.refreshToken || ''
}

function extractUser(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  return payload.user || payload.profile || null
}

function saveSession(payload) {
  const previousTokens = getStoredTokens()

  const accessToken = extractAccessToken(payload)
  const refreshToken = extractRefreshToken(payload) || previousTokens.refreshToken
  const user = extractUser(payload)

  if (!accessToken) {
    throw new Error('Сервер не вернул токен.')
  }

  saveStoredTokens({ accessToken, refreshToken })

  if (user) {
    saveStoredUser(user)
  }

  return {
    accessToken,
    refreshToken,
    user,
  }
}

export async function registerUser(data) {
  try {
    const payload = await request(ENDPOINTS.authRegister, {
      method: 'POST',
      auth: false,
      body: data,
    })

    return saveSession(payload)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    return saveSession(buildLocalSession(data))
  }
}

export async function loginUser(data) {
  try {
    const payload = await request(ENDPOINTS.authLogin, {
      method: 'POST',
      auth: false,
      body: data,
    })

    return saveSession(payload)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    return saveSession(buildLocalSession(data))
  }
}

export async function logoutUser() {
  try {
    await request(ENDPOINTS.authLogout, {
      method: 'POST',
      body: {},
    })
  } catch {
    // Logout should still clear local state even if server request fails.
  }

  clearStoredTokens()
  clearStoredUser()
}

