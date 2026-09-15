import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SIGNATURE, SIGNATURE_FIELDS, SIGNATURE_SECTIONS,
  applyBrandToSignature, buildSignature, buildSignatureText, normalizeSignature,
  setSignatureValue, signatureSizeKb, type SignatureConfig,
} from '../src/signature/index.js';
import { DEFAULT_BRAND } from '../src/store/brand.js';

const filled: SignatureConfig = {
  ...DEFAULT_SIGNATURE,
  name: 'Jordan Rivera',
  creds: 'LCSW',
  title: 'Clinical Care Coordinator',
  email: 'hello@example.com',
  org: 'Cedar Grove Health',
  showemail: true,
  builtinlogo: false,
};

describe('signature engine', () => {
  it('builds table-based HTML', () => {
    const html = buildSignature(filled);
    expect(html).toContain('<table');
    // No modern CSS: Outlook renders signatures with the Word engine too.
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
  });

  it('includes the person and the practice', () => {
    const html = buildSignature(filled);
    expect(html).toContain('Jordan Rivera');
    expect(html).toContain('LCSW');
    expect(html).toContain('Clinical Care Coordinator');
    expect(html).toContain('Cedar Grove Health');
  });

  it('escapes user input rather than trusting it', () => {
    const html = buildSignature({ ...filled, name: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('honours the show/hide toggles', () => {
    expect(buildSignature({ ...filled, showemail: true })).toContain('hello@example.com');
    expect(buildSignature({ ...filled, showemail: false })).not.toContain('hello@example.com');

    const withButton = buildSignature({ ...filled, showbooking: true, bookinglabel: 'Book now' });
    expect(withButton).toContain('Book now');
    expect(buildSignature({ ...filled, showbooking: false })).not.toContain('Book now');
  });

  it('adds the legal footers only when asked', () => {
    expect(buildSignature({ ...filled, crisis: true })).toContain('988');
    expect(buildSignature({ ...filled, crisis: false })).not.toContain('988');
  });

  it('renders every layout without throwing', () => {
    for (const layout of ['photo', 'stack'] as const) {
      expect(() => buildSignature({ ...filled, layout })).not.toThrow();
      expect(buildSignature({ ...filled, layout }).length).toBeGreaterThan(400);
    }
  });

  it('produces a plain-text fallback with no markup', () => {
    const text = buildSignatureText(filled);
    expect(text).toContain('Jordan Rivera');
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('survives an empty config instead of crashing', () => {
    // The form starts blank; a half-filled signature must still preview.
    expect(() => buildSignature({ ...DEFAULT_SIGNATURE })).not.toThrow();
  });

  it('works without a DOM, so icons degrade rather than break', () => {
    // The generator draws social icons on a canvas. In Node there is none, so
    // the extraction guards it — the signature still builds.
    expect(typeof document).toBe('undefined');
    expect(buildSignature({ ...filled, bubbles: true })).toContain('Jordan Rivera');
  });

  it('stays a sensible size', () => {
    expect(signatureSizeKb(buildSignature(filled))).toBeLessThan(20);
  });
});

describe('signature form schema', () => {
  it('has a definition for every key it claims', () => {
    for (const field of SIGNATURE_FIELDS) {
      expect(DEFAULT_SIGNATURE, `${field.key} missing a default`).toHaveProperty(field.key);
    }
  });

  it('puts personal fields first and practice settings behind a collapse', () => {
    // The point of the grouping: a person filling this in answers a handful of
    // questions rather than scrolling thirty settings.
    expect(SIGNATURE_SECTIONS[0].title).toBe('You');
    expect(SIGNATURE_SECTIONS[0].collapsed).toBeFalsy();
    for (const section of SIGNATURE_SECTIONS.slice(1)) {
      expect(section.collapsed, `${section.title} should start collapsed`).toBe(true);
    }
  });

  it('keeps the uncollapsed section short', () => {
    expect(SIGNATURE_SECTIONS[0].fields.length).toBeLessThanOrEqual(9);
  });

  it('offers options the generator actually understands', () => {
    // The bug this exists to prevent: the schema shipped layout values of
    // "photo-left" / "stacked" / "compact" while the generator only branches on
    // "photo" and "stack". Selecting "Stacked" silently did nothing.
    //
    // Rather than duplicate the generator's branches here, assert the property
    // that matters: every option must change the output. Two options that
    // render identically mean at least one of them is dead.
    for (const field of SIGNATURE_FIELDS) {
      if (field.type !== 'select') continue;
      const options = field.options ?? [];
      expect(options.length, `${field.key} has no options`).toBeGreaterThan(1);

      const rendered = new Map<string, string>();
      for (const option of options) {
        // With a logo present, so options that only differ when one exists
        // (logo position) are actually exercised.
        const html = buildSignature({ ...filled, builtinlogo: true, [field.key]: option.value });
        for (const [otherValue, otherHtml] of rendered) {
          expect(
            html,
            `${field.key}: "${option.value}" renders identically to "${otherValue}" — one of them is not a value the generator understands`,
          ).not.toBe(otherHtml);
        }
        rendered.set(option.value, html);
      }
    }
  });

  it('defaults to option values the schema itself offers', () => {
    for (const field of SIGNATURE_FIELDS) {
      if (field.type !== 'select') continue;
      const values = (field.options ?? []).map((o) => o.value);
      expect(values, `default ${String(field.key)} is not an offered option`)
        .toContain(DEFAULT_SIGNATURE[field.key]);
    }
  });
});

describe('the default signature', () => {
  // The repository is public, so the default must be placeholders. Checked as
  // an allowlist, so the guard itself never has to name a real person.
  it('ships placeholders, not a real practice or clinician', () => {
    expect(DEFAULT_SIGNATURE).toMatchObject({ creds: '', states: '', tagline: '', fax: '', fb: '', ig: '', newsletter: '', logo: '' });
    for (const url of [DEFAULT_SIGNATURE.email, DEFAULT_SIGNATURE.site, DEFAULT_SIGNATURE.booking]) {
      expect(url).toMatch(/(^|[@.\/])example\.com(\/|$)/);
    }
    expect(DEFAULT_SIGNATURE).toMatchObject({
      name: 'Your Name',
      email: 'hello@example.com',
      org: 'Your Practice',
      phone: '555-555-0100',
      site: 'https://www.example.com',
      booking: 'https://www.example.com/book',
    });
  });

  it('matches the original brand colours', () => {
    // These were transposed in an earlier version: accent and rule swapped,
    // and the pill colour had the navy in it.
    expect(DEFAULT_SIGNATURE.inkc).toBe('#022D41');
    expect(DEFAULT_SIGNATURE.accent).toBe('#5B858D');
    expect(DEFAULT_SIGNATURE.rule).toBe('#88BDBC');
    expect(DEFAULT_SIGNATURE.bubble).toBe('#CBE2DF');
    expect(DEFAULT_SIGNATURE.logow).toBe('84');
  });

  it('turns on the notices the practice sends by default', () => {
    expect(DEFAULT_SIGNATURE.crisis).toBe(true);
    expect(DEFAULT_SIGNATURE.disclaimer).toBe(true);
    expect(DEFAULT_SIGNATURE.indep).toBe(false);
    expect(DEFAULT_SIGNATURE.showbooking).toBe(false);
    expect(DEFAULT_SIGNATURE.showemail).toBe(false);
  });

  it('renders a complete signature with no edits at all', () => {
    const html = buildSignature(DEFAULT_SIGNATURE);
    expect(html).toContain('Your Name');
    expect(html).toContain('555-555-0100');
    expect(html).toContain('example.com');
    expect(html).toContain('988');
    expect(html).not.toMatch(/\{\{/);
  });

  it('adds the newsletter link only once one is set', () => {
    expect(DEFAULT_SIGNATURE.newsletter).toBe('');
    expect(buildSignature(DEFAULT_SIGNATURE)).not.toContain('Newsletter signup');
    expect(buildSignature({ ...DEFAULT_SIGNATURE, newsletter: 'https://example.com/newsletter' }))
      .toContain('Newsletter signup');
  });

  it('keeps the built-in logo available but off by default', () => {
    expect(DEFAULT_SIGNATURE.builtinlogo).toBe(false);
    expect(buildSignature(DEFAULT_SIGNATURE)).not.toContain('data:image/png;base64');
    expect(buildSignature({ ...DEFAULT_SIGNATURE, builtinlogo: true })).toContain('data:image/png;base64');
  });
});

describe('a config saved by an older build', () => {
  it('drops select values this build no longer understands', () => {
    // The exact stale state that shipped: "photo-left" is not a value the
    // generator branches on, so trusting it renders the wrong signature.
    const stale = normalizeSignature({ layout: 'photo-left', logopos: 'below' });
    expect(stale.layout).toBe('photo');
    expect(stale.logopos).toBe('under');
  });

  it('keeps select values that are still valid', () => {
    expect(normalizeSignature({ layout: 'stack' }).layout).toBe('stack');
  });

  it('keeps ordinary text and checkbox values', () => {
    const kept = normalizeSignature({ name: 'Jordan Lee', crisis: false });
    expect(kept.name).toBe('Jordan Lee');
    expect(kept.crisis).toBe(false);
  });

  it('ignores values of the wrong type instead of trusting them', () => {
    const out = normalizeSignature({ name: 42, crisis: 'yes', logow: null });
    expect(out.name).toBe(DEFAULT_SIGNATURE.name);
    expect(out.crisis).toBe(DEFAULT_SIGNATURE.crisis);
    expect(out.logow).toBe(DEFAULT_SIGNATURE.logow);
  });

  it('falls back entirely for junk input', () => {
    expect(normalizeSignature(null)).toEqual(DEFAULT_SIGNATURE);
    expect(normalizeSignature('nonsense')).toEqual(DEFAULT_SIGNATURE);
  });

  it('preserves an embedded headshot across a reload', () => {
    const photo = 'data:image/jpeg;base64,AAAA';
    expect(normalizeSignature({ photoData: photo }).photoData).toBe(photo);
  });

  it('always yields a config that renders', () => {
    expect(() => buildSignature(normalizeSignature({ layout: 'nope', font: 'nope' })))
      .not.toThrow();
  });
});

describe('practice profile fills the signature', () => {
  const brand = { ...DEFAULT_BRAND, sender_name: 'Jordan Lee', sender_title: 'Coordinator' };

  it('fills blanks from the profile', () => {
    const out = applyBrandToSignature({ ...DEFAULT_SIGNATURE, name: '', title: '' }, brand);
    expect(out.name).toBe('Jordan Lee');
    expect(out.title).toBe('Coordinator');
  });

  it('replaces the shipped placeholder name with the profile owner', () => {
    // The default ships placeholder details, so the profile wins — the same
    // precedence templates use for their sample values.
    const out = applyBrandToSignature({ ...DEFAULT_SIGNATURE }, brand);
    expect(out.name).toBe('Jordan Lee');
    expect(out.title).toBe('Coordinator');
  });

  it('never overwrites something the user actually typed', () => {
    const out = applyBrandToSignature({ ...DEFAULT_SIGNATURE, name: 'Mine' }, brand);
    expect(out.name).toBe('Mine');
  });

  it('keeps the default when the profile has nothing to say', () => {
    const out = applyBrandToSignature({ ...DEFAULT_SIGNATURE }, { ...brand, sender_name: '' });
    expect(out.name).toBe(DEFAULT_SIGNATURE.name);
  });
});

describe('setSignatureValue', () => {
  it('writes without losing types', () => {
    const config = { ...DEFAULT_SIGNATURE };
    setSignatureValue(config, 'name', 'Sam');
    setSignatureValue(config, 'round', false);
    expect(config.name).toBe('Sam');
    expect(config.round).toBe(false);
  });
});
