import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // target: 'https://wildcat-radio-f05d362144e6.herokuapp.com',
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: true
      }
    }
  },
  define: {
    global: 'window'
  }
})
