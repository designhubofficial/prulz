/**
 * Design presets.
 *
 * The engine has always carried six layouts and six colour sets; nothing in the
 * app exposed them, so every template rendered in whatever combination it was
 * authored with. This module names them, draws them, and lets a person pick.
 *
 * The thumbnails are schematics, not screenshots — they show where the masthead,
 * section labels and cards sit, drawn in the palette actually being previewed,
 * so the two choices can be judged together.
 */
import { PALETTES, THEMES, type PaletteKey, type ThemeKey } from '../engine/index.js';
import type { BannerStyle } from '../engine/types.js';

export interface ThemeOption {
  key: ThemeKey;
  name: string;
  description: string;
}

export interface PaletteOption {
  key: PaletteKey;
  name: string;
  /** The two colours that carry the identity, for the swatch. */
  primary: string;
  accent: string;
  tint: string;
}

/** Ordered plainest-first, so the safe choice is the easy one to land on. */
export const THEME_ORDER: ThemeKey[] = ['signal', 'plain', 'ledger', 'beacon', 'stack', 'pulse'];
export const PALETTE_ORDER: PaletteKey[] = ['ocean', 'forest', 'graphite', 'midnight', 'plum', 'ember'];

export const THEME_OPTIONS: ThemeOption[] = THEME_ORDER.map((key) => ({
  key,
  name: THEMES[key].name,
  description: THEMES[key].desc,
}));

export const PALETTE_OPTIONS: PaletteOption[] = PALETTE_ORDER.map((key) => ({
  key,
  name: PALETTES[key].name,
  primary: PALETTES[key].primary,
  accent: PALETTES[key].accent,
  tint: PALETTES[key].tint,
}));

/**
 * A schematic of one theme drawn in one palette.
 *
 * Adapted from the original tool's thumbnail, which drew every theme in the
 * same two greys. Using the real palette means one thumbnail answers both
 * questions at once.
 */
export function themeThumbnail(theme: ThemeKey, palette: PaletteKey): string {
  const T = THEMES[theme];
  const P = PALETTES[palette];

  const parts: string[] = [
    `<rect width="100" height="60" fill="#FFFFFF"/>`,
  ];

  /* masthead */
  if (T.headerBand) {
    parts.push(
      `<rect width="100" height="21" fill="${P.primary}"/>`,
      `<rect x="38" y="6" width="24" height="3" rx="1.5" fill="${P.accent}"/>`,
      `<rect x="26" y="12" width="48" height="4.5" rx="2.2" fill="#FFFFFF"/>`,
    );
  } else if (T.header === 'minimal') {
    parts.push(
      `<rect x="8" y="8" width="16" height="4" rx="2" fill="${P.accent}"/>`,
      `<rect x="8" y="17" width="52" height="5" rx="2.5" fill="${P.primary}"/>`,
    );
  } else if (T.header === 'left') {
    parts.push(
      `<rect x="8" y="7" width="18" height="3.5" rx="1.75" fill="${P.accent}"/>`,
      `<rect x="8" y="15" width="60" height="5.5" rx="2.75" fill="${P.primary}"/>`,
      `<rect x="8" y="25" width="84" height="1.4" fill="${P.line}"/>`,
    );
  } else {
    parts.push(
      `<rect x="41" y="6" width="18" height="3.5" rx="1.75" fill="${P.accent}"/>`,
      `<rect x="24" y="14" width="52" height="5.5" rx="2.75" fill="${P.primary}"/>`,
      `<rect x="8" y="25" width="84" height="1.4" fill="${P.line}"/>`,
    );
  }

  /* section label */
  if (T.label === 'bar') {
    parts.push(`<rect x="8" y="32" width="84" height="7" rx="2.5" fill="${P.primary}"/>`);
  } else if (T.label === 'rule') {
    parts.push(
      `<rect x="8" y="32" width="30" height="3" rx="1.5" fill="${P.primary}"/>`,
      `<rect x="8" y="38" width="84" height="1.4" fill="${P.accent}"/>`,
    );
  } else if (T.label === 'plain') {
    parts.push(`<rect x="8" y="32" width="34" height="4" rx="2" fill="${P.primary}"/>`);
  } else {
    parts.push(`<rect x="8" y="32" width="26" height="3" rx="1.5" fill="${P.accent}"/>`);
  }

  /* body */
  if (T.card === 'plain') {
    parts.push(
      `<rect x="8" y="44" width="70" height="3" rx="1.5" fill="${P.line}"/>`,
      `<rect x="8" y="51" width="54" height="3" rx="1.5" fill="${P.line}"/>`,
    );
  } else {
    const fill = T.card === 'tinted' ? P.tint : '#FFFFFF';
    parts.push(
      `<rect x="8" y="43" width="84" height="12" rx="3" fill="${fill}" stroke="${P.line}" stroke-width="1"/>`,
      `<rect x="13" y="47" width="46" height="3" rx="1.5" fill="${P.accent}"/>`,
    );
  }

  return `<svg viewBox="0 0 100 60" role="img" aria-hidden="true">${parts.join('')}</svg>`;
}

