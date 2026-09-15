/**
 * Compliance checks.
 *
 * These apply to mail sent to a list. CAN-SPAM requires a genuine physical
 * postal address and a working opt-out on commercial email; both are cheap to
 * get right and expensive to get wrong.
 *
 * The stakes here are higher than a fine. Spam complaints degrade the sending
 * domain's reputation, and for a practice that is the same domain carrying
 * appointment reminders and intake correspondence. Getting flagged to protect a
 * newsletter means patient-facing mail starts landing in spam.
 */
import type { Check, Finding } from './types.js';

/** A postal address needs a number and something street- or box-like. */
const ADDRESS_RE = /\d+\s+\S+|P\.?O\.?\s*Box\s*\d+/i;

export const complianceCheck: Check = ({ bulk, footer, unsubscribeUrl, body, html }) => {
  const findings: Finding[] = [];

  if (bulk) {
    const address = (footer ?? '').trim();

    if (!address) {
      findings.push({
        id: 'canspam-address-missing',
        group: 'compliance',
        severity: 'error',
        title: 'No postal address on bulk mail',
        detail:
          'CAN-SPAM requires a valid physical postal address on commercial email. Add it in Practice details and it will appear in the footer.',
      });
    } else if (!ADDRESS_RE.test(address)) {
      findings.push({
        id: 'canspam-address-suspect',
        group: 'compliance',
        severity: 'warning',
        title: 'Footer may not be a real postal address',
        detail:
          'The address must be somewhere mail could actually be delivered — a street address or PO box, not just a name.',
        excerpt: address.slice(0, 80),
      });
    } else {
      findings.push({
        id: 'canspam-address',
        group: 'compliance',
        severity: 'pass',
        title: 'Postal address present',
        detail: address.slice(0, 80),
      });
    }

    const unsub = (unsubscribeUrl ?? '').trim();
    if (!unsub) {
      findings.push({
        id: 'canspam-unsub-missing',
        group: 'compliance',
        severity: 'error',
        title: 'No unsubscribe link on bulk mail',
        detail:
          'Commercial email must offer a working opt-out, and it must keep working for at least 30 days after you send.',
      });
    } else if (!/^https?:\/\//i.test(unsub)) {
      findings.push({
        id: 'canspam-unsub-invalid',
        group: 'compliance',
        severity: 'error',
        title: 'Unsubscribe link is not a usable URL',
        detail: 'It must be a full link starting with http:// or https://.',
        excerpt: unsub.slice(0, 80),
      });
    } else {
      findings.push({
        id: 'canspam-unsub',
        group: 'compliance',
        severity: 'pass',
        title: 'Unsubscribe link present',
        detail: unsub.slice(0, 80),
      });
    }

    findings.push({
      id: 'consent-reminder',
      group: 'compliance',
      severity: 'warning',
      title: 'Send only to people who opted in',
      detail:
        'Adding addresses you collected rather than were given is an aggravating factor under CAN-SPAM, and the spam complaints that follow damage the same domain your patient email goes out on.',
    });
  }

  // Substance use disorder content carries stricter redisclosure rules than
  // HIPAA generally, and a template is exactly where that gets forgotten.
  if (/\b(substance use|SUD|addiction|opioid|alcohol use disorder|methadone|buprenorphine|suboxone)\b/i.test(body)) {
    findings.push({
      id: 'part2-notice',
      group: 'compliance',
      severity: 'warning',
      title: 'Substance use content — 42 CFR Part 2 may apply',
      detail:
        'Part 2 restricts redisclosure of substance use disorder records more tightly than HIPAA. Check whether this message needs the Part 2 notice before sending.',
    });
  }

  // Clinical mail between providers usually carries a confidentiality footer.
  const clinicalToPeer = /\b(records request|authorization|care transition|referral|handoff|shared patient)\b/i.test(body);
  const hasNotice = /\bconfidential/i.test(html);
  if (clinicalToPeer && !hasNotice) {
    findings.push({
      id: 'confidentiality-notice',
      group: 'compliance',
      severity: 'warning',
      title: 'No confidentiality notice',
      detail:
        'Provider-to-provider mail normally carries one, so a misdirected message says plainly what the recipient should do.',
    });
  }

  return findings;
};
