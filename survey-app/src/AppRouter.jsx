import { Navigate, Route, Routes } from 'react-router-dom'
import Toasts from './components/Toasts.jsx'
import AuthLayout from './components/AuthLayout.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import PollsPage from './pages/PollsPage.jsx'
import PollEditorPage from './pages/PollEditorPage.jsx'
import PollStatsPage from './pages/PollStatsPage.jsx'
import PollDetailsPage from './pages/PollDetailsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function AppRouter() {
  return (
    <>
      <Toasts />

      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <HomePage />
            </Layout>
          }
        />

        <Route
          path="/login"
          element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          }
        />

        <Route
          path="/register"
          element={
            <AuthLayout>
              <RegisterPage />
            </AuthLayout>
          }
        />

        <Route
          path="/polls"
          element={
            <Layout>
              <PollsPage />
            </Layout>
          }
        />

        <Route
          path="/polls/:id"
          element={
            <Layout>
              <PollDetailsPage />
            </Layout>
          }
        />

        <Route
          path="/polls/new"
          element={
            <ProtectedRoute>
              <Layout>
                <PollEditorPage mode="create" />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/polls/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <PollEditorPage mode="edit" />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/polls/:id/stats"
          element={
            <ProtectedRoute>
              <Layout>
                <PollStatsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
