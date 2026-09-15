/**
 * Gmail-tuned export.
 *
 * Gmail's compose window is the paste target for this team, and it is a hostile
 * one. When you paste HTML into it, Gmail keeps inline `style` attributes and
 * throws away everything else:
 *
 *   - `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` wrappers
 *   - the `<style>` block, so `@media` rules and the `.pad` / `.wrap` classes die
 *   - the webfont `<link>`, so type falls back to the inline stack
 *   - MSO conditional comments, which Gmail never needed
 *
 * So this produces a fragment carrying only what survives, and reports what was
 * lost rather than letting the user discover it after sending.
 */

export interface GmailExport {
  /** The fragment to place on the clipboard. */
  html: string;
  /** Size of the fragment; Gmail clips a *sent* message past ~102KB. */
  bytes: number;
  /** True when the message will be clipped with a "View entire message" link. */
  willClip: boolean;
  /** Plain-language notes about what Gmail discards. */
  notes: string[];
}

/** Gmail truncates a sent message beyond roughly this size. */
export const GMAIL_CLIP_BYTES = 102_000;

/**
 * Convert a full email document into something safe to paste into Gmail.
 *
 * @param html   Output of `buildEmail`.
 * @param opts.keepPreheader  Preheaders do nothing in a manual paste — Gmail
 *   builds its own snippet from visible text — so the hidden div is dropped by
 *   default rather than risking it rendering as a stray blank line.
 */
export function toGmailHtml(html: string, opts: { keepPreheader?: boolean } = {}): GmailExport {
  const notes: string[] = [];
  let out = html;

  // 1. Conditional comments — Outlook-only, dead weight in Gmail.
  if (/<!--\[if/.test(out)) {
    out = out.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '');
  }

  // 2. The webfont link cannot survive; inline font stacks already carry fallbacks.
  if (/<link[^>]+fonts\.googleapis\.com/.test(out)) {
    out = out.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>\s*/g, '');
    notes.push('Web fonts are not applied in Gmail. Text falls back to Helvetica or Arial, which is expected.');
  }

  // 3. The <style> block is stripped by Gmail. Say what that costs.
  const styleBlock = out.match(/<style>([\s\S]*?)<\/style>/);
  if (styleBlock) {
    if (/@media/.test(styleBlock[1])) {
      notes.push('Mobile spacing rules are dropped on paste. The email still uses a fixed 600px table, so it stays readable on a phone but will not reflow.');
    }
    out = out.replace(/<style>[\s\S]*?<\/style>\s*/g, '');
  }

  // 4. Reduce to the body's contents. Gmail discards the document wrapper anyway,
  //    and leaving it in produces stray text nodes in some paste paths.
  const body = out.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) out = body[1];

  out = out
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, '');

  // 5. The preheader is a hidden div; it has no effect on a hand-composed message.
  if (!opts.keepPreheader) {
    const before = out;
    out = out.replace(/<div style="display:none;[\s\S]*?<\/div>\s*/i, '');
    if (before !== out) {
      notes.push('The preheader was removed. Gmail builds its own preview from the first visible line when you compose by hand.');
    }
  }

  // 6. Strip the subject-line comment; it is a note to the author, not content.
  out = out.replace(/<!--\s*SUBJECT LINE:[\s\S]*?-->\s*/g, '');

  out = out.replace(/\n{3,}/g, '\n\n').trim();

  const bytes = byteLength(out);
  const willClip = bytes > GMAIL_CLIP_BYTES;
  if (willClip) {
    notes.push(
      `This message is ${Math.round(bytes / 1024)}KB, past Gmail's ${Math.round(GMAIL_CLIP_BYTES / 1024)}KB limit. ` +
      'Recipients will see "View entire message". Host the logo instead of embedding it.',
    );
  }

  return { html: out, bytes, willClip, notes };
}

/**
 * Data URIs are convenient in the editor and a liability on send: they inflate
 * the message toward Gmail's clip limit and several platforms strip them.
 */
export function findEmbeddedImages(html: string): Array<{ bytes: number; mime: string }> {
  const found: Array<{ bytes: number; mime: string }> = [];
  for (const match of html.matchAll(/src="data:([^;]+);base64,([^"]+)"/g)) {
    found.push({ mime: match[1], bytes: Math.floor(match[2].length * 0.75) });
  }
  return found;
}

function byteLength(s: string): number {
  return typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(s).length
    : Buffer.byteLength(s, 'utf8');
}
