import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { isConfigured } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Study from './pages/Study.jsx'
import SetupNeeded from './pages/SetupNeeded.jsx'

function RequireLogin({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <p className="p-8 text-2xl font-bold">불러오는 중입니다…</p>
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireLogin>
            <Dashboard />
          </RequireLogin>
        }
      />
      <Route
        path="/study/:id"
        element={
          <RequireLogin>
            <Study />
          </RequireLogin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
