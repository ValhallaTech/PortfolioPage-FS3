import { defineConfig } from '@playwright/test';

/**
 * Playwright setup (D-11). Chromium only, no retries (RK-4).
 *
 * Two Chromium projects. `chromium` runs every spec except the frame-timing ones.
 * `chromium-frame-timing` runs the specs whose frame traces hold tight millisecond bounds
 * (spec gsap-animations §2.3, RK-2), one test at a time. It is listed second, so its tests
 * are queued behind every `chromium` test: they start as the main run drains, and never
 * share the machine with more than the main run's last few tests. Under ~15 parallel
 * browsers, main-thread stalls delayed the frame a target first appears in, so these
 * tests measured the machine's load rather than the page.
 *
 * The projects are not linked with `dependencies` or `teardown`. Playwright runs a
 * dependency or teardown project in full, without the command line's `--grep-invert @slow`,
 * file filters or `--repeat-each`, and it skips every dependent project when one
 * dependency test fails, which would skip these tests in AC-90's run.
 *
 * With BASE_URL unset, the suite runs against the local target: `dist/` served by
 * scripts/serve-dist.mjs. BASE_URL=https://fs3portfolio.netlify.app runs the live target.
 * Each test sets its own viewport from tests/e2e/viewports.js.
 */
const LOCAL_URL = 'http://127.0.0.1:4173';
const WEB3FORMS_HOST = 'api.web3forms.com';
const liveBaseUrl = process.env.BASE_URL;

/** The specs whose frame traces hold tight millisecond bounds (helpers/frame-trace.js). */
const FRAME_TIMING_SPECS = ['**/hero.spec.js', '**/reduced-motion.spec.js', '**/reveals.spec.js'];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: liveBaseUrl ?? LOCAL_URL,
    trace: 'retain-on-failure',
    // Fails DNS for Web3Forms in every context of the configured browser, including ones
    // a spec creates with browser.newContext() or browser.newPage() (C-18, AC-90).
    // page.route and context.route fulfill before DNS, so mocks and the fixtures.js guard
    // still see the request.
    launchOptions: { args: [`--host-resolver-rules=MAP ${WEB3FORMS_HOST} ~NOTFOUND`] },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: FRAME_TIMING_SPECS },
    {
      name: 'chromium-frame-timing',
      use: { browserName: 'chromium' },
      testMatch: FRAME_TIMING_SPECS,
      workers: 1,
    },
  ],
  webServer: liveBaseUrl
    ? undefined
    : {
        command: 'node scripts/serve-dist.mjs',
        url: LOCAL_URL,
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
