/**
 * Email-client rendering checks.
 *
 * Outlook on Windows renders with Word's engine, which ignores most of what a
 * browser does. Gmail truncates past a size limit. These are the failures that
 * only appear after you have sent.
 */
import type { Check, Finding } from './types.js';
import { GMAIL_CLIP_BYTES, findEmbeddedImages } from '../export/gmail.js';
import { relativeLuminance as luminance } from './a11y.js';

/**
 * UTF-8 byte length.
 *
 * `Buffer` exists in Node but not in the browser, and referencing it there is a
 * ReferenceError that optional chaining does not save you from. This ran fine
 * under test and threw in the actual app, taking the whole rendering group with
 * it — so `TextEncoder` comes first.
 */
function byteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  return Buffer.byteLength(s, 'utf8');
}

/** Properties Word's rendering engine silently ignores. */
const OUTLOOK_UNSUPPORTED: Array<[RegExp, string, string]> = [
  [/border-radius:\s*(?!0)/g, 'border-radius', 'Corners render square in Outlook.'],
  [/background-image:/g, 'background-image', 'Background images do not render in Outlook without VML.'],
  [/display:\s*flex/g, 'flex layout', 'Outlook has no flexbox. Use nested tables.'],
  [/display:\s*grid/g, 'grid layout', 'Outlook has no grid. Use nested tables.'],
  [/position:\s*(absolute|fixed)/g, 'positioning', 'Outlook ignores positioned elements.'],
];

export const renderingCheck: Check = ({ html }) => {
  const findings: Finding[] = [];

  /* -------------------------------------------------------------- Outlook */
  const unsupported: string[] = [];
  for (const [re, name, why] of OUTLOOK_UNSUPPORTED) {
    re.lastIndex = 0;
    if (re.test(html)) unsupported.push(`${name} — ${why}`);
  }

  if (unsupported.length) {
    findings.push({
      id: 'outlook-unsupported',
      group: 'rendering',
      severity: 'warning',
      title: `${unsupported.length} style${unsupported.length === 1 ? '' : 's'} Outlook ignores`,
      detail:
        'Windows Outlook renders with Word, not a browser. The email still works, it just looks plainer there.',
      excerpt: unsupported.join(' · ').slice(0, 160),
    });
  }

  // Padding on an anchor collapses in Outlook, turning a button into bare text.
  const paddedAnchors = [...html.matchAll(/<a\b[^>]*style="[^"]*padding[^"]*"/g)];
  const hasVml = /<!--\[if mso\]>[\s\S]*?v:roundrect/.test(html);
  if (paddedAnchors.length && !hasVml) {
    findings.push({
      id: 'outlook-button',
      group: 'rendering',
      severity: 'warning',
      title: 'Buttons will look like plain links in Outlook',
      detail:
        'Outlook drops padding on links, so the button loses its shape. A VML fallback fixes it; without one the link still works.',
    });
  }

  /* ---------------------------------------------------------------- Gmail */
  const bytes = byteLength(html);

  if (bytes > GMAIL_CLIP_BYTES) {
    findings.push({
      id: 'gmail-clipping',
      group: 'rendering',
      severity: 'error',
      title: `Over Gmail's clipping limit at ${Math.round(bytes / 1024)}KB`,
      detail:
        'Gmail cuts the message and shows "View entire message", which hides the footer and unsubscribe link.',
    });
  } else if (bytes > GMAIL_CLIP_BYTES * 0.7) {
    findings.push({
      id: 'gmail-clipping',
      group: 'rendering',
      severity: 'warning',
      title: `Approaching Gmail's limit at ${Math.round(bytes / 1024)}KB`,
      detail: `Gmail clips past ${Math.round(GMAIL_CLIP_BYTES / 1024)}KB.`,
    });
  } else {
    findings.push({
      id: 'gmail-clipping',
      group: 'rendering',
      severity: 'pass',
      title: 'Size is comfortable',
      detail: `${Math.round(bytes / 1024)}KB of Gmail's ${Math.round(GMAIL_CLIP_BYTES / 1024)}KB limit.`,
    });
  }

  /* ----------------------------------------------------------- data URIs */
  const embedded = findEmbeddedImages(html);
  if (embedded.length) {
    const total = embedded.reduce((sum, img) => sum + img.bytes, 0);
    findings.push({
      id: 'data-uri',
      group: 'rendering',
      severity: 'warning',
      title: `${embedded.length} embedded image${embedded.length === 1 ? '' : 's'}`,
      detail:
        `About ${Math.round(total / 1024)}KB inline. Fine for a one-off Gmail paste, but Outlook and most sending platforms strip data URIs — host the file and link to it.`,
    });
  }

  /* -------------------------------------------------------------- widths */
  const wide = [...html.matchAll(/width:\s*(\d{3,})px/g)]
    .map((m) => Number(m[1]))
    .filter((px) => px > 640);

  if (wide.length) {
    findings.push({
      id: 'width',
      group: 'rendering',
      severity: 'warning',
      title: `Fixed width of ${Math.max(...wide)}px`,
      detail: 'Past about 640px the email scrolls sideways on a phone.',
    });
  }

  /* ----------------------------------------------------------- dark mode */
  // Outlook.com and Gmail force-invert. Near-black text can come out barely
  // visible once flipped. Measured by luminance rather than by hex prefix — a
  // pattern like /#0[0-9a-f]{5}/ also matches a perfectly readable brand navy
  // such as #022D41.
  const nearBlack = [...html.matchAll(/(?:^|[^-])color:\s*(#[0-9a-f]{3,6})/gi)]
    .map((m) => m[1])
    .filter((hex) => {
      const l = luminance(hex);
      return l !== null && l < 0.01;
    });

  if (nearBlack.length) {
    findings.push({
      id: 'dark-mode',
      group: 'rendering',
      severity: 'warning',
      title: 'Near-black text may invert badly',
      detail:
        'Some clients force dark mode by inverting colours, and text this dark can come out barely visible. A softer dark grey survives the flip.',
      excerpt: [...new Set(nearBlack)].join(', ').slice(0, 60),
    });
  }

  /* ------------------------------------------------------- style survival */
  if (/<style>/.test(html)) {
    findings.push({
      id: 'style-block',
      group: 'rendering',
      severity: 'pass',
      title: 'Style block present for clients that keep it',
      detail:
        'Gmail strips it when you paste by hand, which only costs the mobile spacing rules. Use "Copy for Gmail" and it is handled.',
    });
  }

  return findings;
};
