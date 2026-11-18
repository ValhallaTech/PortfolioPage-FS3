import { defineConfig } from '@playwright/test';

/**
 * Playwright setup (D-11). Chromium only, one `chromium` project, no retries (RK-4).
 *
 * With BASE_URL unset, the suite runs against the local target: `dist/` served by
 * scripts/serve-dist.mjs. BASE_URL=https://fs3portfolio.netlify.app runs the live target.
 * Each test sets its own viewport from tests/e2e/viewports.js.
 */
const LOCAL_URL = 'http://127.0.0.1:4173';
const liveBaseUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: liveBaseUrl ?? LOCAL_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: liveBaseUrl
    ? undefined
    : {
        command: 'node scripts/serve-dist.mjs',
        url: LOCAL_URL,
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
