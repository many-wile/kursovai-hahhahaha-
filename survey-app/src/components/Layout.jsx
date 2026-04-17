import { Link, NavLink, useNavigate } from 'react-router-dom'
import { logoutUser } from '../api/auth.js'
import { getStoredUser } from '../lib/tokenStorage.js'
import { useToast } from '../contexts/ToastContext.jsx'

function Layout({ children }) {
  const navigate = useNavigate()
  const user = getStoredUser()
  const { pushToast } = useToast()

  const onLogout = async () => {
    try {
      await logoutUser()
      pushToast('success', 'Вы вышли из аккаунта')
      navigate('/login', { replace: true })
    } catch (err) {
      pushToast('error', 'Ошибка при выходе')
    }
  }

  return (
    <div className="app-shell">
      <header className="header">
        <Link to="/polls" className="logo">
          gart<span>.opros</span>
        </Link>

        <nav className="header-actions">
          <NavLink to="/polls" className="btn btn-soft">Опросы</NavLink>
          <NavLink to="/polls/new" className="btn btn-soft">Создать</NavLink>
          <NavLink to="/profile" className="btn btn-soft">
            {user?.name || user?.email || 'Профиль'}
          </NavLink>
          <button type="button" className="btn btn-danger" onClick={onLogout}>Выйти</button>
        </nav>
      </header>

      <main className="layout-single">{children}</main>
    </div>
  )
}

export default Layout