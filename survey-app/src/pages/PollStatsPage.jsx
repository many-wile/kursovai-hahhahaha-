import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../api/auth.js'
import { toUserMessage } from '../lib/apiError.js'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      await registerUser({
        name: form.name.trim(),
        userName: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      navigate('/polls', { replace: true })
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel auth-page">
      <h1>Регистрация</h1>

      <form className="stack" onSubmit={onSubmit}>
        <input name="name" type="text" placeholder="Имя" value={form.name} onChange={onChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={onChange} required />
        <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={onChange} minLength={6} required />
        <button className="btn" disabled={busy}>{busy ? 'Создаем...' : 'Создать аккаунт'}</button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}

      <p className="muted">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </section>
  )
}