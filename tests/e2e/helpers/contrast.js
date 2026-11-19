/**
 * Color contrast helpers for the accessibility ACs (spec stabilize-and-cleanup, WI-51).
 *
 * - **Contrast** is the WCAG 2.x relative-luminance ratio.
 * - **Effective background** is the first ancestor-or-self with a non-transparent
 *   `background-color`, alpha-composited onto white (AC Conventions).
 */

const WHITE = Object.freeze({ r: 255, g: 255, b: 255, a: 1 });

/**
 * Parses a computed CSS color: `rgb()`, `rgba()` or `color(srgb …)`, the forms Chromium
 * returns from `getComputedStyle`.
 *
 * @param {string} value
 * @returns {{ r: number, g: number, b: number, a: number }} Channels 0–255, alpha 0–1.
 */
export function parseCssColor(value) {
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(
    value
  );
  if (rgb) {
    const [, r, g, b, a] = rgb;
    return { r: Number(r), g: Number(g), b: Number(b), a: parseAlpha(a) };
  }
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
    value
  );
  if (srgb) {
    const [, r, g, b, a] = srgb;
    return { r: Number(r) * 255, g: Number(g) * 255, b: Number(b) * 255, a: parseAlpha(a) };
  }
  throw new Error(`Unsupported computed color: ${value}`);
}

function parseAlpha(alpha) {
  if (alpha === undefined) return 1;
  return alpha.endsWith('%') ? Number.parseFloat(alpha) / 100 : Number(alpha);
}

/**
 * Composites `top`, with its alpha, over an opaque `bottom`.
 *
 * @param {{ r: number, g: number, b: number, a: number }} top
 * @param {{ r: number, g: number, b: number }} bottom
 */
export function compositeOver(top, bottom) {
  const mix = (channel) => top.a * top[channel] + (1 - top.a) * bottom[channel];
  return { r: mix('r'), g: mix('g'), b: mix('b'), a: 1 };
}

/**
 * WCAG 2.x relative luminance of an opaque sRGB color.
 *
 * @param {{ r: number, g: number, b: number }} color
 */
export function relativeLuminance({ r, g, b }) {
  const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * WCAG 2.x contrast ratio of two opaque colors.
 *
 * @param {{ r: number, g: number, b: number }} first
 * @param {{ r: number, g: number, b: number }} second
 */
export function contrastRatio(first, second) {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Formats an opaque color for failure messages. */
export function formatColor({ r, g, b }) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Runs in the page: the foreground value and the `background-color` and `opacity` of each
 * element from `element` (or its parent) up to `html`.
 *
 * @param {Element} element
 * @param {{ foreground: 'color' | 'background-color', backgroundFrom: 'self' | 'parent' }} options
 */
function readColorChain(element, { foreground, backgroundFrom }) {
  const chain = [];
  const start = backgroundFrom === 'parent' ? element.parentElement : element;
  if (backgroundFrom === 'parent') {
    chain.push({ background: 'rgba(0, 0, 0, 0)', opacity: getComputedStyle(element).opacity });
  }
  for (let node = start; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    chain.push({ background: style.backgroundColor, opacity: style.opacity });
  }
  return { foreground: getComputedStyle(element).getPropertyValue(foreground), chain };
}

/**
 * Measures the contrast of an element against its effective background.
 *
 * The effective background is the first non-transparent `background-color` from the start
 * element up (the element itself, or its parent with `backgroundFrom: 'parent'`, for a UI
 * component whose own fill is the foreground), composited onto white. The foreground is
 * composited over it with its own alpha times the `opacity` of every element below the
 * one that paints the background, since those fade the foreground but not the background.
 *
 * @param {import('@playwright/test').Locator} locator
 * @param {{ foreground?: 'color' | 'background-color', backgroundFrom?: 'self' | 'parent' }} [options]
 * @returns {Promise<{ ratio: number, foreground: string, background: string }>}
 */
export async function measureContrast(
  locator,
  { foreground = 'color', backgroundFrom = 'self' } = {}
) {
  const { foreground: rawForeground, chain } = await locator.evaluate(readColorChain, {
    foreground,
    backgroundFrom,
  });
  let fade = 1;
  let background = WHITE;
  for (const { background: value, opacity } of chain) {
    const color = parseCssColor(value);
    if (color.a > 0) {
      background = compositeOver(color, WHITE);
      break;
    }
    fade *= Number(opacity);
  }
  const top = parseCssColor(rawForeground);
  const shown = compositeOver({ ...top, a: top.a * fade }, background);
  return {
    ratio: contrastRatio(shown, background),
    foreground: formatColor(shown),
    background: formatColor(background),
  };
}

/**
 * Finds the lightest pixel, by relative luminance, inside each box of a PNG screenshot.
 * The PNG is decoded and read on a canvas in the page, so no image library is needed.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Buffer} png A screenshot taken with `scale: 'css'`, so its pixels are CSS pixels.
 * @param {Array<{ x: number, y: number, width: number, height: number }>} boxes In the
 *   screenshot's own coordinates.
 * @returns {Promise<Array<{ r: number, g: number, b: number }>>} One pixel per box.
 */
export async function lightestPixels(page, png, boxes) {
  return page.evaluate(
    async ({ dataUrl, regions }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      // The same WCAG 2.x formula as relativeLuminance() above, which cannot be passed in.
      const linear = (channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return regions.map((region) => {
        const left = Math.max(0, Math.floor(region.x));
        const top = Math.max(0, Math.floor(region.y));
        const right = Math.max(
          left + 1,
          Math.min(canvas.width, Math.ceil(region.x + region.width))
        );
        const bottom = Math.max(
          top + 1,
          Math.min(canvas.height, Math.ceil(region.y + region.height))
        );
        const { data } = context.getImageData(left, top, right - left, bottom - top);
        let lightest = { r: 0, g: 0, b: 0 };
        let maxLuminance = -1;
        for (let i = 0; i < data.length; i += 4) {
          const luminance =
            0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2]);
          if (luminance > maxLuminance) {
            maxLuminance = luminance;
            lightest = { r: data[i], g: data[i + 1], b: data[i + 2] };
          }
        }
        return lightest;
      });
    },
    { dataUrl: `data:image/png;base64,${png.toString('base64')}`, regions: boxes }
  );
}
