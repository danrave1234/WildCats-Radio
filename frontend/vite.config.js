import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Use localhost for local development, production URL for deployed frontend
        target: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8080' 
          : 'https://wildcat-radio-f05d362144e6.autoidleapp.com',
        changeOrigin: true,
        secure: process.env.NODE_ENV !== 'development'
      }
    }
  },
  define: {
    global: 'window'
  }
})
