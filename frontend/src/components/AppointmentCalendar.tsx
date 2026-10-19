import { useState } from 'react'
import { appointmentTitle, dayKey, fullName } from '../lib/format'
import type { Appointment } from '../types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function chipStyle(a: Appointment) {
  if (a.status === 'cancelled') return 'border-slate-300 bg-slate-50 text-slate-400 line-through'
  if (a.status === 'completed') return 'border-emerald-600 bg-emerald-50 text-emerald-800'
  if (a.appointment_type === 'urgent') return 'border-red-600 bg-red-50 text-red-800'
  return 'border-brand-700 bg-brand-50 text-brand-800'
}

export function AppointmentCalendar({
  appointments,
  onSelect,
  onDayClick,
}: {
  appointments: Appointment[]
  onSelect: (a: Appointment) => void
  onDayClick: (day: Date) => void
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const today = dayKey(new Date())
  // Grid starts on the Monday on/before the 1st and always shows 6 weeks.
  const gridStart = new Date(month)
  gridStart.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))

  const byDay = new Map<string, Appointment[]>()
  for (const a of [...appointments].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))) {
    const key = dayKey(new Date(a.scheduled_at))
    byDay.set(key, [...(byDay.get(key) ?? []), a])
  }

  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const navButton = 'rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-1">
          <button className={navButton} onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <button className={navButton} onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
          <button className={navButton} onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-sm border border-slate-200 bg-slate-200 gap-px">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-slate-50 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{d}</div>
        ))}
        {days.map((day) => {
          const key = dayKey(day)
          const inMonth = day.getMonth() === month.getMonth()
          const items = byDay.get(key) ?? []
          const bookable = key >= today
          return (
            <div
              key={key}
              onClick={bookable ? () => onDayClick(day) : undefined}
              className={`group min-h-28 p-1.5 ${bookable ? 'cursor-pointer hover:bg-brand-50/40' : ''} ${inMonth && bookable ? 'bg-white' : 'bg-slate-50'}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    key === today ? 'bg-brand-700 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </span>
                {bookable && <span className="text-xs text-brand-700 opacity-0 group-hover:opacity-100">+ Book</span>}
              </div>
              <div className="max-h-24 space-y-1 overflow-y-auto">
                {items.map((a) => (
                  <button
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(a)
                    }}
                    className={`block w-full truncate rounded-sm border-l-2 px-1.5 py-0.5 text-left text-xs hover:brightness-95 ${chipStyle(a)}`}
                    title={`${fullName(a.patient)} — ${appointmentTitle(a)}`}
                  >
                    <span className="font-semibold tabular-nums">
                      {new Date(a.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    {fullName(a.patient)}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        {[
          ['border-brand-700 bg-brand-50', 'Scheduled'],
          ['border-red-600 bg-red-50', 'Urgent'],
          ['border-emerald-600 bg-emerald-50', 'Completed'],
          ['border-slate-300 bg-slate-50', 'Cancelled'],
        ].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm border-l-2 ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
