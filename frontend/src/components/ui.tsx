import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, KeyboardEvent, ReactNode, TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

export function Card({ title, actions, children, className = '', bodyClassName = 'p-5' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`flex flex-col rounded-md border border-slate-200 bg-white shadow-xs ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">{title}</h2>
          {actions}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300',
    secondary: 'border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50',
    ghost: 'text-brand-700 hover:bg-brand-50',
  }[variant]
  return <button className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles} ${className}`} {...props} />
}

const fieldClass = 'w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input className={fieldClass} {...props} />
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={fieldClass} rows={3} {...props} />

export interface SelectOption<T extends string> {
  value: T
  label: string
}

/** Custom dropdown (no native <select>). The menu is portalled so modals and tables can't clip it. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled,
  searchable,
}: {
  value: T | ''
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const choose = (v: T) => {
    onChange(v)
    close()
    triggerRef.current?.focus()
  }

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const up = below < 280 && r.top > below
    setMenuStyle({
      left: r.left,
      minWidth: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) close()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place, close])

  useEffect(() => {
    if (open) menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) choose(filtered[active].value)
    } else if (e.key === 'Tab') {
      close()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          if (open) close()
          else openMenu()
        }}
        onKeyDown={onKeyDown}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${open ? 'border-brand-600 ring-1 ring-brand-600' : ''}`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[60] flex max-h-72 flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-lg"
          >
            {searchable && (
              <div className="border-b border-slate-200 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search…"
                  className="w-full rounded-sm border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            )}
            <ul id={listId} role="listbox" className="overflow-y-auto py-1">
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matches</li>}
              {filtered.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.value)}
                  className={`flex cursor-pointer items-center justify-between gap-4 whitespace-nowrap px-3 py-2 text-sm ${i === active ? 'bg-brand-50 text-brand-900' : 'text-slate-700'} ${o.value === value ? 'font-semibold' : ''}`}
                >
                  {o.label}
                  {o.value === value && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-brand-700" aria-hidden>
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}

const badgeColors: Record<string, string> = {
  scheduled: 'bg-brand-50 text-brand-700 ring-brand-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  urgent: 'bg-red-50 text-red-700 ring-red-200',
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const color = (tone && badgeColors[tone]) || 'bg-slate-100 text-slate-700 ring-slate-200'
  return <span className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}>{children}</span>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-md border-t-4 border-brand-700 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-600" aria-label="Close">×</button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-slate-200 border-l-4 border-l-brand-700 bg-white px-4 py-3 shadow-xs">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions}
  </div>
)

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-sm text-slate-400">{children}</p>
