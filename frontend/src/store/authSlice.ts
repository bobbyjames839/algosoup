import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Doctor } from '../types'

interface AuthState {
  token: string | null
  doctor: Doctor | null
}

const STORAGE_KEY = 'glucocare_auth'

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AuthState
  } catch {
    // ignore corrupt storage
  }
  return { token: null, doctor: null }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadState,
  reducers: {
    loggedIn(state, action: PayloadAction<{ access_token: string; doctor: Doctor }>) {
      state.token = action.payload.access_token
      state.doctor = action.payload.doctor
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    },
    loggedOut(state) {
      state.token = null
      state.doctor = null
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})

export const { loggedIn, loggedOut } = authSlice.actions
export default authSlice.reducer
