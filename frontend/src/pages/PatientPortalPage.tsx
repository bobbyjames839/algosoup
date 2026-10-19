import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GlucoseChart } from '../components/GlucoseChart'
import { Badge, Button, Card, Empty, Stat } from '../components/ui'
import { TARGET_HIGH, TARGET_LOW, appointmentTitle, formatDateTime, hospitalLabel, isPast } from '../lib/format'
import { useGetMyAppointmentsQuery, useGetMyGlucoseQuery, useGetMyMessagesQuery, useSendMyMessageMutation } from '../store/api'
import { loggedOut } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type { Appointment } from '../types'

const DAYS = 14

export function PatientPortalPage() {
  const dispatch = useAppDispatch()
  const patient = useAppSelector((s) => s.auth.patient)
  const { data: readings = [] } = useGetMyGlucoseQuery(DAYS)
  const { data: appointments = [] } = useGetMyAppointmentsQuery()

  const values = readings.map((r) => Number(r.value_mmol))
  const average = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—'
  const inRange = values.length ? `${Math.round((values.filter((v) => v >= TARGET_LOW && v <= TARGET_HIGH).length / values.length) * 100)}%` : '—'
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && !isPast(a)).reverse()
  const past = appointments.filter((a) => !upcoming.includes(a))

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-700 text-sm font-bold text-white">G</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">GlucoCare</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Patient Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-slate-900 sm:inline">
            {patient?.first_name} {patient?.last_name}
          </span>
          <button onClick={() => dispatch(loggedOut())} className="rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Hello, {patient?.first_name}</h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label={`Average (${DAYS} days)`} value={average} hint="mmol/L" />
          <Stat label="Time in range" value={inRange} hint={`${TARGET_LOW}–${TARGET_HIGH} mmol/L`} />
          <Stat label="Next appointment" value={upcoming[0] ? formatDateTime(upcoming[0].scheduled_at) : 'None booked'} />
        </div>

        <Card title={`My glucose — last ${DAYS} days`}>
          {readings.length ? <GlucoseChart readings={readings} days={DAYS} /> : <Empty>No readings yet.</Empty>}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="My appointments">
            {appointments.length === 0 && <Empty>No appointments.</Empty>}
            <div className="space-y-4">
              {upcoming.length > 0 && <AppointmentList title="Upcoming" items={upcoming} />}
              {past.length > 0 && <AppointmentList title="Past" items={past} />}
            </div>
          </Card>
          <Card title="Message my care team" bodyClassName="p-5 h-[28rem]">
            <PortalMessages />
          </Card>
        </div>
      </main>
    </div>
  )
}

function AppointmentList({ title, items }: { title: string; items: Appointment[] }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <ul className="divide-y divide-slate-100">
        {items.map((a) => (
          <li key={a.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900">{appointmentTitle(a)}</span>
              {a.status !== 'scheduled' && <Badge>{a.status}</Badge>}
            </div>
            <div className="text-xs text-slate-500">
              {formatDateTime(a.scheduled_at)}
              {a.doctor && ` · ${a.doctor.full_name}`}
              {a.location ? ` · ${a.location}` : a.hospital && ` · ${hospitalLabel(a.hospital)}`}
            </div>
            {a.appointment_data?.plan && <p className="mt-1 text-xs text-slate-600">Plan: {a.appointment_data.plan}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PortalMessages() {
  const { data: messages = [], isLoading } = useGetMyMessagesQuery(undefined, { pollingInterval: 30000, skipPollingIfUnfocused: true })
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
