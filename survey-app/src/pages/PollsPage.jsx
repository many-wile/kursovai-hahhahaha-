import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deletePoll, getPolls } from '../api/polls.js'
import { downloadAttachment, getAttachmentPreviewUrl, isImageAttachment } from '../api/files.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { getStoredTokens } from '../lib/tokenStorage.js'

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'file.bin'
  anchor.click()
  URL.revokeObjectURL(url)
}

function hasCoverImage(poll) {
  return Boolean(poll?.attachmentId && isImageAttachment(poll.attachmentName || poll.imagePath))
}

export default function PollsPage() {
  const { pushToast } = useToast()
  const { accessToken } = getStoredTokens()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialQuery = searchParams.get('query') || ''

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [queryInput, setQueryInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(6)
  const [totalCount, setTotalCount] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount])

  const load = useCallback(
    async (targetPage = page, targetQuery = query) => {
      setLoading(true)
      setError('')

      try {
        const data = await getPolls({ page: targetPage, pageSize, query: targetQuery })
        setItems(data.items)
        setTotalCount(data.totalCount)
      } catch (err) {
        const message = toUserMessage(err)
        setError(message)
        pushToast('error', message)
        setItems([])
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, pushToast, query],
  )

  useEffect(() => {
    void load(page, query)
  }, [load, page, query])

  const onSearch = (event) => {
    event.preventDefault()
    const normalized = queryInput.trim()
    setPage(1)
    setQuery(normalized)

    if (normalized) {
      setSearchParams({ query: normalized })
    } else {
      setSearchParams({})
    }
  }

  const onDelete = async (id) => {
    if (!accessToken) {
      pushToast('warning', 'Для удаления нужен вход в аккаунт')
      return
    }

    if (!window.confirm('Удалить опрос?')) {
      return
    }

    try {
      await deletePoll(id)
      pushToast('success', 'Опрос удалён')
      await load(page, query)
    } catch (err) {
      const message = toUserMessage(err)
      pushToast('error', message)
      setError(message)
    }
  }

  const onDownload = async (poll) => {
    if (!poll.attachmentId) {
      pushToast('warning', 'Файл не прикреплён')
      return
    }

    try {
      const blob = await downloadAttachment(poll.attachmentId)
      downloadBlob(blob, poll.attachmentName || `poll-${poll.id}.bin`)
      pushToast('success', 'Файл скачан')
    } catch (err) {
      const message = toUserMessage(err)
      pushToast('error', message)
      setError(message)
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Все опросы</h2>
        <div className="actions-row">
          <span className="muted">Страница {page} из {totalPages}</span>
          {accessToken ? (
            <Link to="/polls/new" className="gold-btn">
              Создать опрос
            </Link>
          ) : null}
        </div>
      </div>

      <form className="hero-search search-wide" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Поиск опросов"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
        />
      </form>

      {error ? <p className="error-box">{error}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      <div className="poll-grid">
        {items.map((poll) => (
          <article key={poll.id} className="poll-card">
            {hasCoverImage(poll) ? (
              <img className="poll-cover-image" src={getAttachmentPreviewUrl(poll.attachmentId)} alt={poll.title} loading="lazy" />
            ) : (
              <div className="photo-placeholder">Место для фото обложки</div>
            )}

            <h3>{poll.title}</h3>
            <p>{poll.description || 'Описание отсутствует'}</p>
            <p className="muted">
              {poll.attachmentId ? `Файл: ${poll.attachmentName || poll.attachmentId}` : 'Файл не прикреплён'}
            </p>

            <div className="actions-row">
              <Link className="soft-btn" to={`/polls/${poll.id}`}>
                Подробнее
              </Link>
              <button type="button" className="soft-btn" onClick={() => onDownload(poll)}>
                Скачать
              </button>
              <Link className="soft-btn" to={`/polls/${poll.id}/stats`}>
                Статистика
              </Link>
              {accessToken ? (
                <Link className="soft-btn" to={`/polls/${poll.id}/edit`}>
                  Редактировать
                </Link>
              ) : null}
              {accessToken ? (
                <button type="button" className="danger-btn" onClick={() => onDelete(poll.id)}>
                  Удалить
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!loading && !items.length ? <p className="muted">По запросу ничего не найдено.</p> : null}

      <div className="pager">
        <button type="button" className="soft-btn" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
          Назад
        </button>
        <button
          type="button"
          className="soft-btn"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Вперёд
        </button>
      </div>
    </section>
  )
}
