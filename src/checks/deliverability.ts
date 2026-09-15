/**
 * Deliverability checks.
 *
 * Healthcare mail is filtered harder than most, and a practice cannot afford a
 * damaged sending domain: the same domain carries appointment reminders and
 * intake correspondence.
 */
import type { Check, Finding } from './types.js';

/**
 * Weighted spam vocabulary. Weight reflects how strongly a filter reacts, not
 * how bad the word is — "free" is common and mild, "act now" is not.
 */
const SPAM_WORDS: Array<[RegExp, number]> = [
  [/\bact now\b/gi, 3],
  [/\blimited time\b/gi, 2],
  [/\bonce in a lifetime\b/gi, 3],
  [/\brisk[- ]free\b/gi, 3],
  [/\bno obligation\b/gi, 2],
  [/\b100% (?:free|guaranteed)\b/gi, 3],
  [/\bguaranteed?\b/gi, 2],
  [/\bmiracle\b/gi, 3],
  [/\bcure\b/gi, 2],
  [/\bclick here now\b/gi, 3],
  [/\bbuy now\b/gi, 3],
  [/\border now\b/gi, 2],
  [/\bcheap\b/gi, 2],
  [/\bdiscount\b/gi, 1],
  [/\bwinner\b/gi, 2],
  [/\bcongratulations\b/gi, 1],
  [/\burgent\b/gi, 2],
  [/\bdon'?t miss\b/gi, 1],
];

const SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly|rebrand\.ly)\b/i;

/** Above this, filters start reading the message as an image with captions. */
const MIN_WORDS = 40;

