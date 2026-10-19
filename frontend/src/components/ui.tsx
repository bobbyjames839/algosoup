import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Card({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-blue-700 hover:bg-blue-50',
  }[variant]
  return <button className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`} {...props} />
}

const fieldClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input className={fieldClass} {...props} />
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className={fieldClass} {...props} />
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={fieldClass} rows={3} {...props} />

const badgeColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  urgent: 'bg-red-50 text-red-700 ring-red-200',
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const color = (tone && badgeColors[tone]) || 'bg-slate-100 text-slate-700 ring-slate-200'
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}>{children}</span>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-600" aria-label="Close">×</button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions}
  </div>
)

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-sm text-slate-400">{children}</p>
