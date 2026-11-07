import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wardrobeProxy } from './server/proxy'

export default defineConfig({
  base: './',
  plugins: [react(), wardrobeProxy()],
})
