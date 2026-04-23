import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { logoutUser } from '../api/auth.js'
import { getStoredTokens, getStoredUser } from '../lib/tokenStorage.js'
import {
  getStoredProfilePhoto,
  PROFILE_PHOTO_EVENT,
} from '../lib/profilePhotoStorage.js'
import defaultAvatar from '../assets/default-avatar.svg'
import { useToast } from '../contexts/ToastContext.jsx'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const user = getStoredUser()
  const { accessToken } = getStoredTokens()
  const { pushToast } = useToast()

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

  const onLogout = async () => {
    try {
      await logoutUser()
      pushToast('success', 'Вы вышли из аккаунта')
      navigate('/login', { replace: true })
    } catch {
      pushToast('error', 'Не удалось выполнить выход')
    }
  }

  const avatarSrc = profilePhoto || defaultAvatar

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
                {user?.name || user?.Name || user?.email || user?.Email || 'Профиль'}
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
            <span className={`avatar-circle${profilePhoto ? ' has-photo' : ' is-default'}`}>
              <img src={avatarSrc} alt="Аватар" className="avatar-image" />
            </span>
          </Link>
        </div>
      </header>

      <main className="container page-content">{children}</main>
    </div>
  )
}

