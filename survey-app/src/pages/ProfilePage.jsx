import { useRef, useState } from 'react'
import { useToast } from '../contexts/ToastContext.jsx'
import { getStoredUser, getStoredTokens } from '../lib/tokenStorage.js'
import {
  clearStoredProfilePhoto,
  getStoredProfilePhoto,
  saveStoredProfilePhoto,
} from '../lib/profilePhotoStorage.js'

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'))

    reader.readAsDataURL(file)
  })
}

export default function ProfilePage() {
  const user = getStoredUser()
  const tokens = getStoredTokens()
  const { pushToast } = useToast()

  const inputRef = useRef(null)
  const [photo, setPhoto] = useState(getStoredProfilePhoto())
  const [dragActive, setDragActive] = useState(false)
  const [busy, setBusy] = useState(false)

  const validateFile = (file) => {
    if (!file) {
      pushToast('warning', 'Файл не выбран')
      return false
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      pushToast('warning', 'Разрешены только PNG, JPG, WEBP, GIF')
      return false
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      pushToast('warning', 'Максимальный размер фото: 2 MB')
      return false
    }

    return true
  }

  const applyPhotoFile = async (file) => {
    if (!validateFile(file)) {
      return
    }

    setBusy(true)

    try {
      const dataUrl = await readAsDataUrl(file)
      saveStoredProfilePhoto(dataUrl)
      setPhoto(dataUrl)
      pushToast('success', 'Фото профиля обновлено')
    } catch (error) {
      pushToast('error', error.message || 'Не удалось загрузить фото')
    } finally {
      setBusy(false)
    }
  }

  const onInputChange = async (event) => {
    const file = event.target.files?.[0] || null
    await applyPhotoFile(file)

    event.target.value = ''
  }

  const onDrop = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const file = event.dataTransfer?.files?.[0] || null
    await applyPhotoFile(file)
  }

  const onRemovePhoto = () => {
    clearStoredProfilePhoto()
    setPhoto('')
    pushToast('success', 'Фото профиля удалено')
  }

  return (
    <section className="card profile-card">
      <h2>Профиль</h2>

      <div className="profile-row">
        <span className="muted">Имя:</span>
        <b>{user?.name || '-'}</b>
      </div>

      <div className="profile-row">
        <span className="muted">Email:</span>
        <b>{user?.email || '-'}</b>
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
        {photo ? <img src={photo} alt="Фото профиля" className="profile-photo-preview" /> : null}

        {!photo ? <p className="muted">Перетащи фото сюда или нажми кнопку ниже</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onInputChange}
        className="hidden-file-input"
      />

      <div className="actions-row profile-photo-actions">
        <button type="button" className="soft-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Загружаем...' : 'Загрузить фото'}
        </button>

        {photo ? (
          <button type="button" className="danger-btn" onClick={onRemovePhoto}>
            Удалить фото
          </button>
        ) : null}
      </div>
    </section>
  )
}
