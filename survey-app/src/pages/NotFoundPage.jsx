import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="panel">
      <h1>404</h1>
      <p>Страница не найдена.</p>
      <Link className="btn" to="/polls">На главную</Link>
    </section>
  )
}

export default NotFoundPage