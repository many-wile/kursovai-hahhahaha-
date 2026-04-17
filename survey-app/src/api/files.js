import { request } from './client.js'
import { ENDPOINTS, API_BASE_URL } from './endpoints.js'

export async function uploadAttachment(surveyId, file) {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const payload = await request(ENDPOINTS.uploadFile(surveyId), {
      method: 'POST',
      body: formData,
    })

    return {
      id: surveyId,
      name: payload?.fileName || file.name,
      url: `${API_BASE_URL}/Surveys/${surveyId}/image`,
    }
  } catch (error) {
    console.error("Ошибка загрузки на сервер:", error);
    throw error;
  }
}

export async function downloadAttachment(surveyId) {
  try {
    const url = `${API_BASE_URL}/Surveys/${surveyId}/image`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (!response.ok) {
      throw new Error('Не удалось получить файл с сервера')
    }

    return await response.blob()
  } catch (error) {
    console.error("Ошибка при скачивании файла:", error);
    throw error;
  }
}