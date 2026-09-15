/**
 * The PHI scanner.
 *
 * This is the check that makes the tool different from a generic email builder,
 * and the one most at risk of being useless.
 *
 * It runs on the **template source**, not the filled email. That distinction is
 * the whole design: a filled email is *supposed* to contain a patient's name —
 * that is what the merge field is for. A stored, reusable template containing a
 * real name is patient information waiting to be sent to the wrong person.
 *
 * Two rules govern every pattern here:
 *
 *   1. **Precision over recall.** A scanner that cries wolf gets dismissed, and
 *      a dismissed scanner catches nothing. Every pattern below is anchored on
 *      something a false positive is unlikely to contain.
 *   2. **Fixing must be easier than dismissing.** Findings carry a one-click
 *      replacement with the right merge field wherever one exists.
 *
 * It is an aid, not a guarantee, and it never reports a template as "clean" —
 * only that it found nothing.
 */
import type { Check, Finding } from './types.js';

/** Words that legitimately follow a greeting and are not somebody's name. */
const GREETING_ALLOWLIST = new Set([
  'there', 'all', 'team', 'everyone', 'again', 'friend', 'folks', 'colleagues',
  'doctor', 'dr', 'and', 'from', 'to', 'the', 'hello', 'hi',
]);

/** Units that make a bare number look like a medication dose. */
const DOSE_UNITS = 'mg|mcg|ug|ml|mL|g|IU|units';

interface Pattern {
  id: string;
  /** Must be global; the scanner iterates matches. */
  re: RegExp;
  title: string;
  detail: string;
  /** Merge field to offer in place of the match, when there is an obvious one. */
  suggest?: string;
  /** Narrow further; return false to reject a match as a false positive. */
  accept?: (match: RegExpMatchArray, body: string) => boolean;
  /** Which capture group is the offending text. Defaults to the whole match. */
  group?: number;
}

