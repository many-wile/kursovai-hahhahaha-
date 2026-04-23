import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import { ApiError } from '../lib/apiError.js'
import { getStoredUser } from '../lib/tokenStorage.js'

const SHADOW_POLLS_KEY = 'survey_app_shadow_polls'
const POLL_META_KEY = 'survey_app_poll_meta_v1'
const POLL_AUTHORS_KEY = 'survey_app_poll_authors_v1'

export const POLL_QUESTION_TYPES = {
  CHOICE: 'choice',
  TEXT: 'text',
}

function decodeEscapedUnicode(value) {
  const raw = String(value ?? '')

  if (!raw.includes('\\u')) {
    return raw
  }

  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

function readText(value, { trim = false } = {}) {
  const decoded = decodeEscapedUnicode(value)
  return trim ? decoded.trim() : decoded
}

function normalizeIdentity(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim().toLowerCase()
}

function getOwnerIdentity(user) {
  if (!user || typeof user !== 'object') {
    return { id: '', email: '' }
  }

  return {
    id: normalizeIdentity(user.id ?? user.userId ?? user.sub ?? user.nameid),
    email: normalizeIdentity(user.email ?? user.Email),
  }
}

function loadPollAuthors() {
  try {
    const raw = localStorage.getItem(POLL_AUTHORS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function savePollAuthors(map) {
  localStorage.setItem(POLL_AUTHORS_KEY, JSON.stringify(map))
}

function rememberPollAuthor(pollId, owner) {
  const key = String(pollId || '').trim()
  if (!key) {
    return
  }

  const id = normalizeIdentity(owner?.id)
  const email = normalizeIdentity(owner?.email)

  const map = loadPollAuthors()
  map[key] = { id, email }
  savePollAuthors(map)
}

function getRememberedPollAuthor(pollId) {
  const key = String(pollId || '').trim()
  if (!key) {
    return { id: '', email: '' }
  }

  const map = loadPollAuthors()
  return {
    id: normalizeIdentity(map?.[key]?.id),
    email: normalizeIdentity(map?.[key]?.email),
  }
}

function resolveOwnerFromRaw(raw) {
  const directId = normalizeIdentity(
    raw?.authorId ??
      raw?.AuthorId ??
      raw?.userId ??
      raw?.UserId ??
      raw?.createdById ??
      raw?.CreatedById ??
      raw?.ownerId ??
      raw?.OwnerId ??
      raw?.creatorId ??
      raw?.CreatorId,
  )

  const directEmail = normalizeIdentity(
    raw?.authorEmail ??
      raw?.AuthorEmail ??
      raw?.userEmail ??
      raw?.UserEmail ??
      raw?.createdByEmail ??
      raw?.CreatedByEmail,
  )

  const nestedId = normalizeIdentity(
    raw?.author?.id ??
      raw?.Author?.Id ??
      raw?.user?.id ??
      raw?.User?.Id,
  )

  const nestedEmail = normalizeIdentity(
    raw?.author?.email ??
      raw?.Author?.Email ??
      raw?.user?.email ??
      raw?.User?.Email,
  )

  return {
    id: directId || nestedId,
    email: directEmail || nestedEmail,
  }
}

function isMethodMissing(error) {
  return error instanceof ApiError && [404, 405, 501].includes(error.status)
}

function shouldUseLocalFallback(error) {
  return isMethodMissing(error) || error instanceof TypeError
}

function isServerPollId(id) {
  const parsed = Number(id)
  return Number.isInteger(parsed) && parsed > 0
}

export function isPollOwner(poll, user = getStoredUser()) {
  const pollOwnerId = normalizeIdentity(poll?.authorId)
  const pollOwnerEmail = normalizeIdentity(poll?.authorEmail)
  const owner = getOwnerIdentity(user)

  if (!owner.id && !owner.email) {
    return false
  }

  if (pollOwnerId && owner.id && pollOwnerId === owner.id) {
    return true
  }

  return Boolean(pollOwnerEmail && owner.email && pollOwnerEmail === owner.email)
}

function createLocalId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeOption(raw, index) {
  const isObject = raw && typeof raw === 'object'
  const text = readText(isObject ? (raw?.text ?? raw?.Text ?? '') : raw, { trim: true })

  return {
    id: isObject ? (raw?.id ?? raw?.Id ?? `opt_${index + 1}`) : `opt_${index + 1}`,
    text,
  }
}

function parseSerializedQuestion(raw) {
  const candidate = readText(raw, { trim: true })
  if (!candidate.startsWith('{')) {
    return null
  }

  try {
    const parsed = JSON.parse(candidate)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return {
      text: readText(parsed?.text ?? parsed?.Text ?? '', { trim: true }),
      type: readText(parsed?.type ?? parsed?.Type ?? '', { trim: true }).toLowerCase(),
      options: Array.isArray(parsed?.options)
        ? parsed.options
        : Array.isArray(parsed?.Options)
          ? parsed.Options
          : [],
    }
  } catch {
    return null
  }
}

function normalizeQuestion(raw, index) {
  if (typeof raw === 'string') {
    const parsed = parseSerializedQuestion(raw)
    const text = readText(parsed?.text ?? raw, { trim: true })
    const parsedOptions = Array.isArray(parsed?.options) ? parsed.options : []
    const options = parsedOptions.map(normalizeOption).filter((item) => item.text.length > 0)
    const type = parsed?.type === POLL_QUESTION_TYPES.CHOICE
      ? POLL_QUESTION_TYPES.CHOICE
      : parsed?.type === POLL_QUESTION_TYPES.TEXT
        ? POLL_QUESTION_TYPES.TEXT
        : options.length
          ? POLL_QUESTION_TYPES.CHOICE
          : POLL_QUESTION_TYPES.TEXT

    return {
      id: `q_${index + 1}`,
      text,
      type,
      options: type === POLL_QUESTION_TYPES.CHOICE ? options : [],
    }
  }

  const text = readText(raw?.text ?? raw?.Text ?? '', { trim: true })

  const rawOptions = Array.isArray(raw?.options)
    ? raw.options
    : Array.isArray(raw?.Options)
      ? raw.Options
      : []

  const options = rawOptions.map(normalizeOption).filter((item) => item.text.length > 0)

  const explicitType = readText(raw?.type ?? raw?.Type ?? raw?.questionType ?? '', { trim: true }).toLowerCase()
  const type = explicitType === POLL_QUESTION_TYPES.TEXT
    ? POLL_QUESTION_TYPES.TEXT
    : options.length
      ? POLL_QUESTION_TYPES.CHOICE
      : POLL_QUESTION_TYPES.TEXT

  return {
    id: raw?.id ?? raw?.Id ?? `q_${index + 1}`,
    text,
    type,
    options: type === POLL_QUESTION_TYPES.CHOICE ? options : [],
  }
}

function normalizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) {
    return []
  }

  return rawQuestions
    .map(normalizeQuestion)
    .filter((question) => question.text.length > 0)
}

function toQuestionMeta(questions) {
  return normalizeQuestions(questions).map((question) => ({
    id: question.id ?? null,
    text: question.text,
    type: question.type,
    options: question.options.map((option) => ({ text: option.text })),
  }))
}

function loadPollMeta() {
  try {
    const raw = localStorage.getItem(POLL_META_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function savePollMeta(meta) {
  localStorage.setItem(POLL_META_KEY, JSON.stringify(meta))
}

function rememberPollQuestions(pollId, questions) {
  const key = String(pollId || '').trim()
  if (!key) {
    return
  }

  const meta = loadPollMeta()
  const normalized = toQuestionMeta(questions)

  if (!normalized.length) {
    delete meta[key]
  } else {
    meta[key] = { questions: normalized }
  }

  savePollMeta(meta)
}

function mergeQuestionMeta(pollId, questions) {
  const key = String(pollId || '').trim()
  if (!key) {
    return questions
  }

  const meta = loadPollMeta()
  const metaQuestions = normalizeQuestions(meta?.[key]?.questions || [])
  if (!metaQuestions.length) {
    return questions
  }

  if (!questions.length) {
    return metaQuestions
  }

  return questions.map((question, index) => {
    const byId = metaQuestions.find((item) => String(item.id) === String(question.id))
    const byText = metaQuestions.find((item) => item.text === question.text)
    const byIndex = metaQuestions[index]
    const matched = byId || byText || byIndex

    if (!matched) {
      return question
    }

    return {
      ...question,
      type: matched.type || question.type,
      options: matched.options?.length ? matched.options : question.options,
    }
  })
}

function normalizePoll(raw) {
  const resolvedId = raw?.id ?? raw?.pollId ?? raw?.Id ?? ''
  const imagePath = readText(raw?.imagePath ?? raw?.ImagePath ?? '')
  const rawQuestions = raw?.questions ?? raw?.Questions
  const normalizedQuestions = normalizeQuestions(rawQuestions)
  const questions = mergeQuestionMeta(resolvedId, normalizedQuestions)
  const ownerFromRaw = resolveOwnerFromRaw(raw)
  const rememberedOwner = getRememberedPollAuthor(resolvedId)
  const authorId = ownerFromRaw.id || rememberedOwner.id
  const authorEmail = ownerFromRaw.email || rememberedOwner.email

  if (resolvedId && (authorId || authorEmail)) {
    rememberPollAuthor(resolvedId, { id: authorId, email: authorEmail })
  }

  return {
    id: resolvedId,
    title: readText(raw?.title ?? raw?.name ?? raw?.question ?? 'Без названия'),
    description: readText(raw?.description ?? raw?.desc ?? raw?.text ?? ''),
    attachmentId: raw?.attachmentId ?? raw?.fileId ?? (imagePath ? resolvedId : null),
    attachmentName: readText(raw?.attachmentName ?? raw?.fileName ?? imagePath ?? ''),
    createdAt: raw?.createdAt ?? raw?.created ?? null,
    imagePath,
    authorId,
    authorEmail,
    questions,
  }
}

function prepareRequestQuestions(questions) {
  if (!Array.isArray(questions)) {
    return []
  }

  return questions
    .map((question) => {
      const text = readText(question?.text || '', { trim: true })
      if (!text) {
        return null
      }

      const normalized = {
        text,
        type: question?.type === POLL_QUESTION_TYPES.TEXT ? POLL_QUESTION_TYPES.TEXT : POLL_QUESTION_TYPES.CHOICE,
      }

      const parsedId = Number(question?.id)
      if (Number.isFinite(parsedId) && parsedId > 0) {
        normalized.id = parsedId
      }

      if (normalized.type === POLL_QUESTION_TYPES.CHOICE) {
        normalized.options = Array.isArray(question?.options)
          ? question.options
            .map((option) => ({ text: readText(option?.text || '', { trim: true }) }))
            .filter((option) => option.text.length > 0)
          : []
      } else {
        normalized.options = []
      }

      return normalized
    })
    .filter(Boolean)
}

function toApiQuestionList(questions) {
  return questions.map((question) => question.text)
}

function loadShadowState() {
  try {
    const raw = localStorage.getItem(SHADOW_POLLS_KEY)

    if (!raw) {
      return { updates: {}, deletedIds: [], created: [] }
    }

    const parsed = JSON.parse(raw)
    const created = Array.isArray(parsed?.created) ? parsed.created.map(normalizePoll) : []

    return {
      updates: parsed?.updates && typeof parsed.updates === 'object' ? parsed.updates : {},
      deletedIds: Array.isArray(parsed?.deletedIds) ? parsed.deletedIds.map(String) : [],
      created,
    }
  } catch {
    return { updates: {}, deletedIds: [], created: [] }
  }
}

function saveShadowState(state) {
  localStorage.setItem(
    SHADOW_POLLS_KEY,
    JSON.stringify({
      updates: state.updates || {},
      deletedIds: Array.isArray(state.deletedIds) ? state.deletedIds : [],
      created: Array.isArray(state.created) ? state.created : [],
    }),
  )
}

function applyShadow(items) {
  const shadow = loadShadowState()
  const deleted = new Set(shadow.deletedIds.map(String))

  const serverItems = items
    .map(normalizePoll)
    .filter((item) => !deleted.has(String(item.id)))
    .map((item) => {
      const patch = shadow.updates[String(item.id)] || null
      return patch ? { ...item, ...patch } : item
    })

  const createdItems = shadow.created
    .filter((item) => !deleted.has(String(item.id)))
    .map((item) => {
      const patch = shadow.updates[String(item.id)] || null
      return patch ? { ...item, ...patch } : item
    })

  const byId = new Map()

  for (const item of createdItems) {
    byId.set(String(item.id), item)
  }

  for (const item of serverItems) {
    byId.set(String(item.id), item)
  }

  return [...byId.values()].sort((a, b) => new Date(b.createdAt || 0).valueOf() - new Date(a.createdAt || 0).valueOf())
}

function rememberLocalCreate(poll) {
  const state = loadShadowState()
  const normalized = normalizePoll(poll)
  const key = String(normalized.id)

  state.created = state.created.filter((item) => String(item.id) !== key)
  state.created.unshift(normalized)
  state.deletedIds = state.deletedIds.filter((item) => item !== key)

  saveShadowState(state)
}

function rememberLocalUpdate(id, patch) {
  const state = loadShadowState()
  const key = String(id)

  state.updates[key] = { ...(state.updates[key] || {}), ...patch }
  state.deletedIds = state.deletedIds.filter((item) => item !== key)
  state.created = state.created.map((item) => (String(item.id) === key ? { ...item, ...patch } : item))

  saveShadowState(state)
}

function rememberLocalDelete(id) {
  const state = loadShadowState()
  const key = String(id)

  delete state.updates[key]
  state.created = state.created.filter((item) => String(item.id) !== key)

  if (!state.deletedIds.includes(key)) {
    state.deletedIds.push(key)
  }

  saveShadowState(state)
}

function normalizePagedResponse(payload, page, pageSize) {
  const rawItems =
    payload?.items ||
    payload?.data ||
    payload?.results ||
    payload?.polls ||
    (Array.isArray(payload) ? payload : [])

  const items = applyShadow(rawItems)

  return {
    items,
    totalCount: payload?.totalCount ?? payload?.total ?? items.length,
    page: payload?.page ?? page,
    pageSize: payload?.pageSize ?? pageSize,
  }
}

function paginateLocal(items, page, pageSize, query) {
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = normalizedQuery
    ? items.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : items

  const totalCount = filtered.length
  const start = Math.max(0, (page - 1) * pageSize)

  return {
    items: filtered.slice(start, start + pageSize),
    totalCount,
    page,
    pageSize,
  }
}

export async function getPolls({ page = 1, pageSize = 5, query = '' }) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  if (query.trim()) {
    params.set('query', query.trim())
  }

  try {
    const payload = await request(`${ENDPOINTS.polls}?${params.toString()}`)
    return normalizePagedResponse(payload, page, pageSize)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    return paginateLocal(applyShadow([]), page, pageSize, query)
  }
}

export async function getPollById(id) {
  if (!isServerPollId(id)) {
    const localOnly = applyShadow([])
    const foundLocal = localOnly.find((item) => String(item.id) === String(id))

    if (!foundLocal) {
      throw new ApiError('РћРїСЂРѕСЃ РЅРµ РЅР°Р№РґРµРЅ.', 404)
    }

    return foundLocal
  }

  try {
    const payload = await request(ENDPOINTS.pollById(id))
    return normalizePoll(payload)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    try {
      const listPayload = await request(ENDPOINTS.polls)
      const rawItems = Array.isArray(listPayload) ? listPayload : listPayload?.items || []
      const items = applyShadow(rawItems)
      const found = items.find((item) => String(item.id) === String(id))

      if (found) {
        return found
      }
    } catch {
      // ignore and fallback to local-only data
    }

    const localOnly = applyShadow([])
    const foundLocal = localOnly.find((item) => String(item.id) === String(id))

    if (!foundLocal) {
      throw new ApiError('Опрос не найден.', 404)
    }

    return foundLocal
  }
}

export async function createPoll(data) {
  const questions = prepareRequestQuestions(data?.questions)
  const questionsForApi = toApiQuestionList(questions)
  const currentOwner = getOwnerIdentity(getStoredUser())

  try {
    const payload = await request(ENDPOINTS.polls, {
      method: 'POST',
      body: {
        title: data?.title ?? '',
        description: data?.description ?? '',
        questions: questionsForApi,
        questionsMeta: questions,
      },
    })

    const created = normalizePoll(payload)
    const merged = {
      ...created,
      questions: questions.length ? questions : created.questions,
    }

    if (merged.id && (currentOwner.id || currentOwner.email)) {
      rememberPollAuthor(merged.id, currentOwner)
    }

    rememberPollQuestions(merged.id, merged.questions)
    return merged
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    const localPoll = normalizePoll({
      id: createLocalId('local_poll'),
      title: data?.title ?? '',
      description: data?.description ?? '',
      createdAt: new Date().toISOString(),
      authorId: currentOwner.id || null,
      authorEmail: currentOwner.email || null,
      questions,
    })

    rememberLocalCreate(localPoll)
    if (localPoll.id && (currentOwner.id || currentOwner.email)) {
      rememberPollAuthor(localPoll.id, currentOwner)
    }
    rememberPollQuestions(localPoll.id, questions)
    return localPoll
  }
}

async function ensureCurrentUserOwnsPoll(pollId) {
  const poll = await getPollById(pollId)

  if (!isPollOwner(poll, getStoredUser())) {
    throw new ApiError('Редактировать и удалять опрос может только его автор.', 403)
  }

  return poll
}

export async function updatePoll(id, data) {
  const questions = prepareRequestQuestions(data?.questions)
  const questionsForApi = toApiQuestionList(questions)

  await ensureCurrentUserOwnsPoll(id)

  if (!isServerPollId(id)) {
    const fallbackPoll = await getPollById(id)
    const patch = {
      title: data?.title ?? fallbackPoll.title,
      description: data?.description ?? fallbackPoll.description,
      attachmentId: data?.attachmentId ?? fallbackPoll.attachmentId,
      attachmentName: data?.attachmentName ?? fallbackPoll.attachmentName,
      questions: questions.length ? questions : fallbackPoll.questions || [],
    }

    rememberLocalUpdate(id, patch)
    rememberPollQuestions(id, patch.questions)
    return { ...fallbackPoll, ...patch }
  }

  try {
    const payload = await request(ENDPOINTS.pollById(id), {
      method: 'PUT',
      body: {
        id: Number(id),
        title: data?.title ?? '',
        description: data?.description ?? '',
        imagePath: data?.imagePath ?? null,
        questions: questionsForApi,
        questionsMeta: questions,
      },
    })

    const updated = payload ? normalizePoll(payload) : await getPollById(id)
    const merged = {
      ...updated,
      questions: questions.length ? questions : updated.questions,
    }

    rememberPollQuestions(id, merged.questions)
    return merged
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    const fallbackPoll = await getPollById(id)
    const patch = {
      title: data?.title ?? fallbackPoll.title,
      description: data?.description ?? fallbackPoll.description,
      attachmentId: data?.attachmentId ?? fallbackPoll.attachmentId,
      attachmentName: data?.attachmentName ?? fallbackPoll.attachmentName,
      questions: questions.length ? questions : fallbackPoll.questions || [],
    }

    rememberLocalUpdate(id, patch)
    rememberPollQuestions(id, patch.questions)
    return { ...fallbackPoll, ...patch }
  }
}

export async function deletePoll(id) {
  await ensureCurrentUserOwnsPoll(id)

  if (!isServerPollId(id)) {
    rememberLocalDelete(id)
    return
  }

  try {
    await request(ENDPOINTS.pollById(id), {
      method: 'DELETE',
    })
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    rememberLocalDelete(id)
  }
}
