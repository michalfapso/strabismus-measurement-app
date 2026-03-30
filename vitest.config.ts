import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['src/__tests__/setup.ts'],
    environment: 'jsdom',
    globals: true,
  },
});
