/**
 * Generates the golden snapshots that lock the engine's output.
 *
 * These files are the regression net for the whole project. They are produced
 * ONCE from the original tool's behaviour and then committed. Every later
 * change to the engine must reproduce them byte-for-byte, or explain why not.
 *
 * Run: npm run snapshots       (only when intentionally re-baselining)
 * Check: npm test
 */
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const E = require(resolve(root, 'tests/golden/reference.cjs'));

const OUT = resolve(root, 'tests/golden/snapshots');

/** Exercises every block type the parser supports, in one document. */
const ALL_BLOCKS = [
  'Subject: Every block type in one document',
  '~ Eyebrow label',
  '# Heading one',
  '## Heading two',
  '### Sub heading',
  '',
  'A paragraph with **bold text**, a [named link](https://example.com/path),',
  'a bare email hello@example.com, and a second line.',
  '',
  '- First bullet with **emphasis**',
  '- Second bullet',
  '',
  '1. First numbered',
  '2. Second numbered',
  '',
  '+ A card item',
  '+ Another card item',
  '',
  '| Label one | Value one',
  '| Label two | Value two',
  '',
  '[Stat: 42% | Faster onboarding]',
  '[Stat: 1,280 | New teams]',
  '',
  '> A callout with **bold** inside it.',
  '',
  '[Button: Press me | https://example.com/go]',
  '[Image: https://example.com/img.png | Descriptive alt text]',
  '[Image: https://example.com/caption.png | Captioned alt text | A short caption under the photo]',
  '',
  '[Quote: Care changes lives. | A. Patient]',
  '',
  '[Feature: https://example.com/feature.png | Feature alt text | Feature heading | Feature body text with **bold** inside.]',
  '[Feature: https://example.com/feature2.png | Second feature alt | Second heading | Second body text.]',
  '',
  '---',
  '',
  '@ Casey Rivera | Care Coordinator | casey@example.com',
].join('\n');

/** Edge cases that have historically broken email builders. */
const EDGE_CASES = [
  'Subject: Escaping & <edge> cases',
  '# Ampersands & angle <brackets>',
  '',
  'Text with & ampersand, <tag> and "quotes".',
  '',
  '- Item with a trailing pipe |',
  '',
  '| Key with | pipe | Value with | pipes',
  '',
  '@ Solo signature line',
].join('\n');

const FIXTURES = {
  'all-blocks': ALL_BLOCKS,
  'edge-cases': EDGE_CASES,
  thanks: E.STARTERS.thanks,
  recap: E.STARTERS.recap,
  newsletter: E.STARTERS.newsletter,
};

const THEMES = Object.keys(E.THEMES);
const PALETTES = Object.keys(E.PALETTES);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const manifest = [];

async function snap(name, fixture, state) {
  E.resetState();
  if (state.palette) E.applyPalette(state.palette);
  E.setState(state);
  const parsed = E.parse(fixture);
  const html = E.buildEmail(parsed);
  const text = E.buildText(parsed);
  await writeFile(resolve(OUT, name + '.html'), html, 'utf8');
  await writeFile(resolve(OUT, name + '.txt'), text, 'utf8');
  manifest.push({ name, state, htmlBytes: html.length, textBytes: text.length });
}

// every fixture across every theme, default palette
for (const [fx, body] of Object.entries(FIXTURES)) {
  for (const theme of THEMES) {
    await snap(`${fx}--theme-${theme}`, body, { theme });
  }
}

// palette coverage on the fixture that uses every block
for (const palette of PALETTES) {
  await snap(`all-blocks--palette-${palette}`, ALL_BLOCKS, { theme: 'signal', palette });
}

// non-default layout settings, to lock the numeric knobs
await snap('all-blocks--wide-large', ALL_BLOCKS, {
  theme: 'ledger', width: 680, radius: 0, btnRadius: 24, fsBody: 17, fsTitle: 32,
});
await snap('all-blocks--with-chrome', ALL_BLOCKS, {
  theme: 'beacon',
  preheader: 'A preheader that shows beside the subject.',
  footer: 'Example Practice, 123 Example St, Portland OR 97201',
  unsub: 'https://example.com/unsubscribe',
});

await writeFile(
  resolve(OUT, 'manifest.json'),
  JSON.stringify({ generated: 'from tests/golden/reference.cjs', count: manifest.length, snapshots: manifest }, null, 2),
  'utf8',
);

console.log(`Wrote ${manifest.length} golden snapshots to tests/golden/snapshots/`);
