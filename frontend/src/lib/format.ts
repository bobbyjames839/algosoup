export const fullName = (p: { first_name: string; last_name: string } | null | undefined) =>
  p ? `${p.first_name} ${p.last_name}` : '—'

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

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
