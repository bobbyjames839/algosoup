import { useState } from 'react'
import type { FormEvent } from 'react'
import { fullName, humanize } from '../lib/format'
import { useCreateAppointmentMutation, useGetPatientsQuery, useSaveAppointmentDataMutation } from '../store/api'
import type { AppointmentDataInput } from '../store/api'
import type { Appointment, AppointmentType } from '../types'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'

const TYPES: AppointmentType[] = ['initial', 'routine', 'follow_up', 'urgent', 'telehealth']

export function NewAppointmentModal({ patientId, onClose }: { patientId?: string; onClose: () => void }) {
  const { data: patients = [] } = useGetPatientsQuery(undefined, { skip: !!patientId })
  const [createAppointment, { isLoading }] = useCreateAppointmentMutation()
  const [form, setForm] = useState({ patient_id: patientId ?? '', scheduled_at: '', appointment_type: 'routine' as AppointmentType, notes: '' })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await createAppointment({ ...form, scheduled_at: new Date(form.scheduled_at).toISOString(), notes: form.notes || undefined })
    if (!error) onClose()
  }

  return (
    <Modal title="Book appointment" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        {!patientId && (
          <div className="col-span-2">
            <Field label="Patient">
              <Select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select a patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Date & time">
          <Input type="datetime-local" required value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={form.appointment_type} onChange={(e) => setForm({ ...form, appointment_type: e.target.value as AppointmentType })}>
            {TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={isLoading}>Book</Button>
        </div>
      </form>
    </Modal>
  )
}

export function AppointmentDataModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const [save, { isLoading }] = useSaveAppointmentDataMutation()
  const d = appointment.appointment_data
  const [form, setForm] = useState({
    height_cm: d?.height_cm?.toString() ?? '',
    weight_kg: d?.weight_kg?.toString() ?? '',
    hba1c_percent: d?.hba1c_percent?.toString() ?? '',
    blood_pressure: d?.blood_pressure ?? '',
    overall_score: d?.overall_score?.toString() ?? '',
    notes: d?.notes ?? '',
  })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value })
  const num = (v: string) => (v === '' ? null : Number(v))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const data: AppointmentDataInput = {
      height_cm: num(form.height_cm),
      weight_kg: num(form.weight_kg),
      hba1c_percent: num(form.hba1c_percent),
      blood_pressure: form.blood_pressure || null,
      overall_score: num(form.overall_score),
      notes: form.notes || null,
    }
    const { error } = await save({ id: appointment.id, data })
    if (!error) onClose()
  }

  return (
    <Modal title={`Appointment data — ${humanize(appointment.appointment_type)}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Height (cm)"><Input type="number" step="0.1" value={form.height_cm} onChange={set('height_cm')} /></Field>
        <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} /></Field>
        <Field label="HbA1c (%)"><Input type="number" step="0.1" value={form.hba1c_percent} onChange={set('hba1c_percent')} /></Field>
        <Field label="Blood pressure"><Input placeholder="120/80" value={form.blood_pressure} onChange={set('blood_pressure')} /></Field>
        <Field label="Overall score (0–100)"><Input type="number" min="0" max="100" value={form.overall_score} onChange={set('overall_score')} /></Field>
        <div className="col-span-2">
          <Field label="Clinical notes"><Textarea value={form.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={isLoading}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
