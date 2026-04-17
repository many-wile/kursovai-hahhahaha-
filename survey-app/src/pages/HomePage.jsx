import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPolls } from '../api/polls.js'
import { toUserMessage } from '../lib/apiError.js'


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

export default function HomePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getPolls({ page: 1, pageSize: 3, query: '' })
        setItems(data.items)
      } catch (err) {
        setError(toUserMessage(err))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const onSearch = (event) => {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/polls?query=${encodeURIComponent(query)}` : '/polls')
  }

  return (
    <>
      <section className="hero-box" aria-label="Баннер">
        <h1>Опросы на любой вкус и цвет</h1>

        <form className="hero-search" onSubmit={onSearch}>
          <SearchIcon />
          <input
            type="search"
            placeholder="Поиск"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />
        </form>
      </section>

      <section className="section-block">
        <h2>Лучшие опросы</h2>

        {error ? <p className="error-box">{error}</p> : null}
        {loading ? <p className="muted">Загрузка...</p> : null}

        <div className="poll-vertical-list">
          {items.map((poll) => (
            <article key={poll.id} className="vertical-card">
              <div className="photo-placeholder">Место для фото опроса</div>
              <h3>{poll.title}</h3>
              <p>{poll.description || 'Описание появится позже'}</p>
              <div className="inline-links">
                <Link to={`/polls/${poll.id}`}>Подробнее</Link>
                <Link to={`/polls/${poll.id}/stats`}>Статистика</Link>
              </div>
            </article>
          ))}
        </div>

        {!loading && !items.length ? <p className="muted">Пока нет опросов.</p> : null}

        <div className="inline-links">
          <Link to="/polls">Смотреть все опросы</Link>
          <Link to="/register">Создать аккаунт</Link>
        </div>
      </section>
    </>
  )
}
