import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPoll, getPollById, updatePoll } from '../api/polls.js'
import { uploadAttachment } from '../api/files.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

const MAX_FILE_SIZE = 8 * 1024 * 1024

export default function PollEditorPage({ mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { pushToast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState({ id: null, name: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pageTitle = useMemo(() => (mode === 'edit' ? 'Редактирование опроса' : 'Создание опроса'), [mode])

  useEffect(() => {
    if (mode !== 'edit' || !id) {
      return
    }

    const loadOne = async () => {
      setLoading(true)
      setError('')

      try {
        const poll = await getPollById(id)
        setTitle(poll.title || '')
        setDescription(poll.description || '')
        setAttachment({ id: poll.attachmentId, name: poll.attachmentName })
      } catch (err) {
        const message = toUserMessage(err)
        setError(message)
        pushToast('error', message)
      } finally {
        setLoading(false)
      }
    }

    void loadOne()
  }, [id, mode, pushToast])

  const validateSelectedFile = (file) => {
    if (!file) {
      return true
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowed = ['png', 'jpg', 'jpeg', 'pdf', 'doc', 'docx', 'txt']

    if (!allowed.includes(ext)) {
      setError('Недопустимый тип файла.')
      pushToast('warning', 'Разрешены: png, jpg, jpeg, pdf, doc, docx, txt')
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Файл превышает 8 MB.')
      pushToast('warning', 'Файл слишком большой')
      return false
    }

    return true
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      let finalAttachment = attachment

      if (selectedFile) {
        if (!validateSelectedFile(selectedFile)) {
          setBusy(false)
          return
        }

        finalAttachment = await uploadAttachment(selectedFile)
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
      }

      if (finalAttachment?.id) {
        payload.attachmentId = finalAttachment.id
        payload.attachmentName = finalAttachment.name
      }

      if (mode === 'edit' && id) {
        await updatePoll(id, payload)
        pushToast('success', 'Опрос обновлён')
      } else {
        await createPoll(payload)
        pushToast('success', 'Опрос создан')
      }

      navigate('/polls')
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
        <p className="muted">Загрузка данных...</p>
      </section>
    )
  }

  return (
    <section className="card editor-card">
      <div className="card-head">
        <h2>{pageTitle}</h2>
        <Link to="/polls" className="soft-btn">
          Назад
        </Link>
      </div>

      <div className="photo-placeholder large">Место для изображения опроса</div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Название
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
        </label>

        <label>
          Описание
          <textarea
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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

        {attachment?.id && !selectedFile ? (
          <p className="muted">Текущий файл: {attachment.name || attachment.id}</p>
        ) : null}

        {selectedFile ? <p className="muted">Выбран файл: {selectedFile.name}</p> : null}

        <button type="submit" className="gold-btn" disabled={busy}>
          {busy ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}
    </section>
  )
}
