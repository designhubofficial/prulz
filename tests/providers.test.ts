import { describe, expect, it } from 'vitest';
import { TEMPLATES, fieldsFor, render, sampleValues, search } from '../src/library/providers.js';

describe('provider correspondence', () => {
  it.each(TEMPLATES)('$name renders a complete provider email', template => {
    const result = render(template, sampleValues(template));
    expect(result.gate.ok).toBe(true);
    expect(result.text).toContain('Dr. Morgan');
    expect(result.html).not.toContain('{{');
    expect(result.subject.length).toBeGreaterThan(5);
    expect(template.bulk).toBe(false);
  });
  it.each(TEMPLATES)('$name blocks export without the recipient', template => {
    const values = sampleValues(template);
    delete values.recipient_name;
    expect(render(template, values).gate.ok).toBe(false);
  });
  it('escapes recipient input in the rendered email', () => {
    const t = TEMPLATES[0];
    const result = render(t, { ...sampleValues(t), recipient_name: '<script>alert(1)</script>' });
    expect(result.html).not.toContain('<script>');
  });
  it('provides a recipient field and stable distinct IDs', () => {
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
    expect(TEMPLATES.every(t => fieldsFor(t).some(f => f.key === 'recipient_name'))).toBe(true);
    expect(search('referral').length).toBeGreaterThan(0);
    expect(search('unmatched-query')).toEqual([]);
  });
});
