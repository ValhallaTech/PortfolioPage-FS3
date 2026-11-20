/**
 * The contact form works without JavaScript (spec bootstrap-6-upgrade, WI-7: AC-23, AC-24).
 *
 * Without JavaScript the contact button is hidden, and `.contact-nojs-link` opens the
 * dialog as the `#contactModal:target` panel (§3.3 "No-JS path"). The form posts to
 * Web3Forms, which redirects to the form's `redirect` value.
 *
 * Every submission is mocked, and the `fixtures.js` guard stays on, so nothing reaches
 * Web3Forms. The mock parses the urlencoded POST and answers 303 with `Location` set to
 * the `redirect` value's pathname on the test's own origin: Web3Forms only redirects to
 * an absolute https URL on the site's own domain (V-5), so this is the local model of it.
 * The thank-you page then comes from `dist`, as on Netlify.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WEB3FORMS_URL, test, expect } from './fixtures.js';
import { desktop } from './viewports.js';
import { contactDialog, fillContactForm, openContactModal } from './helpers/contact-modal.js';

const THANKS_PAGE = path.resolve(__dirname, '..', '..', 'dist', 'thanks.html');

/** The origin the form's `redirect` value must have (AC-24, V-5). */
const PRODUCTION_ORIGIN = 'https://fs3portfolio.netlify.app';

/** The name the contact control and the dialog share (AC Conventions). */
const CONTACT_NAME = 'Send Me a Message';

/** The four field labels (AC Conventions). */
const FIELD_LABELS = Object.freeze(['Your Name', 'Your Email', 'Subject', 'Message']);

/** The most Tab presses from `body` to the contact control. */
const MAX_TABS = 120;

/**
 * The control in `#contact` named "Send Me a Message", a button or a link (AC-23).
 *
 * @param {import('@playwright/test').Page} page
 */
function contactControl(page) {
  return page
    .locator('#contact')
    .getByRole('button', { name: CONTACT_NAME })
    .or(page.locator('#contact').getByRole('link', { name: CONTACT_NAME }));
}

/**
 * Presses Tab from `body` until `locator` has focus, and returns how many presses it took,
 * or null when it never did.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 */
async function tabTo(page, locator) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let press = 1; press <= MAX_TABS; press += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) return press;
  }
  return null;
}

/**
 * Loads `/` and opens the form from the contact control with Tab and Enter (AC-23's When).
 *
 * @param {import('@playwright/test').Page} page
 */
async function openFormByKeyboard(page) {
  await page.goto('/');
  const control = contactControl(page);
  await expect(control, 'one visible contact control').toHaveCount(1);
  expect(await tabTo(page, control), 'Tab reaches the contact control').not.toBeNull();
  await page.keyboard.press('Enter');
}

test.use(desktop);

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('AC-23: Tab and Enter on the contact link show the four fields, ready to type in', async ({
    page,
  }) => {
    await openFormByKeyboard(page);

    for (const label of FIELD_LABELS) {
      const field = page.getByLabel(label, { exact: true });
      await expect(field, `${label} is shown`).toBeVisible();
      await expect(field, `${label} can be typed into`).toBeEditable();
    }
  });

  test('AC-24: a submission ends on the site thank-you page from dist, not on JSON', async ({
    page,
    baseURL,
    web3formsGuard,
  }) => {
    await openFormByKeyboard(page);
    await fillContactForm(page);

    const redirectValue = await page
      .locator('#contact-form input[name="redirect"]')
      .getAttribute('value');
    expect(new URL(redirectValue).origin, 'the redirect value is on the production origin').toBe(
      PRODUCTION_ORIGIN
    );
    const thanksUrl = new URL(new URL(redirectValue).pathname, baseURL).href;

    const posts = [];
    await page.route(WEB3FORMS_URL, async (route) => {
      const request = route.request();
      posts.push({
        method: request.method(),
        contentType: (await request.allHeaders())['content-type'] ?? '',
        fields: Object.fromEntries(new URLSearchParams(request.postData() ?? '')),
      });
      await route.fulfill({ status: 303, headers: { Location: thanksUrl } });
    });
    const thanksResponse = page.waitForResponse(
      (response) => response.url() === thanksUrl && response.request().isNavigationRequest()
    );

    await page.getByRole('button', { name: 'Send Message', exact: true }).click();
    await page.waitForURL(thanksUrl);

    expect(posts, 'the form posted once, urlencoded, with its redirect value').toEqual([
      expect.objectContaining({
        method: 'POST',
        contentType: expect.stringMatching(/^application\/x-www-form-urlencoded/),
        fields: expect.objectContaining({ redirect: redirectValue }),
      }),
    ]);

    expect(page.url(), 'the final document URL').toBe(thanksUrl);
    const response = await thanksResponse;
    expect(response.headers()['content-type'], 'the thank-you page content type').toMatch(
      /^text\/html/
    );
    expect(await response.text(), 'the thank-you page is the one in dist').toBe(
      await readFile(THANKS_PAGE, 'utf8')
    );

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/\S/);
    const linkTargets = await page
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.href));
    expect(linkTargets, 'a link back to the site root').toContain(new URL('/', baseURL).href);
    expect(
      await page.evaluate(() => document.body.innerText.trim().startsWith('{')),
      'the page is not a JSON body'
    ).toBe(false);
    expect(web3formsGuard, 'unmocked Web3Forms requests').toEqual([]);
  });

  test('No-JS close: the close link hides the form and returns to the contact section', async ({
    page,
  }) => {
    await openFormByKeyboard(page);
    const nameField = page.getByLabel('Your Name', { exact: true });
    await expect(nameField).toBeVisible();

    const close = page.locator('#contactModal').getByRole('link', { name: 'Close' });
    await expect(close, 'one visible close link').toBeVisible();
    await close.click();

    await expect(page).toHaveURL(/#contact$/);
    await expect(nameField, 'the form is hidden again').toBeHidden();
    await expect(contactControl(page), 'the contact link is back in view').toBeInViewport();
  });
});

test('With JavaScript: the no-JS link and close link stay hidden, and the button opens the dialog', async ({
  page,
}) => {
  await page.goto('/');
  const contact = page.locator('#contact');
  await expect(contact.locator('.contact-nojs-link'), 'the no-JS link').toBeHidden();
  await expect(contact.getByRole('link', { name: CONTACT_NAME })).toHaveCount(0);
  await expect(contact.getByRole('button', { name: CONTACT_NAME })).toBeVisible();

  await openContactModal(page);
  const dialog = contactDialog(page);
  await expect(dialog.locator('.contact-nojs-close'), 'the no-JS close link').toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Close' })).toHaveCount(0);
});
