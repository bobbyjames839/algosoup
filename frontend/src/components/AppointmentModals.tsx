import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { appointmentTitle, formatDateTime, fullName, hospitalLabel, humanize, isPast, localDateTime } from '../lib/format'
import { useCreateAppointmentMutation, useGetPatientsQuery, useUpdateAppointmentStatusMutation } from '../store/api'
import { bannerShown } from '../store/bannerSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type { Appointment, AppointmentStatus, AppointmentType } from '../types'
import { Badge, Button, Field, Input, Modal, Select, Textarea } from './ui'
import { VisitRecord } from './VisitRecord'

const TYPES: AppointmentType[] = ['initial', 'routine', 'follow_up', 'urgent', 'telehealth']
const STATUSES: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled']

export function NewAppointmentModal({ patientId, defaultDate = '', onClose }: { patientId?: string; defaultDate?: string; onClose: () => void }) {
  const { data: patients = [] } = useGetPatientsQuery(undefined, { skip: !!patientId })
  const [createAppointment, { isLoading }] = useCreateAppointmentMutation()
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ patient_id: patientId ?? '', scheduled_at: defaultDate, appointment_type: 'routine' as AppointmentType, notes: '' })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (new Date(form.scheduled_at).getTime() < Date.now()) {
      dispatch(bannerShown({ tone: 'error', message: 'Appointments cannot be booked in the past.' }))
      return
    }
    const { error } = await createAppointment({ ...form, scheduled_at: new Date(form.scheduled_at).toISOString(), notes: form.notes || undefined })
    if (!error) onClose()
  }

  return (
    <Modal title="Book appointment" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        {!patientId && (
          <div className="col-span-2">
            <Field label="Patient">
              <Select
                searchable
                placeholder="Select a patient…"
                value={form.patient_id}
                options={patients.map((p) => ({ value: p.id, label: fullName(p) }))}
                onChange={(patient_id) => setForm({ ...form, patient_id })}
              />
            </Field>
          </div>
        )}
        <Field label="Date & time">
          <Input type="datetime-local" required min={localDateTime(new Date())} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select
            value={form.appointment_type}
            options={TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            onChange={(appointment_type) => setForm({ ...form, appointment_type })}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={isLoading || !form.patient_id}>Book</Button>
        </div>
      </form>
    </Modal>
  )
}

export function AppointmentDetailModal({ appointment: a, onClose }: { appointment: Appointment; onClose: () => void }) {
  const [updateStatus, { isLoading }] = useUpdateAppointmentStatusMutation()
  const myId = useAppSelector((s) => s.auth.doctor?.id)
  const past = isPast(a)
  const mine = a.doctor_id === myId
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  )

  return (
    <Modal title={appointmentTitle(a)} onClose={onClose}>
      <dl>
        {row('Patient', <Link to={`/patients/${a.patient_id}`} className="text-brand-700 hover:underline">{fullName(a.patient)}</Link>)}
        {row('Date & time', `${formatDateTime(a.scheduled_at)} · ${a.duration_minutes} min`)}
        {row('Doctor', a.doctor ? [a.doctor.full_name, a.doctor.specialty].filter(Boolean).join(' · ') : '—')}
        {row('Hospital', hospitalLabel(a.hospital) ?? '—')}
        {a.location && row('Location', a.location)}
        {row('Type', <Badge tone={a.appointment_type}>{humanize(a.appointment_type)}</Badge>)}
        {row('Status', past || !mine ? (
          <Badge tone={a.status}>{humanize(a.status)}</Badge>
        ) : (
          <Select
            value={a.status}
            disabled={isLoading}
            options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            onChange={(status) => updateStatus({ id: a.id, status })}
          />
        ))}
        {a.cancellation_reason && row('Cancellation reason', a.cancellation_reason)}
      </dl>
      {a.description && <p className="mt-3 whitespace-pre-wrap rounded-sm bg-slate-50 px-3 py-2 text-sm text-slate-700">{a.description}</p>}
      {a.notes && <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Notes:</span> {a.notes}</p>}
      {past && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Visit record</h3>
          <VisitRecord data={a.appointment_data} />
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
