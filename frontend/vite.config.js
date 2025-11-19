import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, '.', '');
  // Force local backend when in development mode
  const useLocalBackend = mode === 'development' || env.VITE_USE_LOCAL_BACKEND === 'true';
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
    build: {
      // Bundle size optimization
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunk - core libraries
            vendor: ['react', 'react-dom', 'react-router-dom'],

            // UI library chunk - all UI components
            ui: [
              '@headlessui/react',
              '@heroicons/react',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot'
            ],

            // Charts and data visualization
            charts: ['chart.js', 'react-chartjs-2'],

            // Utilities and helpers
            utils: [
              'axios',
              'date-fns',
              'date-fns-tz',
              'clsx',
              'class-variance-authority',
              'tailwind-merge',
              'lucide-react'
            ],

            // WebSocket and streaming
            streaming: [
              '@stomp/stompjs',
              'sockjs-client',
              'framer-motion'
            ],

            // Admin and analytics pages (loaded on demand)
            admin: [
              './src/pages/AdminDashboard.jsx',
              './src/pages/AnalyticsDashboard.jsx',
              './src/pages/DJAnalyticsDashboard.jsx',
              './src/pages/ModeratorDashboard.jsx'
            ]
          }
        }
      },

      // Bundle size limits and warnings
      chunkSizeWarningLimit: 600, // Warn if chunks exceed 600kb

      // Enable source maps for production debugging
      sourcemap: mode === 'development',

      // Minification settings
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production', // Remove console.logs in production
          drop_debugger: true
        }
      }
    },

    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'chart.js',
        'react-chartjs-2',
        '@stomp/stompjs'
      ],
      exclude: ['@vite/client', '@vite/env']
    },
    server: {
      host: '0.0.0.0', // Listen on all interfaces for mobile access
      port: 5173,
      proxy: {
        '/api': {
          target: useLocalBackend 
            ? 'http://localhost:8080'
            : `https://${apiBaseUrl}`,
          changeOrigin: true,
          secure: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Log proxy requests in dev mode
              if (useLocalBackend) {
                console.log(`[Vite Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
              }
              // Ensure all headers are forwarded, especially Authorization
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization);
              }
              // Forward cookies
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
              }
            });
            proxy.on('error', (err, _req, _res) => {
              console.error('[Vite Proxy Error]', err);
            });
          }
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
        env.VITE_ICECAST_URL || 'icecast.software/live.ogg'
      )
    }
  };
})
