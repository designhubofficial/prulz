import { describe, it, expect } from 'vitest';
import {
  review, applyFix, contrastRatio, hasPhiWarnings,
  type CheckContext, type Finding,
} from '../src/checks/index.js';
import { phiCheck } from '../src/checks/phi.js';
import { TEMPLATES, render, sampleValues, getTemplate } from '../src/library/index.js';

const base: CheckContext = {
  body: '# Hello there\n\nA reasonable amount of body text goes here so the volume check is happy, with enough words to clear the minimum comfortably and then some more.',
  subject: 'A perfectly ordinary subject',
  preheader: 'A perfectly ordinary preheader line.',
  html: '<html lang="en"><body><table role="presentation" style="font-size:15px; color:#222222"><tr><td>Hello</td></tr></table></body></html>',
  text: 'Hello there. A reasonable amount of body text goes here so the volume check is happy, with enough words to clear the minimum comfortably and then some more.',
  bulk: false,
  fields: [],
};

const ctx = (patch: Partial<CheckContext> = {}): CheckContext => ({ ...base, ...patch });
const phi = (body: string): Finding[] => phiCheck(ctx({ body })).filter((f) => f.severity !== 'pass');
const ids = (findings: Finding[]): string[] => findings.map((f) => f.id);

/* ------------------------------------------------------------------ PHI */

describe('PHI scanner — catches what matters', () => {
  it('flags a Social Security number', () => {
    expect(ids(phi('Reference 123-45-6789 on the form.'))).toContain('phi-ssn');
  });

  it('flags a date of birth', () => {
    expect(ids(phi('Patient DOB: 04/12/1988'))).toContain('phi-dob');
    expect(ids(phi('Date of birth 1988-04-12'))).toContain('phi-dob');
  });

  it('flags a medical record number', () => {
    expect(ids(phi('MRN 88421 attached'))).toContain('phi-mrn');
    expect(ids(phi('Medical record number: A7781'))).toContain('phi-mrn');
  });

  it('flags an insurance member id', () => {
    expect(ids(phi('Member ID: XZ4419'))).toContain('phi-member-id');
  });

  it('flags an ICD-10 code', () => {
    expect(ids(phi('Coded as F41.1 for billing.'))).toContain('phi-icd10');
  });

  it('flags an explicit diagnosis', () => {
    expect(ids(phi('Dx: generalized anxiety'))).toContain('phi-diagnosis-label');
  });

  it('flags a medication with a dose', () => {
    expect(ids(phi('Continue sertraline 50mg daily.'))).toContain('phi-medication-dose');
  });

  it('flags a name baked into the greeting', () => {
    // The most likely way PHI enters a template at all.
    expect(ids(phi('Hi Sarah,\n\nYour appointment is confirmed.'))).toContain('phi-hardcoded-name');
    expect(ids(phi('Dear Michael, we received your referral.'))).toContain('phi-hardcoded-name');
  });
});

describe('PHI scanner — precision, so it does not get ignored', () => {
  const clean = (body: string) => expect(phi(body)).toEqual([]);

  it('accepts a merge field in the greeting', () => {
    clean('Hi {{first_name}},\n\nYour appointment is confirmed.');
  });

  it('accepts generic greetings', () => {
    clean('Hi there,\n\nWelcome.');
    clean('Hello team,\n\nAn update.');
    clean('Hi all,\n\nAn update.');
  });

  it('does not treat a bare letter-number code as a diagnosis', () => {
    // Room numbers, suite numbers and form codes are everywhere in practice mail.
    clean('Report to suite B12 on arrival.');
    clean('Complete form W9 before your visit.');
  });

  it('does not read a policy sentence as a prescription', () => {
    clean('Doses under 500 mg do not need prior authorization.');
    clean('Bring up to 3 mg of documentation.');
  });

  it('accepts merge fields where identifiers belong', () => {
    clean('Your member ID is {{member_id}} and your record is {{mrn}}.');
  });

  it('does not flag a phone number as an SSN', () => {
    clean('Call 503-555-0100 to reschedule.');
  });

  it('leaves the whole shipped library clean', () => {
    // The library is the reference implementation. If a starter trips the
    // scanner, either the template or the scanner is wrong.
    for (const template of TEMPLATES) {
      expect(phi(template.body), `${template.id} tripped the PHI scanner`).toEqual([]);
    }
  });
});

