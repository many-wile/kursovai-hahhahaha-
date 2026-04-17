import { Navigate, useLocation } from 'react-router-dom'
import { getStoredTokens } from '../lib/tokenStorage.js'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const { accessToken } = getStoredTokens()

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}