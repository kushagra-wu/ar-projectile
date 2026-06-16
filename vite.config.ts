import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Served at https://<user>.github.io/ar-projectile/ on Pages; root '/' in dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ar-projectile/' : '/',
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5173,
  },
}));
