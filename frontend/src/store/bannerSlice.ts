import { createSlice, isFulfilled, isRejectedWithValue } from '@reduxjs/toolkit'
import type { Middleware, PayloadAction } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

export type BannerTone = 'success' | 'error'

interface BannerState {
  id: number
  tone: BannerTone
  message: string | null
}

const bannerSlice = createSlice({
  name: 'banner',
  initialState: { id: 0, tone: 'success', message: null } as BannerState,
  reducers: {
    bannerShown(state, action: PayloadAction<{ tone: BannerTone; message: string }>) {
      state.id += 1
      state.tone = action.payload.tone
      state.message = action.payload.message
    },
    bannerDismissed(state) {
      state.message = null
    },
  },
})

export const { bannerShown, bannerDismissed } = bannerSlice.actions
export default bannerSlice.reducer

const successMessages: Record<string, string> = {
  createPatient: 'Patient added.',
  addGlucose: 'Glucose reading logged.',
  createAppointment: 'Appointment booked.',
  updateAppointmentStatus: 'Appointment status updated.',
  saveAppointmentData: 'Appointment data saved.',
  sendMessage: 'Message sent.',
}

function errorMessage(endpoint: string, error: FetchBaseQueryError): string {
  if (error.status === 401) return endpoint === 'login' ? 'Invalid username or password.' : 'Your session has expired. Please sign in again.'
  if (error.status === 'FETCH_ERROR') return 'Unable to reach the server. Check your connection.'
  const detail = (error.data as { detail?: unknown } | undefined)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  return 'Something went wrong. Please try again.'
}

type ApiMeta = { arg?: { endpointName?: string; type?: 'query' | 'mutation' } }

// Turns every RTK Query result into a banner: all errors, plus success for known mutations.
export const bannerMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  if (isRejectedWithValue(action)) {
    const endpoint = (action.meta as ApiMeta).arg?.endpointName ?? ''
    store.dispatch(bannerShown({ tone: 'error', message: errorMessage(endpoint, action.payload as FetchBaseQueryError) }))
  } else if (isFulfilled(action)) {
    const arg = (action.meta as ApiMeta).arg
    const message = arg?.type === 'mutation' && arg.endpointName ? successMessages[arg.endpointName] : undefined
    if (message) store.dispatch(bannerShown({ tone: 'success', message }))
  }
  return result
}
