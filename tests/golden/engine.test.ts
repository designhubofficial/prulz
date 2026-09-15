/**
 * Golden tests — the regression net for the rendering engine.
 *
 * The snapshots in tests/golden/snapshots/ capture what the original
 * single-file tool produced. Email HTML is unforgiving and that output is
 * already correct in Outlook, Gmail and Apple Mail, so it is treated as the
 * specification: any change to src/engine must reproduce it byte-for-byte.
 *
 * If a test here fails, the engine changed what it renders. That is either a
 * bug, or an intentional change that needs `npm run snapshots` and a careful
 * look at the resulting diff.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parse, buildEmail, buildText, setState, resetState, applyPalette,
  THEMES, PALETTES, STARTERS, esc, inline, stripInline,
  type EngineState, type PaletteKey,
} from '../../src/engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPS = resolve(here, 'snapshots');

interface ManifestEntry {
  name: string;
  state: Partial<EngineState>;
  htmlBytes: number;
  textBytes: number;
}

const manifest = JSON.parse(
  readFileSync(resolve(SNAPS, 'manifest.json'), 'utf8'),
) as { count: number; snapshots: ManifestEntry[] };

/** Rebuilt here so the fixtures live in exactly one place: the snapshot script. */
const FIXTURE_BODIES = new Map<string, string>();
{
  // Fixture bodies are recovered from the snapshot script to avoid drift.
  const script = readFileSync(resolve(here, '../../scripts/make-snapshots.mjs'), 'utf8');
  const grab = (marker: string) => {
    const start = script.indexOf(`const ${marker} = [`);
    const end = script.indexOf("].join('\\n');", start);
    if (start < 0 || end < 0) throw new Error(`fixture ${marker} not found`);
    // eslint-disable-next-line no-eval
    return eval(script.slice(start + `const ${marker} = `.length, end + 1) + ".join('\\n')") as string;
  };
  FIXTURE_BODIES.set('all-blocks', grab('ALL_BLOCKS'));
  FIXTURE_BODIES.set('edge-cases', grab('EDGE_CASES'));
  FIXTURE_BODIES.set('thanks', STARTERS.thanks);
  FIXTURE_BODIES.set('recap', STARTERS.recap);
  FIXTURE_BODIES.set('newsletter', STARTERS.newsletter);
}

function bodyFor(name: string): string {
  const fixture = name.split('--')[0];
  const body = FIXTURE_BODIES.get(fixture);
  if (!body) throw new Error(`No fixture body for "${fixture}"`);
  return body;
}

beforeEach(() => resetState());

describe('golden snapshots', () => {
  it('has a snapshot for every theme and palette', () => {
    const files = readdirSync(SNAPS).filter((f) => f.endsWith('.html'));
    expect(files.length).toBe(manifest.count);
    // every theme and palette must appear somewhere in the suite
    for (const theme of Object.keys(THEMES)) {
      expect(files.some((f) => f.includes(`theme-${theme}`))).toBe(true);
    }
    for (const palette of Object.keys(PALETTES)) {
      expect(files.some((f) => f.includes(`palette-${palette}`))).toBe(true);
    }
  });

  for (const entry of manifest.snapshots) {
    it(`renders ${entry.name} byte-for-byte`, () => {
      resetState();
      if (entry.state.palette) applyPalette(entry.state.palette as PaletteKey);
      setState(entry.state);

      const parsed = parse(bodyFor(entry.name));
      const html = buildEmail(parsed);
      const text = buildText(parsed);

      expect(html).toBe(readFileSync(resolve(SNAPS, `${entry.name}.html`), 'utf8'));
      expect(text).toBe(readFileSync(resolve(SNAPS, `${entry.name}.txt`), 'utf8'));
    });
  }
});

