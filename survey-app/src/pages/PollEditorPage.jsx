import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPoll, getPollById, POLL_QUESTION_TYPES, updatePoll } from '../api/polls.js'
import { getAttachmentPreviewUrl, isImageAttachment, uploadAttachment } from '../api/files.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

const MAX_FILE_SIZE = 8 * 1024 * 1024
const FRAME_WIDTH = 1600
const FRAME_HEIGHT = 900
const MIN_ZOOM = 1
const MAX_ZOOM = 3.5

const MIN_TITLE_LENGTH = 5
const MAX_QUESTIONS = 20
const MAX_QUESTION_LENGTH = 280
const MIN_OPTIONS_PER_QUESTION = 2
const MAX_OPTIONS_PER_QUESTION = 10
const MAX_OPTION_LENGTH = 120

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function createLocalId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function createDraftOption(text = '', id = null) {
  return {
    id,
    clientId: createLocalId('opt'),
    text,
  }
}

function getDefaultChoiceOptions() {
  return [createDraftOption('Да'), createDraftOption('Нет')]
}

function createDraftQuestion({
  id = null,
  text = '',
  type = POLL_QUESTION_TYPES.CHOICE,
  options = null,
} = {}) {
  const normalizedType = type === POLL_QUESTION_TYPES.TEXT ? POLL_QUESTION_TYPES.TEXT : POLL_QUESTION_TYPES.CHOICE

  const normalizedOptions = normalizedType === POLL_QUESTION_TYPES.CHOICE
    ? (Array.isArray(options) ? options : getDefaultChoiceOptions())
      .map((option) => createDraftOption(String(option?.text ?? option ?? '').trim(), option?.id ?? null))
    : []

  while (normalizedType === POLL_QUESTION_TYPES.CHOICE && normalizedOptions.length < MIN_OPTIONS_PER_QUESTION) {
    normalizedOptions.push(createDraftOption(''))
  }

  return {
    id,
    clientId: createLocalId('q'),
    text,
    type: normalizedType,
    options: normalizedOptions,
  }
}

function normalizeQuestionsForEditor(questions) {
  if (!Array.isArray(questions) || !questions.length) {
    return [createDraftQuestion()]
  }

  const normalized = questions.map((question) =>
    createDraftQuestion({
      id: question?.id ?? null,
      text: String(question?.text ?? '').trim(),
      type: question?.type,
      options: question?.options,
    }),
  )

  return normalized.length ? normalized : [createDraftQuestion()]
}

function isEditableImage(file) {
  if (!file) {
    return false
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg'].includes(ext)
}

function getCoverBounds(imageMeta, zoom) {
  if (!imageMeta?.width || !imageMeta?.height) {
    return { maxX: 0, maxY: 0 }
  }

  const baseScale = Math.max(FRAME_WIDTH / imageMeta.width, FRAME_HEIGHT / imageMeta.height)
  const drawScale = baseScale * zoom
  const drawWidth = imageMeta.width * drawScale
  const drawHeight = imageMeta.height * drawScale

  return {
    maxX: Math.max(0, (drawWidth - FRAME_WIDTH) / 2),
    maxY: Math.max(0, (drawHeight - FRAME_HEIGHT) / 2),
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось загрузить изображение.'))
    image.src = url
  })
}

