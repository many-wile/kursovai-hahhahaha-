import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'

function normalizePoll(raw) {
  return {
    id: raw?.id ?? raw?.pollId ?? raw?.Id ?? '',
    title: raw?.title ?? raw?.name ?? raw?.question ?? 'Без названия',
    description: raw?.description ?? raw?.desc ?? raw?.text ?? '',
    attachmentId: raw?.attachmentId ?? raw?.fileId ?? null,
    attachmentName: raw?.attachmentName ?? raw?.fileName ?? '',
    createdAt: raw?.createdAt ?? raw?.created ?? null,
  }
}

function normalizePagedResponse(payload, page, pageSize) {
  const rawItems =
    payload?.items ||
    payload?.data ||
    payload?.results ||
    payload?.polls ||
    (Array.isArray(payload) ? payload : [])

  const items = rawItems.map(normalizePoll)

  const totalCount = payload?.totalCount ?? payload?.total ?? items.length
  const currentPage = payload?.page ?? page
  const currentPageSize = payload?.pageSize ?? pageSize

  return {
    items,
    totalCount,
    page: currentPage,
    pageSize: currentPageSize,
  }
}

export async function getPolls({ page = 1, pageSize = 5, query = '' }) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  if (query.trim()) {
    params.set('query', query.trim())
  }

  const payload = await request(`${ENDPOINTS.polls}?${params.toString()}`)
  return normalizePagedResponse(payload, page, pageSize)
}

export async function getPollById(id) {
  const payload = await request(ENDPOINTS.pollById(id))
  return normalizePoll(payload)
}

export async function createPoll(data) {
  const payload = await request(ENDPOINTS.polls, {
    method: 'POST',
    body: data,
  })

  return normalizePoll(payload)
}

export async function updatePoll(id, data) {
  const payload = await request(ENDPOINTS.pollById(id), {
    method: 'PUT',
    body: data,
  })

  return normalizePoll(payload)
}

export async function deletePoll(id) {
  await request(ENDPOINTS.pollById(id), {
    method: 'DELETE',
  })
}
