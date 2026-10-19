import { useEffect } from 'react'
import { bannerDismissed } from '../store/bannerSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

const toneStyles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
}

export function Banner() {
  const dispatch = useAppDispatch()
  const { id, tone, message } = useAppSelector((s) => s.banner)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => dispatch(bannerDismissed()), 5000)
    return () => clearTimeout(timer)
  }, [id, message, dispatch])

  if (!message) return null

  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div role={tone === 'error' ? 'alert' : 'status'} className={`flex w-full max-w-md items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${toneStyles[tone]}`}>
        <p className="flex-1">{message}</p>
        <button onClick={() => dispatch(bannerDismissed())} className="text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">×</button>
      </div>
    </div>
  )
}
