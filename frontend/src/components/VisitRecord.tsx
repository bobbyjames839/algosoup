import type { ReactNode } from 'react'
import { formatDateTime } from '../lib/format'
import type { AppointmentData } from '../types'
import { Empty } from './ui'

function Measure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value ?? '—'}</div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{children}</p>
    </div>
  )
}

// Read-only clinical record for a past visit.
export function VisitRecord({ data: d }: { data: AppointmentData | null }) {
  if (!d) return <Empty>No visit record.</Empty>

  const sections: [string, ReactNode][] = [
    ['Chief complaint', d.chief_complaint],
    ['Assessment', d.assessment],
    ['Plan', d.plan],
    ['Insulin regimen', d.insulin_regimen],
    ['Follow-up', d.follow_up_weeks != null && (d.follow_up_weeks === 0 ? 'No follow-up needed' : `In ${d.follow_up_weeks} week${d.follow_up_weeks === 1 ? '' : 's'}`)],
    ['Clinical notes', d.notes],
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Measure label="Height" value={d.height_cm != null && `${d.height_cm} cm`} />
        <Measure label="Weight" value={d.weight_kg != null && `${d.weight_kg} kg`} />
        <Measure label="HbA1c" value={d.hba1c_percent != null && `${d.hba1c_percent}%`} />
        <Measure label="BP" value={d.blood_pressure} />
        <Measure label="Score" value={d.overall_score != null && `${d.overall_score}/100`} />
      </div>
      {sections.filter(([, v]) => v).map(([label, v]) => <Section key={label} label={label}>{v}</Section>)}
      <p className="text-xs text-slate-400">Record last updated {formatDateTime(d.updated_at)}</p>
    </div>
  )
}
