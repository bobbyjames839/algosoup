import { ItemList } from './features/items/ItemList'

function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold">Algosoup</h1>
        <ItemList />
      </div>
    </main>
  )
}

export default App
