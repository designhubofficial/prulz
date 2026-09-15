/**
 * Every shipped template is held to the standard the tool enforces on users.
 * The library is the reference implementation: if a starter cannot pass its own
 * checks, the checks are wrong or the template is.
 */
import { describe, it, expect } from 'vitest';
import {
  TEMPLATES, CATEGORY_LABELS, fieldsFor, render, sampleValues,
  byCategory, search, getTemplate, type Category,
} from '../src/library/index.js';
import { THEMES, PALETTES } from '../src/engine/index.js';
import { extractFields } from '../src/merge/index.js';

describe('library integrity', () => {
  it('ships a usable number of templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(35);
  });

  it('has unique ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every category', () => {
    for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
      expect(byCategory(category).length, `no templates in ${category}`).toBeGreaterThan(0);
    }
  });

  it('includes the marketing and newsletter categories the team asked for', () => {
    expect(byCategory('marketing').length).toBeGreaterThanOrEqual(5);
    expect(byCategory('newsletter').length).toBeGreaterThanOrEqual(5);
  });

  it('references only real themes and palettes', () => {
    for (const t of TEMPLATES) {
      expect(Object.keys(THEMES), `${t.id} theme`).toContain(t.theme);
      expect(Object.keys(PALETTES), `${t.id} palette`).toContain(t.palette);
    }
  });
});

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('template %s', (id, template) => {
  const fields = fieldsFor(template);

  it('has the metadata the library card needs', () => {
    expect(template.name.length).toBeGreaterThan(3);
    expect(template.description.length).toBeGreaterThan(10);
    expect(template.preheader.length).toBeGreaterThan(0);
  });

  it('declares every merge field it uses', () => {
    const used = extractFields(template.body, template.preheader);
    const declared = new Set(fields.map((f) => f.key));
    for (const key of used) {
      expect(declared.has(key), `${id} uses {{${key}}} with no definition`).toBe(true);
    }
  });

  it('gives every field a sample so previews are never empty', () => {
    for (const field of fields) {
      expect(field.sample, `${id}.${field.key} has no sample`).toBeTruthy();
    }
  });

  it('parses to a subject and a body', () => {
    const result = render(template, sampleValues(template), { preview: true });
    expect(result.subject.length, `${id} has no subject line`).toBeGreaterThan(3);
    expect(result.html).toContain('<!DOCTYPE html');
    expect(result.text.length).toBeGreaterThan(40);
  });

  it('resolves completely when every field is filled', () => {
    const result = render(template, sampleValues(template));
    expect(result.gate.summary).toBe('Ready to send.');
    expect(result.gate.ok).toBe(true);
    expect(result.html).not.toMatch(/\{\{/);
    expect(result.text).not.toMatch(/\{\{/);
  });

  it('refuses to export while fields are empty', () => {
    const result = render(template, {});
    expect(result.gate.ok).toBe(false);
    expect(result.gate.missing.length).toBeGreaterThan(0);
  });

  it('contains no real contact details or patient data', () => {
    const body = template.body;
    // Placeholder domains only - a starter must never carry a live address.
    for (const email of body.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) ?? []) {
      expect(email, `${id} contains a non-example email`).toMatch(/example\.(com|org)$/);
    }
    expect(body, `${id} contains an SSN-shaped string`).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    expect(body, `${id} contains a date of birth`).not.toMatch(/\bDOB\b/i);
    expect(body, `${id} contains a medical record number`).not.toMatch(/\bMRN\b/i);
  });

  it('names one practice, not two', () => {
    // The masthead used to keep the engine's default while the body used the
    // supplied practice name.
    const values = { ...sampleValues(template), practice_name: 'Cedar Clinic' };
    const { html } = render(template, values);
    expect(html).not.toContain('UpWell Psychiatry');
  });

  it('stays well under the Gmail clipping limit', () => {
    const { html } = render(template, sampleValues(template));
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(102_000);
  });
});

describe('bulk templates carry their CAN-SPAM obligations', () => {
  const bulk = TEMPLATES.filter((t) => t.bulk);

  it('marks the marketing and newsletter templates as bulk', () => {
    for (const t of TEMPLATES) {
      if (t.category === 'marketing' || t.category === 'newsletter') {
        expect(t.bulk, `${t.id} should be marked bulk`).toBe(true);
      }
    }
  });

  it('renders a postal address and unsubscribe link when supplied', () => {
    for (const template of bulk) {
      const { html } = render(template, sampleValues(template), {
        footer: 'Example Health, 123 Example St, Portland OR 97201',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      });
      expect(html, `${template.id} footer`).toContain('123 Example St');
      expect(html, `${template.id} unsubscribe`).toContain('https://example.com/unsubscribe');
    }
  });

  it('asks for the postal address and unsubscribe link on the fill form', () => {
    for (const template of bulk) {
      const keys = fieldsFor(template).map((f) => f.key);
      expect(keys, `${template.id}`).toContain('practice_address');
      expect(keys, `${template.id}`).toContain('unsubscribe_url');
    }
  });

  it('fills the footer from those fields without leaking a placeholder', () => {
    // Regression: the footer was previously injected as the literal string
    // "{{practice_address}}" and never resolved, and because the gate only
    // inspected the body and preheader it still reported "Ready to send".
    for (const template of bulk) {
      const result = render(template, sampleValues(template));
      expect(result.html, `${template.id} leaked a placeholder`).not.toMatch(/\{\{/);
      expect(result.gate.ok, `${template.id} gate`).toBe(true);
      expect(result.html).toContain('123 Example St');
    }
  });

  it('blocks export when a placeholder reaches the output by any path', () => {
    const template = bulk[0];
    const values = sampleValues(template);
    delete values.practice_address;
    const result = render(template, values);
    expect(result.gate.ok).toBe(false);
    expect(result.gate.missing.map((m) => m.key)).toContain('practice_address');
  });

  it('never marks one-to-one outreach as bulk', () => {
    // These go to a named individual. Treating them as bulk would be both
    // wrong and a CAN-SPAM problem waiting to happen.
    for (const t of byCategory('outreach')) {
      expect(t.bulk, `${t.id} is one-to-one and must not be bulk`).toBe(false);
    }
    for (const t of byCategory('coordination')) {
      expect(t.bulk).toBe(false);
    }
  });
});

describe('lookup helpers', () => {
  it('finds a template by id', () => {
    expect(getTemplate('news-monthly')?.name).toBe('Monthly newsletter');
    expect(getTemplate('nope')).toBeUndefined();
  });

  it('searches name, description and body', () => {
    expect(search('newsletter').length).toBeGreaterThan(0);
    expect(search('zzzznotathing')).toHaveLength(0);
    expect(search('')).toHaveLength(TEMPLATES.length);
  });
});

describe('shared email identity', () => {
  it('places the saved PNG logo where chosen without changing authored sign-offs', () => {
    const template = getTemplate('sch-reminder')!;
    const values = sampleValues(template);
    const logo = 'https://example.com/upwell-logo.png';
    const header = render(template, values, {
      logo,
      logoWidth: 84,
      logoPlacement: 'header',
    });
    const above = render(template, values, {
      logo,
      logoWidth: 84,
      logoPlacement: 'above',
    });
    const footer = render(template, values, {
      logo,
      logoWidth: 84,
      logoPlacement: 'footer',
    });
    const hidden = render(template, values, {
      logo,
      logoWidth: 84,
      logoPlacement: 'hidden',
    });

    expect(header.html).toContain(`src="${logo}"`);
    expect(above.html).toContain(`src="${logo}"`);
    expect(footer.html).toContain(`src="${logo}"`);
    expect(hidden.html).not.toContain(`src="${logo}"`);
    expect(above.html.indexOf(`src="${logo}"`))
      .toBeLessThan(above.html.indexOf('<h1'));
    expect(footer.html.indexOf(`src="${logo}"`))
      .toBeGreaterThan(footer.html.indexOf(`${values.practice_name} | ${values.practice_phone}`));
    expect(header.text).toContain(String(values.practice_name));
    expect(header.gate.ok).toBe(true);
  });

  it('renders editable banner copy, a CTA, and a responsive gallery', () => {
    const template = getTemplate('sch-reminder')!;
    const result = render(template, sampleValues(template), {
      banner: {
        style: 'soft',
        eyebrow: 'A calmer next step',
        title: 'Your visit is coming up',
        subtitle: 'A few details to make the day easy.',
      },
      customBlocks: [
        '[Button: Open your care plan | https://example.com/plan]',
        '[Gallery: two | https://example.com/one.png | A quiet room | One | https://example.com/two.png | A welcoming team | Two]',
      ].join('\n\n'),
    });

    expect(result.html).toContain('A calmer next step');
    expect(result.html).toContain('Your visit is coming up');
    expect(result.html).toContain('href="https://example.com/plan"');
    expect(result.html).toContain('src="https://example.com/one.png"');
    expect(result.html).toContain('src="https://example.com/two.png"');
    expect(result.text).toContain('Open your care plan: https://example.com/plan');
    expect(result.text).toContain('Gallery:');
    expect(result.gate.ok).toBe(true);
  });
});
