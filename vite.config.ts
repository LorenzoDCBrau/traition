import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  server: {
    host: true,
    port: 5173,
  },
})
