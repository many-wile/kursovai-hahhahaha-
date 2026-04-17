import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createPoll, getPollById, updatePoll } from '../api/polls.js'
import { uploadAttachment } from '../api/files.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

function PollEditorPage({ mode }) {
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

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    const loadOne = async () => {
      setLoading(true)
      try {
        const poll = await getPollById(id)
        setTitle(poll.title || '')
        setDescription(poll.description || '')
        setAttachment({ id: poll.attachmentId, name: poll.attachmentName })
      } catch (err) {
        setError(toUserMessage(err))
        pushToast('error', toUserMessage(err))
      } finally {
        setLoading(false)
      }
    }
    loadOne()
  }, [mode, id, pushToast])

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      let finalAttachment = attachment
      if (selectedFile) {
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
      setError(toUserMessage(err))
      pushToast('error', toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <section className="panel"><p className="muted">Загрузка...</p></section>

  return (
    <section className="panel">
      <h1>{mode === 'edit' ? 'Редактирование опроса' : 'Создание опроса'}</h1>
      <form className="stack" onSubmit={onSubmit}>
        <input type="text" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea rows={5} placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input type="file" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.txt" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
        {attachment?.id && !selectedFile && <p className="muted">Текущий файл: {attachment.name || attachment.id}</p>}
        {selectedFile && <p className="muted">Выбран: {selectedFile.name}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Сохраняем...' : 'Сохранить'}</button>
      </form>
      {error && <p className="error-box">{error}</p>}
    </section>
  )
}

export default PollEditorPage