import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AssistantAvatar, AssistantChat } from '../components/AssistantChat'
import { MessageThread } from '../components/MessageThread'
import { Card, Empty, PageHeader } from '../components/ui'
import { formatDateTime, fullName } from '../lib/format'
import { useGetInboxQuery } from '../store/api'

const ASSISTANT = 'assistant'

export function MessagesPage() {
  const { data: threads = [], isLoading } = useGetInboxQuery()
  const [selected, setSelected] = useState<string | null>(null)
  const active = threads.find((t) => t.patient.id === selected)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Messages" subtitle="Patient enquiries and AI assistant" />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] gap-6 lg:grid-cols-3 lg:grid-rows-1">
        <Card className="min-h-0 lg:col-span-1" bodyClassName="overflow-y-auto">
          <ul className="divide-y divide-slate-100">
            <li>
              <button
                onClick={() => setSelected(ASSISTANT)}
                className={`w-full px-5 py-3 text-left hover:bg-indigo-50/50 ${selected === ASSISTANT ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <AssistantAvatar />
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-indigo-800">AI Assistant</span>
                    <p className="mt-0.5 truncate text-xs text-slate-500">Ask about any patient and their records</p>
                  </div>
                </div>
              </button>
            </li>
          </ul>
          {isLoading && <Empty>Loading…</Empty>}
          {!isLoading && threads.length === 0 && <Empty>No messages.</Empty>}
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {threads.map((t) => (
              <li key={t.patient.id}>
                <button
                  onClick={() => setSelected(t.patient.id)}
                  className={`w-full px-5 py-3 text-left hover:bg-slate-50 ${selected === t.patient.id ? 'bg-brand-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${t.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{fullName(t.patient)}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(t.last_message.created_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-slate-500">{t.last_message.sender === 'doctor' && 'You: '}{t.last_message.body}</p>
                    {t.unread > 0 && <span className="rounded-full bg-brand-700 px-2 text-xs text-white">{t.unread}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          className="min-h-0 lg:col-span-2"
          title={selected === ASSISTANT ? 'AI Assistant' : active ? fullName(active.patient) : 'Conversation'}
          actions={active && <Link to={`/patients/${active.patient.id}`} className="text-sm text-brand-700 hover:underline">View patient →</Link>}
        >
          {selected === ASSISTANT ? (
            <AssistantChat />
          ) : selected ? (
            <MessageThread key={selected} patientId={selected} />
          ) : (
            <Empty>Select a conversation.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
