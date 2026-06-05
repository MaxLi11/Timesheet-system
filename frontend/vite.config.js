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
    // ExcelJS is lazy-loaded only from export actions, and ECharts is isolated here as
    // a chart vendor chunk. Keep the limit just above those known bundles so new
    // accidental chunks still warn without making the current split noisy.
    chunkSizeWarningLimit: 1150,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core is tiny, but good to isolate.
          'vendor-react': ['react', 'react-dom'],
          // Charting library.
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          // Icon library.
          'vendor-icons': ['lucide-react'],
          // Date utility.
          'vendor-dayjs': ['dayjs'],
        },
      },
    },
  },
})
