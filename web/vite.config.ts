import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api/* to the API process during `npm run dev` so the frontend
      // can use relative URLs (architecture.md#3.4 same-origin contract).
      // Production same-origin routing is handled by Caddy in Story 1.5.
      '/api': 'http://localhost:3000',
    },
  },
});
