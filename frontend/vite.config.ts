import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Dev proxy — browser talks to Vite :3000; no CORS needed on services. */
function svc(port: number) {
  return {
    target: `http://localhost:${port}`,
    changeOrigin: true,
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/svc/conversation': {
        ...svc(8081),
        rewrite: (p) => p.replace(/^\/svc\/conversation/, ''),
      },
      '/svc/customer': {
        ...svc(8082),
        rewrite: (p) => p.replace(/^\/svc\/customer/, ''),
      },
      '/svc/ai': {
        ...svc(8083),
        rewrite: (p) => p.replace(/^\/svc\/ai/, ''),
      },
      '/svc/routing': {
        ...svc(8084),
        rewrite: (p) => p.replace(/^\/svc\/routing/, ''),
      },
      '/svc/outbound': {
        ...svc(8085),
        rewrite: (p) => p.replace(/^\/svc\/outbound/, ''),
      },
      '/svc/analytics': {
        ...svc(8086),
        rewrite: (p) => p.replace(/^\/svc\/analytics/, ''),
      },
      '/svc/incidents': {
        ...svc(8087),
        rewrite: (p) => p.replace(/^\/svc\/incidents/, ''),
      },
    },
  },
});
