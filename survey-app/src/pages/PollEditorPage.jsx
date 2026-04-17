import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPoll, getPollById, updatePoll } from '../api/polls.js'
import { getAttachmentPreviewUrl, isImageAttachment, uploadAttachment } from '../api/files.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

const MAX_FILE_SIZE = 8 * 1024 * 1024
const FRAME_WIDTH = 1600
const FRAME_HEIGHT = 900
const MIN_ZOOM = 1
const MAX_ZOOM = 3.5

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
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
    const img = new Image()

    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Не удалось загрузить изображение.'))

    img.src = url
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
      if (cancelled) {
        return
      }

      setImageMeta({ width: image.naturalWidth, height: image.naturalHeight })
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
      setError('Файл превышает 8 MB.')
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

  const onSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      if (selectedFile && !validateSelectedFile(selectedFile)) {
        setBusy(false)
        return
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
      }

      if (mode === 'edit' && id) {
        await updatePoll(id, { ...payload, id: Number(id) })

        if (selectedFile) {
          const processedFile = await resolveUploadFile()
          const uploaded = await uploadAttachment(id, processedFile)
          setAttachment({ id: uploaded.id, name: uploaded.name })
        }

        pushToast('success', 'Опрос обновлён')
      } else {
        const created = await createPoll(payload)

        if (selectedFile) {
          if (!created?.id) {
            throw new Error('Опрос создан, но id не получен для загрузки изображения.')
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

  const resetCrop = () => {
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
  }

  const previewOffsetX = crop.offsetX * (frameSize.width / FRAME_WIDTH)
  const previewOffsetY = crop.offsetY * (frameSize.height / FRAME_HEIGHT)

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
              <span className="muted">Перетащи изображение мышкой внутри рамки</span>
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
          <textarea
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
          />
        </label>

        <label>
          Фото обложки
          <input
            type="file"
            accept=".png,.jpg,.jpeg"
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
