import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        onboarding: 'onboarding.html',
        dashboard: 'dashboard.html',
        blackbox: 'blackbox.html'
      }
    }
  }
});
