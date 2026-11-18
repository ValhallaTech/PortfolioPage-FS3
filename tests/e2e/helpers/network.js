import { expect } from '../fixtures.js';

/**
 * Tracks every request of a page, including those of its frames (the map iframe),
 * so a test can wait for a stretch of network idle longer than Playwright's own
 * `networkidle` (500 ms).
 *
 * Start it before the navigation whose requests it must count.
 *
 * @param {import('@playwright/test').Page} page
 */
export function trackNetwork(page) {
  const inFlight = new Set();
  let lastActivity = Date.now();

  const started = (request) => {
    inFlight.add(request);
    lastActivity = Date.now();
  };
  const ended = (request) => {
    inFlight.delete(request);
    lastActivity = Date.now();
  };
  page.on('request', started);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);

  return {
    /**
     * Waits until no request has been in flight for `idleMs`.
     *
     * @param {number} idleMs
     * @param {{ timeout?: number }} [options]
     */
    async waitForIdle(idleMs, { timeout = 20_000 } = {}) {
      // Polls what still blocks idle, so a timeout names the requests in flight.
      const blockers = () => {
        if (inFlight.size > 0) return [...inFlight].map((request) => request.url());
        const quietMs = Date.now() - lastActivity;
        return quietMs >= idleMs ? [] : [`quiet for ${quietMs} ms of ${idleMs} ms`];
      };
      await expect
        .poll(blockers, { message: `${idleMs} ms of network idle`, timeout, intervals: [100] })
        .toEqual([]);
    },

    stop() {
      page.off('request', started);
      page.off('requestfinished', ended);
      page.off('requestfailed', ended);
    },
  };
}
