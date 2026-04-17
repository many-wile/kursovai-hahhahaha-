import { Link } from 'react-router-dom'
import { getStoredUser } from '../lib/tokenStorage.js'

export default function AuthLayout({ children }) {
  const user = getStoredUser()

  return (
    <div className="app-shell">
      <header className="header">
        <Link to="/" className="logo">
          gart<span>.opros</span>
        </Link>

        <div className="header-actions">
          <div className="user-pill" title={user?.email || user?.name || 'Гость'}>
            <span>{user?.name || user?.email || 'Гость'}</span>
          </div>
        </div>
      </header>

      <section className="hero" aria-label="Баннер">
        <div className="hero-glow" />
        <div className="hero-inner">
          <h1 className="hero-title">Клиент опросов: JWT, CRUD, файлы и API-интеграция</h1>
        </div>
      </section>

      <main className="layout-single">{children}</main>
    </div>
  )
}