describe('PHI scanner — how it reports', () => {
  it('offers a merge field replacement for a hardcoded name', () => {
    const [finding] = phi('Hi Sarah,');
    expect(finding.fix).toEqual({
      label: 'Replace with {{first_name}}',
      find: 'Sarah',
      replace: '{{first_name}}',
    });
  });

  it('applies the fix to the source', () => {
    const body = 'Hi Sarah,\n\nSee you soon.';
    const [finding] = phi(body);
    expect(applyFix(body, finding)).toBe('Hi {{first_name}},\n\nSee you soon.');
  });

  it('never claims a template is clean, only that it found nothing', () => {
    const pass = phiCheck(ctx({ body: 'Hi there,' })).find((f) => f.severity === 'pass')!;
    expect(pass.detail).toContain('not a guarantee');
    expect(pass.title).not.toMatch(/clean|safe|no PHI/i);
  });

  it('warns rather than blocks, so it can be acknowledged', () => {
    // A hard block on a heuristic would train people to work around the tool.
    for (const finding of phi('Hi Sarah, DOB: 04/12/1988')) {
      expect(finding.severity).toBe('warning');
    }
  });

  it('reports each distinct match once', () => {
    const findings = phi('Hi Sarah,\n\nHi Sarah,\n\nHi Sarah,');
    expect(findings.filter((f) => f.id === 'phi-hardcoded-name')).toHaveLength(1);
  });

  it('exposes whether anything needs acknowledging', () => {
    expect(hasPhiWarnings(phiCheck(ctx({ body: 'Hi Sarah,' })))).toBe(true);
    expect(hasPhiWarnings(phiCheck(ctx({ body: 'Hi there,' })))).toBe(false);
  });
});

/* ----------------------------------------------------------- compliance */

describe('compliance', () => {
  it('blocks bulk mail with no postal address', () => {
    const { findings, ok } = review(ctx({ bulk: true, unsubscribeUrl: 'https://e.com/u' }));
    expect(ids(findings)).toContain('canspam-address-missing');
    expect(ok).toBe(false);
  });

  it('blocks bulk mail with no unsubscribe link', () => {
    const { findings } = review(ctx({ bulk: true, footer: '1 Main St, Portland OR' }));
    expect(ids(findings)).toContain('canspam-unsub-missing');
  });

  it('rejects an unsubscribe value that is not a URL', () => {
    const { findings } = review(ctx({
      bulk: true, footer: '1 Main St, Portland OR', unsubscribeUrl: 'reply to opt out',
    }));
    expect(ids(findings)).toContain('canspam-unsub-invalid');
  });

  it('is suspicious of a footer with no street number', () => {
    const { findings } = review(ctx({
      bulk: true, footer: 'Example Health', unsubscribeUrl: 'https://e.com/u',
    }));
    expect(ids(findings)).toContain('canspam-address-suspect');
  });

  it('accepts a proper address and link', () => {
    const { findings, ok } = review(ctx({
      bulk: true, footer: '123 Example St, Portland OR 97201', unsubscribeUrl: 'https://e.com/u',
    }));
    expect(ids(findings)).toContain('canspam-address');
    expect(ids(findings)).toContain('canspam-unsub');
    expect(ok).toBe(true);
  });

  it('reminds about consent on bulk mail only', () => {
    expect(ids(review(ctx({ bulk: true })).findings)).toContain('consent-reminder');
    expect(ids(review(ctx({ bulk: false })).findings)).not.toContain('consent-reminder');
  });

  it('raises 42 CFR Part 2 when substance use content appears', () => {
    const { findings } = review(ctx({ body: 'Your buprenorphine refill is ready.' }));
    expect(ids(findings)).toContain('part2-notice');
  });

  it('wants a confidentiality notice on provider-to-provider mail', () => {
    const { findings } = review(ctx({ body: 'Records request for a shared patient.' }));
    expect(ids(findings)).toContain('confidentiality-notice');
  });
});

