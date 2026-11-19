/**
 * @jest-environment node
 */
/**
 * S1 acceptance tests for chain M (spec stabilize-and-cleanup, sections 2.3,
 * 3.4 WI-47 and 3.7): AC-27, AC-28 and AC-29 on `src/css/style.css`.
 *
 * AC-27 and AC-28 work on the declarations PostCSS parses. A color literal is a
 * hex color, an `rgb()`/`rgba()`/`hsl()`/`hsla()` call with numeric arguments, or
 * a CSS named color other than `transparent`, `currentcolor` and `inherit`. Text
 * inside quoted strings and `url(...)` is ignored, so a font name or a URL is not
 * a hit. AC-29 applies the AC's own regex line by line, as `rg` does, and is a
 * guard: it passes before any work, by design.
 */
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const STYLE_CSS = path.resolve(__dirname, '..', '..', 'src', 'css', 'style.css');

/** Repo-relative name used in failure messages. */
const STYLE_CSS_NAME = 'src/css/style.css';

/** The CSS named colors (CSS Color Module Level 4), with their sRGB hex values. */
const NAMED_COLORS = Object.freeze({
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '00ffff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000000',
  blanchedalmond: 'ffebcd',
  blue: '0000ff',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '00ffff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '778899',
  lightslategrey: '778899',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '00ff00',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'ff00ff',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  rebeccapurple: '663399',
  red: 'ff0000',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'ffffff',
  whitesmoke: 'f5f5f5',
  yellow: 'ffff00',
  yellowgreen: '9acd32',
});

/** AC-27: a hex color, as a whole word. */
const HEX_LITERAL = /#[0-9a-f]{3,8}(?![\w-])/gi;

/** AC-27: a color function whose first argument is a number. */
const FUNCTION_LITERAL = /(?<![\w-])(?:rgba?|hsla?)\(\s*[-+]?[\d.][^)]*\)/gi;

/** A CSS identifier-like word, so `white-space` and `--white` stay whole. */
const WORD = /[\w-]+/g;

/** A quoted string, with escapes. */
const QUOTED_STRING = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;

/** A `url(...)` token, after strings are blanked. */
const URL_TOKEN = /(?<![\w-])url\([^)]*\)/gi;

/** A whole value that is one hex color of 3, 4, 6 or 8 digits. */
const HEX_VALUE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** A whole value that is one color function with numeric arguments. */
const FUNCTION_VALUE = /^(rgba?|hsla?)\(\s*([-+]?[\d.][^)]*)\)$/i;

/** AC-29: the AC's regex. */
const BS_TOKEN = /--bs-[A-Za-z0-9-]+\s*:/;

/**
 * Reads and parses the stylesheet.
 *
 * @returns {{ text: string, root: import('postcss').Root }} Its text and its PostCSS tree.
 */
function readStyle() {
  const text = fs.readFileSync(STYLE_CSS, 'utf8');
  return { text, root: postcss.parse(text, { from: STYLE_CSS }) };
}

/**
 * Whether `node` is the top-level `:root` rule.
 *
 * @param {import('postcss').Node | undefined} node A node.
 * @returns {boolean} True for a `:root` rule directly in the stylesheet.
 */
function isTopLevelRoot(node) {
  return node?.type === 'rule' && node.parent?.type === 'root' && node.selector.trim() === ':root';
}

/**
 * Blanks quoted strings and `url(...)` tokens, so their text is never scanned.
 *
 * @param {string} value A declaration value.
 * @returns {string} The value without strings or URLs.
 */
function scannableText(value) {
  return value.replace(QUOTED_STRING, '""').replace(URL_TOKEN, 'url()');
}

/**
 * Lists the color literals in a declaration value.
 *
 * @param {string} value A declaration value.
 * @returns {string[]} Each literal found.
 */
function colorLiterals(value) {
  const text = scannableText(value);
  const named = (text.match(WORD) ?? []).filter((word) =>
    Object.hasOwn(NAMED_COLORS, word.toLowerCase())
  );
  return [...(text.match(HEX_LITERAL) ?? []), ...(text.match(FUNCTION_LITERAL) ?? []), ...named];
}

/**
 * Converts a hex color to channels.
 *
 * @param {string} digits 3, 4, 6 or 8 hex digits.
 * @returns {number[]} `[r, g, b, a]`, with `a` from 0 to 1.
 */
function hexChannels(digits) {
  const full = digits.length <= 4 ? Array.from(digits, (digit) => digit + digit).join('') : digits;
  const bytes = full.match(/../g).map((pair) => parseInt(pair, 16));
  return [bytes[0], bytes[1], bytes[2], bytes.length === 4 ? bytes[3] / 255 : 1];
}

