import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import { ApiError } from '../lib/apiError.js'

const SHADOW_POLLS_KEY = 'survey_app_shadow_polls'

function isMethodMissing(error) {
  return error instanceof ApiError && [404, 405, 501].includes(error.status)
}

function loadShadowState() {
  try {
    const raw = localStorage.getItem(SHADOW_POLLS_KEY)

    if (!raw) {
      return { updates: {}, deletedIds: [] }
    }

    const parsed = JSON.parse(raw)
    return {
      updates: parsed?.updates && typeof parsed.updates === 'object' ? parsed.updates : {},
      deletedIds: Array.isArray(parsed?.deletedIds) ? parsed.deletedIds.map(String) : [],
    }
  } catch {
    return { updates: {}, deletedIds: [] }
  }
}

function saveShadowState(state) {
  localStorage.setItem(
    SHADOW_POLLS_KEY,
    JSON.stringify({
      updates: state.updates || {},
      deletedIds: Array.isArray(state.deletedIds) ? state.deletedIds : [],
    }),
  )
}

function applyShadow(items) {
  const shadow = loadShadowState()
  const deleted = new Set(shadow.deletedIds.map(String))

  return items
    .filter((item) => !deleted.has(String(item.id)))
    .map((item) => {
      const patch = shadow.updates[String(item.id)] || null
      return patch ? { ...item, ...patch } : item
    })
}

function rememberLocalUpdate(id, patch) {
  const state = loadShadowState()
  const key = String(id)
  state.updates[key] = { ...(state.updates[key] || {}), ...patch }
  state.deletedIds = state.deletedIds.filter((item) => item !== key)
  saveShadowState(state)
}

function rememberLocalDelete(id) {
  const state = loadShadowState()
  const key = String(id)
  delete state.updates[key]

  if (!state.deletedIds.includes(key)) {
    state.deletedIds.push(key)
  }

  saveShadowState(state)
}

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

  const items = applyShadow(rawItems.map(normalizePoll))

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
  const normalized = normalizePagedResponse(payload, page, pageSize)
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return normalized
  }

  const filtered = normalized.items.filter((item) => item.title.toLowerCase().includes(normalizedQuery))

  return {
    ...normalized,
    items: filtered,
    totalCount: filtered.length,
    page,
    pageSize,
  }
}

export async function getPollById(id) {
  try {
    const payload = await request(ENDPOINTS.pollById(id))
    return normalizePoll(payload)
  } catch (error) {
    if (!isMethodMissing(error)) {
      throw error
    }

    const listPayload = await request(ENDPOINTS.polls)
    const rawItems = Array.isArray(listPayload) ? listPayload : listPayload?.items || []
    const items = applyShadow(rawItems.map(normalizePoll))
    const found = items.find((item) => String(item.id) === String(id))

    if (!found) {
      throw new ApiError('Опрос не найден.', 404)
    }

    return found
  }
}

export async function createPoll(data) {
  const payload = await request(ENDPOINTS.polls, {
    method: 'POST',
    body: data,
  })

  return normalizePoll(payload)
}

export async function updatePoll(id, data) {
  try {
    const payload = await request(ENDPOINTS.pollById(id), {
      method: 'PUT',
      body: data,
    })

    return normalizePoll(payload)
  } catch (error) {
    if (!isMethodMissing(error)) {
      throw error
    }

    const fallbackPoll = await getPollById(id)
    const patch = {
      title: data?.title ?? fallbackPoll.title,
      description: data?.description ?? fallbackPoll.description,
      attachmentId: data?.attachmentId ?? fallbackPoll.attachmentId,
      attachmentName: data?.attachmentName ?? fallbackPoll.attachmentName,
    }

    rememberLocalUpdate(id, patch)
    return { ...fallbackPoll, ...patch }
  }
}

export async function deletePoll(id) {
  try {
    await request(ENDPOINTS.pollById(id), {
      method: 'DELETE',
    })
  } catch (error) {
    if (!isMethodMissing(error)) {
      throw error
    }

    rememberLocalDelete(id)
  }
}