/* -------------------------------------------------------- accessibility */

describe('accessibility', () => {
  it('flags genuinely unreadable text', () => {
    const { findings } = review(ctx({ html: '<html lang="en"><p style="font-size:9px">x</p></html>' }));
    expect(ids(findings)).toContain('a11y-font-size');
    expect(findings.find((f) => f.id === 'a11y-font-size')!.severity).toBe('warning');
  });

  it('ignores spacer rows', () => {
    // Regression: a `height/line-height/font-size:10px` spacer around a &nbsp;
    // was reported as "some text is 10px" on every single email.
    const { findings } = review(ctx({
      html: '<html lang="en"><td style="height:10px; line-height:10px; font-size:10px;">&nbsp;</td><p style="font-size:16px">Hi</p></html>',
    }));
    expect(findings.find((f) => f.id === 'a11y-font-size')!.severity).toBe('pass');
  });

  it('ignores the hidden preheader', () => {
    const { findings } = review(ctx({
      html: '<html lang="en"><div style="display:none; font-size:1px; color:#EEE">pre</div><p style="font-size:16px">Hi</p></html>',
    }));
    expect(findings.find((f) => f.id === 'a11y-font-size')!.severity).toBe('pass');
  });

  it('accepts conventional footer small print without nagging', () => {
    const { findings } = review(ctx({
      html: '<html lang="en"><p style="font-size:11px">Legal footer</p></html>',
    }));
    expect(findings.find((f) => f.id === 'a11y-font-size')!.severity).toBe('pass');
  });

  it('flags an image with no alt text as an error', () => {
    const { findings } = review(ctx({ html: '<html lang="en"><img src="a.png"></html>' }));
    const finding = findings.find((f) => f.id === 'a11y-alt-missing')!;
    expect(finding.severity).toBe('error');
  });

  it('accepts an image with alt text', () => {
    const { findings } = review(ctx({ html: '<html lang="en"><img src="a.png" alt="A chart"></html>' }));
    expect(ids(findings)).toContain('a11y-alt');
  });

  it('flags low contrast', () => {
    const { findings } = review(ctx({
      html: '<html lang="en"><p style="color:#BBBBBB; background-color:#FFFFFF">x</p></html>',
    }));
    expect(ids(findings)).toContain('a11y-contrast');
    expect(findings.find((f) => f.id === 'a11y-contrast')!.severity).toBe('warning');
  });

  it('says nothing when it cannot know the background', () => {
    // Regression: assuming white produced a confident 1.0:1 failure on the
    // white-on-navy header band of every email.
    const { findings } = review(ctx({
      html: '<html lang="en"><td style="background-color:#022D41"><p style="color:#FFFFFF">Title</p></td></html>',
    }));
    expect(ids(findings)).not.toContain('a11y-contrast');
  });

  it('flags skipped heading levels', () => {
    const { findings } = review(ctx({ body: '# Title\n\n### Sub' }));
    expect(ids(findings)).toContain('a11y-heading-order');
  });

  it('flags uninformative link text', () => {
    const { findings } = review(ctx({ html: '<html lang="en"><a href="https://e.com">click here</a></html>' }));
    expect(ids(findings)).toContain('a11y-link-text');
  });

  it('flags a missing lang attribute', () => {
    expect(ids(review(ctx({ html: '<html><body>x</body></html>' })).findings)).toContain('a11y-lang');
  });

  describe('contrastRatio', () => {
    it('computes the known extremes', () => {
      expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
      expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 0);
    });

    it('handles shorthand hex', () => {
      expect(contrastRatio('#000', '#FFF')).toBeCloseTo(21, 0);
    });

    it('returns null for something it cannot parse', () => {
      expect(contrastRatio('rebeccapurple', '#FFF')).toBeNull();
    });
  });
});

/* ------------------------------------------------------- deliverability */

