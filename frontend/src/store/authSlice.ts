import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Doctor, Patient } from '../types'

interface AuthState {
  token: string | null
  doctor: Doctor | null
  // Set instead of `doctor` when a patient signs in to the patient portal.
  patient: Patient | null
}

export const STORAGE_KEY = 'glucocare_auth'

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { patient: null, ...JSON.parse(raw) } as AuthState
  } catch {
    // ignore corrupt storage
  }
  return { token: null, doctor: null, patient: null }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadState,
  reducers: {
    loggedIn(state, action: PayloadAction<{ access_token: string; doctor: Doctor }>) {
      state.token = action.payload.access_token
      state.doctor = action.payload.doctor
      state.patient = null
    },
    patientLoggedIn(state, action: PayloadAction<{ access_token: string; patient: Patient }>) {
      state.token = action.payload.access_token
      state.doctor = null
      state.patient = action.payload.patient
    },
    loggedOut(state) {
      state.token = null
      state.doctor = null
      state.patient = null
    },
  },
})

export const { loggedIn, patientLoggedIn, loggedOut } = authSlice.actions
export default authSlice.reducer
