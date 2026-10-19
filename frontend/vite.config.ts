import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // ws: also proxy the /api/ws WebSocket used for live messages.
      '/api': { target: 'http://localhost:8000', ws: true },
    },
  },
})