const PATTERNS: Pattern[] = [
  {
    id: 'phi-ssn',
    re: /\b\d{3}-\d{2}-\d{4}\b/g,
    title: 'Looks like a Social Security number',
    detail:
      'A Social Security number should never appear in an email template, and rarely in an email at all.',
  },
  {
    id: 'phi-dob',
    re: /\b(?:DOB|D\.O\.B\.|date of birth)\b\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})?/gi,
    title: 'Date of birth',
    detail:
      'Date of birth is a direct patient identifier. Use a merge field so it is filled per recipient rather than stored in the template.',
    suggest: '{{patient_dob}}',
  },
  {
    id: 'phi-mrn',
    re: /\b(?:MRN|medical record (?:number|no\.?|#)|chart (?:number|#))\b\s*[:#]?\s*([A-Z0-9-]{3,})?/gi,
    title: 'Medical record number',
    detail:
      'A medical record number identifies a specific patient. It belongs in the filled email, not in a saved template.',
    suggest: '{{mrn}}',
  },
  {
    id: 'phi-member-id',
    re: /\b(?:member|policy|subscriber|group)\s*(?:id|ID|#|number)\b\s*[:#]?\s*([A-Z0-9-]{4,})/gi,
    title: 'Insurance member or policy number',
    detail:
      'Insurance identifiers are protected health information. Replace the value with a merge field.',
    suggest: '{{member_id}}',
  },
  {
    id: 'phi-icd10',
    // Requires the decimal form (F41.1). A bare "F41" is too easily a room
    // number, a form code, or a font size to flag confidently.
    re: /\b[A-TV-Z][0-9]{2}\.[0-9]{1,4}\b/g,
    title: 'Looks like an ICD-10 diagnosis code',
    detail:
      'A diagnosis in a reusable template is both a patient identifier and, for behavioral health, especially sensitive.',
  },
  {
    id: 'phi-diagnosis-label',
    re: /\b(?:Dx|diagnosis)\b\s*[:]\s*([^\n]{2,60})/gi,
    title: 'Diagnosis noted in the template',
    detail:
      'Behavioral health diagnoses carry extra protection, and substance use disorder records fall under 42 CFR Part 2. Keep them out of stored templates.',
  },
  {
    id: 'phi-medication-dose',
    re: new RegExp(String.raw`\b([A-Za-z]{4,})\s+(\d{1,4}(?:\.\d+)?)\s?(${DOSE_UNITS})\b`, 'g'),
    title: 'Looks like a medication and dose',
    detail:
      'A named medication with a dose reads as a specific patient’s treatment. Use merge fields if the email needs to carry it.',
    accept: (match) => {
      // "up to 3 mg" or "under 500 mg" is a policy sentence, not a prescription.
      const lead = match[1].toLowerCase();
      return !['under', 'about', 'up', 'over', 'than', 'least', 'most', 'each', 'every', 'take', 'your', 'their'].includes(lead);
    },
  },
  {
    id: 'phi-hardcoded-name',
    // "Hi Sarah," in a template means a real name got baked in where a merge
    // field belongs. This is the single most likely way PHI enters a template.
    re: /\b(?:Hi|Hello|Dear|Hey)\s+([A-Z][a-z]{1,20})\b\s*[,!]/g,
    title: 'A name is written into the greeting',
    detail:
      'Templates are reused. A name typed directly into the greeting will be sent to the next recipient too. Replace it with a merge field.',
    suggest: '{{first_name}}',
    group: 1,
    accept: (match) => !GREETING_ALLOWLIST.has(match[1].toLowerCase()),
  },
];

/**
 * Character ranges occupied by `{{merge_fields}}`.
 *
 * A merge field is the *correct* state, so anything landing inside one is not a
 * finding. Checking the matched text alone is not enough — a pattern like
 * `\bMRN\b` matches the letters inside `{{mrn}}` without ever seeing a brace.
 */
function mergeFieldSpans(body: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of body.matchAll(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g)) {
    const start = match.index ?? 0;
    spans.push([start, start + match[0].length]);
  }
  return spans;
}

function overlapsMergeField(spans: Array<[number, number]>, start: number, end: number): boolean {
  return spans.some(([from, to]) => start < to && end > from);
}

export const phiCheck: Check = ({ body }) => {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const spans = mergeFieldSpans(body);

  for (const pattern of PATTERNS) {
    pattern.re.lastIndex = 0;
    for (const match of body.matchAll(pattern.re)) {
      if (pattern.accept && !pattern.accept(match, body)) continue;

      const offending = (pattern.group ? match[pattern.group] : match[0])?.trim();
      if (!offending) continue;

      // A merge field is the correct state, not a finding.
      const start = match.index ?? 0;
      if (overlapsMergeField(spans, start, start + match[0].length)) continue;
      if (match[0].includes('{{')) continue;

      const key = `${pattern.id}:${offending}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        id: pattern.id,
        group: 'phi',
        severity: 'warning',
        title: pattern.title,
        detail: pattern.detail,
        excerpt: match[0].trim().slice(0, 80),
        ...(pattern.suggest
          ? {
              fix: {
                label: `Replace with ${pattern.suggest}`,
                find: offending,
                replace: pattern.suggest,
              },
            }
          : {}),
      });
    }
  }

  if (!findings.length) {
    findings.push({
      id: 'phi-none',
      group: 'phi',
      severity: 'pass',
      title: 'No patient data patterns found',
      // Deliberately not "this template is clean" - the scanner cannot know that.
      detail:
        'Nothing matched the patterns this tool checks for. It is an aid, not a guarantee — read the template yourself before saving it.',
    });
  }

  return findings;
};

/** True when the scanner found something worth acknowledging before a save. */
export function hasPhiWarnings(findings: Finding[]): boolean {
  return findings.some((f) => f.group === 'phi' && f.severity !== 'pass');
}