describe('deliverability', () => {
  it('flags heavy promotional wording', () => {
    const { findings } = review(ctx({
      text: 'ACT NOW for this risk-free miracle cure, 100% guaranteed, buy now!',
      subject: 'Act now',
    }));
    expect(ids(findings)).toContain('spam-vocabulary');
  });

  it('leaves ordinary clinical wording alone', () => {
    const finding = review(ctx()).findings.find((f) => f.id === 'spam-vocabulary');
    expect(finding).toBeUndefined();
  });

  it('flags an all-caps subject', () => {
    expect(ids(review(ctx({ subject: 'PLEASE READ THIS NOW' })).findings)).toContain('all-caps');
  });

  it('flags an all-caps sentence in the body', () => {
    expect(ids(review(ctx({ text: 'THIS IS A GENUINELY SHOUTED SENTENCE OF TEXT' })).findings))
      .toContain('all-caps');
  });

  it('leaves the plain-text uppercase labels alone', () => {
    // Regression: buildText() uppercases eyebrows and h2 headings by design, so
    // "MONTHLY ROUNDUP" was flagged as shouting on every newsletter.
    const { findings } = review(ctx({
      text: [
        'MONTHLY ROUNDUP',
        '',
        'Hi there, here is the news of the month with plenty of words to read.',
        '',
        'ALSO THIS MONTH',
        '',
        'More text follows here so the volume check stays satisfied throughout.',
      ].join('\n'),
    }));
    expect(ids(findings)).not.toContain('all-caps');
  });

  it('flags repeated punctuation in the subject', () => {
    expect(ids(review(ctx({ subject: 'Important!!' })).findings)).toContain('punctuation');
  });

  it('treats a URL shortener as an error', () => {
    const { findings, ok } = review(ctx({ html: '<a href="https://bit.ly/abc">Book</a>' }));
    expect(ids(findings)).toContain('url-shortener');
    expect(ok).toBe(false);
  });

  it('flags plain http links', () => {
    expect(ids(review(ctx({ html: '<a href="http://e.com">Book</a>' })).findings))
      .toContain('insecure-link');
  });

  it('flags a thin email', () => {
    expect(ids(review(ctx({ text: 'Hi. Bye.' })).findings)).toContain('thin-content');
  });

  it('flags a missing subject as an error', () => {
    const { findings, ok } = review(ctx({ subject: '' }));
    expect(ids(findings)).toContain('subject-missing');
    expect(ok).toBe(false);
  });

  it('flags an over-long subject', () => {
    expect(ids(review(ctx({ subject: 'x'.repeat(70) })).findings)).toContain('subject-length');
  });

  it('flags emoji in the subject', () => {
    expect(ids(review(ctx({ subject: 'Your appointment 🎉' })).findings)).toContain('subject-emoji');
  });

  it('flags a missing preheader', () => {
    expect(ids(review(ctx({ preheader: '' })).findings)).toContain('preheader-missing');
  });
});

/* ------------------------------------------------------------ rendering */

describe('rendering', () => {
  it('flags styles Outlook ignores', () => {
    const { findings } = review(ctx({
      html: '<html lang="en"><div style="border-radius:8px; display:flex">x</div></html>',
    }));
    expect(ids(findings)).toContain('outlook-unsupported');
  });

  it('warns that padded links lose their button shape in Outlook', () => {
    const { findings } = review(ctx({
      html: '<html lang="en"><a href="https://e.com" style="padding:12px 20px">Book</a></html>',
    }));
    expect(ids(findings)).toContain('outlook-button');
  });

  it('accepts a padded link when a VML fallback is present', () => {
    const { findings } = review(ctx({
      html: '<html lang="en"><!--[if mso]><v:roundrect></v:roundrect><![endif]--><a href="https://e.com" style="padding:12px">Book</a></html>',
    }));
    expect(ids(findings)).not.toContain('outlook-button');
  });

  it('treats exceeding the Gmail limit as an error', () => {
    const { findings, ok } = review(ctx({ html: '<html lang="en">' + 'x'.repeat(103_000) + '</html>' }));
    expect(findings.find((f) => f.id === 'gmail-clipping')!.severity).toBe('error');
    expect(ok).toBe(false);
  });

  it('flags embedded images', () => {
    const { findings } = review(ctx({
      html: `<html lang="en"><img alt="x" src="data:image/png;base64,${'A'.repeat(4000)}"></html>`,
    }));
    expect(ids(findings)).toContain('data-uri');
  });

  it('flags an over-wide fixed layout', () => {
    expect(ids(review(ctx({ html: '<table style="width:800px">' })).findings)).toContain('width');
  });

  it('warns about near-black text inverting in dark mode', () => {
    expect(ids(review(ctx({ html: '<p style="color:#000000">x</p>' })).findings)).toContain('dark-mode');
  });

  it('does not treat a dark brand colour as near-black', () => {
    // Regression: /#0[0-9a-f]{5}/ matched #022D41, a perfectly readable navy.
    expect(ids(review(ctx({ html: '<p style="color:#022D41">x</p>' })).findings))
      .not.toContain('dark-mode');
  });
});

