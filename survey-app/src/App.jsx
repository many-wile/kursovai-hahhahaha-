import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { loginUser, logoutUser, registerUser } from './api/auth.js'
import { downloadAttachment, uploadAttachment } from './api/files.js'
import { createPoll, deletePoll, getPollById, getPolls, updatePoll } from './api/polls.js'
import { toUserMessage } from './lib/apiError.js'
import { clearStoredUser, getStoredTokens, getStoredUser } from './lib/tokenStorage.js'

const EMPTY_AUTH_FORM = {
  name: '',
  email: '',
  password: '',
}

const EMPTY_POLL_FORM = {
  title: '',
  description: '',
}

const PAGE_SIZE = 6

function parseRoute(pathname) {
  if (pathname === '/') {
    return { name: 'home' }
  }

  if (pathname === '/login' || pathname === '/auth') {
    return { name: 'auth', mode: 'login' }
  }

  if (pathname === '/register') {
    return { name: 'auth', mode: 'register' }
  }

  if (pathname === '/polls') {
    return { name: 'polls' }
  }

  if (pathname === '/polls/new') {
    return { name: 'poll-new' }
  }

  const editMatch = pathname.match(/^\/polls\/([^/]+)\/edit$/)
  if (editMatch) {
    return { name: 'poll-edit', id: decodeURIComponent(editMatch[1]) }
  }

  const detailMatch = pathname.match(/^\/polls\/([^/]+)$/)
  if (detailMatch) {
    return { name: 'poll-details', id: decodeURIComponent(detailMatch[1]) }
  }

  return { name: 'not-found' }
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M11 19a8 8 0 100-16 8 8 0 000 16zm9 2l-4.35-4.35"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5z" />
    </svg>
  )
}

