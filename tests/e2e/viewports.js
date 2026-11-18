import { devices } from '@playwright/test';

/**
 * The AC Conventions' viewports, as `test.use()` options (D-11).
 *
 * `phone` is Playwright's `iPhone 13` descriptor without `defaultBrowserType`.
 * That key names WebKit, and the suite runs on Chromium only (D-11, RK-5).
 * Playwright also refuses `defaultBrowserType` inside a describe group,
 * because it forces a new worker.
 */
function withoutBrowserType(descriptor) {
  const options = { ...descriptor };
  delete options.defaultBrowserType;
  return options;
}

export const desktop = Object.freeze({ viewport: { width: 1440, height: 900 } });
export const tablet = Object.freeze({ viewport: { width: 1000, height: 800 } });
export const small = Object.freeze({ viewport: { width: 375, height: 812 } });
export const phone = Object.freeze(withoutBrowserType(devices['iPhone 13']));

export const viewports = Object.freeze({ desktop, tablet, small, phone });
