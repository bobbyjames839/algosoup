import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppointmentDataModal, NewAppointmentModal } from '../components/AppointmentModals'
import { GlucoseChart } from '../components/GlucoseChart'
import { MessageThread } from '../components/MessageThread'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat } from '../components/ui'
import { TARGET_HIGH, TARGET_LOW, age, formatDate, formatDateTime, fullName, humanize } from '../lib/format'
import { useAddGlucoseMutation, useGetAppointmentsQuery, useGetGlucoseQuery, useGetPatientQuery } from '../store/api'
import type { Appointment, GlucoseContext } from '../types'

export function PatientDetailPage() {
  const { id = '' } = useParams()
  const { data: patient, isLoading } = useGetPatientQuery(id)
  const { data: readings = [] } = useGetGlucoseQuery({ patientId: id, days: 7 })
  const { data: appointments = [] } = useGetAppointmentsQuery({ patientId: id })
  const [showReading, setShowReading] = useState(false)
  const [showAppt, setShowAppt] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)

  if (isLoading) return <Empty>Loading…</Empty>
  if (!patient) return <Empty>Patient not found.</Empty>

  const values = readings.map((r) => Number(r.value_mmol))
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const inRange = values.length ? (values.filter((v) => v >= TARGET_LOW && v <= TARGET_HIGH).length / values.length) * 100 : null
  const lows = values.filter((v) => v < TARGET_LOW).length
  const latestData = appointments.find((a) => a.appointment_data)?.appointment_data

  return (
    <>
      <Link to="/patients" className="text-sm text-blue-700 hover:underline">← All patients</Link>
      <PageHeader
        title={fullName(patient)}
        subtitle={[
          age(patient.date_of_birth) != null && `${age(patient.date_of_birth)} yrs`,
          `DOB ${formatDate(patient.date_of_birth)}`,
          `Diagnosed ${formatDate(patient.diagnosis_date)}`,
          patient.email,
          patient.phone,
        ].filter(Boolean).join(' · ')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowReading(true)}>Log reading</Button>
            <Button onClick={() => setShowAppt(true)}>Book appointment</Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="7-day average" value={avg ? `${avg.toFixed(1)}` : '—'} hint="mmol/L" />
        <Stat label="Time in range" value={inRange != null ? `${inRange.toFixed(0)}%` : '—'} hint={`${TARGET_LOW}–${TARGET_HIGH} mmol/L`} />
        <Stat label="Hypo events" value={lows} hint={`< ${TARGET_LOW} mmol/L, last 7 days`} />
        <Stat label="Latest HbA1c" value={latestData?.hba1c_percent != null ? `${latestData.hba1c_percent}%` : '—'} hint="From last recorded visit" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Glucose readings — last 7 days">
            {readings.length ? <GlucoseChart readings={readings} /> : <Empty>No readings in the last 7 days.</Empty>}
          </Card>

          <Card title="Appointments">
            {appointments.length === 0 ? (
              <Empty>No appointments.</Empty>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Height / Weight</th>
                    <th className="py-2 font-medium">HbA1c</th>
                    <th className="py-2 font-medium">BP</th>
                    <th className="py-2 font-medium">Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((a) => {
                    const d = a.appointment_data
                    return (
                      <tr key={a.id}>
                        <td className="py-3">{formatDateTime(a.scheduled_at)}</td>
                        <td className="py-3"><Badge tone={a.appointment_type}>{humanize(a.appointment_type)}</Badge></td>
                        <td className="py-3"><Badge tone={a.status}>{humanize(a.status)}</Badge></td>
                        <td className="py-3">{d ? `${d.height_cm ?? '—'} cm / ${d.weight_kg ?? '—'} kg` : '—'}</td>
                        <td className="py-3">{d?.hba1c_percent != null ? `${d.hba1c_percent}%` : '—'}</td>
                        <td className="py-3">{d?.blood_pressure ?? '—'}</td>
                        <td className="py-3">{d?.overall_score != null ? `${d.overall_score}/100` : '—'}</td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" onClick={() => setEditing(a)}>{d ? 'Edit data' : 'Record data'}</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card title="Messages" className="h-fit">
          <MessageThread patientId={id} />
        </Card>
      </div>

      {showReading && <LogReadingModal patientId={id} onClose={() => setShowReading(false)} />}
      {showAppt && <NewAppointmentModal patientId={id} onClose={() => setShowAppt(false)} />}
      {editing && <AppointmentDataModal appointment={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function LogReadingModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [addGlucose, { isLoading }] = useAddGlucoseMutation()
  const [value, setValue] = useState('')
  const [context, setContext] = useState<GlucoseContext>('other')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await addGlucose({ patientId, value_mmol: Number(value), context })
    if (!error) onClose()
  }

  return (
    <Modal title="Log glucose reading" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Value (mmol/L)">
          <Input type="number" step="0.1" min="0.5" max="40" required value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Context">
          <Select value={context} onChange={(e) => setContext(e.target.value as GlucoseContext)}>
            {(['fasting', 'pre_meal', 'post_meal', 'bedtime', 'other'] as const).map((c) => (
              <option key={c} value={c}>{humanize(c)}</option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={isLoading}>Save reading</Button>
        </div>
      </form>
    </Modal>
  )
}