function Toasts({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.text}
        </div>
      ))}
    </div>
  )
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.valueOf())) {
    return ''
  }

  return date.toLocaleString('ru-RU')
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'file.bin'
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const route = useMemo(() => parseRoute(pathname), [pathname])

  const tokens = getStoredTokens()
  const [isAuthorized, setIsAuthorized] = useState(Boolean(tokens.accessToken))
  const [user, setUser] = useState(getStoredUser())

  const [toasts, setToasts] = useState([])
  const [authBusy, setAuthBusy] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM)

  const [polls, setPolls] = useState([])
  const [loadingPolls, setLoadingPolls] = useState(false)
  const [pollError, setPollError] = useState('')

  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [detailPoll, setDetailPoll] = useState(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [pollForm, setPollForm] = useState(EMPTY_POLL_FORM)
  const [selectedFile, setSelectedFile] = useState(null)
  const [currentAttachment, setCurrentAttachment] = useState({ id: null, name: '' })
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorLoading, setEditorLoading] = useState(false)
  const [actionBusyId, setActionBusyId] = useState(null)

  const totalPages = useMemo(() => {
    if (!totalCount) {
      return 1
    }

    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  }, [totalCount])

  const navigate = useCallback((to) => {
    if (to === window.location.pathname) {
      return
    }

    window.history.pushState({}, '', to)
    setPathname(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    if (route.name === 'auth') {
      setAuthMode(route.mode)
    }
  }, [route.mode, route.name])

  const pushToast = useCallback((type, text) => {
    const id = `${Date.now()}-${Math.random()}`

    setToasts((prev) => [...prev, { id, type, text }])

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3200)
  }, [])

  const loadPolls = useCallback(
    async (targetPage, targetQuery) => {
      setLoadingPolls(true)
      setPollError('')

      try {
        const payload = await getPolls({
          page: targetPage,
          pageSize: PAGE_SIZE,
          query: targetQuery,
        })

        setPolls(payload.items)
        setTotalCount(payload.totalCount)
      } catch (error) {
        setPollError(toUserMessage(error))
        setPolls([])
      } finally {
        setLoadingPolls(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (route.name !== 'home' && route.name !== 'polls') {
      return
    }

    void loadPolls(page, searchQuery)
  }, [loadPolls, page, route.name, searchQuery])

  const loadPollDetails = useCallback(async (pollId) => {
    setDetailBusy(true)
    setDetailError('')

    try {
      const payload = await getPollById(pollId)
      setDetailPoll(payload)
    } catch (error) {
      setDetailError(toUserMessage(error))
      setDetailPoll(null)
    } finally {
      setDetailBusy(false)
    }
  }, [])

  useEffect(() => {
    if (route.name !== 'poll-details') {
      setDetailPoll(null)
      setDetailError('')
      return
    }

    void loadPollDetails(route.id)
  }, [loadPollDetails, route.id, route.name])

  useEffect(() => {
    if (route.name === 'poll-new') {
      setPollForm(EMPTY_POLL_FORM)
      setSelectedFile(null)
      setCurrentAttachment({ id: null, name: '' })
      return
    }

    if (route.name !== 'poll-edit') {
      return
    }

    let isMounted = true

    const loadEditorData = async () => {
      setEditorLoading(true)

      try {
        const payload = await getPollById(route.id)

        if (!isMounted) {
          return
        }

        setPollForm({
          title: payload.title || '',
          description: payload.description || '',
        })
        setCurrentAttachment({
          id: payload.attachmentId,
          name: payload.attachmentName,
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        pushToast('error', toUserMessage(error))
        navigate('/polls')
      } finally {
        if (isMounted) {
          setEditorLoading(false)
        }
      }
    }

    void loadEditorData()

    return () => {
      isMounted = false
    }
  }, [navigate, pushToast, route.id, route.name])

  const onLinkClick = (event, to) => {
    event.preventDefault()
    navigate(to)
  }

  const onAuthFieldChange = (event) => {
    const { name, value } = event.target

    setAuthForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const onPollFieldChange = (event) => {
    const { name, value } = event.target

    setPollForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthBusy(true)

    try {
      const payload = {
        name: authForm.name.trim(),
        userName: authForm.name.trim(),
        email: authForm.email.trim(),
        password: authForm.password,
      }

      const result =
        authMode === 'register'
          ? await registerUser(payload)
          : await loginUser({
              email: payload.email,
              password: payload.password,
            })

      setIsAuthorized(true)
      setUser(result.user ?? { name: payload.name, email: payload.email })
      setAuthForm(EMPTY_AUTH_FORM)
      pushToast('success', authMode === 'register' ? 'Регистрация успешна.' : 'Вход выполнен.')
      navigate('/polls')
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    setAuthBusy(true)

    try {
      await logoutUser()
      clearStoredUser()
      setIsAuthorized(false)
      setUser(null)
      pushToast('success', 'Вы вышли из аккаунта.')
      navigate('/')
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setPage(1)
    setSearchQuery(searchInput)

    if (route.name === 'home') {
      navigate('/polls')
    }
  }

  const handleDeletePoll = async (pollId) => {
    if (!isAuthorized) {
      pushToast('warning', 'Сначала войди в аккаунт.')
      navigate('/login')
      return
    }

    const isConfirmed = window.confirm('Удалить этот опрос?')

    if (!isConfirmed) {
      return
    }

    setActionBusyId(pollId)

    try {
      await deletePoll(pollId)
      pushToast('success', 'Опрос удален.')
      await loadPolls(page, searchQuery)

      if (route.name === 'poll-details') {
        navigate('/polls')
      }
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setActionBusyId(null)
    }
  }

  const handleDownloadFile = async (poll) => {
    if (!poll.attachmentId) {
      pushToast('warning', 'У опроса нет прикрепленного файла.')
      return
    }

    setActionBusyId(poll.id)

    try {
      const blob = await downloadAttachment(poll.attachmentId)
      const fileName = poll.attachmentName || `poll-${poll.id}-file.bin`
      downloadBlob(blob, fileName)
      pushToast('success', 'Файл скачан.')
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setActionBusyId(null)
    }
  }

  const handleEditorSubmit = async (event) => {
    event.preventDefault()

    if (!isAuthorized) {
      pushToast('warning', 'Для создания и редактирования нужен вход.')
      navigate('/login')
      return
    }

    if (!pollForm.title.trim()) {
      pushToast('warning', 'Введите название опроса.')
      return
    }

    setEditorBusy(true)

    try {
      let attachment = currentAttachment

      if (selectedFile) {
        attachment = await uploadAttachment(selectedFile)
      }

      const payload = {
        title: pollForm.title.trim(),
        description: pollForm.description.trim(),
      }

      if (attachment?.id) {
        payload.attachmentId = attachment.id
        payload.attachmentName = attachment.name
      }

      if (route.name === 'poll-edit') {
        const updated = await updatePoll(route.id, payload)
        pushToast('success', 'Опрос обновлен.')
        navigate(`/polls/${updated.id || route.id}`)
      } else {
        const created = await createPoll(payload)
        pushToast('success', 'Опрос создан.')
        navigate(created?.id ? `/polls/${created.id}` : '/polls')
      }
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setEditorBusy(false)
    }
  }

  const topPolls = polls.slice(0, 3)

  return (
    <div className="site-root">
      <Toasts toasts={toasts} />

      <header className="topbar-wrap">
        <div className="topbar">
          <a href="/" className="logo" onClick={(event) => onLinkClick(event, '/')}>
            gari<span>.opros</span>
          </a>

          <div className="top-actions">
            {isAuthorized ? <span className="user-name">{user?.name || user?.email || 'Профиль'}</span> : null}

            {isAuthorized ? (
              <button type="button" className="btn-login" onClick={handleLogout} disabled={authBusy}>
                Выйти
              </button>
            ) : (
              <a
                href={route.name === 'auth' && authMode === 'register' ? '/register' : '/login'}
                className="btn-login"
                onClick={(event) => onLinkClick(event, '/login')}
              >
                Войти
              </a>
            )}

            <span className="avatar-dot" aria-hidden>
              <UserIcon />
            </span>
          </div>
        </div>
      </header>

      <main className="page-wrap">
        {(route.name === 'home' || route.name === 'auth') ? (
          <section className="hero" aria-label="Баннер">
            <div className="hero-content">
              <h1>Опросы на любой вкус и цвет</h1>

              {route.name === 'home' ? (
                <form className="search-box" onSubmit={handleSearchSubmit}>
                  <SearchIcon />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Поиск"
                    autoComplete="off"
                  />
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

        {route.name === 'home' ? (
          <section className="list-block reveal" aria-labelledby="best-polls-title">
            <h2 id="best-polls-title">Лучшие опросы</h2>

            {pollError ? <p className="state-error">{pollError}</p> : null}
            {loadingPolls ? <p className="state-muted">Загружаем опросы...</p> : null}

            <div className="poll-list">
              {topPolls.map((poll) => (
                <article key={poll.id} className="poll-item" onClick={() => navigate(`/polls/${poll.id}`)}>
                  <div className="thumb">Превью</div>
                  <h3>{poll.title}</h3>
                  <p>{poll.description || 'Описание отсутствует.'}</p>
                </article>
              ))}
            </div>

            {!loadingPolls && !topPolls.length ? (
              <p className="state-muted">Пока нет данных. Добавь опрос на странице создания.</p>
            ) : null}

            <div className="home-links">
              <a href="/polls" onClick={(event) => onLinkClick(event, '/polls')}>
                Смотреть все опросы
              </a>
              {isAuthorized ? (
                <a href="/polls/new" onClick={(event) => onLinkClick(event, '/polls/new')}>
                  Создать опрос
                </a>
              ) : (
                <a href="/register" onClick={(event) => onLinkClick(event, '/register')}>
                  Регистрация
                </a>
              )}
            </div>
          </section>
        ) : null}

        {route.name === 'auth' ? (
          <section className="card auth-card reveal">
            <h2>{authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}</h2>

            <div className="switcher">
              <button type="button" onClick={() => navigate('/login')} className={authMode === 'login' ? 'active' : ''}>
                Вход
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className={authMode === 'register' ? 'active' : ''}
              >
                Регистрация
              </button>
            </div>

            <form className="form-grid" onSubmit={handleAuthSubmit}>
              {authMode === 'register' ? (
                <label>
                  Имя
                  <input type="text" name="name" value={authForm.name} onChange={onAuthFieldChange} required />
                </label>
              ) : null}

              <label>
                Email
                <input type="email" name="email" value={authForm.email} onChange={onAuthFieldChange} required />
              </label>

              <label>
                Пароль
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={onAuthFieldChange}
                  minLength={6}
                  required
                />
              </label>

              <button type="submit" className="btn-main" disabled={authBusy}>
                {authBusy ? 'Отправка...' : authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </button>
            </form>
          </section>
        ) : null}

        {route.name === 'polls' ? (
          <section className="card reveal">
            <div className="card-head">
              <h2>Все опросы</h2>
              <div className="pager-label">
                Страница {page} из {totalPages}
              </div>
            </div>

            <form className="search-box search-box-wide" onSubmit={handleSearchSubmit}>
              <SearchIcon />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Поиск по названию"
                autoComplete="off"
              />
            </form>

            {pollError ? <p className="state-error">{pollError}</p> : null}
            {loadingPolls ? <p className="state-muted">Загружаем опросы...</p> : null}

            <div className="poll-grid">
              {polls.map((poll) => (
                <article key={poll.id} className="poll-card">
                  <h3>{poll.title}</h3>
                  <p>{poll.description || 'Описание отсутствует.'}</p>
                  {poll.createdAt ? <time>{formatDate(poll.createdAt)}</time> : null}

                  <div className="row-actions">
                    <button type="button" className="btn-sub" onClick={() => navigate(`/polls/${poll.id}`)}>
                      Открыть
                    </button>
                    {isAuthorized ? (
                      <button type="button" className="btn-sub" onClick={() => navigate(`/polls/${poll.id}/edit`)}>
                        Редактировать
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-sub"
                      disabled={actionBusyId === poll.id}
                      onClick={() => handleDownloadFile(poll)}
                    >
                      Скачать файл
                    </button>
                    {isAuthorized ? (
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={actionBusyId === poll.id}
                        onClick={() => handleDeletePoll(poll.id)}
                      >
                        Удалить
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {!loadingPolls && !polls.length ? <p className="state-muted">Ничего не найдено.</p> : null}

            <div className="pager">
              <button
                type="button"
                className="btn-sub"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Назад
              </button>

              <button
                type="button"
                className="btn-sub"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Вперед
              </button>
            </div>
          </section>
        ) : null}

        {route.name === 'poll-details' ? (
          <section className="card reveal">
            {detailBusy ? <p className="state-muted">Загружаем опрос...</p> : null}
            {detailError ? <p className="state-error">{detailError}</p> : null}

            {!detailBusy && detailPoll ? (
              <>
                <div className="card-head">
                  <h2>{detailPoll.title}</h2>
                  {detailPoll.createdAt ? <time>{formatDate(detailPoll.createdAt)}</time> : null}
                </div>

                <p className="detail-text">{detailPoll.description || 'Описание отсутствует.'}</p>
                <p className="state-muted">
                  Файл: {detailPoll.attachmentName || detailPoll.attachmentId || 'не прикреплен'}
                </p>

                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-sub"
                    disabled={actionBusyId === detailPoll.id}
                    onClick={() => handleDownloadFile(detailPoll)}
                  >
                    Скачать файл
                  </button>
                  {isAuthorized ? (
                    <button type="button" className="btn-sub" onClick={() => navigate(`/polls/${detailPoll.id}/edit`)}>
                      Редактировать
                    </button>
                  ) : null}
                  {isAuthorized ? (
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={actionBusyId === detailPoll.id}
                      onClick={() => handleDeletePoll(detailPoll.id)}
                    >
                      Удалить
                    </button>
                  ) : null}
                  <button type="button" className="btn-sub" onClick={() => navigate('/polls')}>
                    Назад к списку
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {(route.name === 'poll-new' || route.name === 'poll-edit') ? (
          <section className="card editor-card reveal">
            <div className="card-head">
              <h2>{route.name === 'poll-edit' ? 'Редактирование опроса' : 'Новый опрос'}</h2>
              <button type="button" className="btn-sub" onClick={() => navigate('/polls')}>
                Отмена
              </button>
            </div>

            {!isAuthorized ? (
              <>
                <p className="state-error">Нужно войти в аккаунт, чтобы работать с опросами.</p>
                <button type="button" className="btn-main" onClick={() => navigate('/login')}>
                  Перейти ко входу
                </button>
              </>
            ) : (
              <form className="form-grid" onSubmit={handleEditorSubmit}>
                {editorLoading ? <p className="state-muted">Загружаем данные для редактирования...</p> : null}

                <label>
                  Название
                  <input
                    type="text"
                    name="title"
                    value={pollForm.title}
                    onChange={onPollFieldChange}
                    maxLength={120}
                    required
                  />
                </label>

                <label>
                  Описание
                  <textarea
                    name="description"
                    value={pollForm.description}
                    onChange={onPollFieldChange}
                    rows={4}
                    maxLength={1000}
                  />
                </label>

                <label>
                  Файл
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.txt"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                {currentAttachment?.id && !selectedFile ? (
                  <p className="state-muted">Текущий файл: {currentAttachment.name || `ID ${currentAttachment.id}`}</p>
                ) : null}

                {selectedFile ? <p className="state-muted">Выбрано: {selectedFile.name}</p> : null}

                <button type="submit" className="btn-main" disabled={editorBusy || editorLoading}>
                  {editorBusy ? 'Сохраняем...' : route.name === 'poll-edit' ? 'Обновить' : 'Создать'}
                </button>
              </form>
            )}
          </section>
        ) : null}

        {route.name === 'not-found' ? (
          <section className="card reveal">
            <h2>Страница не найдена</h2>
            <button type="button" className="btn-main" onClick={() => navigate('/')}>
              На главную
            </button>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App

