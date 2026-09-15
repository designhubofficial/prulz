/**
 * Extracts the signature generator from upwell-email-signature-builder.html.
 *
 * Same principle as the template engine: the code that builds the signature
 * HTML is already correct across mail clients, so it is moved verbatim rather
 * than rewritten.
 *
 * One deliberate change. The original read every input straight from the DOM:
 *
 *     function v(id){ const el = $(id); return el.type === 'checkbox' ? ... }
 *
 * That makes it unusable outside the original page and untestable. It is
 * replaced with a read from a plain config object. Nothing else is touched.
 *
 * Run: npm run extract
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'upwell-email-signature-builder.html');

/**
 * Two ranges, so the DOM plumbing between them is left behind.
 *
 * The original interleaves generator code with UI wiring — `setPhoto` writes to
 * a thumbnail element, `wireDrop` attaches drag-and-drop listeners. Those belong
 * to the old page, not to the generator, and dragging them along was what made
 * the first extraction attempt fail with "$ is not defined".
 */
const RANGES = [
  ['const esc = s =>', 'function setPhoto(data){'],
  ['function buildSignature(){', 'function render(){'],
];

const html = await readFile(SOURCE, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/);
if (!script) throw new Error('No <script> block in ' + SOURCE);

const js = script[1];
let body = RANGES.map(([start, end]) => {
  const from = js.indexOf(start);
  const to = js.indexOf(end);
  if (from < 0 || to < 0) throw new Error(`Marker not found: ${start} .. ${end}`);
  return js.slice(from, to).trimEnd();
}).join('\n\n');

// --- the one substitution: DOM reads become config reads ---
const V_FN = /function v\(id\)\{[^}]*\}/;
if (!V_FN.test(body)) throw new Error('Could not find v() to replace');
body = body.replace(
  V_FN,
  `function v(id){
    // Replaced during extraction: reads the config object instead of the DOM.
    var value = CONFIG[id];
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value;
    return String(value).trim();
  }`,
);

// Canvas is unavailable outside a browser; the icons are decorative, so fall
// back to a text link rather than failing the whole signature.
body = body.replace(
  'function drawIcon(kind, hex){',
  `function drawIcon(kind, hex){
    if (typeof document === 'undefined' || !document.createElement) { return ''; }`,
);

// Checked after the substitution, since v() is the one place $() is expected.
// Anything left means UI plumbing crept into the ranges above.
if (/\$\(/.test(body)) {
  const stray = body.match(/^.*\$\(.*$/m)?.[0].trim();
  throw new Error(`Extracted code still touches the DOM: ${stray}\nNarrow the ranges.`);
}

const BANNER = `/**
 * GENERATED FILE - do not edit by hand.
 * Extracted from upwell-email-signature-builder.html by scripts/extract-signature.mjs
 *
 * Changes from the original, both mechanical:
 *   - v(id) reads a config object rather than the DOM
 *   - drawIcon() returns '' when there is no document (icons are decorative)
 */
`;

const WRAPPER = `
  var CONFIG = {};
  function setConfig(next) { CONFIG = next || {}; }
  function setPhotoData(data) { photoData = data || null; }
  function setLogoData(data) { logoData = data || null; }

  /** Build the signature HTML from a config object. */
  function build(config) {
    setConfig(config);
    setPhotoData(config && config.photoData);
    setLogoData(config && config.logoData);
    return buildSignature();
  }

  /** Build the plain-text fallback from a config object. */
  function buildPlain(config) {
    setConfig(config);
    setPhotoData(config && config.photoData);
    setLogoData(config && config.logoData);
    return plainText();
  }
`;

const api = ['build', 'buildPlain', 'DEFAULT_LOGO'];

const esm = [
  BANNER,
  'const __signature = (function () {',
  '  "use strict";',
  '  let photoData = null;',
  '  let logoData = null;',
  body,
  WRAPPER,
  '  return { ' + api.map((n) => n + ': ' + n).join(', ') + ' };',
  '})();',
  '',
  api.map((n) => `export const ${n} = __signature.${n};`).join('\n'),
  '',
  'export default __signature;',
  '',
].join('\n');

await mkdir(resolve(root, 'src/signature'), { recursive: true });
await writeFile(resolve(root, 'src/signature/engine.js'), esm, 'utf8');

console.log('Extracted signature engine:');
console.log('  src/signature/engine.js  ' + esm.split('\n').length + ' lines');
