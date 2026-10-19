import { configureStore } from '@reduxjs/toolkit'
import { api } from './api'
import assistantReducer from './assistantSlice'
import { authMiddleware } from './authMiddleware'
import authReducer from './authSlice'
import bannerReducer, { bannerMiddleware } from './bannerSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    assistant: assistantReducer,
    banner: bannerReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware, authMiddleware, bannerMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
