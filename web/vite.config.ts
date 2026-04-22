import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../'), '')

  return {
    plugins: [react()],
    envDir: '../',
    server: {
      port: parseInt(env.FRONTEND_PORT || '8080'), 
      allowedHosts: [
        'all'
      ],
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
        '/auth': {
          target: env.BACKEND_URL || 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})