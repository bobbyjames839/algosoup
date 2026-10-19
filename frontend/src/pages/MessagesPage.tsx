import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageThread } from '../components/MessageThread'
import { Card, Empty, PageHeader } from '../components/ui'
import { formatDateTime, fullName } from '../lib/format'
import { useGetInboxQuery } from '../store/api'

export function MessagesPage() {
  const { data: threads = [], isLoading } = useGetInboxQuery()
  const [selected, setSelected] = useState<string | null>(null)
  const active = threads.find((t) => t.patient.id === selected)

  return (
    <>
      <PageHeader title="Messages" subtitle="Patient enquiries" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          {isLoading && <Empty>Loading…</Empty>}
          {!isLoading && threads.length === 0 && <Empty>No messages.</Empty>}
          <ul className="-m-5 divide-y divide-slate-100">
            {threads.map((t) => (
              <li key={t.patient.id}>
                <button
                  onClick={() => setSelected(t.patient.id)}
                  className={`w-full px-5 py-3 text-left hover:bg-slate-50 ${selected === t.patient.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${t.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{fullName(t.patient)}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(t.last_message.created_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-slate-500">{t.last_message.sender === 'doctor' && 'You: '}{t.last_message.body}</p>
                    {t.unread > 0 && <span className="rounded-full bg-blue-700 px-2 text-xs text-white">{t.unread}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          className="lg:col-span-2"
          title={active ? fullName(active.patient) : 'Conversation'}
          actions={active && <Link to={`/patients/${active.patient.id}`} className="text-sm text-blue-700 hover:underline">View patient →</Link>}
        >
          {selected ? <MessageThread key={selected} patientId={selected} /> : <Empty>Select a conversation.</Empty>}
        </Card>
      </div>
    </>
  )
}
