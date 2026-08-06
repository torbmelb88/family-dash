import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// VITE_BASE_PATH settes ved bygg for underkatalog-hosting (f.eks. /family-dash/ på GitHub Pages).
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
})
