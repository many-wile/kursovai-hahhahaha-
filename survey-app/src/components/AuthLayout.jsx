import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStoredTokens, getStoredUser } from '../lib/tokenStorage.js'
import {
  getStoredProfilePhoto,
  PROFILE_PHOTO_EVENT,
} from '../lib/profilePhotoStorage.js'

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5z" />
    </svg>
  )
}

export default function AuthLayout({ children }) {
  const user = getStoredUser()
  const { accessToken } = getStoredTokens()

  const [profilePhoto, setProfilePhoto] = useState(getStoredProfilePhoto())

  useEffect(() => {
    const onPhotoUpdate = () => {
      setProfilePhoto(getStoredProfilePhoto())
    }

    window.addEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdate)
    return () => window.removeEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdate)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header container">
        <Link to="/" className="brand">
          gari<span>.opros</span>
        </Link>

        <div className="header-right">
          {accessToken ? (
            <Link to="/polls" className="gold-btn">
              К опросам
            </Link>
          ) : (
            <Link to="/login" className="gold-btn">
              Войти
            </Link>
          )}

          <Link
            to={accessToken ? '/profile' : '/login'}
            className="avatar-link"
            aria-label={accessToken ? 'Открыть профиль' : 'Войти в аккаунт'}
            title={accessToken ? 'Профиль' : 'Войти'}
          >
            <span className={`avatar-circle${profilePhoto ? ' has-photo' : ''}`}>
              {profilePhoto ? <img src={profilePhoto} alt="Фото профиля" className="avatar-image" /> : <UserIcon />}
            </span>
          </Link>
        </div>
      </header>

      <main className="container page-content">
        <section className="hero-box" aria-label="Баннер">
          <h1>Опросы на любой вкус и цвет</h1>
          <p>{user?.email ? `Текущий пользователь: ${user.email}` : 'Войдите или создайте аккаунт, чтобы управлять опросами.'}</p>
        </section>

        {children}
      </main>
    </div>
  )
}

