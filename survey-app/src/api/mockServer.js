import { ENDPOINTS } from './endpoints.js'
import { ApiError } from '../lib/apiError.js'

const MOCK_DB_KEY = 'survey_app_mock_db_v2'
const MOCK_DELAY_MS = Number(import.meta.env.VITE_MOCK_DELAY_MS || 300)
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf', 'doc', 'docx', 'txt'])

const MARKER = '__file_id__'
const DOWNLOAD_TEMPLATE = ENDPOINTS.downloadFile(MARKER)
const FILES_PREFIX = DOWNLOAD_TEMPLATE.split(`/${MARKER}/download`)[0] || '/files'

const POLLS_BASE = ENDPOINTS.polls || '/polls'

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const pollByIdRegex = new RegExp(`^${escapeRegex(POLLS_BASE)}/([^/]+)$`)
const fileDownloadRegex = new RegExp(`^${escapeRegex(FILES_PREFIX)}/([^/]+)/download$`)

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function createInitialDb() {
  const now = new Date().toISOString()

  return {
    users: [
      {
        id: 'user_demo',
        name: 'Demo User',
        email: 'demo@mail.com',
        password: '123456',
      },
    ],
    sessions: [],
    files: {},
    polls: [
      {
        id: 'poll_1',
        title: 'Опрос про музыку',
        description: 'Какие жанры вы слушаете чаще всего?',
        attachmentId: null,
        attachmentName: '',
        createdAt: now,
      },
      {
        id: 'poll_2',
        title: 'Опрос про кино',
        description: 'Какой формат фильмов вы предпочитаете?',
        attachmentId: null,
        attachmentName: '',
        createdAt: now,
      },
      {
        id: 'poll_3',
        title: 'Опрос про обучение',
        description: 'Какая форма обучения для вас эффективнее?',
        attachmentId: null,
        attachmentName: '',
        createdAt: now,
      },
    ],
  }
}

function loadDb() {
  const raw = localStorage.getItem(MOCK_DB_KEY)

  if (!raw) {
    const initial = createInitialDb()
    saveDb(initial)
    return initial
  }

  try {
    const parsed = JSON.parse(raw)

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {},
      polls: Array.isArray(parsed.polls) ? parsed.polls : [],
    }
  } catch {
    const initial = createInitialDb()
    saveDb(initial)
    return initial
  }
}

function saveDb(db) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db))
}

