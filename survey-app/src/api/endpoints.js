const env = import.meta.env

export const API_BASE_URL = env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const ENDPOINTS = {
  authLogin: env.VITE_AUTH_LOGIN_PATH || '/auth/login',
  authRegister: env.VITE_AUTH_REGISTER_PATH || '/auth/register',
  authRefresh: env.VITE_AUTH_REFRESH_PATH || '/auth/refresh',
  authLogout: env.VITE_AUTH_LOGOUT_PATH || '/auth/logout',

  polls: env.VITE_POLLS_PATH || '/polls',
  pollById: (id) => `${env.VITE_POLLS_PATH || '/polls'}/${id}`,

  uploadFile: env.VITE_FILE_UPLOAD_PATH || '/files/upload',
  downloadFile: (id) => `${env.VITE_FILE_BASE_PATH || '/files'}/${id}/download`,
}
