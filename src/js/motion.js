/**
 * Every GSAP call on the page (AD-1): the hero intro with its typing (AD-5, AD-6) and the
 * scroll reveals (AD-2 to AD-4), both owned by one gsap.matchMedia() that follows the
 * reduced-motion preference (AD-8). Only GSAP core is used, so no plugin is registered.
 *
 * GSAP writes styles through the CSSOM, and so does this module, which keeps the
 * report-only `style-src 'self'` CSP quiet (RK-3). Muuri owns the portfolio cards and
 * Swiper owns its slides, so neither is ever a target here (C-4).
 */
import { gsap } from 'gsap';

import { revealDelays, revealOffset, typingSchedule } from './utils.js';

/** The matchMedia conditions: exactly one of them matches at any time (AD-8). */
const MOTION_CONDITIONS = Object.freeze({
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
});

/** The duration in seconds of a reveal and of the hero fade, as in 5.0.0. */
const ENTRANCE_DURATION = 1;

/** The easing of the hero fade (AD-5). */
const HERO_EASE = 'power1.inOut';

/**
 * The easing of a reveal. sine.inOut leaves 0.01 opacity about 7 ms sooner than
 * power1.inOut, which keeps a row's first reveal inside AC-28's 150 ms under load (RK-1).
 */
const REVEAL_EASE = 'sine.inOut';

/** The wait in seconds before the hero starts to fade in, as in 5.0.0. */
const HERO_DELAY = 0.2;

/** The inline properties a reveal writes, cleared once it ends. */
const REVEAL_PROPS = 'opacity,transform';

/** The hero has appeared, and the style.css gate no longer hides it. */
const HERO_SHOWN = 'is-shown';

/** The script runs the hero fade, so the CSS fallback reveal is switched off. */
const HERO_SCRIPT_OWNED = 'is-script-owned';

/** The hero line, its typing element and its typing cursor (AD-7). */
const HERO_LINE = '.hero-line';
const TYPED_ELEMENT = '.typed';
const TYPED_CURSOR = '.typed-cursor';

/** The hero line types: its typing shows and its sentence is only visually hidden. */
const HERO_TYPING = 'is-typing';

/** The cursor classes of style.css: blinking while idle, and stopped at the end (AD-6). */
const CURSOR_BLINK = 'typed-cursor--blink';
const CURSOR_DONE = 'typed-cursor--done';

/** Targets that have been revealed, or shown at once. None is ever hidden again (AD-8). */
const revealed = new WeakSet();

/** @type {ReturnType<typeof gsap.matchMedia>|null} */
let media = null;

/**
 * The one gsap.matchMedia() that owns the hero and the reveals, made on first use.
 * @returns {ReturnType<typeof gsap.matchMedia>}
 */
function motionMedia() {
  media ??= gsap.matchMedia();
  return media;
}

/**
 * Removes the inline styles an entrance writes, through the CSSOM.
 * @param {HTMLElement} el
 */
function clearEntranceStyles(el) {
  el.style.removeProperty('opacity');
  el.style.removeProperty('transform');
}

/**
 * Marks the hero as shown, so the style.css gate stops hiding it.
 * @param {HTMLElement} hero - The hero container
 */
function showHero(hero) {
  hero.classList.add(HERO_SHOWN);
}

/**
 * @typedef {object} HeroTyping
 * @property {HTMLElement} line - The hero line, which switches between its two modes
 * @property {HTMLElement} typed - The typing element, whose text is typed
 * @property {HTMLElement|null} cursor - The typing cursor
 * @property {string[]} phrases - The phrases from `data-typed-items`, in order
 */

/**
 * The parts of the hero line the typing needs (AD-7), or null when any is missing.
 * @param {HTMLElement} hero - The hero container
 * @returns {HeroTyping|null}
 */
function heroTyping(hero) {
  const line = hero.querySelector(HERO_LINE);
  const typed = line?.querySelector(TYPED_ELEMENT);
  if (!typed) return null;
  const phrases = (typed.dataset.typedItems ?? '')
    .split(',')
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  if (phrases.length === 0) return null;
  return { line, typed, cursor: line.querySelector(TYPED_CURSOR), phrases };
}

