import { describe, it, expect } from 'vitest';
import {
  PALETTE_OPTIONS, PALETTE_ORDER, THEME_OPTIONS, THEME_ORDER,
  isPaletteKey, isThemeKey, normalizeDesign, themeThumbnail,
} from '../src/design/index.js';
import { PALETTES, THEMES } from '../src/engine/index.js';
import {
  CATEGORY_GROUPS, CATEGORY_LABELS, TEMPLATES, byCategory, groupOf,
  getTemplate, render, sampleValues, type Category,
} from '../src/library/index.js';

describe('design presets', () => {
  it('offers every theme and palette the engine has', () => {
    expect(THEME_ORDER.slice().sort()).toEqual(Object.keys(THEMES).sort());
    expect(PALETTE_ORDER.slice().sort()).toEqual(Object.keys(PALETTES).sort());
  });

  it('names them from the engine rather than duplicating the strings', () => {
    for (const option of THEME_OPTIONS) {
      expect(option.name).toBe(THEMES[option.key].name);
      expect(option.description).toBe(THEMES[option.key].desc);
    }
    for (const option of PALETTE_OPTIONS) {
      expect(option.primary).toBe(PALETTES[option.key].primary);
    }
  });

  it('leads with the plainest layout', () => {
    // The safe choice should be the easy one to land on.
    expect(THEME_ORDER[0]).toBe('signal');
  });
});

describe('theme thumbnails', () => {
  it('draws one for every combination without throwing', () => {
    for (const theme of THEME_ORDER) {
      for (const palette of PALETTE_ORDER) {
        const svg = themeThumbnail(theme, palette);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('</svg>');
      }
    }
  });

  it('draws in the palette it is given', () => {
    const svg = themeThumbnail('signal', 'ember');
    expect(svg).toContain(PALETTES.ember.primary);
    expect(svg).not.toContain(PALETTES.ocean.primary);
  });

  it('distinguishes every layout, so the picker is not six identical pictures', () => {
    const drawn = new Map<string, string>();
    for (const theme of THEME_ORDER) {
      const svg = themeThumbnail(theme, 'ocean');
      for (const [other, otherSvg] of drawn) {
        expect(svg, `${theme} draws the same as ${other}`).not.toBe(otherSvg);
      }
      drawn.set(theme, svg);
    }
  });

  it('distinguishes every palette', () => {
    const drawn = new Set<string>();
    for (const palette of PALETTE_ORDER) drawn.add(themeThumbnail('ledger', palette));
    expect(drawn.size).toBe(PALETTE_ORDER.length);
  });

  it('emits no raw user content, since it is injected as HTML', () => {
    // The thumbnail is set via innerHTML; it must only ever contain values
    // that came from the engine's own tables.
    const svg = themeThumbnail('beacon', 'plum');
    expect(svg).not.toMatch(/<script|onload=|javascript:/i);
  });
});

describe('stored design choices', () => {
  const fallback = { theme: 'signal', palette: 'ocean' } as const;

  it('keeps valid choices', () => {
    expect(normalizeDesign({ theme: 'pulse', palette: 'ember' }, fallback))
      .toEqual({ theme: 'pulse', palette: 'ember' });
  });

  it('falls back on a theme the engine no longer has', () => {
    expect(normalizeDesign({ theme: 'gone', palette: 'ember' }, fallback).theme).toBe('signal');
  });

  it('falls back entirely on junk', () => {
    expect(normalizeDesign(null, fallback)).toEqual(fallback);
    expect(normalizeDesign('nope', fallback)).toEqual(fallback);
  });

  it('recognises real keys', () => {
    expect(isThemeKey('ledger')).toBe(true);
    expect(isThemeKey('ledgerr')).toBe(false);
    expect(isPaletteKey('forest')).toBe(true);
    expect(isPaletteKey(42)).toBe(false);
  });
});

describe('applying a design to a template', () => {
  const template = getTemplate('news-monthly')!;
  const values = sampleValues(template);

  it('changes the output', () => {
    const authored = render(template, values).html;
    const restyled = render(template, values, { theme: 'pulse', palette: 'ember' }).html;
    expect(restyled).not.toBe(authored);
    expect(restyled).toContain(PALETTES.ember.primary);
  });

  it('keeps the content identical, only the look changes', () => {
    const a = render(template, values, { theme: 'signal', palette: 'ocean' });
    const b = render(template, values, { theme: 'pulse', palette: 'ember' });
    expect(b.subject).toBe(a.subject);
    expect(b.text).toBe(a.text);
  });

  it('still resolves every merge field, whatever the design', () => {
    for (const theme of THEME_ORDER) {
      const result = render(template, values, { theme, palette: 'plum' });
      expect(result.gate.ok, `${theme} broke the export gate`).toBe(true);
      expect(result.html).not.toMatch(/\{\{/);
    }
  });

  it('falls back to how the template was authored when no override is given', () => {
    expect(render(template, values).html)
      .toBe(render(template, values, { theme: template.theme, palette: template.palette }).html);
  });
});

describe('category groups', () => {
  it('covers every category exactly once', () => {
    const grouped = CATEGORY_GROUPS.flatMap((g) => g.categories);
    expect(grouped.slice().sort()).toEqual(
      (Object.keys(CATEGORY_LABELS) as Category[]).slice().sort(),
    );
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('accounts for every template', () => {
    const counted = CATEGORY_GROUPS
      .flatMap((g) => g.categories)
      .reduce((sum, category) => sum + byCategory(category).length, 0);
    expect(counted).toBe(TEMPLATES.length);
  });

  it('places each category in a group', () => {
    for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
      expect(() => groupOf(category)).not.toThrow();
    }
  });

  it('keeps groups small enough to scan', () => {
    // Three families of two or three; more than that and it is a list again.
    expect(CATEGORY_GROUPS).toHaveLength(3);
    for (const group of CATEGORY_GROUPS) {
      expect(group.categories.length).toBeLessThanOrEqual(3);
      expect(group.hint.length).toBeGreaterThan(15);
    }
  });
});
