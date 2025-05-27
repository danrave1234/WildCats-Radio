import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine if we're in development mode
  const isDevelopment = mode === 'development';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          // Use localhost for local development, production URL for deployed frontend
          target: isDevelopment 
            ? 'http://localhost:8080'
            : 'https://wildcat-radio-f05d362144e6.autoidleapp.com',
          changeOrigin: true,
          secure: true
        },
        '/ws-radio': {
          target: isDevelopment 
            ? 'http://localhost:8080'
            : 'https://wildcat-radio-f05d362144e6.autoidleapp.com',
          changeOrigin: true,
          secure: true,
          ws: true
        },
        '/ws': {
          target: isDevelopment 
            ? 'ws://localhost:8080'
            : 'wss://wildcat-radio-f05d362144e6.autoidleapp.com',
          changeOrigin: true,
          secure: true,
          ws: true
        }
      }
    },
    define: {
      global: 'window',
      // Set default environment variables if not provided (NO PROTOCOLS - they will be added by the app)
      // In Vite, environment variables are loaded from .env files at build time
      // These defaults are used if the variables are not defined in .env files
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        'wildcat-radio-f05d362144e6.autoidleapp.com/api'
      ),
      'import.meta.env.VITE_WS_BASE_URL': JSON.stringify(
        'wildcat-radio-f05d362144e6.autoidleapp.com'
      ),
      'import.meta.env.VITE_ICECAST_URL': JSON.stringify(
        'https://34.142.131.206/live.ogg'
      )
    }
  };
})
