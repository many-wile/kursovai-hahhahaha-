// ПОЛНЫЙ ФАЙЛ ПОСЛЕ ИЗМЕНЕНИЙ:
const env = import.meta.env

export const API_BASE_URL = env.VITE_API_BASE_URL || 'https://localhost:7054/api'

export const ENDPOINTS = {
  authLogin: env.VITE_AUTH_LOGIN_PATH || '/auth/login',
  authRegister: env.VITE_AUTH_REGISTER_PATH || '/auth/register',
  authRefresh: env.VITE_AUTH_REFRESH_PATH || '/auth/refresh',
  authLogout: env.VITE_AUTH_LOGOUT_PATH || '/auth/logout',

  polls: env.VITE_POLLS_PATH || '/surveys',
  pollById: (id) => `${env.VITE_POLLS_PATH || '/surveys'}/${id}`,

  uploadFile: env.VITE_FILE_UPLOAD_PATH || '/files/upload',
  downloadFile: (id) => `${env.VITE_FILE_BASE_PATH || '/files'}/${id}/download`,
}