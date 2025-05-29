import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine if we should use local backend
  // This will be overridden by the VITE_USE_LOCAL_BACKEND env var at runtime
  const isDevelopment = mode === 'development';

  console.log(`Vite config using ${isDevelopment ? 'LOCAL' : 'DEPLOYED'} backend (default based on mode)`);
  console.log(`This will be overridden by VITE_USE_LOCAL_BACKEND at runtime`);

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          // Use development mode as default, will be overridden by VITE_USE_LOCAL_BACKEND at runtime
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
      'import.meta.env.VITE_USE_LOCAL_BACKEND': JSON.stringify(
        process.env.VITE_USE_LOCAL_BACKEND || 'false'
      ),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        'wildcat-radio-f05d362144e6.autoidleapp.com'
      ),
      'import.meta.env.VITE_WS_BASE_URL': JSON.stringify(
        'wildcat-radio-f05d362144e6.autoidleapp.com'
      ),
      'import.meta.env.VITE_ICECAST_URL': JSON.stringify(
        'https://icecast.software/live.ogg'
      )
    }
  };
})
