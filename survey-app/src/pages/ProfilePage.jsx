import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../contexts/ToastContext.jsx'
import { getStoredUser, getStoredTokens } from '../lib/tokenStorage.js'
import {
  clearStoredProfilePhoto,
  getStoredProfilePhoto,
  saveStoredProfilePhoto,
} from '../lib/profilePhotoStorage.js'
import defaultAvatar from '../assets/default-avatar.svg'

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

const AVATAR_FRAME_SIZE = 512
const HEADER_AVATAR_SIZE = 40
const MIN_ZOOM = 1
const MAX_ZOOM = 3.5

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function isAllowedAvatarFile(file) {
  if (!file) {
    return false
  }

  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return true
  }

  const ext = String(file.name || '')
    .split('.')
    .pop()
    ?.toLowerCase()

  return ALLOWED_EXTENSIONS.has(ext || '')
}

function getCoverBounds(imageMeta, zoom) {
  if (!imageMeta?.width || !imageMeta?.height) {
    return { maxX: 0, maxY: 0 }
  }

  const baseScale = Math.max(AVATAR_FRAME_SIZE / imageMeta.width, AVATAR_FRAME_SIZE / imageMeta.height)
  const drawScale = baseScale * zoom
  const drawWidth = imageMeta.width * drawScale
  const drawHeight = imageMeta.height * drawScale

  return {
    maxX: Math.max(0, (drawWidth - AVATAR_FRAME_SIZE) / 2),
    maxY: Math.max(0, (drawHeight - AVATAR_FRAME_SIZE) / 2),
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

async function buildAvatarDataUrl(sourceUrl, crop, imageMeta) {
  const image = await loadImage(sourceUrl)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_FRAME_SIZE
  canvas.height = AVATAR_FRAME_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Не удалось обработать изображение.')
  }

  const baseScale = Math.max(AVATAR_FRAME_SIZE / imageMeta.width, AVATAR_FRAME_SIZE / imageMeta.height)
  const drawScale = baseScale * crop.zoom
  const drawWidth = imageMeta.width * drawScale
  const drawHeight = imageMeta.height * drawScale
  const x = (AVATAR_FRAME_SIZE - drawWidth) / 2 + crop.offsetX
  const y = (AVATAR_FRAME_SIZE - drawHeight) / 2 + crop.offsetY

  context.drawImage(image, x, y, drawWidth, drawHeight)

  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function ProfilePage() {
  const user = getStoredUser()
  const tokens = getStoredTokens()
  const { pushToast } = useToast()

  const inputRef = useRef(null)
  const frameRef = useRef(null)
  const draftUrlRef = useRef('')
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  const [photo, setPhoto] = useState(() => getStoredProfilePhoto(user))
  const [draftUrl, setDraftUrl] = useState('')
  const [draftName, setDraftName] = useState('')
  const [imageMeta, setImageMeta] = useState(null)
  const [crop, setCrop] = useState({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [frameSize, setFrameSize] = useState({ width: AVATAR_FRAME_SIZE, height: AVATAR_FRAME_SIZE })
  const [dragActive, setDragActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const setDraftObjectUrl = (nextUrl) => {
    if (draftUrlRef.current && draftUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(draftUrlRef.current)
    }

    draftUrlRef.current = nextUrl || ''
    setDraftUrl(nextUrl || '')
  }

  const clearDraftEditor = () => {
    setDraftObjectUrl('')
    setDraftName('')
    setImageMeta(null)
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
    setIsDragging(false)
    dragRef.current.active = false
  }

  useEffect(() => {
    setPhoto(getStoredProfilePhoto(user))
    clearDraftEditor()
  }, [user?.id, user?.Id, user?.email, user?.Email])

  useEffect(() => {
    return () => {
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current)
      }
    }
  }, [])

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
    if (!frameRef.current || !draftUrl) {
      return
    }

    const element = frameRef.current

    const update = () => {
      const rect = element.getBoundingClientRect()
      setFrameSize({
        width: rect.width || AVATAR_FRAME_SIZE,
        height: rect.height || AVATAR_FRAME_SIZE,
      })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [draftUrl])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const onMouseMove = (event) => {
      if (!dragRef.current.active) {
        return
      }

      const virtualDx = (event.clientX - dragRef.current.startX) * (AVATAR_FRAME_SIZE / (frameSize.width || AVATAR_FRAME_SIZE))
      const virtualDy = (event.clientY - dragRef.current.startY) * (AVATAR_FRAME_SIZE / (frameSize.height || AVATAR_FRAME_SIZE))

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

  const validateFile = (file) => {
    if (!file) {
      pushToast('warning', 'Файл не выбран')
      return false
    }

    if (!isAllowedAvatarFile(file)) {
      pushToast('warning', 'Разрешены только PNG, JPG, WEBP, GIF')
      return false
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      pushToast('warning', 'Максимальный размер фото: 2 MB')
      return false
    }

    return true
  }

  const prepareDraftFromFile = async (file) => {
    if (!validateFile(file)) {
      return
    }

    setBusy(true)

    try {
      const objectUrl = URL.createObjectURL(file)
      const image = await loadImage(objectUrl)

      setDraftObjectUrl(objectUrl)
      setDraftName(file.name || '')
      setImageMeta({ width: image.naturalWidth, height: image.naturalHeight })
      setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
      pushToast('success', 'Фото загружено. Настройте размер и позицию.')
    } catch (error) {
      pushToast('error', error.message || 'Не удалось загрузить фото')
    } finally {
      setBusy(false)
    }
  }

  const onInputChange = async (event) => {
    const file = event.target.files?.[0] || null
    await prepareDraftFromFile(file)
    event.target.value = ''
  }

  const onDrop = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const file = event.dataTransfer?.files?.[0] || null
    await prepareDraftFromFile(file)
  }

  const onSaveDraft = async () => {
    if (!draftUrl || !imageMeta) {
      pushToast('warning', 'Сначала выберите фото')
      return
    }

    setBusy(true)

    try {
      const finalPhotoDataUrl = await buildAvatarDataUrl(draftUrl, crop, imageMeta)
      saveStoredProfilePhoto(finalPhotoDataUrl, user)
      setPhoto(finalPhotoDataUrl)
      clearDraftEditor()
      pushToast('success', 'Аватарка сохранена для вашего аккаунта')
    } catch (error) {
      pushToast('error', error.message || 'Не удалось сохранить аватарку')
    } finally {
      setBusy(false)
    }
  }

  const onCancelDraft = () => {
    clearDraftEditor()
    pushToast('warning', 'Изменения аватарки отменены')
  }

  const onRemovePhoto = () => {
    clearStoredProfilePhoto(user)
    setPhoto('')
    clearDraftEditor()
    pushToast('success', 'Аватарка удалена')
  }

  const onEditorMouseDown = (event) => {
    if (!draftUrl) {
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

  const displayedAvatar = photo || defaultAvatar

  const editorOffsetX = crop.offsetX * (frameSize.width / AVATAR_FRAME_SIZE)
  const editorOffsetY = crop.offsetY * (frameSize.height / AVATAR_FRAME_SIZE)
  const headerOffsetX = crop.offsetX * (HEADER_AVATAR_SIZE / AVATAR_FRAME_SIZE)
  const headerOffsetY = crop.offsetY * (HEADER_AVATAR_SIZE / AVATAR_FRAME_SIZE)

  return (
    <section className="card profile-card">
      <h2>Профиль</h2>

      <div className="profile-row">
        <span className="muted">Имя:</span>
        <b>{user?.name || user?.Name || '-'}</b>
      </div>

      <div className="profile-row">
        <span className="muted">Email:</span>
        <b>{user?.email || user?.Email || '-'}</b>
      </div>

      <div className="profile-row">
        <span className="muted">Access token:</span>
        <b>{tokens.accessToken ? 'Есть' : 'Нет'}</b>
      </div>

      <div className="profile-row">
        <span className="muted">Refresh token:</span>
        <b>{tokens.refreshToken ? 'Есть' : 'Нет'}</b>
      </div>

      <div
        className={`photo-dropzone${dragActive ? ' drag-active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragActive(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragActive(false)
        }}
        onDrop={onDrop}
      >
        {draftUrl ? (
          <>
            <div className="avatar-editor-tools">
              <div className="editor-cover-slider-row">
                <span className="muted">Размер</span>
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
              <p className="muted">Перетащи фото мышкой внутри рамки</p>
            </div>

            <div
              ref={frameRef}
              className={`avatar-editor-frame${isDragging ? ' dragging' : ''}`}
              onMouseDown={onEditorMouseDown}
            >
              <img
                src={draftUrl}
                alt="Предпросмотр аватарки"
                className="avatar-editor-image-inner"
                style={{
                  transform: `translate(${editorOffsetX}px, ${editorOffsetY}px) scale(${crop.zoom})`,
                }}
              />
            </div>

            <p className="muted">Выбран файл: {draftName || 'новая аватарка'}</p>
          </>
        ) : (
          <>
            <img src={displayedAvatar} alt="Аватар" className="profile-photo-preview" />
            <p className="muted">Перетащи фото сюда или нажми кнопку ниже</p>
          </>
        )}
      </div>

      <div className="avatar-mini-preview-row">
        <span className="muted">Как будет в правом верхнем углу:</span>
        <span className={`avatar-circle avatar-circle-preview${draftUrl || photo ? ' has-photo' : ' is-default'}`}>
          <img
            src={draftUrl || displayedAvatar}
            alt="Мини предпросмотр аватарки"
            className="avatar-image avatar-mini-preview-image"
            style={
              draftUrl
                ? {
                    transform: `translate(${headerOffsetX}px, ${headerOffsetY}px) scale(${crop.zoom})`,
                  }
                : undefined
            }
          />
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onInputChange}
        className="hidden-file-input"
      />

      <p className="muted">Форматы: PNG, JPG, WEBP, GIF. Максимум: 2 MB.</p>

      <div className="actions-row profile-photo-actions">
        <button type="button" className="soft-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Загружаем...' : 'Выбрать фото'}
        </button>

        {draftUrl ? (
          <button type="button" className="gold-btn" onClick={onSaveDraft} disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить аватарку'}
          </button>
        ) : null}

        {draftUrl ? (
          <button type="button" className="soft-btn" onClick={onCancelDraft} disabled={busy}>
            Отменить изменение
          </button>
        ) : null}

        {photo ? (
          <button type="button" className="danger-btn" onClick={onRemovePhoto}>
            Удалить аватарку
          </button>
        ) : null}
      </div>
    </section>
  )
}
