import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend the dev server proxies to. Override with BACKEND_URL if the API
// runs somewhere other than the local Docker container.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxying keeps the API on the same origin as the page. That means:
    //   - no CORS or hardcoded LAN IP during local dev
    //   - no mixed-content blocking when the site is served over HTTPS
    //     through a Cloudflare tunnel (only the frontend needs tunnelling)
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
      '/socket.io': {
        target: BACKEND,
        changeOrigin: true,
        ws: true,
      },
    },
    // Cloudflare quick tunnels use a random *.trycloudflare.com hostname,
    // which Vite would otherwise reject as an unknown host.
    allowedHosts: ['.trycloudflare.com'],
  },
})
