/**
 * @jest-environment node
 */
/**
 * S1 acceptance tests for chain J (spec stabilize-and-cleanup, sections 2.3,
 * 3.4 WI-27 and 3.7): AC-20, AC-22 and AC-23 on `src/css/style.css`.
 *
 * AC-20 and AC-22 apply the ACs' own regexes to the stylesheet's text, AC-20 line
 * by line as `rg` does. AC-23 runs the four `rg` checks of its table line by line,
 * and the four rule-level checks on the rule blocks PostCSS parses.
 */
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const STYLE_CSS = path.resolve(__dirname, '..', '..', 'src', 'css', 'style.css');

/** Repo-relative name used in failure messages. */
const STYLE_CSS_NAME = 'src/css/style.css';

/** AC-20: the frontend-audit section 5a dead selectors. */
const DEAD_SELECTOR_PATTERNS = Object.freeze([
  /\.facts\b/,
  /\.skills\b/,
  /\.resume\b/,
  /\.breadcrumbs\b/,
  /\.portfolio-details\b/,
  /\.loading\b/,
  /animate-loading/,
  /\.info\s+\.social-links/,
  /br\s*\+\s*br/,
  /#hero\s+h2/,
]);

/** AC-22: a rule block whose whole selector is the contact-form base box. */
const FORM_BOX_PATTERN = /^\s*(#contactModal\s+)?\.php-email-form\s*(\{|$)/gm;

/** AC-23: the four line checks, by the label each violation is listed under. */
const LINE_CHECKS = Object.freeze({
  'padding-right: 20px 15px': /padding-right:\s*20px\s+15px/,
  'transition: display': /transition:\s*display/,
  '-moz-text-align-last': /-moz-text-align-last/,
  '@-webkit-keyframes': /@-webkit-keyframes/,
});

/** AC-23 rule-level check labels. */
const DUPLICATE_PROPERTY = 'rule block declares a property twice';
const FILTER_LAST_CHILD = 'portfolio-filter :last-child rule declares only margin-right: 0';
const LINKS_HOVER_OPACITY = ':hover/:focus-within rule for .portfolio-links declares opacity';
const WRAP_BEFORE_OFFSETS =
  ':hover/:focus-within rule for .portfolio-wrap::before declares top, right, bottom or left';

/** A portfolio filter control, under today's `portfolio-flters` id or a corrected name. */
const PORTFOLIO_FILTER = /portfolio-?fi?lters?/i;

/** A state the hover-only rules of AC-23 depend on. */
const HOVER_OR_FOCUS_WITHIN = /:hover|:focus-within/;

/** A zero length, with or without a unit. */
const ZERO = /^0([a-z%]+)?$/i;

/** The offset properties AC-23 forbids on the hovered `::before`. */
const OFFSETS = new Set(['top', 'right', 'bottom', 'left']);

/**
 * Reads the stylesheet.
 *
 * @returns {string} Its text.
 */
function readStyle() {
  return fs.readFileSync(STYLE_CSS, 'utf8');
}

/**
 * Lists every line of `text` that `pattern` matches.
 *
 * @param {string} text The stylesheet's text.
 * @param {RegExp} pattern A non-global pattern.
 * @returns {string[]} Each match as `file:line: text`.
 */
function matchLines(text, pattern) {
  const matches = [];
  text.split('\n').forEach((line, index) => {
    if (pattern.test(line)) {
      matches.push(`${STYLE_CSS_NAME}:${index + 1}: ${line.trim()}`);
    }
  });
  return matches;
}

/**
 * Returns the 1-based line of character `offset` in `text`.
 *
 * @param {string} text The text.
 * @param {number} offset A character offset.
 * @returns {number} The line number.
 */
function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/**
 * Returns the last compound selector of `selector`: the part after its last
 * descendant, child or sibling combinator.
 *
 * @param {string} selector One complex selector.
 * @returns {string} Its last compound selector.
 */
function lastCompound(selector) {
  const parts = selector.trim().split(/\s*[>+~]\s*|\s+/);
  return parts[parts.length - 1];
}

/**
 * Describes a rule for a failure message.
 *
 * @param {import('postcss').Rule} rule The rule.
 * @returns {string} `file:line selector`.
 */
function describeRule(rule) {
  return `${STYLE_CSS_NAME}:${rule.source?.start?.line} ${rule.selector.replace(/\s+/g, ' ')}`;
}

/**
 * Returns the declarations directly inside `rule`.
 *
 * @param {import('postcss').Rule} rule The rule.
 * @returns {import('postcss').Declaration[]} Its declarations.
 */
function declarationsOf(rule) {
  return (rule.nodes ?? []).filter((node) => node.type === 'decl');
}

/**
 * Lists the properties `rule` declares more than once.
 *
 * @param {import('postcss').Rule} rule The rule.
 * @returns {string[]} One violation per repeated property.
 */
function duplicateProperties(rule) {
  const lines = new Map();
  for (const declaration of declarationsOf(rule)) {
    const property = declaration.prop.toLowerCase();
    lines.set(property, [...(lines.get(property) ?? []), declaration.source?.start?.line]);
  }
  return Array.from(lines)
    .filter(([, at]) => at.length > 1)
    .map(([property, at]) => `${describeRule(rule)}: ${property} at lines ${at.join(', ')}`);
}

/**
 * Whether `rule` is a portfolio-filter `:last-child` rule that declares only
 * `margin-right: 0`.
 *
 * @param {import('postcss').Rule} rule The rule.
 * @returns {boolean} True for a violation.
 */
function isFilterLastChildMarginOnly(rule) {
  const onFilterLastChild = rule.selectors.some(
    (selector) => PORTFOLIO_FILTER.test(selector) && selector.includes(':last-child')
  );
  const declarations = declarationsOf(rule);
  return (
    onFilterLastChild &&
    declarations.length === 1 &&
    declarations[0].prop.toLowerCase() === 'margin-right' &&
    ZERO.test(declarations[0].value.trim())
  );
}

/**
 * Lists the declarations of `properties` in a `:hover`/`:focus-within` rule whose
 * selector targets `target`.
 *
 * @param {import('postcss').Rule} rule The rule.
 * @param {(compound: string) => boolean} target Whether a last compound is the target.
 * @param {(property: string) => boolean} forbidden Whether a property is forbidden.
 * @returns {string[]} One violation per forbidden declaration.
 */
function hoverDeclarations(rule, target, forbidden) {
  const applies = rule.selectors.some(
    (selector) => HOVER_OR_FOCUS_WITHIN.test(selector) && target(lastCompound(selector))
  );
  if (!applies) {
    return [];
  }
  return declarationsOf(rule)
    .filter((declaration) => forbidden(declaration.prop.toLowerCase()))
    .map(
      (declaration) =>
        `${describeRule(rule)}: ${declaration.prop} at line ${declaration.source?.start?.line}`
    );
}

/**
 * Runs AC-23's eight checks on the stylesheet.
 *
 * @param {string} text The stylesheet's text.
 * @returns {Record<string, string[]>} The violations, by check.
 */
function declarationViolations(text) {
  const violations = {};
  for (const [label, pattern] of Object.entries(LINE_CHECKS)) {
    violations[label] = matchLines(text, pattern);
  }
  violations[DUPLICATE_PROPERTY] = [];
  violations[FILTER_LAST_CHILD] = [];
  violations[LINKS_HOVER_OPACITY] = [];
  violations[WRAP_BEFORE_OFFSETS] = [];

  postcss.parse(text, { from: STYLE_CSS }).walkRules((rule) => {
    violations[DUPLICATE_PROPERTY].push(...duplicateProperties(rule));
    if (isFilterLastChildMarginOnly(rule)) {
      violations[FILTER_LAST_CHILD].push(describeRule(rule));
    }
    violations[LINKS_HOVER_OPACITY].push(
      ...hoverDeclarations(
        rule,
        (compound) => compound.includes('.portfolio-links'),
        (property) => property === 'opacity'
      )
    );
    violations[WRAP_BEFORE_OFFSETS].push(
      ...hoverDeclarations(
        rule,
        (compound) => compound.includes('.portfolio-wrap') && compound.includes('::before'),
        (property) => OFFSETS.has(property)
      )
    );
  });
  return violations;
}

test('AC-20: the frontend-audit 5a dead selectors are gone', () => {
  // Arrange
  const text = readStyle();

  // Act
  const matches = DEAD_SELECTOR_PATTERNS.flatMap((pattern) =>
    matchLines(text, pattern).map((match) => `${pattern.source} ${match}`)
  );

  // Assert
  expect(matches).toEqual([]);
});

test('AC-22: the overridden contact-form base box is collapsed', () => {
  // Arrange
  const text = readStyle();

  // Act
  const rules = Array.from(text.matchAll(FORM_BOX_PATTERN), (match) => {
    const start = match.index + match[0].search(/\S/);
    return `${STYLE_CSS_NAME}:${lineAt(text, start)}: ${match[0].trim()}`;
  });

  // Assert: more than one rule fails, and the message lists them all.
  const rulesBeyondOne = rules.length > 1 ? rules : [];
  expect(rulesBeyondOne).toEqual([]);
});

test('AC-23: the frontend-audit 5b invalid and no-op declarations are gone', () => {
  // Arrange
  const text = readStyle();

  // Act
  const violations = declarationViolations(text);

  // Assert
  expect(violations).toEqual(
    Object.fromEntries(Object.keys(violations).map((label) => [label, []]))
  );
});
