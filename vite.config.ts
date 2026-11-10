import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return;
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
            if (/\/node_modules\/(recharts|d3-[^/]+)\//.test(id)) return 'vendor-charts';
            if (/\/node_modules\/(leaflet|react-leaflet)\//.test(id)) return 'vendor-maps';
            if (/\/node_modules\/lucide-react\//.test(id)) return 'vendor-icons';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
