/**
 * The hero's roles and text (spec gsap-animations §2.3 Conventions, AD-7), shared by the
 * hero, no-JS and reduced-motion specs.
 */
import { readVisibleText } from './frame-trace.js';

/** The hero sentence (C-22), whitespace-collapsed as the Conventions compare it. */
export const HERO_SENTENCE = 'I am a Designer, a Developer, a Photographer, a Coding Ninja';

/** The hero section, and the roles AD-7 names. */
export const HERO = '#hero';
export const HERO_CONTAINER = '.hero-container';
export const HERO_LINE = '#hero .hero-line';
export const TYPED_ELEMENT = '.typed';
export const TYPED_CURSOR = '.typed-cursor';

/** The hero's state classes (§3.3): shown, faded by the script, and typing. */
export const HERO_SHOWN = 'is-shown';
export const HERO_SCRIPT_OWNED = 'is-script-owned';
export const HERO_TYPING = 'is-typing';

/**
 * The visible hero line now (Conventions).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export function readVisibleHeroLine(page) {
  return readVisibleText(page.locator(HERO_LINE));
}
