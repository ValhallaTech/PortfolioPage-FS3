import { WEB3FORMS_URL } from '../fixtures.js';

/** The contact dialog and its opener (AC-89 `Dialog *`, `Submit, *` and `Abort on close` rows). */
export const CONTACT_MODAL = '#contactModal';
export const CONTACT_MODAL_BUTTON = '.contact-modal-btn';

/** The visible fields of the contact form, in tab order, with the test values typed into them. */
export const CONTACT_FIELDS = Object.freeze([
  { selector: '#name', value: 'Smoke Test' },
  { selector: '#email', value: 'smoke-test@example.com' },
  { selector: '#subject', value: 'Smoke test' },
  { selector: '#message', value: 'Sent by the smoke suite to a mocked endpoint.' },
]);

/** The dialog's accessible name, its title (bootstrap-6-upgrade AC Conventions). */
const CONTACT_DIALOG_NAME = 'Send Me a Message';

/**
 * The contact dialog, by role and name (bootstrap-6-upgrade AC Conventions).
 *
 * @param {import('@playwright/test').Page} page
 */
export function contactDialog(page) {
  // includeHidden, so a closed dialog still resolves and "dialog closed" can be asserted.
  return page.getByRole('dialog', { name: CONTACT_DIALOG_NAME, includeHidden: true });
}

/**
 * The contact button: the button in `#contact` named like the dialog (AC Conventions).
 *
 * @param {import('@playwright/test').Page} page
 */
export function contactButton(page) {
  return page.locator('#contact').getByRole('button', { name: CONTACT_DIALOG_NAME });
}

/**
 * The submit button: the button in the dialog named "Send Message" (AC Conventions).
 *
 * @param {import('@playwright/test').Page} page
 */
export function submitButton(page) {
  return contactDialog(page).getByRole('button', { name: 'Send Message', exact: true });
}

/**
 * Listens once for a Bootstrap dialog event on the contact dialog, and returns a
 * function that waits until that event has fired.
 *
 * Arm it before the action that fires the event, so the event cannot slip past.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'shown.bs.dialog' | 'hidden.bs.dialog'} eventName
 * @returns {Promise<() => Promise<void>>} Resolves once the listener is attached.
 */
export async function armModalEvent(page, eventName) {
  const key = await page.evaluate(
    ({ selector, name }) => {
      const fired = (window.__smokeModalEvents ??= {});
      const id = `${name}#${Object.keys(fired).length}`;
      fired[id] = false;
      document.querySelector(selector).addEventListener(
        name,
        () => {
          fired[id] = true;
        },
        { once: true }
      );
      return id;
    },
    { selector: CONTACT_MODAL, name: eventName }
  );
  return async () => {
    await page.waitForFunction((id) => window.__smokeModalEvents[id] === true, key);
  };
}

/**
 * Opens the contact dialog from its button and waits for `shown.bs.dialog`, after
 * which the page has moved focus into the dialog and its Tab wrap is active.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function openContactModal(page) {
  const shown = await armModalEvent(page, 'shown.bs.dialog');
  await page.locator(CONTACT_MODAL_BUTTON).click();
  await shown();
}

/**
 * Fills every required field of the contact form with test values.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function fillContactForm(page) {
  for (const { selector, value } of CONTACT_FIELDS) {
    await page.locator(selector).fill(value);
  }
}

/**
 * Answers every Web3Forms request of this page with `body`, after `delayMs`.
 *
 * The page calls Web3Forms cross-origin, so the mocked response carries the CORS
 * header that lets `fetch` read it. A page route takes precedence over the guard's
 * context route (fixtures.js).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} body The JSON body Web3Forms would return.
 * @param {{ delayMs?: number }} [options]
 * @returns {Promise<{ answered: () => number }>} How many requests the mock has
 *   started to answer, which lets a test prove that a request was aborted first.
 */
export async function mockWeb3Forms(page, body, { delayMs = 0 } = {}) {
  let answered = 0;
  await page.route(WEB3FORMS_URL, async (route) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    answered += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(body),
    });
  });
  return { answered: () => answered };
}
