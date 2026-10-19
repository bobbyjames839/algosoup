import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatDateTime } from '../lib/format'
import { useGetThreadQuery, useSendMessageMutation } from '../store/api'
import { Button, Empty } from './ui'

export function MessageThread({ patientId }: { patientId: string }) {
  const { data: messages = [], isLoading } = useGetThreadQuery(patientId)
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation()
  const [body, setBody] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll only the message list (scrollIntoView would also scroll the page).
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    const { error } = await sendMessage({ patientId, body: body.trim() })
    if (!error) setBody('')
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading && <Empty>Loading…</Empty>}
        {!isLoading && messages.length === 0 && <Empty>No messages yet.</Empty>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'doctor' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${m.sender === 'doctor' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[11px] ${m.sender === 'doctor' ? 'text-brand-200' : 'text-slate-500'}`}>
                {m.sender === 'doctor' ? 'You' : 'Patient'} · {formatDateTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a reply…"
          className="flex-1 rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <Button disabled={sending || !body.trim()}>Send</Button>
      </form>
    </div>
  )
}
