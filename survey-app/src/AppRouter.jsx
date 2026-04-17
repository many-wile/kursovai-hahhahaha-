import { Route, Routes } from 'react-router-dom'
import AuthLayout from './components/AuthLayout.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import HomePage from './pages/HomePage.jsx'          // новый компонент
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import PollsPage from './pages/PollsPage.jsx'
import PollEditorPage from './pages/PollEditorPage.jsx'
import PollStatsPage from './pages/PollStatsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function AppRouter() {
  return (
    <Routes>
      {/* Публичная главная страница */}
      <Route path="/" element={<HomePage />} />

      {/* Публичный список опросов (если хотите, чтобы все видели) */}
      <Route path="/polls" element={<PollsPage />} />

      {/* Страницы авторизации без защиты */}
      <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
      <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />

      {/* Защищённые страницы (требуют входа) */}
      <Route path="/polls/new" element={<ProtectedRoute><Layout><PollEditorPage mode="create" /></Layout></ProtectedRoute>} />
      <Route path="/polls/:id/edit" element={<ProtectedRoute><Layout><PollEditorPage mode="edit" /></Layout></ProtectedRoute>} />
      <Route path="/polls/:id/stats" element={<ProtectedRoute><Layout><PollStatsPage /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}