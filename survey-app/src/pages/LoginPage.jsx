import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '../api/auth.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pushToast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await loginUser({ email: email.trim(), password })
      pushToast('success', 'Вход выполнен')
      navigate(location.state?.from || '/polls', { replace: true })
    } catch (err) {
      const message = toUserMessage(err)
      setError(message)
      pushToast('error', message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card auth-card">
      <h2>Вход</h2>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        <button type="submit" className="gold-btn" disabled={busy}>
          {busy ? 'Входим...' : 'Войти'}
        </button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}

      <p className="muted">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </section>
  )
}
