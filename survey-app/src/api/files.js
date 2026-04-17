// src/api/files.js
import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'

export async function uploadAttachment(file) {
  const formData = new FormData()
  formData.append('file', file)

  const payload = await request(ENDPOINTS.uploadFile, {
    method: 'POST',
    body: formData,
  })

  return {
    id: payload?.id ?? payload?.fileId ?? payload?.attachmentId ?? null,
    name: payload?.fileName ?? payload?.name ?? file.name,
    url: payload?.url ?? payload?.fileUrl ?? '',
  }
}

export async function downloadAttachment(fileId) {
  return request(ENDPOINTS.downloadFile(fileId), { expect: 'blob' })
}