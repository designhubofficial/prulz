/** Shared types for the rendering engine. Kept separate so `engine.d.ts` can
 *  describe the generated JavaScript without duplicating them. */

export type ThemeKey = 'signal' | 'beacon' | 'ledger' | 'stack' | 'pulse' | 'plain';
export type PaletteKey = 'ocean' | 'midnight' | 'forest' | 'plum' | 'ember' | 'graphite';
export type LogoPlacement = 'header' | 'above' | 'footer' | 'hidden';
export type BannerStyle = 'template' | 'solid' | 'soft' | 'clean';

export interface Theme {
  name: string;
  desc: string;
  header: 'centered' | 'band' | 'left' | 'minimal';
  align: 'center' | 'left';
  label: 'caps' | 'rule' | 'bar' | 'plain';
  card: 'tinted' | 'outlined' | 'elevated' | 'plain';
  titleRule: boolean;
  headerBand: boolean;
  sectionCards?: boolean;
}

export interface Palette {
  name: string;
  primary: string;
  accent: string;
  tint: string;
  line: string;
  ink: string;
  page: string;
}

/** Every block the parser can emit. */
export type Block =
  | { type: 'eyebrow'; text: string }
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'sub'; text: string }
  | { type: 'p'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'card'; items: string[] }
  | { type: 'table'; rows: Array<{ label: string; value: string }> }
  | { type: 'stats'; items: Array<{ value: string; label: string }> }
  | { type: 'callout'; text: string }
  | { type: 'button'; text: string; url: string }
  | { type: 'image'; url: string; alt: string; caption?: string }
  | { type: 'gallery'; layout: 'single' | 'two' | 'three'; items: Array<{ url: string; alt: string; caption?: string }> }
  | { type: 'quote'; text: string; name: string }
  | { type: 'feature'; url: string; alt: string; heading: string; body: string }
  | { type: 'divider' }
  | { type: 'sign'; parts: string[] };

export interface Parsed {
  subject: string;
  blocks: Block[];
}

/** Rendering state. Mirrors the source tool's `S` object. */
export interface EngineState {
  theme: ThemeKey;
  palette: PaletteKey;
  name: string;
  logo: string;
  logoWidth: string;
  logoPlacement: LogoPlacement;
  bannerStyle: BannerStyle;
  bannerSubtitle: string;
  primary: string;
  accent: string;
  tint: string;
  line: string;
  ink: string;
  page: string;
  headFont: string;
  headWeb: string;
  bodyFont: string;
  bodyWeb: string;
  fsBody: number;
  fsTitle: number;
  width: number;
  radius: number;
  btnRadius: number;
  bars: string;
  preheader: string;
  footer: string;
  unsub: string;
}
