import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppointmentDetailModal, NewAppointmentModal } from '../components/AppointmentModals'
import { GlucoseChart } from '../components/GlucoseChart'
import { Badge, Button, Card, Empty, PageHeader, Stat } from '../components/ui'
import { VisitRecord } from '../components/VisitRecord'
import { TARGET_HIGH, TARGET_LOW, age, appointmentTitle, formatDate, formatDateTime, fullName, hospitalLabel, humanize, isPast } from '../lib/format'
import { useGetAppointmentsQuery, useGetGlucoseQuery, useGetPatientQuery } from '../store/api'
import { useAppSelector } from '../store/hooks'

export function PatientDetailPage() {
  const { id = '' } = useParams()
  const { data: patient, isLoading } = useGetPatientQuery(id)
  const { data: readings = [] } = useGetGlucoseQuery({ patientId: id, days: 7 })
  // Includes appointments with other doctors/hospitals; those appear only in prior history.
  const { data: appointments = [] } = useGetAppointmentsQuery({ patientId: id })
  const myId = useAppSelector((s) => s.auth.doctor?.id)
  const [showAppt, setShowAppt] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (isLoading) return <Empty>Loading…</Empty>
  if (!patient) return <Empty>Patient not found.</Empty>

  const values = readings.map((r) => Number(r.value_mmol))
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const inRange = values.length ? (values.filter((v) => v >= TARGET_LOW && v <= TARGET_HIGH).length / values.length) * 100 : null
  const lows = values.filter((v) => v < TARGET_LOW).length
  const prior = appointments.filter(isPast).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
  const upcoming = appointments.filter((a) => !isPast(a) && a.doctor_id === myId).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const latestData = prior.find((a) => a.appointment_data)?.appointment_data
  const selected = appointments.find((a) => a.id === selectedId)

  return (
    <>
      <Link to="/patients" className="text-sm text-brand-700 hover:underline">← All patients</Link>
      <PageHeader
        title={fullName(patient)}
        subtitle={[
          age(patient.date_of_birth) != null && `${age(patient.date_of_birth)} yrs`,
          `DOB ${formatDate(patient.date_of_birth)}`,
          `Diagnosed ${formatDate(patient.diagnosis_date)}`,
          patient.email,
          patient.phone,
        ].filter(Boolean).join(' · ')}
        actions={<Button onClick={() => setShowAppt(true)}>Book appointment</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="7-day average" value={avg ? `${avg.toFixed(1)}` : '—'} hint="mmol/L" />
        <Stat label="Time in range" value={inRange != null ? `${inRange.toFixed(0)}%` : '—'} hint={`${TARGET_LOW}–${TARGET_HIGH} mmol/L`} />
        <Stat label="Hypo events" value={lows} hint={`< ${TARGET_LOW} mmol/L, last 7 days`} />
        <Stat label="Latest HbA1c" value={latestData?.hba1c_percent != null ? `${latestData.hba1c_percent}%` : '—'} hint="From last recorded visit" />
      </div>

      <div className="space-y-6">
        <Card title="Glucose readings — last 7 days">
          {readings.length ? <GlucoseChart readings={readings} /> : <Empty>No readings in the last 7 days.</Empty>}
        </Card>

        <Card title="Upcoming appointments">
          {upcoming.length === 0 ? (
            <Empty>No upcoming appointments.</Empty>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 font-semibold">Date</th>
                  <th className="py-2 font-semibold">Appointment</th>
                  <th className="py-2 font-semibold">Type</th>
                  <th className="py-2 font-semibold">Duration</th>
                  <th className="py-2 font-semibold">Location</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3">{formatDateTime(a.scheduled_at)}</td>
                    <td className="py-3 font-medium text-slate-900">{appointmentTitle(a)}</td>
                    <td className="py-3"><Badge tone={a.appointment_type}>{humanize(a.appointment_type)}</Badge></td>
                    <td className="py-3">{a.duration_minutes} min</td>
                    <td className="py-3 text-slate-600">{a.location ?? '—'}</td>
                    <td className="py-3"><Badge tone={a.status}>{humanize(a.status)}</Badge></td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" onClick={() => setSelectedId(a.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Prior appointments">
          {prior.length === 0 ? (
            <Empty>No prior appointments.</Empty>
          ) : (
            <div className="-my-5 divide-y divide-slate-200">
              {prior.map((a) => (
                <article key={a.id} className="py-5">
                  <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{appointmentTitle(a)}</h3>
                      <p className="text-xs text-slate-500">
                        {[formatDateTime(a.scheduled_at), `${a.duration_minutes} min`, a.location].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{a.doctor?.full_name ?? 'Unknown clinician'}</span>
                        {a.doctor?.specialty && ` · ${a.doctor.specialty}`}
                        {a.hospital && ` · ${hospitalLabel(a.hospital)}`}
                        {a.doctor_id === myId && <span className="ml-2 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">You</span>}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge tone={a.appointment_type}>{humanize(a.appointment_type)}</Badge>
                      <Badge tone={a.status}>{humanize(a.status)}</Badge>
                    </div>
                  </header>
                  {a.status === 'cancelled' ? (
                    <p className="text-sm text-slate-500">Cancelled{a.cancellation_reason ? `: ${a.cancellation_reason}` : '.'}</p>
                  ) : (
                    <VisitRecord data={a.appointment_data} />
                  )}
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showAppt && <NewAppointmentModal patientId={id} onClose={() => setShowAppt(false)} />}
      {selected && <AppointmentDetailModal appointment={selected} onClose={() => setSelectedId(null)} />}
    </>
  )
}
