import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config — zero-config for Vercel deployment
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // Allow LAN connections for testing
    port: 5173
  }
})
