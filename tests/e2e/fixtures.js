import { test as base, expect } from '@playwright/test';

/** Every request to this host is aborted unless a test mocks it itself (C-18, AC-90). */
export const WEB3FORMS_URL = 'https://api.web3forms.com/**';

/**
 * Every spec imports `test` and `expect` from here, so each test gets both guards.
 *
 * - `web3formsGuard` routes Web3Forms to `abort()` at context level and records each
 *   request it aborts. A test's own `page.route` mock takes precedence, because
 *   Playwright checks page routes before context routes. After the test, the guard
 *   asserts that it recorded nothing.
 * - `pageErrors` collects every uncaught page error in the test's context and
 *   asserts after the test that there were none.
 */
export const test = base.extend({
  web3formsGuard: [
    async ({ context }, use) => {
      const aborted = [];
      await context.route(WEB3FORMS_URL, async (route) => {
        const request = route.request();
        aborted.push(`${request.method()} ${request.url()}`);
        await route.abort();
      });

      await use(aborted);

      expect(aborted, 'Web3Forms requests the test did not mock (aborted by the guard)').toEqual(
        []
      );
    },
    { auto: true },
  ],

  pageErrors: [
    async ({ context }, use) => {
      const errors = [];
      const collect = (page) => page.on('pageerror', (error) => errors.push(error.message));
      context.pages().forEach(collect);
      context.on('page', collect);

      await use(errors);

      expect(errors, 'Uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
