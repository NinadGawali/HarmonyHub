import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The browser only ever talks to the Vite origin; /api and /socket.io are proxied to the
  // backend so session cookies and the Spotify redirect URI share one origin.
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:3000';

  const proxy = {
    '/api': { target: backendUrl, xfwd: true },
    '/socket.io': { target: backendUrl, ws: true, xfwd: true }
  };

  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true, host: true, proxy },
    preview: { port: 5173, strictPort: true, host: true, proxy }
  };
});
