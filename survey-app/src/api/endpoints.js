const env = import.meta.env

export const API_BASE_URL = 'https://localhost:7054/api'

export const ENDPOINTS = {
  authLogin: env.VITE_AUTH_LOGIN_PATH || '/auth/login',
  authRegister: env.VITE_AUTH_REGISTER_PATH || '/auth/register',
  authRefresh: env.VITE_AUTH_REFRESH_PATH || '/auth/refresh',
  authLogout: env.VITE_AUTH_LOGOUT_PATH || '/auth/logout',

  polls: '/Surveys',
  pollById: (id) => `/Surveys/${id}`,

  uploadFile: (id) => `/Surveys/${id}/upload-image`,
  downloadFile: (id) => `/Surveys/${id}/image`,
  voteSubmit: (id) => `/Votes/${id}`,
  voteStats: (id) => `/Votes/${id}/stats`,
}
