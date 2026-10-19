export type AssistantEvent =
  | { type: 'thinking' | 'text'; text: string }
  | { type: 'tool'; name: string; label: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

export class AssistantRequestError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** POSTs the doctor's next question (the server holds the conversation) and calls onEvent for each server-sent event until the stream ends. */
export async function streamAssistant(
  question: string,
  token: string | null,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message: question }),
    signal,
  })
  // Limits and auth are checked before streaming starts, so they arrive as normal JSON errors.
  if (!res.ok || !res.body) {
    const detail = await res.json().then((b) => b?.detail, () => undefined)
    throw new AssistantRequestError(res.status, typeof detail === 'string' ? detail : 'The assistant could not answer. Please try again.')
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const data = frame.split('\n').find((l) => l.startsWith('data: '))
      if (data) onEvent(JSON.parse(data.slice(6)) as AssistantEvent)
    }
  }
}
