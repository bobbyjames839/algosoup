import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Field, Input } from '../components/ui'
import { useLoginMutation, usePatientLoginMutation } from '../store/api'
import { errorMessage } from '../store/bannerSlice'
import { loggedIn, patientLoggedIn } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

export function LoginPage() {
  const dispatch = useAppDispatch()
  const { token, patient } = useAppSelector((s) => s.auth)
  const [login, { isLoading: doctorLoading, error: doctorError, reset: resetDoctor }] = useLoginMutation()
  const [patientLogin, { isLoading: patientLoading, error: patientError, reset: resetPatient }] = usePatientLoginMutation()
  const [asPatient, setAsPatient] = useState(false)
  const isLoading = doctorLoading || patientLoading
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (token) return <Navigate to={patient ? '/portal' : '/patients'} replace />

  const error = asPatient ? patientError : doctorError
  const errorText =
    error && 'status' in error
      ? error.status === 401
        ? `Incorrect ${asPatient ? 'email' : 'username'} or password.`
        : errorMessage(asPatient ? 'patientLogin' : 'login', error)
      : error
        ? 'Something went wrong. Please try again.'
        : null

  const switchTab = (p: boolean) => {
    setAsPatient(p)
    resetDoctor()
    resetPatient()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (asPatient) {
      const { data } = await patientLogin({ username, password })
      if (data) dispatch(patientLoggedIn(data))
    } else {
      const { data } = await login({ username, password })
      if (data) dispatch(loggedIn(data))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-700 text-lg font-bold text-white">G</div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-slate-900">GlucoCare</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{asPatient ? 'Patient Portal' : 'Clinician Portal'}</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-slate-200 border-t-4 border-t-brand-700 bg-white p-6 shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Sign in to your account</h1>
          <div className="grid grid-cols-2 rounded-sm border border-slate-300 p-0.5 text-sm font-medium">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                onClick={() => switchTab(p)}
                className={`rounded-sm py-1.5 ${asPatient === p ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {p ? 'Patient' : 'Clinician'}
              </button>
            ))}
          </div>
          <Field label={asPatient ? 'Email' : 'Username'}>
            <Input type={asPatient ? 'email' : 'text'} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {errorText && (
            <p role="alert" className="rounded-sm border border-l-4 border-red-200 border-l-red-600 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorText}
            </p>
          )}
          <Button className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
