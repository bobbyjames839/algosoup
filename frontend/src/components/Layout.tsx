import { NavLink, Outlet } from 'react-router-dom'
import { useGetInboxQuery } from '../store/api'
import { loggedOut } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

const navItems = [
  { to: '/patients', label: 'Patients' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/messages', label: 'Messages' },
]

export function Layout() {
  const dispatch = useAppDispatch()
  const doctor = useAppSelector((s) => s.auth.doctor)
  const { data: inbox } = useGetInboxQuery(undefined, { pollingInterval: 30000 })
  const unread = inbox?.reduce((n, t) => n + t.unread, 0) ?? 0

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="border-b border-slate-800 px-5 py-5">
          <div className="text-lg font-semibold text-white">GlucoCare</div>
          <div className="text-xs text-slate-400">Type 1 Diabetes Management</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-700 text-white' : 'hover:bg-slate-800 hover:text-white'}`
              }
            >
              {item.label}
              {item.to === '/messages' && unread > 0 && (
                <span className="rounded-full bg-red-500 px-2 text-xs text-white">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4 text-sm">
          <div className="font-medium text-white">{doctor?.full_name}</div>
          <div className="text-xs text-slate-400">@{doctor?.username}</div>
          <button onClick={() => dispatch(loggedOut())} className="mt-3 text-xs text-slate-400 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-8">
        <Outlet />
      </main>
    </div>
  )
}
