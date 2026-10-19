import { isAnyOf } from '@reduxjs/toolkit'
import type { Middleware } from '@reduxjs/toolkit'
import { api } from './api'
import { STORAGE_KEY, loggedIn, loggedOut, patientLoggedIn } from './authSlice'

const authChanged = isAnyOf(loggedIn, patientLoggedIn, loggedOut)

// Side effects of signing in or out, kept out of the reducers: persist the session, and drop
// every cached API response so the next user never sees the previous user's data.
export const authMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  if (authChanged(action)) {
    const { auth } = store.getState()
    try {
      if (auth.token) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage unavailable: the session just won't survive a reload
    }
    store.dispatch(api.util.resetApiState())
  }
  return result
}