/**
 * Sets the typing cursor's state through its classes (AD-6).
 * @param {HTMLElement|null} cursor - The typing cursor
 * @param {'blink'|'steady'|'done'} state - Blinking, steady, or stopped for good
 */
function setCursor(cursor, state) {
  if (!cursor) return;
  cursor.classList.toggle(CURSOR_BLINK, state === 'blink');
  cursor.classList.toggle(CURSOR_DONE, state === 'done');
}

/**
 * Switches the hero line to typing mode: the typing shows, empty and with a blinking
 * cursor, and the sentence is only visually hidden, so screen readers keep it (AD-7).
 * @param {HeroTyping} typing
 */
function enterTypingMode({ line, typed, cursor }) {
  typed.textContent = '';
  setCursor(cursor, 'blink');
  line.classList.add(HERO_TYPING);
}

/**
 * Switches the hero line back to its full sentence and stops the cursor (AD-8).
 * @param {HTMLElement} hero - The hero container
 */
function leaveTypingMode(hero) {
  const line = hero.querySelector(HERO_LINE);
  if (!line) return;
  line.classList.remove(HERO_TYPING);
  setCursor(line.querySelector(TYPED_CURSOR), 'done');
}

/**
 * Appends the typing to the end of the hero intro, so the first character is typed only
 * once the fade has ended (AD-6, R-18). Each step writes the typing element's text or
 * the cursor's state in a call step.
 * @param {gsap.core.Timeline} intro - The hero intro
 * @param {HeroTyping} typing
 */
function appendTyping(intro, { typed, cursor, phrases }) {
  const start = intro.duration();
  typingSchedule(phrases).forEach(({ at, text, cursor: state }) => {
    intro.call(
      () => {
        if (text !== undefined) typed.textContent = text;
        if (state) setCursor(cursor, state);
      },
      undefined,
      start + at / 1000
    );
  });
}

/**
 * Fades the hero in once, without moving it, then types the hero line (AD-5, AD-6). When
 * the CSS fallback has already started, because the script arrived late, the fallback
 * finishes, the script only marks the hero shown when it ends, and nothing is typed.
 * @param {HTMLElement} hero - The hero container
 * @returns {(() => void)|undefined} Cleanup for the matchMedia branch
 */
function playHeroIntro(hero) {
  if (hero.classList.contains(HERO_SHOWN)) return undefined;
  try {
    const opacity = Number.parseFloat(getComputedStyle(hero).opacity);
    if (opacity >= 1) {
      // Already fully visible: the fallback has ended, or the gate does not apply.
      showHero(hero);
      return undefined;
    }
    if (opacity > 0) {
      const onFallbackEnd = (event) => {
        if (event.target !== hero) return;
        hero.removeEventListener('animationend', onFallbackEnd);
        showHero(hero);
      };
      hero.addEventListener('animationend', onFallbackEnd);
      return () => hero.removeEventListener('animationend', onFallbackEnd);
    }
    gsap.set(hero, { opacity: 0 });
    hero.classList.add(HERO_SCRIPT_OWNED);
    // Typing mode starts while the hero is still invisible, so the switch never shows.
    const typing = heroTyping(hero);
    if (typing) enterTypingMode(typing);
    const intro = gsap.timeline();
    intro.to(hero, {
      opacity: 1,
      delay: HERO_DELAY,
      duration: ENTRANCE_DURATION,
      ease: HERO_EASE,
      onComplete: () => {
        showHero(hero);
        hero.style.removeProperty('opacity');
      },
    });
    if (typing) appendTyping(intro, typing);
    return () => leaveTypingMode(hero);
  } catch (error) {
    showHero(hero);
    hero.style.removeProperty('opacity');
    leaveTypingMode(hero);
    throw error;
  }
}

/**
 * Runs the hero intro under motion allowed, and shows the hero at once, with its full
 * sentence, under reduced motion. A live switch to reduced motion reverts a running intro
 * and shows the hero with its sentence; the intro and the typing never run twice.
 * @param {HTMLElement|null} hero - The hero container
 */
