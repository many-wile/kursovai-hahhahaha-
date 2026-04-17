import { getStoredUser, getStoredTokens } from '../lib/tokenStorage.js'

function ProfilePage() {
  const user = getStoredUser()
  const tokens = getStoredTokens()

  return (
    <section className="panel">
      <h1>Профиль</h1>
      <p><b>Имя:</b> {user?.name || '-'}</p>
      <p><b>Email:</b> {user?.email || '-'}</p>
      <p><b>Access token:</b> {tokens.accessToken ? 'Есть' : 'Нет'}</p>
      <p><b>Refresh token:</b> {tokens.refreshToken ? 'Есть' : 'Нет'}</p>
    </section>
  )
}

export default ProfilePage