describe('parser', () => {
  it('extracts the subject and drops it from the blocks', () => {
    const p = parse('Subject: Hello there\n\nBody text.');
    expect(p.subject).toBe('Hello there');
    expect(p.blocks).toEqual([{ type: 'p', lines: ['Body text.'] }]);
  });

  it('recognises every block type', () => {
    const p = parse(bodyFor('all-blocks'));
    const types = new Set(p.blocks.map((b) => b.type));
    for (const expected of [
      'eyebrow', 'h1', 'h2', 'sub', 'p', 'ul', 'ol',
      'card', 'table', 'stats', 'callout', 'button', 'image',
      'quote', 'feature', 'divider', 'sign',
    ]) {
      expect(types.has(expected as never), `missing block type: ${expected}`).toBe(true);
    }
  });

  it('groups consecutive list items into one block', () => {
    const p = parse('- one\n- two\n- three');
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0]).toMatchObject({ type: 'ul', items: ['one', 'two', 'three'] });
  });

  it('parses buttons and images with their arguments', () => {
    const p = parse('[Button: Go now | https://example.com/x]\n[Image: https://example.com/i.png | Alt here]');
    expect(p.blocks[0]).toEqual({ type: 'button', text: 'Go now', url: 'https://example.com/x' });
    expect(p.blocks[1]).toEqual({ type: 'image', url: 'https://example.com/i.png', alt: 'Alt here' });
  });

  it('parses an image caption as a third argument', () => {
    const p = parse('[Image: https://example.com/i.png | Alt here | A caption]');
    expect(p.blocks[0]).toEqual({
      type: 'image', url: 'https://example.com/i.png', alt: 'Alt here', caption: 'A caption',
    });
  });

  it('parses quote and feature blocks', () => {
    const q = parse('[Quote: Kind words | A. Patient]');
    expect(q.blocks[0]).toEqual({ type: 'quote', text: 'Kind words', name: 'A. Patient' });

    const f = parse('[Feature: https://example.com/f.png | F alt | A heading | Body text]');
    expect(f.blocks[0]).toEqual({
      type: 'feature', url: 'https://example.com/f.png', alt: 'F alt',
      heading: 'A heading', body: 'Body text',
    });
  });

  it('keeps pipes inside a feature body', () => {
    const f = parse('[Feature: https://example.com/f.png | Alt | Head | 9:00am | 10:30am]');
    expect(f.blocks[0]).toMatchObject({ heading: 'Head', body: '9:00am | 10:30am' });
  });

  it('treats both divider forms the same', () => {
    expect(parse('---').blocks).toEqual(parse('***').blocks);
  });

  it('ignores blank lines between blocks', () => {
    expect(parse('# A\n\n\n\n# B').blocks).toHaveLength(2);
  });
});

describe('inline formatting', () => {
  it('escapes HTML before anything else', () => {
    expect(esc('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    expect(inline('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('linkifies bare email addresses', () => {
    expect(inline('write to hello@example.com today')).toContain('mailto:hello@example.com');
  });

  it('turns a markdown link into an anchor', () => {
    expect(inline('[text](https://example.com)')).toContain('href="https://example.com"');
  });

  it('treats a bare email in link syntax as mailto', () => {
    expect(inline('[Email us](hello@example.com)')).toContain('href="mailto:hello@example.com"');
  });

  it('renders bold', () => {
    expect(inline('**loud**')).toContain('<strong');
  });

  it('strips formatting back to readable text', () => {
    expect(stripInline('**bold** and [link](https://example.com)'))
      .toBe('bold and link (https://example.com)');
  });
});

describe('state isolation', () => {
  it('resets cleanly between renders', () => {
    const before = buildEmail(parse(STARTERS.newsletter));
    setState({ theme: 'pulse', fsBody: 22, width: 700 });
    applyPalette('ember');
    expect(buildEmail(parse(STARTERS.newsletter))).not.toBe(before);
    resetState();
    expect(buildEmail(parse(STARTERS.newsletter))).toBe(before);
  });

  it('applies all six palette colours', () => {
    applyPalette('forest');
    const html = buildEmail(parse('# Title'));
    expect(html).toContain(PALETTES.forest.primary);
  });
});

describe('output invariants', () => {
  const parsed = () => parse(bodyFor('all-blocks'));

  it('produces a complete HTML document', () => {
    const html = buildEmail(parsed());
    expect(html).toMatch(/^<!DOCTYPE html/i);
    expect(html).toContain('</html>');
  });

  it('uses table layout rather than modern CSS', () => {
    const html = buildEmail(parsed());
    expect(html).toContain('<table');
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
  });

  it('gives every image alt text', () => {
    const html = buildEmail(parsed());
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img).toMatch(/\balt=/);
  });

  it('stays under the Gmail clipping limit for a normal email', () => {
    expect(Buffer.byteLength(buildEmail(parsed()), 'utf8')).toBeLessThan(102_000);
  });

  it('emits a plain-text alternative with no markup', () => {
    const text = buildText(parsed());
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text.length).toBeGreaterThan(50);
  });

  it('renders every theme without throwing', () => {
    for (const theme of Object.keys(THEMES)) {
      resetState();
      setState({ theme: theme as EngineState['theme'] });
      expect(() => buildEmail(parsed())).not.toThrow();
    }
  });
});
