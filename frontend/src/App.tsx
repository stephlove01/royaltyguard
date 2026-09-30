import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './layouts/AppShell'
import AuditDetailPage from './pages/AuditDetailPage'
import AuditsPage from './pages/AuditsPage'
import DashboardPage from './pages/DashboardPage'
import DiscrepanciesPage from './pages/DiscrepanciesPage'
import DiscrepancyDetailPage from './pages/DiscrepancyDetailPage'
import DisputeDetailPage from './pages/DisputeDetailPage'
import DisputesPage from './pages/DisputesPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import StatementDetailPage from './pages/StatementDetailPage'
import StatementsPage from './pages/StatementsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/statements" element={<StatementsPage />} />
          <Route path="/statements/:id" element={<StatementDetailPage />} />
          <Route path="/audits" element={<AuditsPage />} />
          <Route path="/audits/:id" element={<AuditDetailPage />} />
          <Route path="/discrepancies" element={<DiscrepanciesPage />} />
          <Route path="/discrepancies/:id" element={<DiscrepancyDetailPage />} />
          <Route path="/disputes" element={<DisputesPage />} />
          <Route path="/disputes/:id" element={<DisputeDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App