import { NavLink, Outlet } from 'react-router-dom'
import { useGetInboxQuery } from '../store/api'
import { loggedOut } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useRealtimeMessages } from '../store/realtime'

const navItems = [
  { to: '/patients', label: 'Patients' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/messages', label: 'Messages' },
]

export function Layout() {
  const dispatch = useAppDispatch()
  const doctor = useAppSelector((s) => s.auth.doctor)
  useRealtimeMessages()
  const { data: inbox } = useGetInboxQuery()
  const unread = inbox?.reduce((n, t) => n + t.unread, 0) ?? 0
  const initials = doctor?.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col bg-brand-950 text-slate-300">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-600 text-sm font-bold text-white">G</div>
          <div>
            <div className="text-sm font-semibold text-white">GlucoCare</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Type 1 Diabetes Management</div>
          </div>
        </div>
        <div className="px-5 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Navigation</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-sm border-l-2 px-3 py-2 text-sm font-medium ${isActive ? 'border-brand-300 bg-white/10 text-white' : 'border-transparent hover:bg-white/5 hover:text-white'}`
              }
            >
              {item.label}
              {item.to === '/messages' && unread > 0 && (
                <span className="rounded-sm bg-red-600 px-1.5 text-xs font-semibold text-white">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-[11px] text-slate-500">© GlucoCare Clinical Systems</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Clinician Portal</div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">{doctor?.full_name}</div>
              <div className="text-xs text-slate-500">@{doctor?.username}</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{initials}</div>
            <button onClick={() => dispatch(loggedOut())} className="ml-2 rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
