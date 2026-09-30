import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './layouts/AppShell'
import NotFoundPage from './pages/NotFoundPage'
import SectionPage from './pages/SectionPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <SectionPage
              eyebrow="Overview"
              title="RoyaltyGuard Dashboard"
              description="Your royalty operations workspace."
            />
          }
        />
        <Route path="/statements" element={<SectionPage eyebrow="Library" title="Statements" />} />
        <Route path="/audits" element={<SectionPage eyebrow="Review" title="Audits" />} />
        <Route
          path="/discrepancies"
          element={<SectionPage eyebrow="Exceptions" title="Discrepancies" />}
        />
        <Route path="/disputes" element={<SectionPage eyebrow="Resolution" title="Disputes" />} />
        <Route path="/login" element={<SectionPage eyebrow="Account" title="Login" />} />
        <Route path="/register" element={<SectionPage eyebrow="Account" title="Register" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App