/**
 * Types for the generated `engine.js`.
 *
 * `engine.js` is extracted verbatim from the original single-file tool and is
 * plain ES5-era JavaScript. Rather than annotate the generated file — which
 * would be overwritten on the next extraction — its public surface is described
 * here. TypeScript prefers this declaration over inferring from the .js.
 */
import type {
  Block, EngineState, Palette, PaletteKey, Parsed, Theme, ThemeKey,
} from './types.js';

export declare const THEMES: Record<ThemeKey, Theme>;
export declare const PALETTES: Record<PaletteKey, Palette>;

/** The three example documents shipped with the original tool. */
export declare const STARTERS: Record<'thanks' | 'recap' | 'newsletter', string>;

/** Escape HTML special characters. */
export declare function esc(s: string): string;

/** Apply inline formatting: links, bare emails, `**bold**`. */
export declare function inline(s: string): string;

/** Strip inline formatting down to plain text. */
export declare function stripInline(s: string): string;

/** Parse the block syntax into a document tree. */
export declare function parse(text: string): Parsed;

/** Render parsed blocks to table-based email HTML fragments. */
export declare function renderBlocks(blocks: Block[], theme: Theme): string;

/** Render the masthead for themes that use a header band. */
export declare function headerBlock(parsed: Parsed, theme: Theme): string;

/** Build the complete email document. */
export declare function buildEmail(parsed: Parsed): string;

/** Build the plain-text alternative. */
export declare function buildText(parsed: Parsed): string;

/** Merge a partial patch into the rendering state. */
export declare function setState(patch: Partial<EngineState>): void;

/** Snapshot the current rendering state. */
export declare function getState(): EngineState;

/** Restore the original defaults. Call between renders. */
export declare function resetState(): void;

/** Apply a named palette's six colours to the state. */
export declare function applyPalette(key: PaletteKey): void;
