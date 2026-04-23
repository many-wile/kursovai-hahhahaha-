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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function buildFallbackUser(data = {}) {
  const email = String(data.email || '').trim()
  const normalizedEmail = normalizeEmail(email)
  const explicitName = String(data.name || data.userName || '').trim()
  const fallbackName = normalizedEmail.split('@')[0] || 'User'

  return {
    id: normalizedEmail || `local_${Date.now()}`,
    name: explicitName || fallbackName,
    email,
  }
}

function buildLocalSession(data = {}) {
  const user = buildFallbackUser(data)

  return {
    accessToken: `local_${Date.now()}`,
    refreshToken: '',
    user,
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

function saveSession(payload, fallbackUser = null) {
  const previousTokens = getStoredTokens()

  const accessToken = extractAccessToken(payload)
  const refreshToken = extractRefreshToken(payload) || previousTokens.refreshToken
  const user = extractUser(payload) || fallbackUser

  if (!accessToken) {
    throw new Error('Server did not return access token.')
  }

  saveStoredTokens({ accessToken, refreshToken })
  saveStoredUser(user || null)

  return {
    accessToken,
    refreshToken,
    user,
  }
}

export async function registerUser(data) {
  const fallbackUser = buildFallbackUser(data)

  try {
    const payload = await request(ENDPOINTS.authRegister, {
      method: 'POST',
      auth: false,
      body: data,
    })

    return saveSession(payload, fallbackUser)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    return saveSession(buildLocalSession(data), fallbackUser)
  }
}

export async function loginUser(data) {
  const fallbackUser = buildFallbackUser(data)

  try {
    const payload = await request(ENDPOINTS.authLogin, {
      method: 'POST',
      auth: false,
      body: data,
    })

    return saveSession(payload, fallbackUser)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    return saveSession(buildLocalSession(data), fallbackUser)
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

