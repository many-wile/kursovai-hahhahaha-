import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { logoutUser } from '../api/auth.js'
import { getStoredTokens, getStoredUser } from '../lib/tokenStorage.js'
import {
  getStoredProfilePhoto,
  PROFILE_PHOTO_EVENT,
} from '../lib/profilePhotoStorage.js'
import { useToast } from '../contexts/ToastContext.jsx'

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5z" />
    </svg>
  )
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const user = getStoredUser()
  const { accessToken } = getStoredTokens()
  const { pushToast } = useToast()

  const [profilePhoto, setProfilePhoto] = useState(getStoredProfilePhoto())

  useEffect(() => {
    const onPhotoUpdate = () => {
      setProfilePhoto(getStoredProfilePhoto())
    }

    window.addEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdate)
    return () => window.removeEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdate)
  }, [])

  const onLogout = async () => {
    try {
      await logoutUser()
      pushToast('success', 'Вы вышли из аккаунта')
      navigate('/login', { replace: true })
    } catch {
      pushToast('error', 'Не удалось выполнить выход')
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header container">
        <Link to="/" className="brand">
          gari<span>.opros</span>
        </Link>

        <nav className="main-nav" aria-label="Навигация">
          <NavLink to="/">Главная</NavLink>
          <NavLink to="/polls">Опросы</NavLink>
          {accessToken ? <NavLink to="/polls/new">Создать</NavLink> : null}
        </nav>

        <div className="header-right">
          {accessToken ? (
            <>
              <NavLink to="/profile" className="user-chip">
                {user?.name || user?.email || 'Профиль'}
              </NavLink>
              <button type="button" className="gold-btn" onClick={onLogout}>
                Выйти
              </button>
            </>
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

      <main className="container page-content">{children}</main>
    </div>
  )
}

