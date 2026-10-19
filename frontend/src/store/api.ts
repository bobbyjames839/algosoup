import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  Doctor,
  GlucoseReading,
  Message,
  MessageThread,
  Patient,
} from '../types'
import { loggedOut } from './authSlice'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as { auth: { token: string | null } }).auth.token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra)
  if (result.error?.status === 401) api.dispatch(loggedOut())
  return result
}

export type NewPatient = Omit<Patient, 'id' | 'doctor_id' | 'created_at'>
export type NewAppointment = {
  patient_id: string
  scheduled_at: string
  appointment_type: AppointmentType
  title?: string
  description?: string
  duration_minutes?: number
  location?: string
  notes?: string
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Patient', 'Appointment', 'Message'],
  endpoints: (build) => ({
    login: build.mutation<{ access_token: string; doctor: Doctor }, { username: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),

    getPatients: build.query<Patient[], void>({
      query: () => '/patients',
      providesTags: [{ type: 'Patient', id: 'LIST' }],
    }),
    getPatient: build.query<Patient, string>({
      query: (id) => `/patients/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Patient', id }],
    }),
    createPatient: build.mutation<Patient, NewPatient>({
      query: (body) => ({ url: '/patients', method: 'POST', body }),
      // Only the list changes; cached single-patient queries are still correct.
      invalidatesTags: [{ type: 'Patient', id: 'LIST' }],
    }),

    getGlucose: build.query<GlucoseReading[], { patientId: string; days?: number }>({
      query: ({ patientId, days = 7 }) => `/patients/${patientId}/glucose?days=${days}`,
    }),

    getAppointments: build.query<Appointment[], { patientId?: string } | void>({
      query: (args) => (args?.patientId ? `/appointments?patient_id=${args.patientId}` : '/appointments'),
      providesTags: ['Appointment'],
    }),
    createAppointment: build.mutation<Appointment, NewAppointment>({
      query: (body) => ({ url: '/appointments', method: 'POST', body }),
      invalidatesTags: ['Appointment'],
    }),
    updateAppointmentStatus: build.mutation<Appointment, { id: string; status: AppointmentStatus }>({
      query: ({ id, status }) => ({ url: `/appointments/${id}`, method: 'PATCH', body: { status } }),
      // The PATCH returns the full updated appointment, so patch every cached list instead of refetching them.
      onQueryStarted: async (_args, { dispatch, getState, queryFulfilled }) => {
        const { data } = await queryFulfilled.catch(() => ({ data: null }))
        if (!data) return
        for (const listArgs of api.util.selectCachedArgsForQuery(getState(), 'getAppointments')) {
          dispatch(
            api.util.updateQueryData('getAppointments', listArgs, (draft) => {
              const i = draft.findIndex((a) => a.id === data.id)
              if (i >= 0) draft[i] = data
            }),
          )
        }
      },
    }),

    getInbox: build.query<MessageThread[], void>({
      query: () => '/messages',
      providesTags: [{ type: 'Message', id: 'INBOX' }],
    }),
    getThread: build.query<Message[], string>({
      query: (patientId) => `/messages/patient/${patientId}`,
      providesTags: (_r, _e, id) => [{ type: 'Message', id }],
      // Fetching a thread marks it read on the server, so zero its unread count in the cached inbox
      // rather than refetching. (Invalidating the 'Message' type here would also refetch this thread, forever.)
      onQueryStarted: async (patientId, { dispatch, queryFulfilled }) => {
        if (!(await queryFulfilled.catch(() => null))) return
        dispatch(
          api.util.updateQueryData('getInbox', undefined, (draft) => {
            const thread = draft.find((t) => t.patient.id === patientId)
            if (thread) thread.unread = 0
          }),
        )
      },
    }),
    sendMessage: build.mutation<Message, { patientId: string; body: string }>({
      query: ({ patientId, body }) => ({ url: `/messages/patient/${patientId}`, method: 'POST', body: { body } }),
      // Add the returned message to the cached thread and inbox instead of refetching both.
      onQueryStarted: async ({ patientId }, { dispatch, queryFulfilled }) => {
        const { data } = await queryFulfilled.catch(() => ({ data: null }))
        if (!data) return
        dispatch(api.util.updateQueryData('getThread', patientId, (draft) => void draft.push(data)))
        let inInbox = false
        dispatch(
          api.util.updateQueryData('getInbox', undefined, (draft) => {
            const i = draft.findIndex((t) => t.patient.id === patientId)
            if (i < 0) return
            inInbox = true
            const [thread] = draft.splice(i, 1)
            thread.last_message = data
            draft.unshift(thread)
          }),
        )
        // A brand-new conversation needs the patient details only the server has.
        if (!inInbox) dispatch(api.util.invalidateTags([{ type: 'Message', id: 'INBOX' }]))
      },
    }),

    // Patient portal (patient token): the signed-in patient's own records.
    patientLogin: build.mutation<{ access_token: string; patient: Patient }, { username: string; password: string }>({
      query: (body) => ({ url: '/portal/login', method: 'POST', body }),
    }),
    getMyGlucose: build.query<GlucoseReading[], number>({
      query: (days) => `/portal/glucose?days=${days}`,
    }),
    getMyAppointments: build.query<Appointment[], void>({
      query: () => '/portal/appointments',
    }),
    getMyMessages: build.query<Message[], void>({
      query: () => '/portal/messages',
    }),
    sendMyMessage: build.mutation<Message, string>({
      query: (body) => ({ url: '/portal/messages', method: 'POST', body: { body } }),
      onQueryStarted: async (_body, { dispatch, queryFulfilled }) => {
        const { data } = await queryFulfilled.catch(() => ({ data: null }))
        if (data) dispatch(api.util.updateQueryData('getMyMessages', undefined, (draft) => void draft.push(data)))
      },
    }),
  }),
})

export const {
  useLoginMutation,
  useGetPatientsQuery,
  useGetPatientQuery,
  useCreatePatientMutation,
  useGetGlucoseQuery,
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentStatusMutation,
  useGetInboxQuery,
  useGetThreadQuery,
  useSendMessageMutation,
  usePatientLoginMutation,
  useGetMyGlucoseQuery,
  useGetMyAppointmentsQuery,
  useGetMyMessagesQuery,
  useSendMyMessageMutation,
} = api
