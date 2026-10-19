import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Banner } from './components/Banner'
import { Layout } from './components/Layout'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { LoginPage } from './pages/LoginPage'
import { MessagesPage } from './pages/MessagesPage'
import { PatientPortalPage } from './pages/PatientPortalPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { PatientsPage } from './pages/PatientsPage'
import { useAppSelector } from './store/hooks'

function RequireAuth({ children }: { children: ReactNode }) {
  const { token, patient } = useAppSelector((s) => s.auth)
  if (!token) return <Navigate to="/login" replace />
  return patient ? <Navigate to="/portal" replace /> : children
}

function RequirePatient({ children }: { children: ReactNode }) {
  const { token, patient } = useAppSelector((s) => s.auth)
  return token && patient ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Banner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/portal" element={<RequirePatient><PatientPortalPage /></RequirePatient>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
