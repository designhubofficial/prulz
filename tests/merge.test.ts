import { describe, it, expect } from 'vitest';
import {
  extractFields, reconcileFields, formatValue, validateFields,
  resolve, guardExport, unresolvedTokens, type FieldDef,
} from '../src/merge/index.js';

const fields: FieldDef[] = [
  { key: 'first_name', label: 'First name', type: 'text', sample: 'Alex' },
  { key: 'appt_date', label: 'Appointment date', type: 'date', sample: '2026-03-04' },
  { key: 'appt_time', label: 'Appointment time', type: 'time', sample: '14:30' },
  { key: 'copay', label: 'Copay', type: 'money', sample: '35' },
  { key: 'phone', label: 'Phone', type: 'phone', sample: '5035550100' },
  { key: 'email', label: 'Email', type: 'email', sample: 'a@example.com' },
  { key: 'link', label: 'Link', type: 'url', sample: 'https://example.com' },
  { key: 'note', label: 'Note', type: 'text', required: false },
];

describe('extractFields', () => {
  it('finds each token once, in order of first use', () => {
    expect(extractFields('{{b}} then {{a}} then {{b}} again')).toEqual(['b', 'a']);
  });

  it('tolerates internal whitespace', () => {
    expect(extractFields('{{ spaced }}')).toEqual(['spaced']);
  });

  it('reads across several texts', () => {
    expect(extractFields('{{a}}', undefined, '{{b}}')).toEqual(['a', 'b']);
  });

  it('returns nothing for text with no tokens', () => {
    expect(extractFields('plain text')).toEqual([]);
  });
});

describe('reconcileFields', () => {
  it('invents a sensible definition for an undeclared token', () => {
    const [field] = reconcileFields([], ['Hello {{patient_first_name}}']);
    expect(field).toMatchObject({ key: 'patient_first_name', type: 'text', required: true });
    expect(field.label).toBe('Patient first name');
  });

  it('drops declared fields the body never uses', () => {
    const out = reconcileFields(fields, ['Only {{first_name}} here']);
    expect(out.map((f) => f.key)).toEqual(['first_name']);
  });
});

describe('formatValue', () => {
  it('writes dates the way a person reads them', () => {
    expect(formatValue('date', '2026-03-04')).toBe('Wednesday, March 4');
  });

  it('treats a date-only string as a local calendar date, not a UTC instant', () => {
    // The classic off-by-one: `new Date('2026-01-01')` is UTC midnight, which is
    // the previous day in every US timezone.
    expect(formatValue('date', '2026-01-01')).toContain('January 1');
  });

  it('converts 24-hour time to 12-hour', () => {
    expect(formatValue('time', '14:30')).toBe('2:30 PM');
    expect(formatValue('time', '09:05')).toBe('9:05 AM');
    expect(formatValue('time', '00:15')).toBe('12:15 AM');
    expect(formatValue('time', '12:00')).toBe('12:00 PM');
  });

  it('formats money as currency', () => {
    expect(formatValue('money', '35')).toBe('$35.00');
    expect(formatValue('money', '$1200.5')).toBe('$1,200.50');
  });

  it('formats phone numbers, with or without a country code', () => {
    expect(formatValue('phone', '5035550100')).toBe('503-555-0100');
    expect(formatValue('phone', '15035550100')).toBe('503-555-0100');
  });

  it('passes through anything it cannot parse rather than mangling it', () => {
    expect(formatValue('date', 'next Tuesday')).toBe('next Tuesday');
    expect(formatValue('time', 'noon')).toBe('noon');
    expect(formatValue('phone', 'ext 4')).toBe('ext 4');
  });

  it('returns empty for empty input', () => {
    expect(formatValue('date', '   ')).toBe('');
  });
});

