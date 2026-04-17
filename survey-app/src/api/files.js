import { request } from './client.js'
import { ENDPOINTS, API_BASE_URL } from './endpoints.js'

const ATTACHMENT_VERSION_KEY = 'survey_app_attachment_versions'

function joinUrl(base, path) {
  const normalizedBase = String(base || '').replace(/\/+$/, '')
  const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

function loadAttachmentVersions() {
  try {
    const raw = localStorage.getItem(ATTACHMENT_VERSION_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveAttachmentVersion(surveyId, version) {
  const key = String(surveyId)
  const all = loadAttachmentVersions()
  all[key] = String(version)
  localStorage.setItem(ATTACHMENT_VERSION_KEY, JSON.stringify(all))
}

function getAttachmentVersion(surveyId) {
  const key = String(surveyId)
  return loadAttachmentVersions()[key] || ''
}

export function isImageAttachment(fileName = '') {
  return /\.(png|jpe?g|webp|gif)$/i.test(String(fileName))
}

export function getAttachmentPreviewUrl(surveyId) {
  if (!surveyId) {
    return ''
  }

  const url = joinUrl(API_BASE_URL, ENDPOINTS.downloadFile(surveyId))
  const version = getAttachmentVersion(surveyId)
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}

export async function uploadAttachment(surveyId, file) {
  if (!surveyId || !file) {
    throw new Error('Для загрузки фото нужен id опроса и выбранный файл.')
  }

  const formData = new FormData()
  formData.append('file', file)

  const payload = await request(ENDPOINTS.uploadFile(surveyId), {
    method: 'POST',
    body: formData,
  })

  const version = payload?.fileName ? `${payload.fileName}-${Date.now()}` : Date.now()
  saveAttachmentVersion(surveyId, version)

  return {
    id: Number(surveyId),
    name: payload?.fileName || file.name,
    url: getAttachmentPreviewUrl(surveyId),
  }
}

export async function downloadAttachment(surveyId) {
  if (!surveyId) {
    throw new Error('Не указан id опроса для скачивания изображения.')
  }

  const url = getAttachmentPreviewUrl(surveyId)

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
  })

  if (!response.ok) {
    throw new Error('Не удалось получить файл с сервера')
  }

  return response.blob()
}
