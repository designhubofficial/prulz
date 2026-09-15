/**
 * Merge fields.
 *
 * A template holds `{{placeholders}}`, never literal patient data. This module
 * finds them, validates the values supplied for them, and substitutes them.
 *
 * The important rule lives in `guardExport`: if a required field is still
 * unresolved, export is BLOCKED rather than warned about. The failure this
 * prevents is sending "Dear {{patient_first_name}}" to a real patient.
 */

export type FieldType =
  | 'text' | 'date' | 'time' | 'datetime'
  | 'phone' | 'email' | 'url' | 'money' | 'choice' | 'image';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Blocks export when missing. Defaults to true. */
  required?: boolean;
  /** Shown in previews before the user types anything real. */
  sample?: string;
  /** Filled automatically from the brand profile, e.g. `practice_name`. */
  fromBrand?: boolean;
  /** Allowed values, for type `choice`. */
  options?: string[];
  help?: string;
}

export type FieldValues = Record<string, string>;

/** Matches `{{field_name}}`, tolerating internal whitespace. */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Every distinct field key referenced in the given text, in order of first use. */
export function extractFields(...texts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(TOKEN)) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
  }
  return order;
}

/**
 * Reconcile a declared manifest against what the body actually references.
 * Templates edited by hand drift, so undeclared fields get a sensible default
 * rather than being silently dropped.
 */
export function reconcileFields(declared: FieldDef[], texts: Array<string | undefined>): FieldDef[] {
  const used = extractFields(...texts);
  const byKey = new Map(declared.map((f) => [f.key, f]));
  const out: FieldDef[] = [];

  for (const key of used) {
    out.push(byKey.get(key) ?? { key, label: humanize(key), type: 'text', required: true });
  }
  // Keep declared-but-unused fields out of the fill form; they only add noise.
  return out;
}

function humanize(key: string): string {
  const words = key.replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------- formatting */

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long', month: 'long', day: 'numeric',
};

/**
 * Render a raw input value the way it should read in an email.
 * A `date` of `2026-03-04` becomes "Wednesday, March 4" — a patient should
 * never have to parse an ISO string.
 */
export function formatValue(type: FieldType, raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  switch (type) {
    case 'date': {
      const d = parseDateOnly(value);
      return d ? d.toLocaleDateString('en-US', LONG_DATE) : value;
    }
    case 'time': {
      const t = parseTimeOnly(value);
      return t ?? value;
    }
    case 'datetime': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return `${d.toLocaleDateString('en-US', LONG_DATE)} at ${d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      })}`;
    }
    case 'money': {
      const n = Number(value.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n)
        ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        : value;
    }
    case 'image':
      // The URL is inserted verbatim into the email's <img src>, so no
      // reformatting — but see validateFields for the http(s) requirement.
      return value;
    case 'phone': {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
      if (digits.length === 11 && digits.startsWith('1')) {
        return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
      }
      return value;
    }
    default:
      return value;
  }
}

/** `YYYY-MM-DD` parsed as a local calendar date, not a UTC instant. */
function parseDateOnly(value: string): Date | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `14:30` becomes `2:30 PM`. */
function parseTimeOnly(value: string): string | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2];
  if (h > 23 || Number(min) > 59) return null;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
}

/* ------------------------------------------------------------- validation */

