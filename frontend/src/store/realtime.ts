import { useEffect } from 'react'
import type { Message } from '../types'
import { addMessage, api } from './api'
import { useAppDispatch, useAppSelector } from './hooks'
import type { AppDispatch } from './index'

const CLOSE_UNAUTHORIZED = 4401 // backend: bad or expired token, so retrying won't help
const MAX_BACKOFF_MS = 30_000

function socketUrl(): string {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  return `${base.replace(/^http/, 'ws')}/api/ws`
}

function applyForDoctor(dispatch: AppDispatch, message: Message) {
  if (message.sender === 'patient') {
    // Refetches the thread only if it's open, and fetching a thread marks it read on the server.
    dispatch(api.util.invalidateTags([{ type: 'Message', id: message.patient_id }]))
  } else {
    dispatch(api.util.updateQueryData('getThread', message.patient_id, (draft) => addMessage(draft, message)))
  }

  let inInbox = false
  dispatch(
    api.util.updateQueryData('getInbox', undefined, (draft) => {
      const i = draft.findIndex((t) => t.patient.id === message.patient_id)
      if (i < 0) return
      inInbox = true
      const [thread] = draft.splice(i, 1)
      // Our own replies are already applied by sendMessage; don't count them twice.
      if (thread.last_message.id !== message.id) {
        thread.last_message = message
        if (message.sender === 'patient' && !message.is_read) thread.unread += 1
      }
      draft.unshift(thread)
    }),
  )
  // A brand-new conversation needs the patient details only the server has.
  if (!inInbox) dispatch(api.util.invalidateTags([{ type: 'Message', id: 'INBOX' }]))
}

function applyForPatient(dispatch: AppDispatch, message: Message) {
  dispatch(api.util.updateQueryData('getMyMessages', undefined, (draft) => addMessage(draft, message)))
}

/** Keeps a WebSocket open while signed in and applies new messages to the cached inbox and threads as they arrive. */
export function useRealtimeMessages() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const isDoctor = useAppSelector((s) => s.auth.doctor !== null)

  useEffect(() => {
    if (!token) return
    let socket: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let connectedBefore = false
    let stopped = false

    const connect = () => {
      socket = new WebSocket(socketUrl())
      socket.onopen = () => socket?.send(JSON.stringify({ token }))
      socket.onmessage = (e) => {
        const event = JSON.parse(e.data) as { type: 'ready' } | { type: 'message'; message: Message }
        if (event.type === 'ready') {
          attempts = 0
          // Catch up on anything sent while we were disconnected.
          if (connectedBefore) dispatch(api.util.invalidateTags(['Message']))
          connectedBefore = true
        } else if (event.type === 'message') {
          if (isDoctor) applyForDoctor(dispatch, event.message)
          else applyForPatient(dispatch, event.message)
        }
      }
      socket.onclose = (e) => {
        if (stopped || e.code === CLOSE_UNAUTHORIZED) return
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, MAX_BACKOFF_MS))
      }
    }
    connect()

    return () => {
      stopped = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [dispatch, token, isDoctor])
}
