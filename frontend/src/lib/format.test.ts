import { afterEach, describe, expect, it, vi } from 'vitest'
import { age, appointmentTitle, dayKey, fullName, hospitalLabel, humanize, isPast, localDateTime } from './format'

afterEach(() => {
  vi.useRealTimers()
})

describe('format', () => {
  it('formats names with a placeholder for missing patients', () => {
    expect(fullName({ first_name: 'Amy', last_name: 'Patel' })).toBe('Amy Patel')
    expect(fullName(null)).toBe('—')
  })

  it('builds local date keys for calendar buckets and datetime-local inputs', () => {
    const d = new Date(2026, 0, 5, 9, 7)
    expect(dayKey(d)).toBe('2026-01-05')
    expect(localDateTime(d)).toBe('2026-01-05T09:07')
  })

  it('humanizes enum values', () => {
    expect(humanize('follow_up')).toBe('Follow up')
  })

  it('falls back to the appointment type when there is no title', () => {
    expect(appointmentTitle({ title: 'Quarterly review', appointment_type: 'routine' })).toBe('Quarterly review')
    expect(appointmentTitle({ title: null, appointment_type: 'follow_up' })).toBe('Follow up')
  })

  it('works out age, counting birthdays not yet reached this year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 19))
    expect(age('1990-05-01')).toBe(36)
    expect(age('1990-12-01')).toBe(35)
    expect(age(null)).toBeNull()
  })

  it('knows whether an appointment is in the past', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'))
    expect(isPast({ scheduled_at: '2026-10-19T11:59:00Z' })).toBe(true)
    expect(isPast({ scheduled_at: '2026-10-19T12:01:00Z' })).toBe(false)
  })

  it('labels hospitals with an optional city', () => {
    expect(hospitalLabel({ name: 'City General', city: 'Leeds' })).toBe('City General, Leeds')
    expect(hospitalLabel({ name: 'City General', city: null })).toBe('City General')
    expect(hospitalLabel(null)).toBeNull()
  })
})
