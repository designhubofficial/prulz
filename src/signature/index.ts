/**
 * Email signature builder.
 *
 * The generator in `engine.js` is extracted verbatim from the original
 * single-file tool (see scripts/extract-signature.mjs). This adds types, a
 * default config, and the field schema the form is built from.
 */
import { build as rawBuild, buildPlain as rawBuildPlain, DEFAULT_LOGO as RAW_LOGO } from './engine.js';
import type { BrandProfile } from '../store/brand.js';

/** The only two values the generator branches on. */
export type Layout = 'photo' | 'stack';

/** Where the logo sits relative to the practice name. */
export type LogoPos = 'under' | 'name';

export interface SignatureConfig {
  /* person */
  name: string;
  creds: string;
  title: string;
  email: string;
  showemail: boolean;
  direct: string;
  pronouns: string;
  states: string;

  /* practice */
  org: string;
  showorg: boolean;
  tagline: string;
  phone: string;
  fax: string;
  site: string;
  fb: string;
  ig: string;
  newsletter: string;
  newslabel: string;
  booking: string;
  bookinglabel: string;
  showbooking: boolean;
  extra: string;

  /* look */
  accent: string;
  inkc: string;
  rule: string;
  font: string;
  layout: Layout;
  round: boolean;
  bubbles: boolean;
  bubble: string;
  logow: string;
  logopos: LogoPos;
  builtinlogo: boolean;
  logo: string;
  photo: string;

  /* legal */
  crisis: boolean;
  disclaimer: boolean;
  indep: boolean;

  /* embedded images, set by the uploader */
  photoData?: string | null;
  logoData?: string | null;
}

export const DEFAULT_LOGO: string = RAW_LOGO;

/** The brand font stack, matching the original tool's first option. */
export const BRAND_FONT = "Raleway, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

/**
 * A neutral starting signature.
 *
 * The repository is public, so the person and contact values are placeholders
 * (example.com, a 555 number) rather than a real clinician's details; the
 * practice profile replaces them, and upwell-email-signature-builder.html
 * carries the same placeholders. Styling and structural values still match the
 * original builder. Getting those wrong is not cosmetic: `layout` and `logopos`
 * are branched on by the generator, so an invented value silently produces the
 * wrong signature.
 */
export const DEFAULT_SIGNATURE: SignatureConfig = {
  name: 'Your Name',
  creds: '',
  title: 'Your role',
  email: 'hello@example.com',
  showemail: false,
  direct: '',
  pronouns: '',
  states: '',

  org: 'Your Practice',
  showorg: false,
  tagline: '',
  phone: '555-555-0100',
  fax: '',
  site: 'https://www.example.com',
  fb: '',
  ig: '',
  newsletter: '',
  newslabel: 'Newsletter signup',
  booking: 'https://www.example.com/book',
  bookinglabel: 'Schedule an appointment',
  showbooking: false,
  extra: '',

  accent: '#5B858D',
  inkc: '#022D41',
  rule: '#88BDBC',
  font: BRAND_FONT,
  layout: 'photo',
  round: true,
  bubbles: true,
  bubble: '#CBE2DF',
  logow: '84',
  logopos: 'under',
  builtinlogo: false,
  logo: '',
  photo: '',

  crisis: true,
  disclaimer: true,
  indep: false,

  photoData: null,
  logoData: null,
};

export type SigFieldType = 'text' | 'email' | 'url' | 'tel' | 'color' | 'select' | 'check' | 'image';

export interface SigField {
  key: keyof SignatureConfig;
  label: string;
  type: SigFieldType;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  /** Render two fields to a row. */
  half?: boolean;
  /** Pre-filled from the practice profile. */
  fromBrand?: keyof BrandProfile;
}

export interface SigSection {
  title: string;
  /** Collapsed by default — practice-wide settings nobody edits per person. */
  collapsed?: boolean;
  fields: SigField[];
}