function parseBody(body) {
  if (!body) {
    return {}
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }

  return body
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

function createSession(db, userId, keepRefresh = null) {
  const accessToken = generateId('access')
  const refreshToken = keepRefresh || generateId('refresh')

  const session = {
    userId,
    accessToken,
    refreshToken,
    createdAt: new Date().toISOString(),
  }

  db.sessions = db.sessions.filter((item) => item.refreshToken !== refreshToken)
  db.sessions.push(session)

  return session
}

function getBearerToken(headers) {
  const raw = headers?.Authorization || headers?.authorization || ''

  if (!raw.startsWith('Bearer ')) {
    return ''
  }

  return raw.slice(7)
}

function requireAuth(db, headers) {
  const accessToken = getBearerToken(headers)

  if (!accessToken) {
    throw new ApiError('Требуется авторизация.', 401)
  }

  const session = db.sessions.find((item) => item.accessToken === accessToken)

  if (!session) {
    throw new ApiError('Сессия истекла. Войдите снова.', 401)
  }

  return session
}

function resolvePollOrThrow(db, id) {
  const poll = db.polls.find((item) => item.id === id)

  if (!poll) {
    throw new ApiError('Опрос не найден.', 404)
  }

  return poll
}

function validateFile(file) {
  if (!file) {
    throw new ApiError('Файл не передан.', 400)
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ApiError('Недопустимый тип файла.', 400)
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError('Файл слишком большой (максимум 8 MB).', 400)
  }
}

function buildAuthResponse(db, session) {
  const user = db.users.find((item) => item.id === session.userId)

  if (!user) {
    throw new ApiError('Пользователь не найден.', 404)
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: sanitizeUser(user),
  }
}

function maybeFailNetwork() {
  if (import.meta.env.VITE_MOCK_FORCE_NETWORK_ERROR === 'true') {
    throw new TypeError('Failed to fetch')
  }
}

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

export async function mockRequest(path, options = {}) {
  const { method = 'GET', body, headers = {}, expect = 'json' } = options

  maybeFailNetwork()
  await delay(MOCK_DELAY_MS)

  const db = loadDb()
  const url = new URL(path, 'http://mock.local')
  const pathname = url.pathname
  const verb = method.toUpperCase()

  if (pathname === ENDPOINTS.authRegister && verb === 'POST') {
    const payload = parseBody(body)

    if (!payload.email || !payload.password) {
      throw new ApiError('Email и пароль обязательны.', 400)
    }

    const exists = db.users.some((item) => item.email.toLowerCase() === payload.email.toLowerCase())

    if (exists) {
      throw new ApiError('Пользователь с таким email уже существует.', 400)
    }

    const newUser = {
      id: generateId('user'),
      name: payload.name || payload.userName || 'Пользователь',
      email: payload.email,
      password: payload.password,
    }

    db.users.push(newUser)
    const session = createSession(db, newUser.id)
    saveDb(db)

    return buildAuthResponse(db, session)
  }

  if (pathname === ENDPOINTS.authLogin && verb === 'POST') {
    const payload = parseBody(body)

    const user = db.users.find((item) => item.email.toLowerCase() === String(payload.email || '').toLowerCase())

    if (!user || user.password !== payload.password) {
      throw new ApiError('Неверный email или пароль.', 401)
    }

    const session = createSession(db, user.id)
    saveDb(db)

    return buildAuthResponse(db, session)
  }

  if (pathname === ENDPOINTS.authRefresh && verb === 'POST') {
    const payload = parseBody(body)
    const refreshToken = payload.refreshToken

    const oldSession = db.sessions.find((item) => item.refreshToken === refreshToken)

    if (!oldSession) {
      throw new ApiError('Refresh token невалиден.', 401)
    }

    const renewed = createSession(db, oldSession.userId, oldSession.refreshToken)
    saveDb(db)

    return buildAuthResponse(db, renewed)
  }

  if (pathname === ENDPOINTS.authLogout && verb === 'POST') {
    const token = getBearerToken(headers)
    db.sessions = db.sessions.filter((item) => item.accessToken !== token)
    saveDb(db)
    return { success: true }
  }

  if (pathname === ENDPOINTS.uploadFile && verb === 'POST') {
    requireAuth(db, headers)

    if (!(body instanceof FormData)) {
      throw new ApiError('Некорректный формат загрузки.', 400)
    }

    const file = body.get('file')
    validateFile(file)

    const fileId = generateId('file')
    db.files[fileId] = {
      id: fileId,
      fileName: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }

    saveDb(db)

    return {
      id: fileId,
      fileName: file.name,
      url: '',
    }
  }

  if (pathname === POLLS_BASE && verb === 'GET') {
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('pageSize') || 6)
    const query = (url.searchParams.get('query') || '').trim().toLowerCase()

    let items = [...db.polls]

    if (query) {
      items = items.filter((poll) => poll.title.toLowerCase().includes(query))
    }

    items.sort((a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf())

    const totalCount = items.length
    const start = Math.max(0, (page - 1) * pageSize)
    const paged = items.slice(start, start + pageSize)

    return {
      items: paged,
      totalCount,
      page,
      pageSize,
    }
  }

  if (pathname === POLLS_BASE && verb === 'POST') {
    requireAuth(db, headers)
    const payload = parseBody(body)

    if (!payload.title || !payload.title.trim()) {
      throw new ApiError('Название опроса обязательно.', 400)
    }

    const poll = {
      id: generateId('poll'),
      title: payload.title.trim(),
      description: (payload.description || '').trim(),
      attachmentId: payload.attachmentId || null,
      attachmentName: payload.attachmentName || '',
      createdAt: new Date().toISOString(),
    }

    db.polls.push(poll)
    saveDb(db)

    return poll
  }

  const pollByIdMatch = pathname.match(pollByIdRegex)
  if (pollByIdMatch) {
    const pollId = decodeURIComponent(pollByIdMatch[1])

    if (verb === 'GET') {
      return resolvePollOrThrow(db, pollId)
    }

    if (verb === 'PUT') {
      requireAuth(db, headers)
      const payload = parseBody(body)
      const poll = resolvePollOrThrow(db, pollId)

      if (!payload.title || !payload.title.trim()) {
        throw new ApiError('Название опроса обязательно.', 400)
      }

      poll.title = payload.title.trim()
      poll.description = (payload.description || '').trim()
      poll.attachmentId = payload.attachmentId || null
      poll.attachmentName = payload.attachmentName || ''

      saveDb(db)

      return poll
    }

    if (verb === 'DELETE') {
      requireAuth(db, headers)
      const poll = resolvePollOrThrow(db, pollId)

      db.polls = db.polls.filter((item) => item.id !== poll.id)
      saveDb(db)

      return null
    }
  }

  const fileDownloadMatch = pathname.match(fileDownloadRegex)
  if (fileDownloadMatch && verb === 'GET') {
    const fileId = decodeURIComponent(fileDownloadMatch[1])
    const file = db.files[fileId]

    if (!file) {
      throw new ApiError('Файл не найден.', 404)
    }

    const blob = new Blob(
      [
        `Mock file: ${file.fileName}\n`,
        `Uploaded: ${file.uploadedAt}\n`,
        'Этот файл создан в мок-режиме фронтенда, пока backend не готов.\n',
      ],
      { type: file.type || 'text/plain' },
    )

    if (expect === 'blob') {
      return blob
    }

    return {
      id: file.id,
      fileName: file.fileName,
    }
  }

  throw new ApiError(`Эндпоинт ${verb} ${pathname} не реализован в mock API.`, 404)
}
