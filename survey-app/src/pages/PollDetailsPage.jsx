import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { downloadAttachment, getAttachmentPreviewUrl, isImageAttachment } from '../api/files.js'
import { getPollById, isPollOwner, POLL_QUESTION_TYPES } from '../api/polls.js'
import { hasUserCompletedPoll, submitPollVote } from '../api/votes.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { getStoredUser } from '../lib/tokenStorage.js'

const CUSTOM_ANSWER_MARKER = '__custom__'

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

function buildQuestionKey(question, index) {
  return `${question?.id ?? 'q'}_${index}`
}

export default function PollDetailsPage() {
  const { id } = useParams()
  const { pushToast } = useToast()
  const currentUser = getStoredUser()

  const [poll, setPoll] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState({})
  const [hasCompleted, setHasCompleted] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const payload = await getPollById(id)
        setPoll(payload)
        setHasCompleted(hasUserCompletedPoll(payload.id, getStoredUser()))
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

  const questions = useMemo(() => (Array.isArray(poll?.questions) ? poll.questions : []), [poll?.questions])
  const canEdit = Boolean(poll && isPollOwner(poll, currentUser))
  const canSeeStats = canEdit || hasCompleted

  useEffect(() => {
    const initial = {}

    questions.forEach((question, index) => {
      const key = buildQuestionKey(question, index)
      initial[key] = {
        selected: '',
        customText: '',
        textValue: '',
      }
    })

    setAnswers(initial)
  }, [questions])

  const onDownload = async () => {
    if (!poll?.attachmentId) {
      pushToast('warning', 'Изображение не прикреплено')
      return
    }

    try {
      const blob = await downloadAttachment(poll.attachmentId)
      downloadBlob(blob, poll.attachmentName || `${poll.id}.bin`)
      pushToast('success', 'Изображение скачано')
    } catch (err) {
      const message = toUserMessage(err)
      setError(message)
      pushToast('error', message)
    }
  }

  const onChoiceSelect = (questionKey, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: {
        ...prev[questionKey],
        selected: value,
      },
    }))
  }

  const onChoiceCustomText = (questionKey, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: {
        ...prev[questionKey],
        customText: value,
        selected: CUSTOM_ANSWER_MARKER,
      },
    }))
  }

  const onTextAnswer = (questionKey, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: {
        ...prev[questionKey],
        textValue: value,
      },
    }))
  }

  const onSubmitVote = async () => {
    if (!poll) {
      return
    }

    const normalizedAnswers = []

    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i]
      const questionKey = buildQuestionKey(question, i)
      const answerState = answers[questionKey] || {}
      const type = question.type === POLL_QUESTION_TYPES.CHOICE ? POLL_QUESTION_TYPES.CHOICE : POLL_QUESTION_TYPES.TEXT

      if (type === POLL_QUESTION_TYPES.TEXT) {
        const answer = String(answerState.textValue || '').trim()

        if (!answer) {
          pushToast('warning', `Ответьте на вопрос №${i + 1}`)
          return
        }

        normalizedAnswers.push({
          questionId: question.id ?? null,
          questionText: question.text,
          type,
          answer,
        })
        continue
      }

      const selected = String(answerState.selected || '').trim()
      if (!selected) {
        pushToast('warning', `Выберите вариант в вопросе №${i + 1}`)
        return
      }

      if (selected === CUSTOM_ANSWER_MARKER) {
        const customAnswer = String(answerState.customText || '').trim()
        if (!customAnswer) {
          pushToast('warning', `Введите свой вариант в вопросе №${i + 1}`)
          return
        }

        normalizedAnswers.push({
          questionId: question.id ?? null,
          questionText: question.text,
          type,
          answer: customAnswer,
          selectedOption: 'custom',
        })
        continue
      }

      normalizedAnswers.push({
        questionId: question.id ?? null,
        questionText: question.text,
        type,
        answer: selected,
        selectedOption: selected,
      })
    }

    setBusy(true)
    setError('')

    try {
      const result = await submitPollVote(poll.id, {
        surveyId: poll.id,
        submittedAt: new Date().toISOString(),
        answers: normalizedAnswers,
      })

      setHasCompleted(hasUserCompletedPoll(poll.id, getStoredUser()))

      if (result?.local) {
        pushToast('warning', 'Backend недоступен. Ответ сохранен локально.')
      } else {
        pushToast('success', 'Ответы отправлены')
      }
    } catch (err) {
      const message = toUserMessage(err)
      setError(message)
      pushToast('error', message)
    } finally {
      setBusy(false)
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

      {hasCoverImage(poll) ? (
        <img className="poll-cover-image poll-cover-image-large" src={getAttachmentPreviewUrl(poll.attachmentId)} alt={poll.title} />
      ) : (
        <div className="photo-placeholder large">Место для фотографии или баннера опроса</div>
      )}

      <p>{poll.description || 'Описание отсутствует'}</p>
      <p className="muted">Вопросов: {questions.length}</p>

      <div className="poll-run-list">
        {questions.map((question, index) => {
          const questionKey = buildQuestionKey(question, index)
          const answerState = answers[questionKey] || {}
          const type = question.type === POLL_QUESTION_TYPES.CHOICE ? POLL_QUESTION_TYPES.CHOICE : POLL_QUESTION_TYPES.TEXT
          const options = Array.isArray(question.options) ? question.options : []

          return (
            <article key={questionKey} className="poll-run-card">
              <h3>Вопрос {index + 1}</h3>
              <p>{question.text}</p>

              {type === POLL_QUESTION_TYPES.CHOICE ? (
                <div className="poll-run-options">
                  {options.map((option, optionIndex) => {
                    const value = option.text || `Вариант ${optionIndex + 1}`
                    return (
                      <label key={`${questionKey}_${optionIndex}`} className="poll-run-option">
                        <input
                          type="radio"
                          name={questionKey}
                          checked={answerState.selected === value}
                          onChange={() => onChoiceSelect(questionKey, value)}
                        />
                        <span>{value}</span>
                      </label>
                    )
                  })}

                  <label className="poll-run-option">
                    <input
                      type="radio"
                      name={questionKey}
                      checked={answerState.selected === CUSTOM_ANSWER_MARKER}
                      onChange={() => onChoiceSelect(questionKey, CUSTOM_ANSWER_MARKER)}
                    />
                    <span>Свой вариант</span>
                  </label>

                  {answerState.selected === CUSTOM_ANSWER_MARKER ? (
                    <input
                      type="text"
                      placeholder="Введите свой вариант ответа"
                      value={answerState.customText || ''}
                      onChange={(event) => onChoiceCustomText(questionKey, event.target.value)}
                    />
                  ) : null}
                </div>
              ) : (
                <textarea
                  rows={4}
                  placeholder="Введите ваш ответ"
                  value={answerState.textValue || ''}
                  onChange={(event) => onTextAnswer(questionKey, event.target.value)}
                />
              )}
            </article>
          )
        })}
      </div>

      <div className="actions-row">
        <button type="button" className="gold-btn" onClick={onSubmitVote} disabled={busy || !questions.length}>
          {busy ? 'Отправляем...' : hasCompleted ? 'Обновить ответы' : 'Отправить ответы'}
        </button>

        {poll.attachmentId ? (
          <button type="button" className="soft-btn" onClick={onDownload}>
            Скачать изображение
          </button>
        ) : null}

        {canSeeStats ? (
          <Link to={`/polls/${poll.id}/stats`} className="soft-btn">
            Статистика
          </Link>
        ) : (
          <span className="muted">Статистика станет доступна после прохождения опроса.</span>
        )}

        {canEdit ? (
          <Link to={`/polls/${poll.id}/edit`} className="soft-btn">
            Редактировать
          </Link>
        ) : null}
      </div>

      <p className="muted">
        {poll.attachmentId ? `Изображение: ${poll.attachmentName || poll.attachmentId}` : 'Изображение не прикреплено'}
      </p>
      {error ? <p className="error-box">{error}</p> : null}
    </section>
  )
}
