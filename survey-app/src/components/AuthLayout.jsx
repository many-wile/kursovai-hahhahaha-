import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStoredTokens, getStoredUser } from '../lib/tokenStorage.js'
import {
  getStoredProfilePhoto,
  PROFILE_PHOTO_EVENT,
} from '../lib/profilePhotoStorage.js'
import defaultAvatar from '../assets/default-avatar.svg'

export default function AuthLayout({ children }) {
  const user = getStoredUser()
  const { accessToken } = getStoredTokens()

  const [profilePhoto, setProfilePhoto] = useState(() => getStoredProfilePhoto(user))

  useEffect(() => {
    setProfilePhoto(getStoredProfilePhoto(user))
  }, [accessToken, user?.id, user?.Id, user?.email, user?.Email])

  useEffect(() => {
    const onPhotoUpdate = () => {
      setProfilePhoto(getStoredProfilePhoto(getStoredUser()))
    }

    window.addEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdate)
    return () => window.removeEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdate)
  }, [])

  const avatarSrc = profilePhoto || defaultAvatar

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
            <span className={`avatar-circle${profilePhoto ? ' has-photo' : ' is-default'}`}>
              <img src={avatarSrc} alt="Аватар" className="avatar-image" />
            </span>
          </Link>
        </div>
      </header>

      <main className="container page-content">
        <section className="hero-box" aria-label="Баннер">
          <h1>Опросы на любой вкус и цвет</h1>
          <p>{user?.email || user?.Email ? `Текущий пользователь: ${user?.email || user?.Email}` : 'Войдите или создайте аккаунт, чтобы управлять опросами.'}</p>
        </section>

        {children}
      </main>
    </div>
  )
}

