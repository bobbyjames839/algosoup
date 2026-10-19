import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AssistantRequestError, streamAssistant } from '../lib/assistantStream'
import { useGetAssistantConversationQuery } from '../store/api'
import { conversationLoaded, questionAsked, questionFailed, replyEvent, replyFinished } from '../store/assistantSlice'
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

// One continuous conversation per doctor: saved on the server, loaded once into the store, then kept
// up to date locally as questions are answered. The server sends the model only the latest messages.
export function AssistantChat() {
  const token = useAppSelector((s) => s.auth.token)
  const messages = useAppSelector((s) => s.assistant.messages)
  const loaded = useAppSelector((s) => s.assistant.loaded)
  const dispatch = useAppDispatch()
  const { data: saved, isError, refetch } = useGetAssistantConversationQuery(undefined, { skip: loaded })
  const [body, setBody] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const busy = messages.some((m) => m.streaming)
  const last = messages[messages.length - 1]

  // Scroll only the message list (scrollIntoView would also scroll the page).
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length, last?.content, last?.reasoning, last?.steps?.length])

  useEffect(() => {
    if (saved && !loaded) dispatch(conversationLoaded(saved))
  }, [saved, loaded, dispatch])

  // Leaving the chat cancels the request, which stops the backend spending tokens.
  useEffect(() => () => abortRef.current?.abort(), [])

  const ask = async (question: string) => {
    if (!question.trim() || busy || !loaded) return
    dispatch(questionAsked(question.trim()))
    setBody('')
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamAssistant(question.trim(), token, (event) => dispatch(replyEvent(event)), controller.signal)
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

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {!loaded && (
          <div className="py-8 text-center text-sm text-slate-500">
            {isError ? (
              <>
                Couldn't load your conversation.{' '}
                <button onClick={() => refetch()} className="font-medium text-indigo-700 hover:underline">Try again</button>
              </>
            ) : (
              'Loading conversation…'
            )}
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <AssistantAvatar size="lg" />
            <p className="mt-3 text-sm font-semibold text-slate-800">GlucoCare Assistant</p>
            <p className="mt-1 text-sm text-slate-500">Ask about any patient: glucose trends, appointments, visit records or messages.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs text-indigo-800 hover:border-indigo-300 hover:bg-indigo-50">
                  ✦ {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[75%] rounded-lg rounded-br-sm bg-slate-800 px-3.5 py-2 text-sm text-white">
                <p className="whitespace-pre-wrap">{m.content}</p>
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
          disabled={!loaded}
          placeholder="Ask the assistant about a patient…"
          className="flex-1 rounded-sm border border-slate-300 bg-indigo-50/30 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {busy ? (
          <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button disabled={!loaded || !body.trim()}>Ask</Button>
        )}
      </form>
      <p className="mt-2 text-[11px] text-slate-400">AI answers can be wrong. Check important details against the patient record.</p>
    </div>
  )
}

export function AssistantAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-brand-700 font-bold text-white ${size === 'lg' ? 'h-11 w-11 text-sm' : 'h-7 w-7 text-[10px]'}`}
      aria-hidden
    >
      AI
    </div>
  )
}

function AssistantReply({ message: m }: { message: AssistantMessage }) {
  const working = m.streaming && !m.content
  const steps = m.steps ?? []
  return (
    <div className="flex items-start gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 max-w-[85%] rounded-lg rounded-tl-sm border border-slate-200 border-l-2 border-l-indigo-500 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Assistant</p>
        {steps.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
            {steps.map((step, j) => (
              <li key={j} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <span className={working && j === steps.length - 1 ? 'animate-pulse text-indigo-600' : 'text-emerald-600'}>●</span>
                {step}
              </li>
            ))}
          </ul>
        )}
        {m.reasoning &&
          (working ? (
            // Live reasoning while the assistant works; collapses once the answer starts.
            <p className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-l-2 border-indigo-200 pl-2 text-xs italic text-slate-500">{m.reasoning}</p>
          ) : (
            <details className="mb-2 text-xs text-slate-500">
              <summary className="cursor-pointer select-none hover:text-indigo-700">Show reasoning</summary>
              <p className="mt-1 whitespace-pre-wrap border-l-2 border-indigo-200 pl-2 italic">{m.reasoning}</p>
            </details>
          ))}
        {working && !m.reasoning && steps.length === 0 && <p className="animate-pulse text-slate-500">Thinking…</p>}
        {m.content && (
          <p className="whitespace-pre-wrap leading-relaxed">
            {m.content}
            {m.streaming && <span className="ml-0.5 animate-pulse text-indigo-600">▍</span>}
          </p>
        )}
      </div>
    </div>
  )
}