export function introHero(hero) {
  if (!hero) return;
  motionMedia().add(MOTION_CONDITIONS, (context) => {
    if (context.conditions.reduce) {
      showHero(hero);
      hero.style.removeProperty('opacity');
      leaveTypingMode(hero);
      return undefined;
    }
    return playHeroIntro(hero);
  });
}

/**
 * Starts the reveals of one batch: each target fades in from its offset, after its delay,
 * then its inline styles are cleared (AD-2, AD-3).
 * @param {HTMLElement[]} batch - The targets that entered the view together
 * @param {Map<HTMLElement, gsap.core.Tween>} running - The reveals still in progress
 */
function playReveals(batch, running) {
  const delays = revealDelays(batch);
  batch.forEach((target, index) => {
    const { x, y } = revealOffset(target.dataset.reveal);
    const tween = gsap.fromTo(
      target,
      { opacity: 0, x, y },
      {
        opacity: 1,
        x: 0,
        y: 0,
        delay: delays[index] / 1000,
        duration: ENTRANCE_DURATION,
        ease: REVEAL_EASE,
        clearProps: REVEAL_PROPS,
        onComplete: () => running.delete(target),
      }
    );
    running.set(target, tween);
  });
}

/**
 * Whether focus reached an element in a way the browser shows a focus ring for: from the
 * keyboard, or from a script after keyboard use. A pointer press does not count, except
 * on text fields. Where `:focus-visible` is not supported, every focus counts.
 * @param {Element} el - The element that received focus
 * @returns {boolean}
 */
function isKeyboardFocus(el) {
  try {
    return el.matches(':focus-visible');
  } catch {
    // SyntaxError: the selector is unknown to this browser.
    return true;
  }
}

/**
 * Hides the targets not yet revealed and reveals each once it enters the view. Keyboard
 * focus inside a target finishes its reveal at once (AD-4); pointer focus lets it run.
 * @param {HTMLElement[]} targets - Every reveal target
 * @param {gsap.Context} context - The matchMedia branch's context
 * @returns {(() => void)|undefined} Cleanup for the matchMedia branch
 */
function watchReveals(targets, context) {
  const pending = targets.filter((target) => !revealed.has(target));
  if (pending.length === 0) return undefined;

  /** @type {Map<HTMLElement, gsap.core.Tween>} */
  const running = new Map();
  gsap.set(pending, { opacity: 0 });

  const observer = new IntersectionObserver(
    (entries) => {
      const batch = entries
        .filter((entry) => entry.isIntersecting && !revealed.has(entry.target))
        .map((entry) => entry.target);
      if (batch.length === 0) return;
      batch.forEach((target) => {
        observer.unobserve(target);
        revealed.add(target);
      });
      context.add(() => playReveals(batch, running));
    },
    { threshold: 0 }
  );
  pending.forEach((target) => observer.observe(target));

  const finishReveal = (target) => {
    const tween = running.get(target);
    if (tween) {
      tween.progress(1);
      return;
    }
    if (revealed.has(target)) return;
    observer.unobserve(target);
    revealed.add(target);
    clearEntranceStyles(target);
  };
  const onFocusIn = (event) => {
    // A pointer focuses what it is already pressing on, so that reveal runs on: finishing
    // it would move the element away between press and release, and lose the click.
    if (!isKeyboardFocus(event.target)) return;
    pending.forEach((target) => {
      if (target.contains(event.target)) finishReveal(target);
    });
  };
  document.addEventListener('focusin', onFocusIn);

  return () => {
    observer.disconnect();
    document.removeEventListener('focusin', onFocusIn);
  };
}

/**
 * Reveals each target as it enters the view under motion allowed, and shows every target
 * at once under reduced motion. A live switch to reduced motion reverts the reveals and
 * shows everything; a switch back hides nothing that was shown.
 * @param {Iterable<HTMLElement>} targets - The reveal targets, without the hero
 */
export function revealOnScroll(targets) {
  const list = Array.from(targets ?? []);
  if (list.length === 0) return;
  motionMedia().add(MOTION_CONDITIONS, (context) => {
    if (context.conditions.reduce) {
      list.forEach((target) => {
        revealed.add(target);
        clearEntranceStyles(target);
      });
      return undefined;
    }
    return watchReveals(list, context);
  });
}
