import { configureStore } from '@reduxjs/toolkit'
import { api } from './api'
import authReducer from './authSlice'
import bannerReducer, { bannerMiddleware } from './bannerSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    banner: bannerReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware, bannerMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
