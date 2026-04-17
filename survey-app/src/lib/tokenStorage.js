const TOKENS_KEY = 'survey_app_tokens'
const USER_KEY = 'survey_app_user'
const TOKEN_KEY = 'token'

function safeParse(value) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function getStoredTokens() {
  const parsed = safeParse(localStorage.getItem(TOKENS_KEY))
  const legacyToken = localStorage.getItem(TOKEN_KEY) || ''

  return {
    accessToken: parsed?.accessToken || legacyToken,
    refreshToken: parsed?.refreshToken || '',
  }
}

export function saveStoredTokens(tokens) {
  const payload = {
    accessToken: tokens?.accessToken ?? '',
    refreshToken: tokens?.refreshToken ?? '',
  }

  localStorage.setItem(TOKENS_KEY, JSON.stringify(payload))

  if (payload.accessToken) {
    localStorage.setItem(TOKEN_KEY, payload.accessToken)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKENS_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function getStoredUser() {
  return safeParse(localStorage.getItem(USER_KEY))
}

export function saveStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user ?? null))
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY)
}