/**
 * The form, grouped so a person filling this in sees six fields, not thirty.
 * Everything practice-wide starts collapsed because the profile already
 * supplies it.
 */
export const SIGNATURE_SECTIONS: SigSection[] = [
  {
    title: 'You',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', half: true, fromBrand: 'sender_name' },
      { key: 'creds', label: 'Credentials', type: 'text', half: true },
      { key: 'title', label: 'Job title', type: 'text', fromBrand: 'sender_title' },
      { key: 'email', label: 'Email', type: 'email', fromBrand: 'practice_email' },
      {
        key: 'showemail', label: 'Show my email in the signature', type: 'check',
        help: 'Off by default — the recipient already has it from the message itself.',
      },
      { key: 'direct', label: 'Direct line or extension', type: 'tel', half: true },
      { key: 'pronouns', label: 'Pronouns', type: 'text', half: true },
      {
        key: 'photo', label: 'Headshot', type: 'image',
        help: 'Cropped square, resized, and embedded. Nothing is uploaded anywhere.',
      },
    ],
  },
  {
    title: 'Practice',
    collapsed: true,
    fields: [
      { key: 'org', label: 'Practice name', type: 'text', fromBrand: 'practice_name' },
      { key: 'showorg', label: 'Also show the practice name as text', type: 'check' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'states', label: 'Serving', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'tel', half: true, fromBrand: 'practice_phone' },
      { key: 'fax', label: 'Fax', type: 'tel', half: true },
      { key: 'site', label: 'Website', type: 'url', fromBrand: 'practice_website' },
      { key: 'fb', label: 'Facebook', type: 'url' },
      { key: 'ig', label: 'Instagram', type: 'url' },
      { key: 'newsletter', label: 'Newsletter sign-up link', type: 'url' },
      { key: 'newslabel', label: 'Newsletter link wording', type: 'text' },
      { key: 'booking', label: 'Booking link', type: 'url', fromBrand: 'booking_url' },
      { key: 'bookinglabel', label: 'Booking button text', type: 'text' },
      { key: 'showbooking', label: 'Show the booking button', type: 'check' },
      {
        key: 'logoData', label: 'Practice logo', type: 'image',
        help: 'Optional transparent PNG, resized and embedded locally. The same practice mark can be reused in Email Editor.',
      },
    ],
  },
  {
    title: 'Appearance',
    collapsed: true,
    fields: [
      {
        key: 'layout', label: 'Layout', type: 'select',
        // These values are branched on by the generator. Do not invent new ones.
        options: [
          { value: 'photo', label: 'Headshot left, details right' },
          { value: 'stack', label: 'Single column (best on phones)' },
        ],
      },
      {
        key: 'font', label: 'Font stack', type: 'select',
        options: [
          { value: BRAND_FONT, label: 'Raleway → Helvetica Neue / Segoe UI (brand)' },
          { value: "Raleway, 'Trebuchet MS', Arial, sans-serif", label: 'Raleway → Trebuchet MS' },
          { value: "'Trebuchet MS', Arial, sans-serif", label: 'Trebuchet MS (installed everywhere)' },
          { value: 'Arial, Helvetica, sans-serif', label: 'Arial (safest, least on-brand)' },
        ],
      },
      { key: 'inkc', label: 'Text', type: 'color', half: true },
      { key: 'accent', label: 'Accent', type: 'color', half: true },
      { key: 'rule', label: 'Rule', type: 'color', half: true },
      { key: 'bubble', label: 'Pill', type: 'color', half: true },
      { key: 'round', label: 'Round the headshot', type: 'check' },
      {
        key: 'bubbles', label: 'Pill background behind the newsletter link and tagline',
        type: 'check',
      },
      { key: 'builtinlogo', label: 'Use the built-in UpWell logo', type: 'check' },
      {
        key: 'logo', label: 'Hosted logo URL (fallback)', type: 'url',
        help: 'Used only when the built-in logo is off and no uploaded logo is attached.',
      },
      {
        key: 'logopos', label: 'Logo position', type: 'select',
        options: [
          { value: 'under', label: 'Under the headshot' },
          { value: 'name', label: 'In place of the practice name' },
        ],
      },
      { key: 'logow', label: 'Logo width (pixels)', type: 'text', half: true },
    ],
  },
  {
    title: 'Legal footer',
    collapsed: true,
    fields: [
      { key: 'crisis', label: 'Crisis line notice (988)', type: 'check' },
      { key: 'disclaimer', label: 'Confidentiality notice', type: 'check' },
      { key: 'indep', label: 'Independent-provider disclaimer', type: 'check' },
      { key: 'extra', label: 'Extra line — portal link, scheduling note', type: 'text' },
    ],
  },
];

