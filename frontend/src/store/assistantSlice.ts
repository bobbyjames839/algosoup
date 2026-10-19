import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { AssistantEvent } from '../lib/assistantStream'
import type { AssistantMessage } from '../types'
import { loggedIn, loggedOut, patientLoggedIn } from './authSlice'

interface AssistantState {
  messages: AssistantMessage[]
  // Whether the saved conversation has been fetched from the server yet.
  loaded: boolean
}

const initialState: AssistantState = { messages: [], loaded: false }

// The reply currently being streamed, if any: always the last message.
const streamingReply = (state: AssistantState) => {
  const last = state.messages[state.messages.length - 1]
  return last?.role === 'assistant' && last.streaming ? last : undefined
}

const assistantSlice = createSlice({
  name: 'assistant',
  initialState,
  reducers: {
    conversationLoaded(state, action: PayloadAction<AssistantMessage[]>) {
      state.messages = action.payload
      state.loaded = true
    },
    questionAsked(state, action: PayloadAction<string>) {
      state.messages.push({ role: 'user', content: action.payload }, { role: 'assistant', content: '', reasoning: '', steps: [], streaming: true })
    },
    replyEvent(state, action: PayloadAction<AssistantEvent>) {
      const reply = streamingReply(state)
      const event = action.payload
      if (!reply) return
      if (event.type === 'thinking') reply.reasoning = (reply.reasoning ?? '') + event.text
      else if (event.type === 'text') reply.content += event.text
      else if (event.type === 'tool') reply.steps = [...(reply.steps ?? []), event.label]
      else if (event.type === 'error') reply.content = (reply.content ? `${reply.content}\n\n` : '') + event.message
    },
    replyFinished(state, action: PayloadAction<{ fallback: string }>) {
      const reply = streamingReply(state)
      if (!reply) return
      reply.content ||= action.payload.fallback
      reply.streaming = false
    },
    // Nothing was answered: drop the question and its empty reply.
    questionFailed(state) {
      if (streamingReply(state)) state.messages.splice(-2, 2)
    },
  },
  // A conversation belongs to the signed-in doctor.
  extraReducers: (builder) => builder.addMatcher(isAnyOf(loggedIn, patientLoggedIn, loggedOut), () => initialState),
})

export const { conversationLoaded, questionAsked, replyEvent, replyFinished, questionFailed } = assistantSlice.actions
export default assistantSlice.reducer
