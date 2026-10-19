import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GlucoseChart } from '../components/GlucoseChart'
import { Badge, Button, Card, Empty, PageHeader, Stat } from '../components/ui'
import { TARGET_HIGH, TARGET_LOW, appointmentTitle, formatDate, formatDateTime, hospitalLabel, humanize, isPast } from '../lib/format'
import { useGetMyAppointmentsQuery, useGetMyGlucoseQuery, useGetMyMessagesQuery, useSendMyMessageMutation } from '../store/api'
import { loggedOut } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useRealtimeMessages } from '../store/realtime'
import type { Appointment } from '../types'

// Same window as the clinician's patient page, so both see the same chart.
const DAYS = 7

type Tab = 'overview' | 'messages'
const navItems: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'messages', label: 'Messages' },
]

export function PatientPortalPage() {
  const dispatch = useAppDispatch()
  const patient = useAppSelector((s) => s.auth.patient)
  const [tab, setTab] = useState<Tab>('overview')
  useRealtimeMessages()
  const { data: readings = [] } = useGetMyGlucoseQuery(DAYS)
  const { data: appointments = [] } = useGetMyAppointmentsQuery()

  const values = readings.map((r) => Number(r.value_mmol))
  const average = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—'
  const inRange = values.length ? `${Math.round((values.filter((v) => v >= TARGET_LOW && v <= TARGET_HIGH).length / values.length) * 100)}%` : '—'
  const lows = values.filter((v) => v < TARGET_LOW).length
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && !isPast(a)).reverse()
    const next = upcoming[0]
  const initials = `${patient?.first_name[0] ?? ''}${patient?.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col bg-brand-950 text-slate-300 md:flex">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-600 text-sm font-bold text-white">G</div>
          <div>
            <div className="text-sm font-semibold text-white">GlucoCare</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Type 1 Diabetes Care</div>
          </div>
        </div>
        <div className="px-5 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">My care</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex w-full items-center rounded-sm border-l-2 px-3 py-2 text-left text-sm font-medium ${tab === item.id ? 'border-brand-300 bg-white/10 text-white' : 'border-transparent hover:bg-white/5 hover:text-white'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-[11px] text-slate-500">© GlucoCare Clinical Systems</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Patient Portal</div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900">{patient?.first_name} {patient?.last_name}</div>
              <div className="text-xs text-slate-500">{patient?.email}</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{initials}</div>
            <button onClick={() => dispatch(loggedOut())} className="ml-2 rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </header>
        {/* Sidebar is hidden on small screens, so show the sections as tabs instead. */}
        <nav className="flex shrink-0 border-b border-slate-200 bg-white md:hidden">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 border-b-2 py-2.5 text-sm font-medium ${tab === item.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          {tab === 'overview' && (
            <>
              <PageHeader title={`Hello, ${patient?.first_name ?? ''}`} subtitle="Your glucose and care at a glance." />
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label={`${DAYS}-day average`} value={average} hint="mmol/L" />
                <Stat label="Time in range" value={inRange} hint={`${TARGET_LOW}–${TARGET_HIGH} mmol/L`} />
                <Stat label="Low readings" value={values.length ? lows : '—'} hint={`< ${TARGET_LOW} mmol/L, last ${DAYS} days`} />
                <Stat label="Next appointment" value={next ? formatDate(next.scheduled_at) : '—'} hint={next ? appointmentTitle(next) : 'None booked'} />
              </div>
              <Card title={`Glucose readings — last ${DAYS} days`} className="mb-6">
                {readings.length ? <GlucoseChart readings={readings} days={DAYS} /> : <Empty>No readings in the last {DAYS} days.</Empty>}
              </Card>
              <Card title="Upcoming appointments">
                {upcoming.length ? <AppointmentList items={upcoming.slice(0, 3)} /> : <Empty>No upcoming appointments.</Empty>}
              </Card>
            </>
          )}

          {tab === 'messages' && (
            <>
              <PageHeader title="Messages" subtitle="Send a message to your care team. For emergencies, call 999." />
              <Card title="Care team" bodyClassName="p-5 h-[calc(100dvh-16rem)] min-h-80">
                <PortalMessages />
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function AppointmentList({ items }: { items: Appointment[] }) {
  return (
    <ul className="-my-3 divide-y divide-slate-100">
      {items.map((a) => {
        const d = new Date(a.scheduled_at)
        return (
          <li key={a.id} className="flex gap-4 py-3">
            <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-sm border border-brand-100 bg-brand-50 py-1.5 text-brand-800">
              <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
              <span className="text-lg font-semibold leading-none">{d.getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{appointmentTitle(a)}</span>
                <Badge tone={a.status}>{humanize(a.status)}</Badge>
              </div>
              <div className="text-xs text-slate-500">
                {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                {a.doctor && ` · ${a.doctor.full_name}`}
                {a.location ? ` · ${a.location}` : a.hospital && ` · ${hospitalLabel(a.hospital)}`}
              </div>
              {a.appointment_data?.plan && <p className="mt-1.5 text-xs text-slate-600"><span className="font-medium text-slate-700">Plan:</span> {a.appointment_data.plan}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function PortalMessages() {
  const { data: messages = [], isLoading } = useGetMyMessagesQuery()
  const [send, { isLoading: sending }] = useSendMyMessageMutation()
  const [body, setBody] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    const { error } = await send(body.trim())
    if (!error) setBody('')
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading && <Empty>Loading…</Empty>}
        {!isLoading && messages.length === 0 && <Empty>No messages yet.</Empty>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'patient' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${m.sender === 'patient' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[11px] ${m.sender === 'patient' ? 'text-brand-200' : 'text-slate-500'}`}>
                {m.sender === 'patient' ? 'You' : 'Care team'} · {formatDateTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="min-w-0 flex-1 rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <Button disabled={sending || !body.trim()}>Send</Button>
      </form>
    </div>
  )
}
