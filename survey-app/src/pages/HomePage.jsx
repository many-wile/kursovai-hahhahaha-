import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPolls } from '../api/polls.js'
import { getStoredTokens } from '../lib/tokenStorage.js'
import { toUserMessage } from '../lib/apiError.js'
import { logoutUser } from '../api/auth.js'

function HomePage() {
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const navigate = useNavigate()
  const isAuthorized = Boolean(getStoredTokens().accessToken)

  useEffect(() => {
    const loadTopPolls = async () => {
      setLoading(true)
      try {
        const data = await getPolls({ page: 1, pageSize: 3, query: '' })
        setPolls(data.items)
      } catch (err) {
        setError(toUserMessage(err))
      } finally {
        setLoading(false)
      }
    }
    loadTopPolls()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchInput.trim()) {
      navigate(`/polls?q=${encodeURIComponent(searchInput)}`)
    } else {
      navigate('/polls')
    }
  }

  return (
    <div className="site-root">
      <header className="topbar-wrap">
        <div className="topbar">
          <Link to="/" className="logo">gart<span>.opros</span></Link>
          <div className="top-actions">
            {isAuthorized ? (
              <>
                <span className="user-name">Профиль</span>
                <button className="btn-login" onClick={() => navigate('/profile')}>Профиль</button>
                <button className="btn-login" onClick={async () => { await logoutUser(); navigate('/') }}>Выйти</button>
              </>
            ) : (
              <Link to="/login" className="btn-login">Войти</Link>
            )}
            <span className="avatar-dot">👤</span>
          </div>
        </div>
      </header>

      <main className="page-wrap">
        <section className="hero">
          <div className="hero-content">
            <h1>Опросы на любой вкус и цвет</h1>
            <form className="search-box" onSubmit={handleSearch}>
              <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Поиск" />
            </form>
          </div>
        </section>

        <section className="list-block reveal">
          <h2>Лучшие опросы</h2>
          {error && <p className="state-error">{error}</p>}
          {loading && <p className="state-muted">Загрузка...</p>}
          <div className="poll-list">
            {polls.map(poll => (
              <article key={poll.id} className="poll-item" onClick={() => navigate(`/polls/${poll.id}`)}>
                <div className="thumb">📋</div>
                <h3>{poll.title}</h3>
                <p>{poll.description || 'Описание отсутствует'}</p>
              </article>
            ))}
          </div>
          <div className="home-links">
            <Link to="/polls">Смотреть все опросы</Link>
            {isAuthorized ? (
              <Link to="/polls/new">Создать опрос</Link>
            ) : (
              <Link to="/register">Регистрация</Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default HomePage