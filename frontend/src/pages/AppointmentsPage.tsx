import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppointmentCalendar } from '../components/AppointmentCalendar'
import { AppointmentDetailModal, NewAppointmentModal } from '../components/AppointmentModals'
import { Badge, Button, Card, Empty, PageHeader, Select } from '../components/ui'
import { appointmentTitle, formatDateTime, localDateTime, fullName, humanize, isPast } from '../lib/format'
import { useGetAppointmentsQuery, useUpdateAppointmentStatusMutation } from '../store/api'

type Filter = 'upcoming' | 'past' | 'all'
type View = 'calendar' | 'list'

const segment = 'mb-4 inline-flex divide-x divide-slate-300 overflow-hidden rounded-sm border border-slate-300'
const segmentButton = (active: boolean) => `px-4 py-1.5 text-sm font-medium ${active ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`

export function AppointmentsPage() {
  const { data: appointments = [], isLoading } = useGetAppointmentsQuery()
  const [updateStatus] = useUpdateAppointmentStatusMutation()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [view, setView] = useState<View>('calendar')
  const [newDate, setNewDate] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Look up by id so the detail modal reflects status changes after refetch.
  const selected = appointments.find((a) => a.id === selectedId)

  // Default to 09:00, or the next full hour if that has already passed today.
  const bookOn = (day: Date) => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9)
    const nextHour = new Date()
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
    setNewDate(localDateTime(start < nextHour ? nextHour : start))
  }

  const now = Date.now()
  const filtered = appointments.filter((a) => {
    const t = new Date(a.scheduled_at).getTime()
    return filter === 'all' || (filter === 'upcoming' ? t >= now : t < now)
  })
  if (filter === 'past') filtered.reverse()

  return (
    <>
      <PageHeader title="Appointments" subtitle="Schedule and record clinical visits" actions={<Button onClick={() => setNewDate('')}>Book appointment</Button>} />
      <Card>
        <div className="flex flex-wrap justify-between gap-4">
          <div className={segment}>
            {(['calendar', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={segmentButton(view === v)}>{humanize(v)}</button>
            ))}
          </div>
          {view === 'list' && (
            <div className={segment}>
              {(['upcoming', 'past', 'all'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={segmentButton(filter === f)}>{humanize(f)}</button>
              ))}
            </div>
          )}
        </div>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : view === 'calendar' ? (
          <AppointmentCalendar appointments={appointments} onSelect={(a) => setSelectedId(a.id)} onDayClick={bookOn} />
        ) : filtered.length === 0 ? (
          <Empty>No appointments.</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 font-semibold">Patient</th>
                <th className="py-2 font-semibold">Appointment</th>
                <th className="py-2 font-semibold">Type</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2 font-semibold">Score</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="py-3">{formatDateTime(a.scheduled_at)}</td>
                  <td className="py-3">
                    <Link to={`/patients/${a.patient_id}`} className="font-medium text-brand-700 hover:underline">{fullName(a.patient)}</Link>
                  </td>
                  <td className="py-3 text-slate-700">{appointmentTitle(a)}</td>
                  <td className="py-3"><Badge tone={a.appointment_type}>{humanize(a.appointment_type)}</Badge></td>
                  <td className="py-3">
                    {isPast(a) ? (
                      <Badge tone={a.status}>{humanize(a.status)}</Badge>
                    ) : (
                      <div className="w-36">
                        <Select
                          value={a.status}
                          options={(['scheduled', 'completed', 'cancelled'] as const).map((s) => ({ value: s, label: humanize(s) }))}
                          onChange={(status) => updateStatus({ id: a.id, status })}
                        />
                      </div>
                    )}
                  </td>
                  <td className="py-3">{a.appointment_data?.overall_score != null ? `${a.appointment_data.overall_score}/100` : '—'}</td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" onClick={() => setSelectedId(a.id)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {newDate != null && <NewAppointmentModal defaultDate={newDate} onClose={() => setNewDate(null)} />}
      {selected && <AppointmentDetailModal appointment={selected} onClose={() => setSelectedId(null)} />}
    </>
  )
}
