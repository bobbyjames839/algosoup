import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AssistantRequestError, streamAssistant } from '../lib/assistantStream'
import { chatCleared, questionAsked, questionFailed, replyEvent, replyFinished } from '../store/assistantSlice'
import { loggedOut } from '../store/authSlice'
import { bannerShown } from '../store/bannerSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type { AssistantMessage } from '../types'
import { Button } from './ui'

const suggestions = [
  'Who am I seeing this week?',
  'Which patients had hypos in the last 14 days?',
  'Which patients have unread messages, and what do they need?',
]

// The conversation lives in the store, so it survives switching threads and pages (not a reload).
export function AssistantChat() {
  const token = useAppSelector((s) => s.auth.token)
  const messages = useAppSelector((s) => s.assistant.messages)
  const dispatch = useAppDispatch()
  const [body, setBody] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const busy = messages.some((m) => m.streaming)
  const last = messages[messages.length - 1]

  // Scroll only the message list (scrollIntoView would also scroll the page).
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length, last?.content, last?.reasoning, last?.steps?.length])

  // Leaving the chat cancels the request, which stops the backend spending tokens.
  useEffect(() => () => abortRef.current?.abort(), [])

  const ask = async (question: string) => {
    if (!question.trim() || busy) return
    const history: AssistantMessage[] = [...messages, { role: 'user', content: question.trim() }]
    dispatch(questionAsked(question.trim()))
    setBody('')
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamAssistant(history, token, (event) => dispatch(replyEvent(event)), controller.signal)
      dispatch(replyFinished({ fallback: 'No answer was received. Please try again.' }))
    } catch (err) {
      if (controller.signal.aborted) {
        dispatch(replyFinished({ fallback: 'Stopped.' }))
      } else {
        // Nothing was answered: drop the question and put it back in the box to retry.
        dispatch(questionFailed())
        setBody(question)
        if (err instanceof AssistantRequestError && err.status === 401) dispatch(loggedOut())
        else dispatch(bannerShown({ tone: 'error', message: err instanceof AssistantRequestError ? err.message : 'Unable to reach the server. Check your connection.' }))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(body)
  }

  const newChat = () => {
    abortRef.current?.abort()
    dispatch(chatCleared())
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-500">Ask about any patient: glucose trends, appointments, visit records or messages.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-sm border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-md bg-brand-700 px-3 py-2 text-sm text-white">
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className="mt-1 text-[11px] text-brand-200">You</p>
              </div>
            </div>
          ) : (
            <AssistantReply key={i} message={m} />
          ),
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="Ask about a patient…"
          className="flex-1 rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        {messages.length > 0 && (
          <Button type="button" variant="secondary" onClick={newChat}>
            New chat
          </Button>
        )}
        {busy ? (
          <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button disabled={!body.trim()}>Ask</Button>
        )}
      </form>
      <p className="mt-2 text-[11px] text-slate-400">AI answers can be wrong. Check important details against the patient record.</p>
    </div>
  )
}

function AssistantReply({ message: m }: { message: AssistantMessage }) {
  const working = m.streaming && !m.content
  const steps = m.steps ?? []
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">
        {steps.length > 0 && (
          <ul className="mb-2 space-y-0.5 text-xs text-slate-500">
            {steps.map((step, j) => (
              <li key={j} className="flex items-center gap-1.5">
                <span className={working && j === steps.length - 1 ? 'animate-pulse text-brand-700' : 'text-emerald-600'}>●</span>
                {step}
              </li>
            ))}
          </ul>
        )}
        {m.reasoning &&
          (working ? (
            // Live reasoning while the assistant works; collapses once the answer starts.
            <p className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">{m.reasoning}</p>
          ) : (
            <details className="mb-2 text-xs text-slate-500">
              <summary className="cursor-pointer select-none hover:text-slate-700">Reasoning</summary>
              <p className="mt-1 whitespace-pre-wrap border-l-2 border-slate-300 pl-2 italic">{m.reasoning}</p>
            </details>
          ))}
        {working && !m.reasoning && steps.length === 0 && <p className="animate-pulse text-slate-500">Thinking…</p>}
        {m.content && (
          <p className="whitespace-pre-wrap">
            {m.content}
            {m.streaming && <span className="ml-0.5 animate-pulse">▍</span>}
          </p>
        )}
        <p className="mt-1 text-[11px] text-slate-500">Assistant</p>
      </div>
    </div>
  )
}
