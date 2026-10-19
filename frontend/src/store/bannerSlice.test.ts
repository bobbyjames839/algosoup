import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it } from 'vitest'
import banner, { bannerDismissed, bannerMiddleware } from './bannerSlice'

function makeStore() {
  return configureStore({
    reducer: { banner },
    middleware: (getDefault) => getDefault().concat(bannerMiddleware),
  })
}

// Minimal shapes of the actions RTK Query dispatches when a request settles.
const rejected = (endpointName: string, payload: unknown) => ({
  type: 'api/executeQuery/rejected',
  payload,
  error: { message: 'Rejected' },
  meta: { requestId: '1', requestStatus: 'rejected', rejectedWithValue: true, arg: { endpointName, type: 'query' } },
})

const fulfilled = (endpointName: string, type: 'query' | 'mutation') => ({
  type: 'api/executeMutation/fulfilled',
  payload: {},
  meta: { requestId: '1', requestStatus: 'fulfilled', arg: { endpointName, type } },
})

describe('banner middleware', () => {
  it.each([
    ['login', { status: 401 }, 'Invalid username or password.'],
    ['getPatients', { status: 401 }, 'Your session has expired. Please sign in again.'],
    ['getPatients', { status: 'FETCH_ERROR', error: 'TypeError' }, 'Unable to reach the server. Check your connection.'],
    ['getPatient', { status: 404, data: { detail: 'Patient not found' } }, 'Patient not found'],
    ['createPatient', { status: 422, data: { detail: [{ msg: 'Field required' }] } }, 'Field required'],
    ['getPatient', { status: 500, data: 'oops' }, 'Something went wrong. Please try again.'],
  ])('shows an error banner for a failed %s (%j)', (endpoint, error, message) => {
    const store = makeStore()
    store.dispatch(rejected(endpoint, error))
    expect(store.getState().banner).toMatchObject({ tone: 'error', message })
  })

  it('shows a success banner for known mutations only', () => {
    const store = makeStore()
    store.dispatch(fulfilled('getPatients', 'query'))
    expect(store.getState().banner.message).toBeNull()

    store.dispatch(fulfilled('createPatient', 'mutation'))
    expect(store.getState().banner).toMatchObject({ tone: 'success', message: 'Patient added.' })
  })

  it('can be dismissed', () => {
    const store = makeStore()
    store.dispatch(fulfilled('sendMessage', 'mutation'))
    store.dispatch(bannerDismissed())
    expect(store.getState().banner.message).toBeNull()
  })
})
