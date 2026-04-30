import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  use: {
    baseURL: process.env.TASKY_BASE_URL ?? 'https://localhost:8443',
    ignoreHTTPSErrors: true,
  },
});
