import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Field, Input, Modal, PageHeader } from '../components/ui'
import { age, formatDate, fullName } from '../lib/format'
import { useCreatePatientMutation, useGetPatientsQuery } from '../store/api'
import type { NewPatient } from '../store/api'

export function PatientsPage() {
  const navigate = useNavigate()
  const { data: patients = [], isLoading } = useGetPatientsQuery()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = patients.filter((p) => fullName(p).toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <PageHeader title="Patients" subtitle={`${patients.length} patients under care`} actions={<Button onClick={() => setShowAdd(true)}>Add patient</Button>} />
      <Card>
        <div className="mb-4 max-w-xs">
          <Input placeholder="Search patients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : filtered.length === 0 ? (
          <Empty>No patients found.</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold">Age</th>
                <th className="py-2 font-semibold">Diagnosed</th>
                <th className="py-2 font-semibold">Email</th>
                <th className="py-2 font-semibold">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="py-3 font-medium text-brand-700">{fullName(p)}</td>
                  <td className="py-3">{age(p.date_of_birth) ?? '—'}</td>
                  <td className="py-3">{formatDate(p.diagnosis_date)}</td>
                  <td className="py-3 text-slate-600">{p.email ?? '—'}</td>
                  <td className="py-3 text-slate-600">{p.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} />}
    </>
  )
}

function AddPatientModal({ onClose }: { onClose: () => void }) {
  const [createPatient, { isLoading }] = useCreatePatientMutation()
  const [form, setForm] = useState<NewPatient>({ first_name: '', last_name: '', date_of_birth: null, diagnosis_date: null, email: null, phone: null })
  const set = (key: keyof NewPatient) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value || null })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await createPatient(form)
    if (!error) onClose()
  }

  return (
    <Modal title="Add patient" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <Field label="First name"><Input required value={form.first_name} onChange={set('first_name')} /></Field>
        <Field label="Last name"><Input required value={form.last_name} onChange={set('last_name')} /></Field>
        <Field label="Date of birth"><Input type="date" onChange={set('date_of_birth')} /></Field>
        <Field label="Diagnosis date"><Input type="date" onChange={set('diagnosis_date')} /></Field>
        <Field label="Email"><Input type="email" onChange={set('email')} /></Field>
        <Field label="Phone"><Input onChange={set('phone')} /></Field>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={isLoading}>Save patient</Button>
        </div>
      </form>
    </Modal>
  )
}
