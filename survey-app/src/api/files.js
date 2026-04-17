import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import { ApiError } from '../lib/apiError.js'

const LOCAL_FILES_KEY = 'survey_app_local_files'

function shouldUseLocalFallback(error) {
  if (error instanceof ApiError) {
    return [404, 405, 501].includes(error.status)
  }

  return error instanceof TypeError
}

function loadLocalFiles() {
  try {
    const raw = localStorage.getItem(LOCAL_FILES_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveLocalFiles(files) {
  localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(files))
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'))

    reader.readAsDataURL(file)
  })
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64Data] = String(dataUrl || '').split(',')

  if (!meta || !base64Data) {
    throw new Error('Некорректный формат локального файла.')
  }

  const mimeMatch = meta.match(/data:(.*);base64/)
  const mimeType = mimeMatch?.[1] || 'application/octet-stream'
  const binary = atob(base64Data)
  const length = binary.length
  const bytes = new Uint8Array(length)

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: mimeType })
}

export async function uploadAttachment(file) {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const payload = await request(ENDPOINTS.uploadFile, {
      method: 'POST',
      body: formData,
    })

    return {
      id: payload?.id ?? payload?.fileId ?? payload?.attachmentId ?? null,
      name: payload?.fileName ?? payload?.name ?? file.name,
      url: payload?.url ?? payload?.fileUrl ?? '',
    }
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    const localId = `local_file_${Date.now()}`
    const dataUrl = await readAsDataUrl(file)
    const files = loadLocalFiles()

    files[localId] = {
      id: localId,
      name: file.name,
      type: file.type || 'application/octet-stream',
      dataUrl,
      createdAt: new Date().toISOString(),
    }

    saveLocalFiles(files)

    return {
      id: localId,
      name: file.name,
      url: '',
    }
  }
}

export async function downloadAttachment(fileId) {
  try {
    return await request(ENDPOINTS.downloadFile(fileId), { expect: 'blob' })
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    const files = loadLocalFiles()
    const file = files[String(fileId)]

    if (!file?.dataUrl) {
      throw new ApiError('Файл не найден.', 404)
    }

    return dataUrlToBlob(file.dataUrl)
  }
}