/** Every field in the schema, flattened. */
export const SIGNATURE_FIELDS: SigField[] = SIGNATURE_SECTIONS.flatMap((s) => s.fields);

export function buildSignature(config: SignatureConfig): string {
  return rawBuild({ ...config });
}

export function buildSignatureText(config: SignatureConfig): string {
  return rawBuildPlain({ ...config });
}

/** Type-safe write into the config, for form controls keyed by field name. */
export function setSignatureValue<K extends keyof SignatureConfig>(
  config: SignatureConfig,
  key: K,
  value: SignatureConfig[K],
): void {
  config[key] = value;
}

/**
 * Reconcile a stored config against the current schema.
 *
 * A config saved by an older version can carry values this build no longer
 * understands — an earlier release persisted `layout: 'photo-left'`, which the
 * generator does not branch on, so the signature silently rendered wrong.
 * Anything not offered by the schema falls back to the shipped default rather
 * than being trusted.
 */
export function normalizeSignature(stored: unknown): SignatureConfig {
  const out: SignatureConfig = { ...DEFAULT_SIGNATURE };
  if (!stored || typeof stored !== 'object') return out;

  const input = stored as Record<string, unknown>;

  for (const field of SIGNATURE_FIELDS) {
    const value = input[field.key];
    if (value === undefined || value === null) continue;

    if (field.type === 'check') {
      if (typeof value === 'boolean') setSignatureValue(out, field.key as 'round', value);
      continue;
    }

    if (typeof value !== 'string') continue;

    if (field.type === 'select') {
      const allowed = (field.options ?? []).map((o) => o.value);
      if (!allowed.includes(value)) continue;   // keep the shipped default
    }

    setSignatureValue(out, field.key as 'name', value);
  }

  // Embedded images are not schema fields but must survive a reload.
  if (typeof input.photoData === 'string') out.photoData = input.photoData;
  if (typeof input.logoData === 'string') out.logoData = input.logoData;

  return out;
}

/**
 * Fill personal fields from the practice profile.
 *
 * The shipped default holds placeholder values, not anyone's data — so the
 * profile overrides them, exactly as the practice profile overrides a
 * template's sample values. Anything the user actually typed is left alone.
 */
export function applyBrandToSignature(
  config: SignatureConfig,
  brand: BrandProfile,
): SignatureConfig {
  const out = { ...config };
  for (const field of SIGNATURE_FIELDS) {
    if (!field.fromBrand) continue;
    const current = out[field.key];
    const shipped = DEFAULT_SIGNATURE[field.key];
    const isPlaceholder = current === shipped;
    if (typeof current === 'string' && current.trim() && !isPlaceholder) continue;
    const value = brand[field.fromBrand];
    if (value?.trim()) setSignatureValue(out, field.key as 'name', value);
  }
  return out;
}

/** Rough send size. Data URIs make a signature heavy fast. */
export function signatureSizeKb(html: string): number {
  const bytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(html).length
    : Buffer.byteLength(html, 'utf8');
  return Math.round((bytes / 1024) * 10) / 10;
}
