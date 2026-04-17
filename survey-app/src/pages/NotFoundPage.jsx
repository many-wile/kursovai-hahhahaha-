import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="app-shell">
      <main className="container page-content">
        <section className="card not-found-card">
          <h2>404</h2>
          <p className="muted">Страница не найдена</p>
          <Link to="/" className="gold-btn">
            На главную
          </Link>
        </section>
      </main>
    </div>
  )
}
