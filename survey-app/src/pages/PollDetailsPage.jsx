import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { downloadAttachment } from '../api/files.js'
import { getPollById } from '../api/polls.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'file.bin'
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function PollDetailsPage() {
  const { id } = useParams()
  const { pushToast } = useToast()

  const [poll, setPoll] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const payload = await getPollById(id)
        setPoll(payload)
      } catch (err) {
        const message = toUserMessage(err)
        setError(message)
        pushToast('error', message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, pushToast])

  const onDownload = async () => {
    if (!poll?.attachmentId) {
      pushToast('warning', 'Файл не прикреплён')
      return
    }

    try {
      const blob = await downloadAttachment(poll.attachmentId)
      downloadBlob(blob, poll.attachmentName || `${poll.id}.bin`)
      pushToast('success', 'Файл скачан')
    } catch (err) {
      const message = toUserMessage(err)
      setError(message)
      pushToast('error', message)
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Загрузка опроса...</p>
      </section>
    )
  }

  if (!poll) {
    return (
      <section className="card">
        <p className="error-box">{error || 'Опрос не найден'}</p>
        <Link to="/polls" className="soft-btn">
          Назад
        </Link>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>{poll.title}</h2>
        <Link to="/polls" className="soft-btn">
          К списку
        </Link>
      </div>

      <div className="photo-placeholder large">Место для фотографии / баннера опроса</div>

      <p>{poll.description || 'Описание отсутствует'}</p>
      <p className="muted">Файл: {poll.attachmentName || poll.attachmentId || 'не прикреплён'}</p>

      <div className="actions-row">
        <button type="button" className="soft-btn" onClick={onDownload}>
          Скачать файл
        </button>
        <Link to={`/polls/${poll.id}/stats`} className="soft-btn">
          Статистика
        </Link>
        <Link to={`/polls/${poll.id}/edit`} className="soft-btn">
          Редактировать
        </Link>
      </div>

      {error ? <p className="error-box">{error}</p> : null}
    </section>
  )
}
