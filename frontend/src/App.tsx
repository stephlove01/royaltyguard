import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './layouts/AppShell'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import SectionPage from './pages/SectionPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/statements" element={<SectionPage eyebrow="Library" title="Statements" />} />
          <Route path="/audits" element={<SectionPage eyebrow="Review" title="Audits" />} />
          <Route
            path="/discrepancies"
            element={<SectionPage eyebrow="Exceptions" title="Discrepancies" />}
          />
          <Route path="/disputes" element={<SectionPage eyebrow="Resolution" title="Disputes" />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App