/** A template's design, which the user can override per template. */
export interface DesignChoice {
  theme: ThemeKey;
  palette: PaletteKey;
  banner?: BannerCustomization;
  cta?: CtaCustomization;
  gallery?: GalleryCustomization;
}

export type GalleryLayout = 'single' | 'two' | 'three';

export interface BannerCustomization {
  style: BannerStyle;
  eyebrow: string;
  title: string;
  subtitle: string;
}

export interface CtaCustomization {
  enabled: boolean;
  label: string;
  url: string;
}

export interface GalleryImage {
  url: string;
  alt: string;
  caption: string;
}

export interface GalleryCustomization {
  enabled: boolean;
  layout: GalleryLayout;
  images: GalleryImage[];
}

export interface ResolvedDesign extends DesignChoice {
  banner: BannerCustomization;
  cta: CtaCustomization;
  gallery: GalleryCustomization;
}

export const DEFAULT_BANNER: BannerCustomization = {
  style: 'template', eyebrow: '', title: '', subtitle: '',
};
export const DEFAULT_CTA: CtaCustomization = {
  enabled: false, label: 'Learn more', url: '',
};
export const DEFAULT_GALLERY: GalleryCustomization = {
  enabled: false, layout: 'two', images: [],
};

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && value in THEMES;
}

export function isPaletteKey(value: unknown): value is PaletteKey {
  return typeof value === 'string' && value in PALETTES;
}

function isBannerStyle(value: unknown): value is BannerStyle {
  return value === 'template' || value === 'solid' || value === 'soft' || value === 'clean';
}

function isGalleryLayout(value: unknown): value is GalleryLayout {
  return value === 'single' || value === 'two' || value === 'three';
}

function textValue(value: unknown, fallback: string, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function normalizeBanner(value: unknown): BannerCustomization {
  if (!value || typeof value !== 'object') return { ...DEFAULT_BANNER };
  const input = value as Record<string, unknown>;
  return {
    style: isBannerStyle(input.style) ? input.style : DEFAULT_BANNER.style,
    eyebrow: textValue(input.eyebrow, DEFAULT_BANNER.eyebrow, 80),
    title: textValue(input.title, DEFAULT_BANNER.title, 140),
    subtitle: textValue(input.subtitle, DEFAULT_BANNER.subtitle, 180),
  };
}

function normalizeCta(value: unknown): CtaCustomization {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CTA };
  const input = value as Record<string, unknown>;
  return {
    enabled: input.enabled === true,
    label: textValue(input.label, DEFAULT_CTA.label, 80),
    url: textValue(input.url, DEFAULT_CTA.url, 500),
  };
}

function normalizeGallery(value: unknown): GalleryCustomization {
  if (!value || typeof value !== 'object') return { ...DEFAULT_GALLERY };
  const input = value as Record<string, unknown>;
  const images = Array.isArray(input.images)
    ? input.images.slice(0, 3).flatMap((item): GalleryImage[] => {
      if (!item || typeof item !== 'object') return [];
      const image = item as Record<string, unknown>;
      const url = textValue(image.url, '', 1000);
      if (!url) return [];
      return [{
        url,
        alt: textValue(image.alt, '', 180),
        caption: textValue(image.caption, '', 180),
      }];
    })
    : [];
  return {
    enabled: input.enabled === true,
    layout: isGalleryLayout(input.layout) ? input.layout : DEFAULT_GALLERY.layout,
    images,
  };
}

/** Fill optional marketing controls without changing legacy stored designs. */
export function designWithDefaults(design: DesignChoice): ResolvedDesign {
  return {
    ...design,
    banner: design.banner ? normalizeBanner(design.banner) : { ...DEFAULT_BANNER },
    cta: design.cta ? normalizeCta(design.cta) : { ...DEFAULT_CTA },
    gallery: design.gallery ? normalizeGallery(design.gallery) : { ...DEFAULT_GALLERY },
  };
}

/**
 * Reconcile a stored design against what the engine offers.
 * A theme removed from the engine must not silently render nothing.
 */
export function normalizeDesign(stored: unknown, fallback: DesignChoice): DesignChoice {
  if (!stored || typeof stored !== 'object') return fallback;
  const input = stored as Record<string, unknown>;
  const out: DesignChoice = {
    theme: isThemeKey(input.theme) ? input.theme : fallback.theme,
    palette: isPaletteKey(input.palette) ? input.palette : fallback.palette,
  };
  if (input.banner !== undefined) out.banner = normalizeBanner(input.banner);
  if (input.cta !== undefined) out.cta = normalizeCta(input.cta);
  if (input.gallery !== undefined) out.gallery = normalizeGallery(input.gallery);
  return out;
}
