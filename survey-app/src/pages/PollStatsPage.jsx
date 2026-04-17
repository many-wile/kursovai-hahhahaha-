import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPollById } from '../api/polls.js'
import { toUserMessage } from '../lib/apiError.js'

export default function PollStatsPage() {
  const { id } = useParams()
  const [poll, setPoll] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await getPollById(id)
        setPoll(payload)
      } catch (err) {
        setError(toUserMessage(err))
      }
    }

    void load()
  }, [id])

  return (
    <section className="card">
      <div className="card-head">
        <h2>Статистика опроса</h2>
        <Link to={`/polls/${id}`} className="soft-btn">
          Назад
        </Link>
      </div>

      {poll ? <p className="muted">Опрос: {poll.title}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <div className="stats-grid">
        <div className="photo-placeholder">Диаграмма 1 (плейсхолдер)</div>
        <div className="photo-placeholder">Диаграмма 2 (плейсхолдер)</div>
        <div className="photo-placeholder">Диаграмма 3 (плейсхолдер)</div>
      </div>

      <p className="muted">Когда API статистики будет готово, сюда подключатся реальные данные голосований.</p>
    </section>
  )
}