export const deliverabilityCheck: Check = ({ html, text, subject, preheader }) => {
  const findings: Finding[] = [];

  /* ---------------------------------------------------------- spam words */
  const hits: string[] = [];
  let score = 0;
  for (const [re, weight] of SPAM_WORDS) {
    re.lastIndex = 0;
    for (const match of `${subject} ${text}`.matchAll(re)) {
      hits.push(match[0]);
      score += weight;
    }
  }

  if (score >= 5) {
    findings.push({
      id: 'spam-vocabulary',
      group: 'deliverability',
      severity: 'warning',
      title: 'Wording reads as promotional',
      detail:
        'Filters weight these phrases heavily, and healthcare senders get less benefit of the doubt than most.',
      excerpt: [...new Set(hits)].join(', ').slice(0, 80),
    });
  } else if (hits.length) {
    findings.push({
      id: 'spam-vocabulary',
      group: 'deliverability',
      severity: 'pass',
      title: 'Wording is mostly clean',
      detail: `Minor flags: ${[...new Set(hits)].join(', ')}.`,
    });
  }

  /* ------------------------------------------------------------- shouting */
  // Short all-caps lines in the body are section labels — the plain-text build
  // uppercases eyebrows and headings by design. Only a full uppercase *sentence*
  // reads as shouting, so body lines need length and several words; a subject is
  // author-written, so it is held to a lower bar.
  const isShouting = (line: string, minLength: number, minWords: number): boolean =>
    line.length >= minLength &&
    line.split(/\s+/).filter(Boolean).length >= minWords &&
    line === line.toUpperCase() &&
    /[A-Z]{4,}/.test(line);

  const shouting = [
    ...(isShouting(subject, 9, 2) ? [subject] : []),
    ...(text.match(/^.+$/gm) ?? []).filter((line) => isShouting(line, 20, 4)),
  ];

  if (shouting.length) {
    findings.push({
      id: 'all-caps',
      group: 'deliverability',
      severity: 'warning',
      title: 'A line is in all capitals',
      detail: 'Filters and readers both treat shouting as promotional.',
      excerpt: shouting[0].slice(0, 60),
    });
  }

  if (/[!?]{2,}/.test(subject) || (subject.match(/!/g) ?? []).length > 1) {
    findings.push({
      id: 'punctuation',
      group: 'deliverability',
      severity: 'warning',
      title: 'Heavy punctuation in the subject',
      detail: 'Repeated exclamation or question marks are a well-known spam signal.',
      excerpt: subject.slice(0, 60),
    });
  }

  /* ------------------------------------------------------- image to text */
  const images = (html.match(/<img\b/g) ?? []).length;
  const words = text.split(/\s+/).filter(Boolean).length;

  if (words < MIN_WORDS) {
    findings.push({
      id: 'thin-content',
      group: 'deliverability',
      severity: 'warning',
      title: `Only ${words} words of text`,
      detail:
        'Image-heavy, text-light mail is more likely to be filtered, and unreadable when images are blocked.',
    });
  } else if (images > 0 && words / images < 20) {
    findings.push({
      id: 'image-ratio',
      group: 'deliverability',
      severity: 'warning',
      title: 'More images than text supports',
      detail: `${images} image${images === 1 ? '' : 's'} against ${words} words. Filters read that as an image-only mailer.`,
    });
  } else {
    findings.push({
      id: 'content-volume',
      group: 'deliverability',
      severity: 'pass',
      title: 'Healthy amount of text',
      detail: `${words} words.`,
    });
  }

  /* ---------------------------------------------------------------- links */
  const links = [...html.matchAll(/<a\s+href="([^"]+)"/g)].map((m) => m[1]);
  const external = links.filter((url) => /^https?:/i.test(url));

  const shortened = external.filter((url) => SHORTENERS.test(url));
  if (shortened.length) {
    findings.push({
      id: 'url-shortener',
      group: 'deliverability',
      severity: 'error',
      title: 'Shortened link',
      detail:
        'Shorteners hide the destination, and filters treat them harshly in healthcare mail. Use the full URL.',
      excerpt: shortened[0].slice(0, 80),
    });
  }

  if (external.length > 12) {
    findings.push({
      id: 'link-count',
      group: 'deliverability',
      severity: 'warning',
      title: `${external.length} links`,
      detail: 'A high link count is a spam signal. Cut to the ones that earn their place.',
    });
  }

  const insecure = external.filter((url) => /^http:/i.test(url));
  if (insecure.length) {
    findings.push({
      id: 'insecure-link',
      group: 'deliverability',
      severity: 'warning',
      title: 'Link is not HTTPS',
      detail: 'Plain http links look untrustworthy and some clients warn on them.',
      excerpt: insecure[0].slice(0, 80),
    });
  }

  /* ----------------------------------------------------- subject and pre */
  if (!subject) {
    findings.push({
      id: 'subject-missing',
      group: 'deliverability',
      severity: 'error',
      title: 'No subject line',
      detail: 'Add a line starting with "Subject:" so it travels with the template.',
    });
  } else if (subject.length > 60) {
    findings.push({
      id: 'subject-length',
      group: 'deliverability',
      severity: 'warning',
      title: `Subject is ${subject.length} characters`,
      detail: 'Mobile inboxes cut off around 40 to 60. The important part should come first.',
      excerpt: subject.slice(0, 70),
    });
  } else {
    findings.push({
      id: 'subject-length',
      group: 'deliverability',
      severity: 'pass',
      title: 'Subject length is good',
      detail: `${subject.length} characters.`,
    });
  }

  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(subject)) {
    findings.push({
      id: 'subject-emoji',
      group: 'deliverability',
      severity: 'warning',
      title: 'Emoji in the subject line',
      detail:
        'Rendering varies by client, and in a clinical context it reads as marketing rather than care.',
    });
  }

  if (!preheader.trim()) {
    findings.push({
      id: 'preheader-missing',
      group: 'deliverability',
      severity: 'warning',
      title: 'No preheader',
      detail: 'Without one, the inbox preview falls back to whatever the first line happens to be.',
    });
  } else if (preheader.length > 100) {
    findings.push({
      id: 'preheader-length',
      group: 'deliverability',
      severity: 'warning',
      title: `Preheader is ${preheader.length} characters`,
      detail: 'Most clients show 40 to 100. The tail will be cut.',
    });
  } else {
    findings.push({
      id: 'preheader',
      group: 'deliverability',
      severity: 'pass',
      title: 'Preheader set',
      detail: preheader.slice(0, 80),
    });
  }

  return findings;
};