async function buildCoverImageFile(file, crop, imageMeta) {
  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(sourceUrl)
    const canvas = document.createElement('canvas')
    canvas.width = FRAME_WIDTH
    canvas.height = FRAME_HEIGHT

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Не удалось обработать изображение.')
    }

    const baseScale = Math.max(FRAME_WIDTH / imageMeta.width, FRAME_HEIGHT / imageMeta.height)
    const drawScale = baseScale * crop.zoom
    const drawWidth = imageMeta.width * drawScale
    const drawHeight = imageMeta.height * drawScale
    const x = (FRAME_WIDTH - drawWidth) / 2 + crop.offsetX
    const y = (FRAME_HEIGHT - drawHeight) / 2 + crop.offsetY

    context.drawImage(image, x, y, drawWidth, drawHeight)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error('Не удалось сохранить изображение.'))
          return
        }

        resolve(result)
      }, 'image/jpeg', 0.92)
    })

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'cover'
    return new File([blob], `${baseName}-cover.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

export default function PollEditorPage({ mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { pushToast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState(() => normalizeQuestionsForEditor([]))
  const [attachment, setAttachment] = useState({ id: null, name: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [imageMeta, setImageMeta] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [crop, setCrop] = useState({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [frameSize, setFrameSize] = useState({ width: FRAME_WIDTH, height: FRAME_HEIGHT })

  const frameRef = useRef(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  const pageTitle = useMemo(() => (mode === 'edit' ? 'Редактирование опроса' : 'Создание опроса'), [mode])

  const constrainCrop = useCallback(
    (next) => {
      const zoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM)
      const bounds = getCoverBounds(imageMeta, zoom)

      return {
        zoom,
        offsetX: clamp(next.offsetX, -bounds.maxX, bounds.maxX),
        offsetY: clamp(next.offsetY, -bounds.maxY, bounds.maxY),
      }
    },
    [imageMeta],
  )

  useEffect(() => {
    setCrop((prev) => constrainCrop(prev))
  }, [constrainCrop])

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
        setQuestions(normalizeQuestionsForEditor(poll.questions))
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

  useEffect(() => {
    if (!selectedFile || !isEditableImage(selectedFile)) {
      setImagePreviewUrl('')
      setImageMeta(null)
      setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setImagePreviewUrl(objectUrl)
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (!cancelled) {
        setImageMeta({ width: image.naturalWidth, height: image.naturalHeight })
      }
    }
    image.onerror = () => {
      if (!cancelled) {
        setImageMeta(null)
      }
    }
    image.src = objectUrl

    return () => {
      cancelled = true
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  useEffect(() => {
    if (!frameRef.current) {
      return
    }

    const element = frameRef.current
    const update = () => {
      const rect = element.getBoundingClientRect()
      setFrameSize({
        width: rect.width || FRAME_WIDTH,
        height: rect.height || FRAME_HEIGHT,
      })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [imagePreviewUrl, attachment.id])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const onMouseMove = (event) => {
      if (!dragRef.current.active) {
        return
      }

      const virtualDx = (event.clientX - dragRef.current.startX) * (FRAME_WIDTH / (frameSize.width || FRAME_WIDTH))
      const virtualDy = (event.clientY - dragRef.current.startY) * (FRAME_HEIGHT / (frameSize.height || FRAME_HEIGHT))

      setCrop((prev) =>
        constrainCrop({
          zoom: prev.zoom,
          offsetX: dragRef.current.originX + virtualDx,
          offsetY: dragRef.current.originY + virtualDy,
        }),
      )
    }

    const onMouseUp = () => {
      dragRef.current.active = false
      setIsDragging(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [constrainCrop, frameSize.height, frameSize.width, isDragging])

  const onFrameMouseDown = (event) => {
    if (!imagePreviewUrl) {
      return
    }

    event.preventDefault()
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: crop.offsetX,
      originY: crop.offsetY,
    }
    setIsDragging(true)
  }

  const validateSelectedFile = (file) => {
    if (!file) {
      return true
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowed = ['png', 'jpg', 'jpeg']

    if (!allowed.includes(ext)) {
      setError('Недопустимый тип файла.')
      pushToast('warning', 'Разрешены только изображения: png, jpg, jpeg')
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Файл превышает 8 МБ.')
      pushToast('warning', 'Файл слишком большой')
      return false
    }

    return true
  }

  const resolveUploadFile = async () => {
    if (!selectedFile) {
      return null
    }

    if (!isEditableImage(selectedFile)) {
      return selectedFile
    }

    if (!imageMeta) {
      throw new Error('Подождите, изображение еще обрабатывается.')
    }

    return buildCoverImageFile(selectedFile, crop, imageMeta)
  }

  const addQuestion = (afterIndex = questions.length - 1) => {
    if (questions.length >= MAX_QUESTIONS) {
      pushToast('warning', `Максимум ${MAX_QUESTIONS} вопросов в одном опросе`)
      return
    }

    setQuestions((prev) => {
      const copy = [...prev]
      copy.splice(afterIndex + 1, 0, createDraftQuestion())
      return copy
    })
  }

  const removeQuestion = (index) => {
    setQuestions((prev) => {
      if (prev.length <= 1) {
        return [createDraftQuestion()]
      }

      return prev.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const duplicateQuestion = (index) => {
    if (questions.length >= MAX_QUESTIONS) {
      pushToast('warning', `Максимум ${MAX_QUESTIONS} вопросов в одном опросе`)
      return
    }

    setQuestions((prev) => {
      const source = prev[index]
      const copy = [...prev]
      copy.splice(
        index + 1,
        0,
        createDraftQuestion({
          text: source?.text || '',
          type: source?.type,
          options: source?.options || [],
        }),
      )
      return copy
    })
  }

  const moveQuestion = (index, direction) => {
    const target = index + direction
    setQuestions((prev) => {
      if (target < 0 || target >= prev.length) {
        return prev
      }

      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[target]
      copy[target] = temp
      return copy
    })
  }

  const updateQuestionText = (index, value) => {
    setQuestions((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], text: value }
      return copy
    })
  }

  const setQuestionType = (index, type) => {
    setQuestions((prev) => {
      const copy = [...prev]
      const question = copy[index]

      if (!question) {
        return prev
      }

      if (type === POLL_QUESTION_TYPES.TEXT) {
        copy[index] = {
          ...question,
          type: POLL_QUESTION_TYPES.TEXT,
          options: [],
        }
      } else {
        const options = question.options?.length ? [...question.options] : getDefaultChoiceOptions()

        while (options.length < MIN_OPTIONS_PER_QUESTION) {
          options.push(createDraftOption(''))
        }

        copy[index] = {
          ...question,
          type: POLL_QUESTION_TYPES.CHOICE,
          options,
        }
      }

      return copy
    })
  }

  const addOption = (questionIndex) => {
    setQuestions((prev) => {
      const copy = [...prev]
      const question = copy[questionIndex]
      if (!question || question.type !== POLL_QUESTION_TYPES.CHOICE) {
        return prev
      }

      if (question.options.length >= MAX_OPTIONS_PER_QUESTION) {
        pushToast('warning', `Максимум ${MAX_OPTIONS_PER_QUESTION} вариантов для одного вопроса`)
        return prev
      }

      copy[questionIndex] = {
        ...question,
        options: [...question.options, createDraftOption('')],
      }

      return copy
    })
  }

  const removeOption = (questionIndex, optionIndex) => {
    setQuestions((prev) => {
      const copy = [...prev]
      const question = copy[questionIndex]

      if (!question || question.type !== POLL_QUESTION_TYPES.CHOICE) {
        return prev
      }

      if (question.options.length <= MIN_OPTIONS_PER_QUESTION) {
        return prev
      }

      copy[questionIndex] = {
        ...question,
        options: question.options.filter((_, idx) => idx !== optionIndex),
      }

      return copy
    })
  }

  const updateOptionText = (questionIndex, optionIndex, value) => {
    setQuestions((prev) => {
      const copy = [...prev]
      const question = copy[questionIndex]
      if (!question || question.type !== POLL_QUESTION_TYPES.CHOICE) {
        return prev
      }

      const options = [...question.options]
      options[optionIndex] = { ...options[optionIndex], text: value }
      copy[questionIndex] = { ...question, options }
      return copy
    })
  }

  const resetCrop = () => {
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
  }

  const onSubmit = async (event) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()

    if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      pushToast('warning', `Название опроса должно быть не короче ${MIN_TITLE_LENGTH} символов`)
      return
    }

    if (!trimmedDescription.length) {
      pushToast('warning', 'Заполните описание опроса')
      return
    }

    const normalizedQuestions = []

    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i]
      const text = String(question?.text || '').trim()

      if (!text) {
        pushToast('warning', `Заполните текст вопроса №${i + 1}`)
        return
      }

      if (text.length > MAX_QUESTION_LENGTH) {
        pushToast('warning', `Вопрос №${i + 1} слишком длинный`)
        return
      }

      if (question.type === POLL_QUESTION_TYPES.CHOICE) {
        const options = question.options
          .map((option) => ({ text: String(option?.text || '').trim() }))
          .filter((option) => option.text.length > 0)

        if (options.length < MIN_OPTIONS_PER_QUESTION) {
          pushToast('warning', `Для вопроса №${i + 1} нужно минимум ${MIN_OPTIONS_PER_QUESTION} варианта`)
          return
        }

        if (options.some((option) => option.text.length > MAX_OPTION_LENGTH)) {
          pushToast('warning', `Вариант ответа в вопросе №${i + 1} слишком длинный`)
          return
        }

        normalizedQuestions.push({
          id: question.id,
          text,
          type: POLL_QUESTION_TYPES.CHOICE,
          options,
        })
      } else {
        normalizedQuestions.push({
          id: question.id,
          text,
          type: POLL_QUESTION_TYPES.TEXT,
          options: [],
        })
      }
    }

    if (!normalizedQuestions.length) {
      pushToast('warning', 'Добавьте хотя бы один вопрос')
      return
    }

    setBusy(true)
    setError('')

    try {
      if (selectedFile && !validateSelectedFile(selectedFile)) {
        setBusy(false)
        return
      }

      const payload = {
        title: trimmedTitle,
        description: trimmedDescription,
        questions: normalizedQuestions,
      }

      if (mode === 'edit' && id) {
        await updatePoll(id, { ...payload, id: Number(id) })

        if (selectedFile) {
          const processedFile = await resolveUploadFile()
          const uploaded = await uploadAttachment(id, processedFile)
          setAttachment({ id: uploaded.id, name: uploaded.name })
        }

        pushToast('success', 'Опрос обновлен')
      } else {
        const created = await createPoll(payload)

        if (selectedFile) {
          if (!created?.id) {
            throw new Error('Опрос создан, но не получен id для загрузки изображения')
          }

          const processedFile = await resolveUploadFile()
          await uploadAttachment(created.id, processedFile)
        }

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

  const previewOffsetX = crop.offsetX * (frameSize.width / FRAME_WIDTH)
  const previewOffsetY = crop.offsetY * (frameSize.height / FRAME_HEIGHT)
  const pollPreviewImage =
    imagePreviewUrl || (attachment?.id && isImageAttachment(attachment.name) ? getAttachmentPreviewUrl(attachment.id) : '')

  const previewQuestions = questions
    .map((question) => ({
      text: String(question.text || '').trim(),
      type: question.type,
      options: question.options?.map((option) => String(option?.text || '').trim()).filter(Boolean) || [],
    }))
    .filter((question) => question.text.length > 0)

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

      {imagePreviewUrl ? (
        <>
          <div className="editor-cover-tools">
            <div className="editor-cover-slider-row">
              <span className="muted">Масштаб</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                onChange={(event) => {
                  const zoom = Number(event.target.value)
                  setCrop((prev) => constrainCrop({ ...prev, zoom }))
                }}
              />
              <b>{crop.zoom.toFixed(2)}x</b>
            </div>

            <div className="actions-row">
              <button type="button" className="soft-btn" onClick={resetCrop}>
                Сбросить
              </button>
              <span className="muted">Перетащите изображение мышкой внутри рамки</span>
            </div>
          </div>

          <div
            ref={frameRef}
            className={`editor-cover-frame${isDragging ? ' dragging' : ''}`}
            onMouseDown={onFrameMouseDown}
          >
            <img
              src={imagePreviewUrl}
              alt="Превью обложки"
              className="editor-cover-image-inner"
              style={{
                transform: `translate(${previewOffsetX}px, ${previewOffsetY}px) scale(${crop.zoom})`,
              }}
            />
          </div>
        </>
      ) : attachment?.id && isImageAttachment(attachment.name) ? (
        <img className="poll-cover-image poll-cover-image-large" src={getAttachmentPreviewUrl(attachment.id)} alt="Текущая обложка" />
      ) : (
        <div className="photo-placeholder large">Место для изображения опроса</div>
      )}

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Название
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
        </label>

        <label>
          Описание
          <textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} />
        </label>

        <label>
          Фото обложки
          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {attachment?.id && !selectedFile ? <p className="muted">Текущий файл: {attachment.name || attachment.id}</p> : null}
        {selectedFile ? <p className="muted">Выбран файл: {selectedFile.name}</p> : null}

        <div className="editor-questions-block">
          <div className="card-head">
            <h3>Вопросы</h3>
            <button type="button" className="soft-btn" onClick={() => addQuestion(questions.length - 1)}>
              Добавить вопрос
            </button>
          </div>

          <p className="muted">Минимум 1 вопрос, максимум {MAX_QUESTIONS}.</p>

          <div className="editor-questions-list">
            {questions.map((question, index) => (
              <article key={question.clientId} className="editor-question-item">
                <div className="editor-question-head">
                  <b>Вопрос {index + 1}</b>
                  <div className="actions-row">
                    <button type="button" className="soft-btn" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                      Вверх
                    </button>
                    <button
                      type="button"
                      className="soft-btn"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === questions.length - 1}
                    >
                      Вниз
                    </button>
                    <button type="button" className="soft-btn" onClick={() => duplicateQuestion(index)}>
                      Дубль
                    </button>
                    <button type="button" className="danger-btn" onClick={() => removeQuestion(index)}>
                      Удалить
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  maxLength={MAX_QUESTION_LENGTH}
                  placeholder="Текст вопроса"
                  value={question.text}
                  onChange={(event) => updateQuestionText(index, event.target.value)}
                />
                <p className="muted">{question.text.length}/{MAX_QUESTION_LENGTH}</p>

                <div className="editor-question-mode">
                  <button
                    type="button"
                    className={`soft-btn${question.type === POLL_QUESTION_TYPES.CHOICE ? ' is-active' : ''}`}
                    onClick={() => setQuestionType(index, POLL_QUESTION_TYPES.CHOICE)}
                  >
                    Варианты ответа
                  </button>
                  <button
                    type="button"
                    className={`soft-btn${question.type === POLL_QUESTION_TYPES.TEXT ? ' is-active' : ''}`}
                    onClick={() => setQuestionType(index, POLL_QUESTION_TYPES.TEXT)}
                  >
                    Свободный ответ
                  </button>
                </div>

                {question.type === POLL_QUESTION_TYPES.CHOICE ? (
                  <div className="editor-option-list">
                    {question.options.map((option, optionIndex) => (
                      <div key={option.clientId} className="editor-option-item">
                        <input
                          type="text"
                          value={option.text}
                          maxLength={MAX_OPTION_LENGTH}
                          placeholder={`Вариант ${optionIndex + 1}`}
                          onChange={(event) => updateOptionText(index, optionIndex, event.target.value)}
                        />
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => removeOption(index, optionIndex)}
                          disabled={question.options.length <= MIN_OPTIONS_PER_QUESTION}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}

                    <div className="actions-row">
                      <button type="button" className="soft-btn" onClick={() => addOption(index)}>
                        Добавить вариант
                      </button>
                      <span className="muted">
                        Минимум {MIN_OPTIONS_PER_QUESTION}, максимум {MAX_OPTIONS_PER_QUESTION}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="muted">Для этого вопроса пользователь вводит свой текстовый ответ.</p>
                )}
              </article>
            ))}
          </div>
        </div>

        <button type="submit" className="gold-btn" disabled={busy}>
          {busy ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </form>

      <div className="editor-poll-preview">
        <h3>Предпросмотр опроса</h3>
        <article className="poll-card poll-card-preview">
          {pollPreviewImage ? (
            <img className="poll-cover-image" src={pollPreviewImage} alt={title.trim() || 'Обложка опроса'} />
          ) : (
            <div className="photo-placeholder">Место для фото обложки</div>
          )}

          <h3>{title.trim() || 'Название опроса'}</h3>
          <p>{description.trim() || 'Описание опроса'}</p>
          <p className="muted">Вопросов: {previewQuestions.length}</p>

          {previewQuestions.length ? (
            <ol className="poll-question-preview-list">
              {previewQuestions.map((question, index) => (
                <li key={`${index}_${question.text}`} className="poll-question-preview-item">
                  <b>{question.text}</b>
                  {question.type === POLL_QUESTION_TYPES.CHOICE ? (
                    <ul className="poll-option-preview-list">
                      {question.options.map((option) => (
                        <li key={`${index}_${option}`}>{option}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Свободный ответ пользователя</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Добавьте вопросы, чтобы увидеть их в предпросмотре.</p>
          )}

          <p className="muted">
            {selectedFile ? `Файл: ${selectedFile.name}` : attachment?.name ? `Файл: ${attachment.name}` : 'Файл не прикреплен'}
          </p>
        </article>
      </div>

      {error ? <p className="error-box">{error}</p> : null}
    </section>
  )
}
