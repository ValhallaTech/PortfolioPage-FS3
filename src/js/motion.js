/**
 * Every GSAP call on the page (AD-1): the hero intro (AD-5) and the scroll reveals (AD-2 to
 * AD-4), both owned by one gsap.matchMedia() that follows the reduced-motion preference
 * (AD-8). Only GSAP core is used, so no plugin is registered.
 *
 * GSAP writes styles through the CSSOM, and so does this module, which keeps the
 * report-only `style-src 'self'` CSP quiet (RK-3). Muuri owns the portfolio cards and
 * Swiper owns its slides, so neither is ever a target here (C-4).
 */
import { gsap } from 'gsap';

import { revealDelays, revealOffset } from './utils.js';

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
 * Fades the hero in once, without moving it (AD-5). When the CSS fallback has already
 * started, because the script arrived late, the fallback finishes and the script only
 * marks the hero shown when it ends.
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
    gsap.to(hero, {
      opacity: 1,
      delay: HERO_DELAY,
      duration: ENTRANCE_DURATION,
      ease: HERO_EASE,
      onComplete: () => {
        showHero(hero);
        hero.style.removeProperty('opacity');
      },
    });
    return undefined;
  } catch (error) {
    showHero(hero);
    hero.style.removeProperty('opacity');
    throw error;
  }
}

/**
 * Runs the hero intro under motion allowed, and shows the hero at once under reduced
 * motion. A live switch to reduced motion reverts a running intro and shows the hero; the
 * intro never runs twice.
 * @param {HTMLElement|null} hero - The hero container
 */
export function introHero(hero) {
  if (!hero) return;
  motionMedia().add(MOTION_CONDITIONS, (context) => {
    if (context.conditions.reduce) {
      showHero(hero);
      hero.style.removeProperty('opacity');
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
