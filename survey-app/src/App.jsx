import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { loginUser, logoutUser, registerUser } from './api/auth.js'
import { downloadAttachment, uploadAttachment } from './api/files.js'
import { createPoll, deletePoll, getPollById, getPolls, updatePoll } from './api/polls.js'
import { toUserMessage } from './lib/apiError.js'
import { clearStoredUser, getStoredTokens, getStoredUser } from './lib/tokenStorage.js'

const EMPTY_AUTH_FORM = { name: '', email: '', password: '' }
const EMPTY_POLL_FORM = { title: '', description: '' }
const PAGE_SIZE = 6

function parseRoute(pathname) {
  if (pathname === '/') return { name: 'home' }
  if (pathname === '/login' || pathname === '/auth') return { name: 'auth', mode: 'login' }
  if (pathname === '/register') return { name: 'auth', mode: 'register' }
  if (pathname === '/polls') return { name: 'polls' }
  if (pathname === '/polls/new') return { name: 'poll-new' }
  const editMatch = pathname.match(/^\/polls\/([^/]+)\/edit$/)
  if (editMatch) return { name: 'poll-edit', id: decodeURIComponent(editMatch[1]) }
  const detailMatch = pathname.match(/^\/polls\/([^/]+)$/)
  if (detailMatch) return { name: 'poll-details', id: decodeURIComponent(detailMatch[1]) }
  return { name: 'not-found' }
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 19a8 8 0 100-16 8 8 0 000 16zm9 2l-4.35-4.35" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5z" />
    </svg>
  )
}

