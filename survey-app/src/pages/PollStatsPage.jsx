import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { POLL_HUB_URL } from '../api/endpoints.js'
import { getPollById, isPollOwner } from '../api/polls.js'
import { hasUserCompletedPoll, loadPollStats } from '../api/votes.js'
import { toUserMessage } from '../lib/apiError.js'
import { getStoredUser } from '../lib/tokenStorage.js'

function formatSubmittedAt(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return ''
  }

  return date.toLocaleString('ru-RU')
}

export default function PollStatsPage() {
  const { id } = useParams()
  const currentUser = getStoredUser()

  const [poll, setPoll] = useState(null)
  const [stats, setStats] = useState({ totalResponses: 0, questions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const payload = await getPollById(id)

        if (cancelled) {
          return
        }

        setPoll(payload)
        setStats(await loadPollStats(payload))
      } catch (err) {
        if (!cancelled) {
          setError(toUserMessage(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(POLL_HUB_URL)
      .withAutomaticReconnect()
      .build()

    connection.on('ReceiveStatsUpdate', (surveyId) => {
      if (String(surveyId) === String(id)) {
        void load()
      }
    })

    void connection.start().catch(() => {})

    const onStorage = () => {
      void load()
    }

    window.addEventListener('storage', onStorage)

    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
      void connection.stop()
    }
  }, [id])

  const canSeeStats = useMemo(() => {
    if (!poll) {
      return false
    }

    return isPollOwner(poll, currentUser) || hasUserCompletedPoll(poll.id, currentUser)
  }, [currentUser, poll])

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Загрузка статистики...</p>
      </section>
    )
  }

  if (!poll) {
    return (
      <section className="card">
        <p className="error-box">{error || 'Опрос не найден'}</p>
        <Link to="/polls" className="soft-btn">
          К списку
        </Link>
      </section>
    )
  }

  if (!canSeeStats) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Статистика опроса</h2>
          <Link to={`/polls/${id}`} className="soft-btn">
            Назад
          </Link>
        </div>

        <p className="muted">Опрос: {poll.title}</p>
        <p className="error-box">
          Статистика доступна только автору опроса или пользователю после его прохождения.
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Статистика опроса</h2>
        <Link to={`/polls/${id}`} className="soft-btn">
          Назад
        </Link>
      </div>

      <p className="muted">Опрос: {poll.title}</p>
      {error ? <p className="error-box">{error}</p> : null}

      <div className="stats-summary">
        <div className="stats-summary-card">
          <span className="muted">Всего ответов</span>
          <strong>{stats.totalResponses}</strong>
        </div>
        <div className="stats-summary-card">
          <span className="muted">Вопросов</span>
          <strong>{Array.isArray(poll.questions) ? poll.questions.length : 0}</strong>
        </div>
      </div>

      {!stats.totalResponses ? (
        <div className="photo-placeholder large">
          Пока нет ответов. Статистика появится после прохождения опроса.
        </div>
      ) : (
        <div className="stats-question-list">
          {stats.questions.map((question, index) => (
            <article key={question.key} className="stats-question-card">
              <div className="card-head">
                <h3>Вопрос {index + 1}</h3>
                <span className="muted">Ответов: {question.totalAnswers}</span>
              </div>

              <p>{question.text}</p>

              {question.type === 'choice' ? (
                <>
                  <div className="stats-option-list">
                    {question.optionStats.map((option) => (
                      <div key={option.text} className="stats-option-row">
                        <div className="stats-option-head">
                          <span>{option.text}</span>
                          <span className="muted">
                            {option.count} ({option.percent}%)
                          </span>
                        </div>
                        <div className="stats-bar-track">
                          <div className="stats-bar-fill" style={{ width: `${option.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {question.customAnswers.length ? (
                    <div className="stats-answer-list">
                      {question.customAnswers.map((answer, answerIndex) => (
                        <div key={`${question.key}_custom_${answerIndex}`} className="stats-answer-item">
                          <p>{answer.text}</p>
                          <span className="stats-answer-meta">
                            {answer.responder}
                            {answer.submittedAt ? `, ${formatSubmittedAt(answer.submittedAt)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : question.textAnswers.length ? (
                <div className="stats-answer-list">
                  {question.textAnswers.map((answer, answerIndex) => (
                    <div key={`${question.key}_text_${answerIndex}`} className="stats-answer-item">
                      <p>{answer.text}</p>
                      <span className="stats-answer-meta">
                        {answer.responder}
                        {answer.submittedAt ? `, ${formatSubmittedAt(answer.submittedAt)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Пока нет текстовых ответов.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
