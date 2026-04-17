import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '../api/auth.js'
import { toUserMessage } from '../lib/apiError.js'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      await loginUser({ email: email.trim(), password })
      navigate(location.state?.from || '/polls', { replace: true })
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel auth-page">
      <h1>Вход</h1>

      <form className="stack" onSubmit={onSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        <button className="btn" disabled={busy}>{busy ? 'Входим...' : 'Войти'}</button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}

      <p className="muted">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </section>
  )
}

export default LoginPage