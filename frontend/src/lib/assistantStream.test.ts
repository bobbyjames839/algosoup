import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssistantRequestError, streamAssistant } from './assistantStream'
import type { AssistantEvent } from './assistantStream'

afterEach(() => {
  vi.unstubAllGlobals()
})

// A streaming response delivered in the given chunks, so frames can be split across reads.
function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const question = [{ role: 'user' as const, content: 'How is Amy?' }]

describe('streamAssistant', () => {
  it('parses events, including frames split across chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"type":"tool","name":"search_patients","label":"Searching patients"}\n\n',
        'data: {"type":"text","te',
        'xt":"Amy is "}\n\ndata: {"type":"text","text":"well."}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const events: AssistantEvent[] = []

    await streamAssistant(question, 'tok', (e) => events.push(e), new AbortController().signal)

    expect(events).toEqual([
      { type: 'tool', name: 'search_patients', label: 'Searching patients' },
      { type: 'text', text: 'Amy is ' },
      { type: 'text', text: 'well.' },
      { type: 'done' },
    ])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/assistant/chat')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ messages: question })
  })

  it('throws the API detail for errors returned before streaming', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Slow down' }, { status: 429 })))

    const err = await streamAssistant(question, 'tok', () => {}, new AbortController().signal).catch((e) => e)

    expect(err).toBeInstanceOf(AssistantRequestError)
    expect(err).toMatchObject({ status: 429, message: 'Slow down' })
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })))

    await expect(streamAssistant(question, null, () => {}, new AbortController().signal)).rejects.toMatchObject({
      status: 502,
      message: 'The assistant could not answer. Please try again.',
    })
  })
})