/* --------------------------------------------------------------- runner */

describe('runs in a browser, not just in Node', () => {
  // Regression: rendering.ts used Buffer.byteLength. Node has Buffer, so the
  // suite was green while the entire rendering group threw in the real app and
  // silently never ran — no Gmail clipping check, no Outlook check, nothing.
  it('does not depend on Node globals', () => {
    const saved = globalThis.Buffer;
    // @ts-expect-error - deliberately simulating a browser
    delete globalThis.Buffer;
    try {
      const result = review(ctx());
      expect(ids(result.findings)).not.toContain('check-failed');
      expect(ids(result.findings)).toContain('gmail-clipping');
    } finally {
      globalThis.Buffer = saved;
    }
  });

  it('reports honestly when a check does fail', () => {
    // Defined after the spread, so the getter fires inside review() rather than
    // while the fixture is being built.
    const context = ctx();
    Object.defineProperty(context, 'html', {
      get(): string { throw new Error('boom'); },
    });

    const result = review(context);
    const failed = result.findings.find((f) => f.id === 'check-failed');
    expect(failed?.detail).toContain('not fully reviewed');
    expect(failed?.detail).toContain('boom');
  });
});

describe('review runner', () => {
  it('sorts errors before warnings before passes', () => {
    const { findings } = review(ctx({ bulk: true, subject: '' }));
    const ranks = findings.map((f) => ['error', 'warning', 'pass'].indexOf(f.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('groups findings and reports the worst per group', () => {
    const { byGroup } = review(ctx({ bulk: true }));
    const compliance = byGroup.find((g) => g.group === 'compliance')!;
    expect(compliance.label).toBe('Compliance');
    expect(compliance.worst).toBe('error');
  });

  it('puts patient data first', () => {
    expect(review(ctx()).byGroup[0].group).toBe('phi');
  });

  it('lets warnings pass but not errors', () => {
    expect(review(ctx()).ok).toBe(true);
    expect(review(ctx({ subject: '' })).ok).toBe(false);
  });

  it('summarises in plain language', () => {
    expect(review(ctx({ subject: '' })).summary).toMatch(/problem/);
    expect(review(ctx()).summary).toMatch(/Nothing flagged|consider/);
  });

  it('runs well inside the keystroke budget', () => {
    const template = getTemplate('news-monthly')!;
    const { html, text, subject } = render(template, sampleValues(template));
    const context = ctx({ html, text, subject, body: template.body.repeat(8) });

    const started = performance.now();
    for (let i = 0; i < 20; i++) review(context);
    const perRun = (performance.now() - started) / 20;

    expect(perRun).toBeLessThan(150);
  });
});

describe('every shipped template survives its own review', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, template) => {
    const values = {
      ...sampleValues(template),
      practice_address: '123 Example St, Portland OR 97201',
      unsubscribe_url: 'https://example.com/unsubscribe',
    };
    const result = render(template, values);
    const { errors, findings } = review({
      body: template.body,
      subject: result.subject,
      preheader: template.preheader,
      html: result.html,
      text: result.text,
      bulk: template.bulk,
      fields: [],
      footer: template.bulk ? values.practice_address : '',
      unsubscribeUrl: template.bulk ? values.unsubscribe_url : '',
    });

    const blocking = findings.filter((f) => f.severity === 'error');
    expect(blocking.map((f) => `${f.id}: ${f.title}`)).toEqual([]);
    expect(errors).toBe(0);
  });
});
