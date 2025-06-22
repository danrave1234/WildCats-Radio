import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, '.', '');
  const useLocalBackend = env.VITE_USE_LOCAL_BACKEND === 'true';
  const apiBaseUrl = env.VITE_API_BASE_URL || 'api.wildcat-radio.live';
  const wsBaseUrl = env.VITE_WS_BASE_URL || 'api.wildcat-radio.live';

  console.log(`Vite config using ${useLocalBackend ? 'LOCAL' : 'DEPLOYED'} backend`);
  console.log(`API Base URL: ${apiBaseUrl}`);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: useLocalBackend 
            ? 'http://localhost:8080'
            : `https://${apiBaseUrl}`,
          changeOrigin: true,
          secure: true
        },
        '/ws-radio': {
          target: useLocalBackend 
            ? 'http://localhost:8080'
            : `https://${wsBaseUrl}`,
          changeOrigin: true,
          secure: true,
          ws: true
        },
        '/ws': {
          target: useLocalBackend 
            ? 'http://localhost:8080'
            : `https://${wsBaseUrl}`,
          changeOrigin: true,
          secure: true,
          ws: true
        }
      }
    },
    define: {
      global: 'window',
      // Environment variables are loaded from .env files and passed to the client
      // These use the loaded environment variables instead of hardcoded values
      'import.meta.env.VITE_USE_LOCAL_BACKEND': JSON.stringify(
        env.VITE_USE_LOCAL_BACKEND || 'false'
      ),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL || 'api.wildcat-radio.live'
      ),
      'import.meta.env.VITE_WS_BASE_URL': JSON.stringify(
        env.VITE_WS_BASE_URL || 'api.wildcat-radio.live'
      ),
      'import.meta.env.VITE_ICECAST_URL': JSON.stringify(
        env.VITE_ICECAST_URL || 'api.wildcat-radio.live:8000/live.ogg'
      )
    }
  };
})
