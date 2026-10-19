import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import type {
  Appointment,
  AppointmentData,
  AppointmentStatus,
  AppointmentType,
  Doctor,
  GlucoseContext,
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
export type NewAppointment = { patient_id: string; scheduled_at: string; appointment_type: AppointmentType; notes?: string }
export type AppointmentDataInput = Omit<AppointmentData, 'id' | 'appointment_id'>

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Patient', 'Glucose', 'Appointment', 'Message'],
  endpoints: (build) => ({
    login: build.mutation<{ access_token: string; doctor: Doctor }, { username: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),

    getPatients: build.query<Patient[], void>({
      query: () => '/patients',
      providesTags: ['Patient'],
    }),
    getPatient: build.query<Patient, string>({
      query: (id) => `/patients/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Patient', id }],
    }),
    createPatient: build.mutation<Patient, NewPatient>({
      query: (body) => ({ url: '/patients', method: 'POST', body }),
      invalidatesTags: ['Patient'],
    }),

    getGlucose: build.query<GlucoseReading[], { patientId: string; days?: number }>({
      query: ({ patientId, days = 7 }) => `/patients/${patientId}/glucose?days=${days}`,
      providesTags: (_r, _e, { patientId }) => [{ type: 'Glucose', id: patientId }],
    }),
    addGlucose: build.mutation<GlucoseReading, { patientId: string; value_mmol: number; context: GlucoseContext }>({
      query: ({ patientId, ...body }) => ({ url: `/patients/${patientId}/glucose`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { patientId }) => [{ type: 'Glucose', id: patientId }],
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
      invalidatesTags: ['Appointment'],
    }),
    saveAppointmentData: build.mutation<Appointment, { id: string; data: AppointmentDataInput }>({
      query: ({ id, data }) => ({ url: `/appointments/${id}/data`, method: 'PUT', body: data }),
      invalidatesTags: ['Appointment'],
    }),

    getInbox: build.query<MessageThread[], void>({
      query: () => '/messages',
      providesTags: ['Message'],
    }),
    getThread: build.query<Message[], string>({
      query: (patientId) => `/messages/patient/${patientId}`,
      providesTags: (_r, _e, id) => [{ type: 'Message', id }],
      // Fetching a thread marks it read, so refresh inbox unread counts.
      onQueryStarted: async (_id, { dispatch, queryFulfilled }) => {
        await queryFulfilled
        dispatch(api.util.invalidateTags(['Message']))
      },
    }),
    sendMessage: build.mutation<Message, { patientId: string; body: string }>({
      query: ({ patientId, body }) => ({ url: `/messages/patient/${patientId}`, method: 'POST', body: { body } }),
      invalidatesTags: (_r, _e, { patientId }) => ['Message', { type: 'Message', id: patientId }],
    }),
  }),
})

export const {
  useLoginMutation,
  useGetPatientsQuery,
  useGetPatientQuery,
  useCreatePatientMutation,
  useGetGlucoseQuery,
  useAddGlucoseMutation,
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentStatusMutation,
  useSaveAppointmentDataMutation,
  useGetInboxQuery,
  useGetThreadQuery,
  useSendMessageMutation,
} = api
