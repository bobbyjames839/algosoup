import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { api } from '../../api'

export interface Item {
  id: number
  title: string
  done: boolean
}

interface ItemsState {
  items: Item[]
  status: 'idle' | 'loading' | 'failed'
  error: string | null
}

const initialState: ItemsState = { items: [], status: 'idle', error: null }

export const fetchItems = createAsyncThunk('items/fetch', () => api<Item[]>('/items'))

export const addItem = createAsyncThunk('items/add', (title: string) =>
  api<Item>('/items', { method: 'POST', body: JSON.stringify({ title }) }),
)

export const toggleItem = createAsyncThunk('items/toggle', (id: number) =>
  api<Item>(`/items/${id}`, { method: 'PATCH' }),
)

export const deleteItem = createAsyncThunk('items/delete', async (id: number) => {
  await api<void>(`/items/${id}`, { method: 'DELETE' })
  return id
})

const itemsSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.status = 'idle'
        state.items = action.payload
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Failed to load items'
      })
      .addCase(addItem.fulfilled, (state, action) => {
        state.items.push(action.payload)
      })
      .addCase(toggleItem.fulfilled, (state, action) => {
        const i = state.items.findIndex((item) => item.id === action.payload.id)
        if (i !== -1) state.items[i] = action.payload
      })
      .addCase(deleteItem.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload)
      })
  },
})

export default itemsSlice.reducer