function Toasts({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>{toast.text}</div>
      ))}
    </div>
  )
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleString('ru-RU')
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
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorLoading, setEditorLoading] = useState(false)
  const [actionBusyId, setActionBusyId] = useState(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount])

  const navigate = useCallback((to) => {
    if (to === window.location.pathname) return
    window.history.pushState({}, '', to)
    setPathname(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (route.name === 'auth') setAuthMode(route.mode)
  }, [route.mode, route.name])

  const pushToast = useCallback((type, text) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, type, text }])
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3200)
  }, [])

  const loadPolls = useCallback(async (targetPage, targetQuery) => {
    setLoadingPolls(true)
    setPollError('')
    try {
      const payload = await getPolls({ page: targetPage, pageSize: PAGE_SIZE, query: targetQuery })
      setPolls(payload.items)
      setTotalCount(payload.totalCount)
    } catch (error) {
      setPollError(toUserMessage(error))
      setPolls([])
    } finally {
      setLoadingPolls(false)
    }
  }, [])

  useEffect(() => {
    if (route.name === 'home' || route.name === 'polls') loadPolls(page, searchQuery)
  }, [loadPolls, page, route.name, searchQuery])

  const loadPollDetails = useCallback(async (pollId) => {
    setDetailBusy(true)
    setDetailError('')
    try {
      const payload = await getPollById(pollId)
      setDetailPoll(payload)
    } catch (error) {
      setDetailError(toUserMessage(error))
    } finally {
      setDetailBusy(false)
    }
  }, [])

  useEffect(() => {
    if (route.name === 'poll-details') loadPollDetails(route.id)
  }, [loadPollDetails, route.id, route.name])

  useEffect(() => {
    if (route.name === 'poll-new') {
      setPollForm(EMPTY_POLL_FORM)
      setSelectedFile(null)
    } else if (route.name === 'poll-edit') {
      setEditorLoading(true)
      getPollById(route.id).then(payload => {
        setPollForm({ title: payload.title || '', description: payload.description || '' })
        setEditorLoading(false)
      }).catch(() => navigate('/polls'))
    }
  }, [route.id, route.name, navigate])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthBusy(true)
    try {
      const payload = { fullName: authForm.name.trim(), email: authForm.email.trim(), password: authForm.password }
      const result = authMode === 'register' ? await registerUser(payload) : await loginUser({ email: payload.email, password: payload.password })
      setIsAuthorized(true)
      setUser(result.user)
      pushToast('success', 'Успешно!')
      navigate('/polls')
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  const handleEditorSubmit = async (event) => {
    event.preventDefault()
    if (!isAuthorized) return navigate('/login')
    setEditorBusy(true)
    try {
      const payload = { title: pollForm.title.trim(), description: pollForm.description.trim() }
      let result;
      
      if (route.name === 'poll-edit') {
        result = await updatePoll(route.id, { ...payload, id: parseInt(route.id) })
      } else {
        result = await createPoll(payload)
      }

      const activeId = route.name === 'poll-edit' ? route.id : result?.id;

      if (selectedFile && activeId) {
        pushToast('info', 'Загружаем фото...')
        await uploadAttachment(activeId, selectedFile)
      }

      pushToast('success', 'Сохранено!')
      navigate(`/polls/${activeId}`)
    } catch (error) {
      pushToast('error', toUserMessage(error))
    } finally {
      setEditorBusy(false)
    }
  }

  const handleDownloadFile = async (pollId) => {
    setActionBusyId(pollId)
    try {
      const blob = await downloadAttachment(pollId)
      downloadBlob(blob, `survey-${pollId}-img.jpg`)
      pushToast('success', 'Файл скачан')
    } catch (error) {
      pushToast('error', 'Файла нет или ошибка сервера')
    } finally {
      setActionBusyId(null)
    }
  }

  return (
    <div className="site-root">
      <Toasts toasts={toasts} />
      <header className="topbar-wrap">
        <div className="topbar">
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); navigate('/') }}>gari<span>.opros</span></a>
          <div className="top-actions">
            {isAuthorized && <span className="user-name">{user?.name || user?.fullName || user?.email}</span>}
            <button className="btn-login" onClick={isAuthorized ? () => { logoutUser(); setIsAuthorized(false); navigate('/') } : () => navigate('/login')}>
              {isAuthorized ? 'Выйти' : 'Войти'}
            </button>
            <span className="avatar-dot"><UserIcon /></span>
          </div>
        </div>
      </header>

      <main className="page-wrap">
        {route.name === 'auth' && (
          <section className="card auth-card reveal">
            <h2>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
            <div className="switcher">
              <button onClick={() => navigate('/login')} className={authMode === 'login' ? 'active' : ''}>Вход</button>
              <button onClick={() => navigate('/register')} className={authMode === 'register' ? 'active' : ''}>Регистрация</button>
            </div>
            <form className="form-grid" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label>Имя<input type="text" value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})} required /></label>
              )}
              <label>Email<input type="email" value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} required /></label>
              <label>Пароль<input type="password" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} required /></label>
              <button type="submit" className="btn-main" disabled={authBusy}>Отправить</button>
            </form>
          </section>
        )}

        {(route.name === 'home' || route.name === 'polls') && (
          <section className="card reveal">
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>{route.name === 'home' ? 'Лучшие опросы' : 'Все опросы'}</h2>
                {isAuthorized && <button className="btn-main" style={{width:'auto', padding:'0 20px'}} onClick={() => navigate('/polls/new')}>Создать опрос</button>}
             </div>
             <div className="poll-grid" style={{marginTop:'20px'}}>
                {polls.map(poll => (
                  <article key={poll.id} className="poll-card">
                    <div className="thumb" style={{height:'120px', background:'#222', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'}}>
                       <img src={`https://localhost:7054/api/Surveys/${poll.id}/image`} alt="" onError={(e) => e.target.style.display='none'} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                       <span style={{color:'#666'}}>Нет обложки</span>
                    </div>
                    <h3>{poll.title}</h3>
                    <p>{poll.description}</p>
                    <div className="row-actions">
                      <button className="btn-sub" onClick={() => navigate(`/polls/${poll.id}`)}>Открыть</button>
                      <button className="btn-sub" onClick={() => handleDownloadFile(poll.id)}>Скачать фото</button>
                    </div>
                  </article>
                ))}
             </div>
          </section>
        )}

        {route.name === 'poll-details' && detailPoll && (
          <section className="card reveal">
            <h2>{detailPoll.title}</h2>
            <p>{detailPoll.description}</p>
            <img src={`https://localhost:7054/api/Surveys/${detailPoll.id}/image`} alt="Обложка" style={{maxWidth:'100%', borderRadius:'8px', margin:'20px 0'}} onError={(e) => e.target.style.display='none'} />
            <div className="row-actions">
              <button className="btn-sub" onClick={() => navigate('/polls')}>Назад</button>
              {isAuthorized && <button className="btn-sub" onClick={() => navigate(`/polls/${detailPoll.id}/edit`)}>Редактировать</button>}
              <button className="btn-sub" onClick={() => handleDownloadFile(detailPoll.id)}>Скачать фото</button>
            </div>
          </section>
        )}

        {(route.name === 'poll-new' || route.name === 'poll-edit') && (
          <section className="card editor-card reveal">
            <h2>{route.name === 'poll-edit' ? 'Редактирование' : 'Новый опрос'}</h2>
            <form className="form-grid" onSubmit={handleEditorSubmit}>
              <label>Название<input type="text" value={pollForm.title} onChange={(e) => setPollForm({...pollForm, title: e.target.value})} required /></label>
              <label>Описание<textarea value={pollForm.description} onChange={(e) => setPollForm({...pollForm, description: e.target.value})} /></label>
              <label>Фото<input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} /></label>
              <button type="submit" className="btn-main" disabled={editorBusy || editorLoading}>Сохранить</button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

export default App