export interface FieldProblem {
  key: string;
  label: string;
  reason: 'missing' | 'invalid';
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

export function validateFields(fields: FieldDef[], values: FieldValues): FieldProblem[] {
  const problems: FieldProblem[] = [];

  for (const field of fields) {
    const raw = (values[field.key] ?? '').trim();
    const required = field.required !== false;

    if (!raw) {
      if (required) {
        problems.push({
          key: field.key, label: field.label, reason: 'missing',
          message: `${field.label} is required.`,
        });
      }
      continue;
    }

    const invalid = (message: string) =>
      problems.push({ key: field.key, label: field.label, reason: 'invalid', message });

    if (field.type === 'email' && !EMAIL_RE.test(raw)) {
      invalid(`${field.label} does not look like an email address.`);
    } else if ((field.type === 'url' || field.type === 'image') && !URL_RE.test(raw)) {
      invalid(`${field.label} must be a full URL starting with http:// or https://.`);
    } else if (field.type === 'phone' && raw.replace(/\D/g, '').length < 10) {
      invalid(`${field.label} needs at least 10 digits.`);
    } else if (field.type === 'date' && !parseDateOnly(raw)) {
      invalid(`${field.label} is not a date we can read.`);
    } else if (field.type === 'choice' && field.options && !field.options.includes(raw)) {
      invalid(`${field.label} must be one of: ${field.options.join(', ')}.`);
    }
  }

  return problems;
}

/* ----------------------------------------------------------- substitution */

export interface ResolveOptions {
  /** Use each field's `sample` where no value was supplied. For previews only. */
  useSamples?: boolean;
  /** Leave unknown tokens in place instead of blanking them. Default true. */
  keepUnknown?: boolean;
}

/** Substitute `{{tokens}}`, formatting each value according to its declared type. */
export function resolve(
  text: string,
  fields: FieldDef[],
  values: FieldValues,
  options: ResolveOptions = {},
): string {
  const { useSamples = false, keepUnknown = true } = options;
  const byKey = new Map(fields.map((f) => [f.key, f]));

  return text.replace(TOKEN, (token, key: string) => {
    const field = byKey.get(key);
    const raw = values[key] ?? (useSamples ? field?.sample ?? '' : '');
    if (!raw) return keepUnknown ? token : '';
    return field ? formatValue(field.type, raw) : raw;
  });
}

/** Tokens still present after substitution — the export blocker. */
export function unresolvedTokens(text: string): string[] {
  return extractFields(text);
}

/* ------------------------------------------------------------ export gate */

export interface ExportGate {
  ok: boolean;
  /** Required fields with no value. */
  missing: FieldProblem[];
  /** Values that are present but malformed. */
  invalid: FieldProblem[];
  /** Tokens left in the rendered output, whatever their origin. */
  unresolved: string[];
  /** One line suitable for showing directly in the UI. */
  summary: string;
}

/**
 * The guard every export path runs first.
 *
 * Deliberately blocking, not advisory: a warning that can be clicked past is
 * how "Dear {{patient_first_name}}" reaches a patient's inbox.
 */
export function guardExport(
  fields: FieldDef[],
  values: FieldValues,
  ...renderedTexts: string[]
): ExportGate {
  const problems = validateFields(fields, values);
  const missing = problems.filter((p) => p.reason === 'missing');
  const invalid = problems.filter((p) => p.reason === 'invalid');

  const unresolved = new Set<string>();
  for (const text of renderedTexts) {
    for (const key of unresolvedTokens(text)) unresolved.add(key);
  }

  const leftover = [...unresolved];
  const ok = missing.length === 0 && invalid.length === 0 && leftover.length === 0;

  return { ok, missing, invalid, unresolved: leftover, summary: summarize(missing, invalid, leftover) };
}

function summarize(missing: FieldProblem[], invalid: FieldProblem[], unresolved: string[]): string {
  if (!missing.length && !invalid.length && !unresolved.length) return 'Ready to send.';

  const parts: string[] = [];
  if (missing.length) {
    parts.push(`${missing.length} required field${missing.length === 1 ? '' : 's'} still empty`);
  }
  if (invalid.length) {
    parts.push(`${invalid.length} field${invalid.length === 1 ? '' : 's'} need${invalid.length === 1 ? 's' : ''} fixing`);
  }
  const orphans = unresolved.filter(
    (key) => !missing.some((m) => m.key === key) && !invalid.some((i) => i.key === key),
  );
  if (orphans.length) {
    parts.push(`unknown placeholder${orphans.length === 1 ? '' : 's'}: ${orphans.join(', ')}`);
  }
  return `Cannot export — ${parts.join('; ')}.`;
}
