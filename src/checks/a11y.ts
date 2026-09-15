/**
 * Accessibility checks.
 *
 * Patients skew older and more impaired than a general mailing list, so this is
 * not box-ticking: small type and low contrast lose real readers.
 */
import type { Check, Finding } from './types.js';

/** Minimum comfortable body size in email. */
const MIN_BODY_PX = 14;
const RECOMMENDED_BODY_PX = 16;
/** Below this, even small print is not readable. */
const MIN_SMALL_PRINT_PX = 11;

/**
 * Font sizes belonging to text a person actually reads.
 *
 * Table-based email is full of declarations that are not text: spacer rows set
 * `height`, `line-height` and `font-size` to the same value around a `&nbsp;`,
 * and the preheader is a 1px hidden div. Counting those produced a confident
 * "some text is 10px" on every email, which is exactly the kind of noise that
 * teaches people to ignore the panel.
 */
function contentFontSizes(html: string): number[] {
  const sizes: number[] = [];

  for (const match of html.matchAll(/style="([^"]*)"/g)) {
    const style = match[1];
    const size = style.match(/font-size:\s*(\d+(?:\.\d+)?)px/)?.[1];
    if (!size) continue;

    if (/display:\s*none/.test(style)) continue;

    // A spacer sets height and line-height to the same value as the font size.
    const height = style.match(/(?:^|[^-])height:\s*(\d+(?:\.\d+)?)px/)?.[1];
    const lineHeight = style.match(/line-height:\s*(\d+(?:\.\d+)?)px/)?.[1];
    if (height && lineHeight && height === lineHeight && lineHeight === size) continue;

    sizes.push(Number(size));
  }

  return sizes;
}

/** WCAG AA for normal-size text. */
const MIN_CONTRAST = 4.5;

