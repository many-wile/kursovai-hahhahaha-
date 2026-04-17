export const API_BASE_URL = '/api'

export const ENDPOINTS = {
  authLogin: '/auth/login',
  authRegister: '/auth/register',
  authRefresh: '/auth/refresh',
  authLogout: '/auth/logout',
  polls: '/polls',
  pollById: (id) => `/polls/${id}`,
  uploadFile: '/files/upload',
  downloadFile: (id) => `/files/${id}/download`,
}