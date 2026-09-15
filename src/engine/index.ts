/**
 * The rendering engine.
 *
 * `engine.js` is generated verbatim from the original single-file tool by
 * scripts/extract-engine.mjs. It is deliberately not rewritten: the email HTML
 * it produces is already correct across Outlook, Gmail and Apple Mail, and that
 * correctness is expensive to re-earn. Types live in `engine.d.ts`, and the
 * golden tests hold its output to the byte.
 */
export type {
  BannerStyle, Block, EngineState, LogoPlacement, Palette, PaletteKey, Parsed, Theme, ThemeKey,
} from './types.js';

export {
  THEMES, PALETTES, STARTERS,
  esc, inline, stripInline, parse,
  renderBlocks, headerBlock, buildEmail, buildText,
  setState, getState, resetState, applyPalette,
} from './engine.js';
