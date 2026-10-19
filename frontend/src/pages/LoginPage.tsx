import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Field, Input } from '../components/ui'
import { useLoginMutation } from '../store/api'
import { loggedIn } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

export function LoginPage() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const [login, { isLoading }] = useLoginMutation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (token) return <Navigate to="/patients" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const { data } = await login({ username, password })
    if (data) dispatch(loggedIn(data))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold text-slate-900">GlucoCare</div>
          <div className="text-sm text-slate-500">Clinician portal · Type 1 Diabetes</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Button className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