export const a11yCheck: Check = ({ html, body }) => {
  const findings: Finding[] = [];

  /* ------------------------------------------------------------ font size */
  const sizes = contentFontSizes(html);

  const bodyish = sizes.filter((px) => px < 20);
  const smallest = bodyish.length ? Math.min(...bodyish) : RECOMMENDED_BODY_PX;

  if (smallest < MIN_SMALL_PRINT_PX) {
    findings.push({
      id: 'a11y-font-size',
      group: 'accessibility',
      severity: 'warning',
      title: `Some text is ${smallest}px`,
      detail: `Below ${MIN_SMALL_PRINT_PX}px is unreadable for many people. ${RECOMMENDED_BODY_PX}px is the comfortable default for body copy.`,
    });
  } else if (smallest < MIN_BODY_PX) {
    // 11-13px is conventional for footer small print, so this is worth noting
    // but not worth interrupting every single email over.
    findings.push({
      id: 'a11y-font-size',
      group: 'accessibility',
      severity: 'pass',
      title: `Smallest text is ${smallest}px`,
      detail: `Fine for footer small print. Keep body copy at ${RECOMMENDED_BODY_PX}px.`,
    });
  } else {
    findings.push({
      id: 'a11y-font-size',
      group: 'accessibility',
      severity: 'pass',
      title: 'Text sizes are readable',
      detail: `Smallest body text is ${smallest}px.`,
    });
  }

  /* -------------------------------------------------------------- contrast */
  const worst = worstContrast(html);
  if (worst && worst.ratio < MIN_CONTRAST) {
    findings.push({
      id: 'a11y-contrast',
      group: 'accessibility',
      severity: 'warning',
      title: `Contrast ${worst.ratio.toFixed(1)}:1 is below AA`,
      detail: `${worst.fg} on ${worst.bg} needs ${MIN_CONTRAST}:1 for normal text. Darken the text or lighten the background.`,
    });
  } else if (worst) {
    findings.push({
      id: 'a11y-contrast',
      group: 'accessibility',
      severity: 'pass',
      title: 'Contrast meets AA',
      detail: `Lowest measured pairing is ${worst.ratio.toFixed(1)}:1.`,
    });
  }

  /* ----------------------------------------------------------------- alt */
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  const missingAlt = images.filter((tag) => !/\balt\s*=/.test(tag));
  const emptyAlt = images.filter((tag) => /\balt\s*=\s*(""|'')/.test(tag));

  if (missingAlt.length) {
    findings.push({
      id: 'a11y-alt-missing',
      group: 'accessibility',
      severity: 'error',
      title: `${missingAlt.length} image without alt text`,
      detail:
        'Most clients block images by default, so alt text is what many recipients actually read.',
    });
  } else if (images.length) {
    findings.push({
      id: 'a11y-alt',
      group: 'accessibility',
      severity: 'pass',
      title: 'Every image has alt text',
      detail: `${images.length} image${images.length === 1 ? '' : 's'}, ${emptyAlt.length} marked decorative.`,
    });
  }

  /* ------------------------------------------------------------- headings */
  const levels = [...body.matchAll(/^(#{1,3})\s/gm)].map((m) => m[1].length);
  const skipped = levels.some((level, i) => i > 0 && level - levels[i - 1] > 1);
  if (skipped) {
    findings.push({
      id: 'a11y-heading-order',
      group: 'accessibility',
      severity: 'warning',
      title: 'Heading levels skip a step',
      detail:
        'Going straight from # to ### leaves a screen reader announcing a structure the email does not have.',
    });
  }

  /* ---------------------------------------------------------- link text */
  const vagueLinks = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    .filter((label) => /^(click here|here|read more|more|link|this)$/i.test(label));

  if (vagueLinks.length) {
    findings.push({
      id: 'a11y-link-text',
      group: 'accessibility',
      severity: 'warning',
      title: 'Link text does not say where it goes',
      detail:
        'Screen readers can list links out of context, so "click here" tells the reader nothing. Name the destination.',
      excerpt: vagueLinks.join(', ').slice(0, 80),
    });
  }

  /* ------------------------------------------------- presentational tables */
  const tables = html.match(/<table\b[^>]*>/g) ?? [];
  const unmarked = tables.filter((tag) => !/role\s*=\s*["']presentation["']/.test(tag));
  if (unmarked.length) {
    findings.push({
      id: 'a11y-table-role',
      group: 'accessibility',
      severity: 'warning',
      title: `${unmarked.length} layout table without role="presentation"`,
      detail:
        'Without it, a screen reader announces the layout scaffolding as a data table.',
    });
  }

  /* ------------------------------------------------------------- language */
  if (!/<html[^>]+lang=/i.test(html)) {
    findings.push({
      id: 'a11y-lang',
      group: 'accessibility',
      severity: 'warning',
      title: 'No language set on the document',
      detail: 'Screen readers use it to pick the right pronunciation.',
    });
  }

  return findings;
};

/* ------------------------------------------------------------- contrast */

interface Pairing { fg: string; bg: string; ratio: number }

/**
 * Worst contrast among pairings we can actually be sure about.
 *
 * Only measures where a `color` and a `background-color` sit in the **same**
 * style attribute. An earlier version assumed white whenever no background was
 * declared, which reported white-on-navy header text as 1.0:1 — a confident,
 * completely wrong failure on every email. Inheriting the real background would
 * need a full cascade; without one, saying nothing beats saying something false.
 */
function worstContrast(html: string): Pairing | null {
  let worst: Pairing | null = null;

  for (const match of html.matchAll(/style="([^"]*)"/g)) {
    const style = match[1];
    const fg = style.match(/(?:^|[^-])color:\s*(#[0-9a-f]{3,6})/i)?.[1];
    const bg = style.match(/background-color:\s*(#[0-9a-f]{3,6})/i)?.[1];
    if (!fg || !bg) continue;

    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue;
    if (!worst || ratio < worst.ratio) worst = { fg, bg, ratio };
  }

  return worst;
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const [r, g, b] = clean.split('').map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}
