import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
        '/dofusdb': {
          target: 'https://api.dofusdb.fr',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/dofusdb/, ''),
        },
      },
    },
  };
});
