import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { addItem, deleteItem, fetchItems, toggleItem } from './itemsSlice'

export function ItemList() {
  const dispatch = useAppDispatch()
  const { items, status, error } = useAppSelector((state) => state.items)
  const [title, setTitle] = useState('')

  useEffect(() => {
    dispatch(fetchItems())
  }, [dispatch])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    dispatch(addItem(title.trim()))
    setTitle('')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
          Add
        </button>
      </form>

      {status === 'loading' && <p className="text-slate-500">Loading...</p>}
      {status === 'failed' && <p className="text-red-600">Error: {error}</p>}

      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {items.length === 0 && status === 'idle' && (
          <li className="px-4 py-3 text-slate-400">No items yet.</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => dispatch(toggleItem(item.id))}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className={`flex-1 ${item.done ? 'text-slate-400 line-through' : ''}`}>
              {item.title}
            </span>
            <button
              onClick={() => dispatch(deleteItem(item.id))}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
