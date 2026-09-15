import raw from './templates.json' with { type: 'json' };
import { BRAND_FIELDS, type Category, type Template } from './types.js';
import {
  extractFields, guardExport, resolve,
  type ExportGate, type FieldDef, type FieldValues,
} from '../merge/index.js';
import {
  applyPalette, buildEmail, buildText, parse, resetState, setState,
  type PaletteKey, type ThemeKey,
} from '../engine/index.js';
import type { BannerStyle, LogoPlacement } from '../engine/types.js';

export * from './types.js';

export const TEMPLATES: Template[] = (raw as { templates: Template[] }).templates;

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
const BRAND_BY_KEY = new Map(BRAND_FIELDS.map((f) => [f.key, f]));

export function getTemplate(id: string): Template | undefined {
  return BY_ID.get(id);
}

export function byCategory(category: Category): Template[] {
  return TEMPLATES.filter((t) => t.category === category);
}

/** Case-insensitive search across name, description and body. */
export function search(query: string): Template[] {
  const q = query.trim().toLowerCase();
  if (!q) return TEMPLATES;
  return TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.body.toLowerCase().includes(q),
  );
}

/**
 * Every field the fill form should show, in the order they appear.
 *
 * Brand fields (practice name, phone, booking link) are folded in from the
 * shared definitions so a template never has to redeclare them, and so they
 * can be pre-filled from the active brand profile rather than retyped.
 */
export function fieldsFor(template: Template): FieldDef[] {
  const declared = new Map(template.fields.map((f) => [f.key, f]));
  const used = extractFields(template.body, template.preheader);

  const fields = used.map((key) =>
    declared.get(key) ??
    BRAND_BY_KEY.get(key) ??
    { key, label: key.replace(/_/g, ' '), type: 'text' as const, required: true },
  );

  // Bulk mail must carry a physical postal address and a working unsubscribe
  // link (CAN-SPAM). Rather than bolt them on at render time, ask for them like
  // any other field so they are validated and gated the same way.
  if (template.bulk) {
    for (const key of ['practice_address', 'unsubscribe_url'] as const) {
      if (!fields.some((f) => f.key === key)) fields.push(BRAND_BY_KEY.get(key)!);
    }
  }

  return fields;
}

export interface RenderResult {
  subject: string;
  html: string;
  text: string;
  gate: ExportGate;
}

export interface RenderOptions {
  /** Fill unsupplied fields with their samples. For previews, never for export. */
  preview?: boolean;
  /** Footer line; CAN-SPAM requires a physical postal address on bulk mail. */
  footer?: string;
  unsubscribeUrl?: string;
  /** Override the template's authored look. */
  theme?: ThemeKey;
  palette?: PaletteKey;
  /** Optional practice brand logo. */
  logo?: string;
  /** Width for the optional practice logo in the masthead. */
  logoWidth?: string | number;
  /** Where the reusable practice logo should appear in the email. */
  logoPlacement?: LogoPlacement;
  /** Optional banner/header overrides. Empty strings keep the authored copy. */
  banner?: {
    style?: BannerStyle;
    eyebrow?: string;
    title?: string;
    subtitle?: string;
  };
  /** Additional marketing blocks expressed in the engine's small block DSL. */
  customBlocks?: string;
}

/**
 * Render a template to its finished email.
 *
 * The returned `gate` decides whether export is allowed. Callers must check it
 * — `gate.ok === false` means the output still contains placeholders and must
 * not reach a recipient.
 */
export function render(
  template: Template,
  values: FieldValues,
  options: RenderOptions = {},
): RenderResult {
  const fields = fieldsFor(template);
  const opts = { useSamples: options.preview === true, keepUnknown: true };

  const body = resolve(template.body, fields, values, opts);
  const preheader = resolve(template.preheader, fields, values, opts);

  // Bulk mail defaults its footer to the practice address the fill form
  // collects; an explicit option still wins.
  const footerSource = options.footer
    ?? (template.bulk ? '{{practice_address}}' : '');
  const unsubSource = options.unsubscribeUrl
    ?? (template.bulk ? '{{unsubscribe_url}}' : '');

  const footer = resolve(footerSource, fields, values, opts);
  const unsub = resolve(unsubSource, fields, values, opts);

  resetState();
  applyPalette(options.palette ?? template.palette);
  setState({
    theme: options.theme ?? template.theme,
    // The masthead follows the practice being written for. Without this it
    // keeps the engine's baked-in default, so the header and the body name
    // two different practices.
    ...(values.practice_name ? { name: values.practice_name } : {}),
    ...(options.logo ? {
      logo: options.logo,
      logoWidth: String(options.logoWidth ?? '84'),
    } : {}),
    ...(options.logoPlacement ? { logoPlacement: options.logoPlacement } : {}),
    ...(options.banner ? {
      bannerStyle: options.banner.style ?? 'template',
      ...(options.banner.subtitle?.trim() ? { bannerSubtitle: options.banner.subtitle.trim() } : {}),
    } : {}),
    preheader,
    footer,
    unsub,
  });

  const parsed = parse(body);
  applyBanner(parsed, options.banner);
  insertCustomBlocks(parsed, options.customBlocks);
  const html = buildEmail(parsed);
  const text = buildText(parsed);

  return {
    subject: parsed.subject,
    html,
    text,
    // The rendered html and text are checked too, not just the sources. A
    // placeholder that reaches the output through any path — footer, unsubscribe
    // link, a field default — must block export. Checking only the inputs is how
    // "{{practice_address}}" ends up in a sent email.
    gate: guardExport(fields, values, body, preheader, html, text),
  };
}

function applyBanner(
  parsed: ReturnType<typeof parse>,
  banner: RenderOptions['banner'],
): void {
  if (!banner) return;

  const replaceOrInsert = (
    type: 'eyebrow' | 'h1' | 'sub',
    text: string | undefined,
    insertAt: number,
  ): void => {
    const value = text?.trim();
    if (!value) return;
    const existing = parsed.blocks.find((block) => block.type === type);
    if (existing && 'text' in existing) {
      existing.text = value;
      return;
    }
    parsed.blocks.splice(insertAt, 0, { type, text: value });
  };

  const eyebrowIndex = parsed.blocks.findIndex((block) => block.type === 'eyebrow');
  replaceOrInsert('eyebrow', banner.eyebrow, eyebrowIndex >= 0 ? eyebrowIndex : 0);
  const h1Index = parsed.blocks.findIndex((block) => block.type === 'h1');
  replaceOrInsert('h1', banner.title, h1Index >= 0 ? h1Index : 0);
  const subIndex = parsed.blocks.findIndex((block) => block.type === 'sub');
  replaceOrInsert('sub', banner.subtitle, subIndex >= 0 ? subIndex : parsed.blocks.length);
}

function insertCustomBlocks(parsed: ReturnType<typeof parse>, source: string | undefined): void {
  if (!source?.trim()) return;
  const extra = parse(source);
  const signIndex = parsed.blocks.findIndex((block) => block.type === 'sign');
  parsed.blocks.splice(signIndex < 0 ? parsed.blocks.length : signIndex, 0, ...extra.blocks);
}

/** Sample values for every field, used for library previews. */
export function sampleValues(template: Template): FieldValues {
  const out: FieldValues = {};
  for (const field of fieldsFor(template)) {
    if (field.sample) out[field.key] = field.sample;
  }
  return out;
}
