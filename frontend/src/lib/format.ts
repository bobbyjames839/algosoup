export const fullName = (p: { first_name: string; last_name: string } | null | undefined) =>
  p ? `${p.first_name} ${p.last_name}` : '—'

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Local YYYY-MM-DD, used to bucket appointments by day and prefill datetime-local inputs.
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Local YYYY-MM-DDTHH:mm, the value format of datetime-local inputs.
export const localDateTime = (d: Date) =>
  `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

// Appointments may have no title; fall back to the type (see backend/CLAUDE.md).
export const appointmentTitle = (a: { title: string | null; appointment_type: string }) => a.title || humanize(a.appointment_type)

export const isPast = (a: { scheduled_at: string }) => new Date(a.scheduled_at).getTime() < Date.now()

export function age(dob: string | null) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let years = now.getFullYear() - d.getFullYear()
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) years--
  return years
}

// Standard T1D target range in mmol/L
export const TARGET_LOW = 3.9
export const TARGET_HIGH = 10.0

export const hospitalLabel = (h: { name: string; city: string | null } | null | undefined) =>
  h ? [h.name, h.city].filter(Boolean).join(', ') : null
