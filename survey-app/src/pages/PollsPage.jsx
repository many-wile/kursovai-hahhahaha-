import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deletePoll, getPolls } from '../api/polls.js'
import { downloadAttachment } from '../api/files.js'
import { toUserMessage } from '../lib/apiError.js'

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'file.bin'
  anchor.click()
  URL.revokeObjectURL(url)
}

function PollsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const load = useCallback(
    async (targetPage = page, targetQuery = query) => {
      setLoading(true)
      setError('')

      try {
        const data = await getPolls({ page: targetPage, pageSize, query: targetQuery })
        setItems(data.items)
        setTotalCount(data.totalCount)
      } catch (err) {
        setError(toUserMessage(err))
        setItems([])
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, query],
  )

  useEffect(() => {
    void load(page, query)
  }, [load, page, query])

  const onSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setQuery(queryInput)
  }

  const onDelete = async (id) => {
    if (!window.confirm('Удалить опрос?')) {
      return
    }

    try {
      await deletePoll(id)
      await load(page, query)
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  const onDownload = async (poll) => {
    if (!poll.attachmentId) {
      return
    }

    try {
      const blob = await downloadAttachment(poll.attachmentId)
      downloadBlob(blob, poll.attachmentName || `poll-${poll.id}.bin`)
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  return (
    <section className="panel panel-main">
      <div className="panel-head">
        <h1>Опросы</h1>
        <Link to="/polls/new" className="btn">
          Создать опрос
        </Link>
      </div>

      <form className="search" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Поиск опросов"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
        />
        <button className="btn btn-small" type="submit">
          Найти
        </button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      <div className="polls-grid">
        {items.map((poll) => (
          <article key={poll.id} className="poll-card">
            <h3>{poll.title}</h3>
            <p>{poll.description || 'Без описания'}</p>
            <p className="muted">
              {poll.attachmentId ? `Файл: ${poll.attachmentName || poll.attachmentId}` : 'Файл не прикреплен'}
            </p>

            <div className="card-actions">
              <Link className="btn btn-soft" to={`/polls/${poll.id}/edit`}>
                Редактировать
              </Link>
              <Link className="btn btn-soft" to={`/polls/${poll.id}/stats`}>
                Статистика
              </Link>
              <button type="button" className="btn btn-soft" onClick={() => onDownload(poll)}>
                Скачать файл
              </button>
              <button type="button" className="btn btn-danger" onClick={() => onDelete(poll.id)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="pager">
        <button type="button" className="btn btn-soft" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Назад
        </button>
        <span className="muted">
          Страница {page} из {totalPages}
        </span>
        <button type="button" className="btn btn-soft" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Вперед
        </button>
      </div>
    </section>
  )
}

export default PollsPage