describe('validateFields', () => {
  const full = {
    first_name: 'Alex', appt_date: '2026-03-04', appt_time: '14:30',
    copay: '35', phone: '5035550100', email: 'a@example.com', link: 'https://example.com',
  };

  it('accepts a fully valid set', () => {
    expect(validateFields(fields, full)).toEqual([]);
  });

  it('reports every empty required field', () => {
    const problems = validateFields(fields, {});
    expect(problems.every((p) => p.reason === 'missing')).toBe(true);
    expect(problems.map((p) => p.key)).not.toContain('note'); // optional
  });

  it('rejects malformed emails, urls and phones', () => {
    const problems = validateFields(fields, { ...full, email: 'nope', link: 'example.com', phone: '123' });
    expect(problems.map((p) => p.key).sort()).toEqual(['email', 'link', 'phone']);
    expect(problems.every((p) => p.reason === 'invalid')).toBe(true);
  });

  it('enforces choice options', () => {
    const choice: FieldDef[] = [{ key: 's', label: 'Status', type: 'choice', options: ['a', 'b'] }];
    expect(validateFields(choice, { s: 'c' })).toHaveLength(1);
    expect(validateFields(choice, { s: 'a' })).toHaveLength(0);
  });

  it('treats whitespace as empty', () => {
    expect(validateFields([fields[0]], { first_name: '   ' })[0].reason).toBe('missing');
  });

  it('validates image URLs like URLs', () => {
    const image: FieldDef[] = [{ key: 'photo_url', label: 'Photo', type: 'image' }];
    expect(validateFields(image, { photo_url: 'https://images.unsplash.com/photo-1?w=800' })).toHaveLength(0);
    expect(validateFields(image, { photo_url: 'images.unsplash.com/photo-1' })[0].reason).toBe('invalid');
    expect(validateFields(image, { photo_url: '' })[0].reason).toBe('missing');
  });
});

describe('resolve', () => {
  it('substitutes and formats by declared type', () => {
    const out = resolve('Hi {{first_name}}, see you {{appt_date}} at {{appt_time}}.', fields, {
      first_name: 'Alex', appt_date: '2026-03-04', appt_time: '14:30',
    });
    expect(out).toBe('Hi Alex, see you Wednesday, March 4 at 2:30 PM.');
  });

  it('leaves unfilled tokens in place so the gate can catch them', () => {
    expect(resolve('Hi {{first_name}}', fields, {})).toBe('Hi {{first_name}}');
  });

  it('uses samples only when previewing', () => {
    expect(resolve('Hi {{first_name}}', fields, {}, { useSamples: true })).toBe('Hi Alex');
  });

  it('passes through a token with no definition', () => {
    expect(resolve('{{mystery}}', fields, { mystery: 'kept' })).toBe('kept');
  });
});

describe('guardExport', () => {
  const full = {
    first_name: 'Alex', appt_date: '2026-03-04', appt_time: '14:30',
    copay: '35', phone: '5035550100', email: 'a@example.com', link: 'https://example.com',
  };

  it('passes when everything resolves', () => {
    const gate = guardExport(fields, full, resolve('{{first_name}}', fields, full));
    expect(gate.ok).toBe(true);
    expect(gate.summary).toBe('Ready to send.');
  });

  it('BLOCKS rather than warns when a required field is empty', () => {
    const gate = guardExport(fields, {}, 'Dear {{first_name}}');
    expect(gate.ok).toBe(false);
    expect(gate.missing.map((m) => m.key)).toContain('first_name');
    expect(gate.summary).toMatch(/^Cannot export/);
  });

  it('catches a token that survived into the rendered output', () => {
    // The exact failure this whole mechanism exists to prevent.
    const gate = guardExport([], {}, 'Dear {{patient_first_name}}, your visit is soon.');
    expect(gate.ok).toBe(false);
    expect(gate.unresolved).toContain('patient_first_name');
    expect(gate.summary).toContain('patient_first_name');
  });

  it('reports invalid values separately from missing ones', () => {
    const gate = guardExport(fields, { ...full, email: 'bad' }, 'ok');
    expect(gate.missing).toHaveLength(0);
    expect(gate.invalid).toHaveLength(1);
    expect(gate.ok).toBe(false);
  });

  it('checks every text it is given', () => {
    const gate = guardExport([], {}, 'clean subject', 'body with {{leak}}');
    expect(gate.unresolved).toEqual(['leak']);
  });
});

describe('unresolvedTokens', () => {
  it('reports what is left behind', () => {
    expect(unresolvedTokens('a {{x}} b {{y}}')).toEqual(['x', 'y']);
    expect(unresolvedTokens('nothing here')).toEqual([]);
  });
});
