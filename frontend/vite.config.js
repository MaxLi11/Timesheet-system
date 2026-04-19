import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — tiny, but good to isolate
          'vendor-react': ['react', 'react-dom'],
          // ECharts is the largest dependency (~600KB min+gz)
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          // Icon library
          'vendor-icons': ['lucide-react'],
          // Date utility
          'vendor-dayjs': ['dayjs'],
        },
      },
    },
  },
})

