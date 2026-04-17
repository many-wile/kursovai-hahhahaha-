import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import {
  clearStoredTokens,
  clearStoredUser,
  getStoredTokens,
  saveStoredTokens,
  saveStoredUser,
} from '../lib/tokenStorage.js'

function extractAccessToken(payload) {
  return payload?.accessToken || payload?.token || payload?.jwt || ''
}

function extractRefreshToken(payload) {
  return payload?.refreshToken || ''
}

function extractUser(payload) {
  return payload?.user || payload?.profile || null
}

function saveSession(payload) {
  const previousTokens = getStoredTokens()

  const accessToken = extractAccessToken(payload)
  const refreshToken = extractRefreshToken(payload) || previousTokens.refreshToken
  const user = extractUser(payload)

  if (!accessToken) {
    throw new Error('Сервер не вернул access token.')
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
  const payload = await request(ENDPOINTS.authRegister, {
    method: 'POST',
    auth: false,
    body: data,
  })

  return saveSession(payload)
}

export async function loginUser(data) {
  const payload = await request(ENDPOINTS.authLogin, {
    method: 'POST',
    auth: false,
    body: data,
  })

  return saveSession(payload)
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
