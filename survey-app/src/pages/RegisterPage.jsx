import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { registerUser } from '../api/auth.js'
import { toUserMessage } from '../lib/apiError.js'
import { useToast } from '../contexts/ToastContext.jsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pushToast } = useToast()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await registerUser({
        name: form.name.trim(),
        userName: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      pushToast('success', 'Аккаунт создан')
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
      <h2>Регистрация</h2>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Имя
          <input name="name" type="text" value={form.name} onChange={onChange} required />
        </label>

        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={onChange} required />
        </label>

        <label>
          Пароль
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            minLength={6}
            required
          />
        </label>

        <button type="submit" className="gold-btn" disabled={busy}>
          {busy ? 'Создаём...' : 'Создать аккаунт'}
        </button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}

      <p className="muted">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </section>
  )
}
