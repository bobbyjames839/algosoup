import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppointmentDataModal, NewAppointmentModal } from '../components/AppointmentModals'
import { Badge, Button, Card, Empty, PageHeader, Select } from '../components/ui'
import { formatDateTime, fullName, humanize } from '../lib/format'
import { useGetAppointmentsQuery, useUpdateAppointmentStatusMutation } from '../store/api'
import type { Appointment, AppointmentStatus } from '../types'

type Filter = 'upcoming' | 'past' | 'all'

export function AppointmentsPage() {
  const { data: appointments = [], isLoading } = useGetAppointmentsQuery()
  const [updateStatus] = useUpdateAppointmentStatusMutation()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)

  const now = Date.now()
  const filtered = appointments.filter((a) => {
    const t = new Date(a.scheduled_at).getTime()
    return filter === 'all' || (filter === 'upcoming' ? t >= now : t < now)
  })
  if (filter === 'past') filtered.reverse()

  return (
    <>
      <PageHeader title="Appointments" subtitle="Schedule and record clinical visits" actions={<Button onClick={() => setShowNew(true)}>Book appointment</Button>} />
      <Card>
        <div className="mb-4 flex gap-1">
          {(['upcoming', 'past', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {humanize(f)}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : filtered.length === 0 ? (
          <Empty>No appointments.</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Patient</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Score</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="py-3">{formatDateTime(a.scheduled_at)}</td>
                  <td className="py-3">
                    <Link to={`/patients/${a.patient_id}`} className="font-medium text-blue-700 hover:underline">{fullName(a.patient)}</Link>
                  </td>
                  <td className="py-3"><Badge tone={a.appointment_type}>{humanize(a.appointment_type)}</Badge></td>
                  <td className="py-3">
                    <div className="w-36">
                      <Select value={a.status} onChange={(e) => updateStatus({ id: a.id, status: e.target.value as AppointmentStatus })}>
                        {(['scheduled', 'completed', 'cancelled'] as const).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                      </Select>
                    </div>
                  </td>
                  <td className="py-3">{a.appointment_data?.overall_score != null ? `${a.appointment_data.overall_score}/100` : '—'}</td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" onClick={() => setEditing(a)}>{a.appointment_data ? 'Edit data' : 'Record data'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {showNew && <NewAppointmentModal onClose={() => setShowNew(false)} />}
      {editing && <AppointmentDataModal appointment={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
