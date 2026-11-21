/**
 * The hero typing recorder, shared by sprint 1's AC-110 to AC-112, AC-24 and AC-25 in
 * motion.spec.js and AC-23 in hero.spec.js.
 */

/**
 * Runs in the page before any page script. From `DOMContentLoaded`, records each distinct
 * `textContent` of the hero typing element with its time, and records the `load` time, in
 * `window.__typingRecording`.
 *
 * @param {string} selector The typing element.
 */
export function installTypingRecorder(selector) {
  const recording = { domContentLoadedAt: null, loadAt: null, changes: [] };
  window.__typingRecording = recording;
  window.addEventListener('load', () => {
    recording.loadAt = performance.now();
  });
  document.addEventListener('DOMContentLoaded', () => {
    recording.domContentLoadedAt = performance.now();
    const element = document.querySelector(selector);
    if (!element) return;
    let last = element.textContent;
    recording.changes.push({ at: recording.domContentLoadedAt, text: last });
    new MutationObserver(() => {
      const text = element.textContent;
      if (text === last) return;
      last = text;
      recording.changes.push({ at: performance.now(), text });
    }).observe(element, { childList: true, characterData: true, subtree: true });
  });
}