/**
 * Reads an alpha argument.
 *
 * @param {string | undefined} argument The argument, or undefined when absent.
 * @returns {number} The alpha, from 0 to 1.
 */
function alphaOf(argument) {
  if (argument === undefined) {
    return 1;
  }
  return argument.endsWith('%') ? parseFloat(argument) / 100 : parseFloat(argument);
}

/**
 * Converts HSL to RGB.
 *
 * @param {number} hue Degrees.
 * @param {number} saturation 0 to 1.
 * @param {number} lightness 0 to 1.
 * @returns {number[]} `[r, g, b]`, each 0 to 255.
 */
function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const sectors = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  const [r, g, b] = sectors[Math.floor(h) % 6];
  const m = lightness - chroma / 2;
  return [r, g, b].map((channel) => (channel + m) * 255);
}

/**
 * Converts a color function's arguments to channels.
 *
 * @param {string} name `rgb`, `rgba`, `hsl` or `hsla`.
 * @param {string} inner The text between the parentheses.
 * @returns {number[]} `[r, g, b, a]`.
 */
function functionChannels(name, inner) {
  const args = inner
    .trim()
    .split(/\s*[,/]\s*|\s+/)
    .filter(Boolean);
  if (name.toLowerCase().startsWith('rgb')) {
    const rgb = args
      .slice(0, 3)
      .map((arg) => (arg.endsWith('%') ? parseFloat(arg) * 2.55 : parseFloat(arg)));
    return [...rgb, alphaOf(args[3])];
  }
  const rgb = hslToRgb(parseFloat(args[0]), parseFloat(args[1]) / 100, parseFloat(args[2]) / 100);
  return [...rgb, alphaOf(args[3])];
}

/**
 * Normalizes a value that is wholly one color literal.
 *
 * @param {string} value A declaration value.
 * @returns {string | null} Lowercase `rgba(r, g, b, a)`, or null when the value is not a color literal.
 */
function normalizedColor(value) {
  const text = value.trim().toLowerCase();
  let channels = null;
  const hex = HEX_VALUE.exec(text);
  const call = FUNCTION_VALUE.exec(text);
  if (hex) {
    channels = hexChannels(hex[1]);
  } else if (call) {
    channels = functionChannels(call[1], call[2]);
  } else if (Object.hasOwn(NAMED_COLORS, text)) {
    channels = hexChannels(NAMED_COLORS[text]);
  }
  if (channels === null) {
    return null;
  }
  const [r, g, b] = channels.slice(0, 3).map((channel) => {
    return Math.min(255, Math.max(0, Math.round(channel)));
  });
  const a = Number(Math.min(1, Math.max(0, channels[3])).toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

test('AC-27: color literals appear only in the :root custom-property block', () => {
  // Arrange
  const { root } = readStyle();

  // Act
  const hits = [];
  root.walkDecls((declaration) => {
    if (isTopLevelRoot(declaration.parent)) {
      return;
    }
    for (const literal of colorLiterals(declaration.value)) {
      hits.push(
        `${STYLE_CSS_NAME}:${declaration.source?.start?.line}: ${literal} in ${declaration.prop}: ${declaration.value}`
      );
    }
  });

  // Assert
  expect(hits).toEqual([]);
});

test('AC-28: each color value is declared only once in :root', () => {
  // Arrange
  const { root } = readStyle();
  const rootRules = root.nodes.filter(isTopLevelRoot);

  // Act
  const colors = rootRules
    .flatMap((rule) => rule.nodes.filter((node) => node.type === 'decl'))
    .filter((declaration) => declaration.prop.startsWith('--'))
    .map((declaration) => ({
      property: declaration.prop,
      color: normalizedColor(declaration.value),
    }))
    .filter(({ color }) => color !== null);
  const properties = new Map();
  for (const { property, color } of colors) {
    properties.set(color, [...(properties.get(color) ?? []), property]);
  }
  const duplicates = Array.from(properties)
    .filter(([, names]) => names.length > 1)
    .map(([color, names]) => `${color} in ${names.join(', ')}`);

  // Assert: the Given holds (a :root rule that declares color custom properties),
  // and the distinct normalized values equal the color custom properties.
  expect({
    hasRootRule: rootRules.length > 0,
    hasColorProperties: colors.length > 0,
    duplicates,
  }).toEqual({ hasRootRule: true, hasColorProperties: true, duplicates: [] });
  expect(properties.size).toBe(colors.length);
});

test('AC-29 (guard): no Bootstrap token is declared in style.css', () => {
  // Arrange
  const { text } = readStyle();

  // Act
  const matches = [];
  text.split('\n').forEach((line, index) => {
    if (BS_TOKEN.test(line)) {
      matches.push(`${STYLE_CSS_NAME}:${index + 1}: ${line.trim()}`);
    }
  });

  // Assert
  expect(matches).toEqual([]);
});
