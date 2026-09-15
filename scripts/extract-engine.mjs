/**
 * Extracts the rendering engine from the original single-file tool.
 *
 * Why a script instead of copy-paste: the engine is ~350 lines of dense,
 * proven email-HTML string building. Retyping it by hand would be a rewrite
 * with transcription-bug risk. This slices it out verbatim and emits two
 * copies of the SAME code:
 *
 *   src/engine/engine.js    ES module, used by the app
 *   tests/golden/reference.cjs   CommonJS, used as the golden baseline
 *
 * The golden tests diff one against the other, so any future edit to
 * src/engine has to prove it did not change the rendered output.
 *
 * Run: npm run extract
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'dispatch_email_studio.html');

const START = '/* ==================== themes ==================== */';
const END = '/* ==================== review checks ==================== */';

const EXPORTS = [
  'THEMES', 'PALETTES', 'STARTERS',
  'esc', 'inline', 'stripInline', 'parse',
  'renderBlocks', 'headerBlock', 'buildEmail', 'buildText',
];

const html = await readFile(SOURCE, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/);
if (!script) throw new Error('No <script> block found in ' + SOURCE);

const js = script[1];
const from = js.indexOf(START);
const to = js.indexOf(END);
if (from < 0 || to < 0) throw new Error('Engine markers not found; did the source file change?');

const body = js.slice(from, to).trimEnd();

const BANNER = `/**
 * GENERATED FILE - do not edit by hand.
 * Extracted verbatim from dispatch_email_studio.html by scripts/extract-engine.mjs
 *
 * The one deliberate change from the original: the module-scope state object \`S\`
 * was mutated directly by the UI. Here it is encapsulated behind setState/getState
 * so the engine is callable without a DOM. Everything else is byte-identical.
 */
`;

/** The original UI mutated `S` directly; expose it as a small API instead. */
const STATE_API = `
  var DEFAULTS = JSON.parse(JSON.stringify(S));
  function setState(patch) {
    if (!patch) return;
    Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
  }
  function getState() { return JSON.parse(JSON.stringify(S)); }
  function resetState() {
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.keys(DEFAULTS).forEach(function (k) { S[k] = DEFAULTS[k]; });
  }
  function applyPalette(key) {
    var P = PALETTES[key];
    if (!P) return;
    S.palette = key;
    ['primary', 'accent', 'tint', 'line', 'ink', 'page'].forEach(function (k) { S[k] = P[k]; });
  }
`;

const api = EXPORTS.concat(['setState', 'getState', 'resetState', 'applyPalette']);

// --- ES module for the app ---
const esm = [
  BANNER,
  'const __engine = (function () {',
  '  "use strict";',
  body,
  STATE_API,
  '  return { ' + api.map((n) => n + ': ' + n).join(', ') + ' };',
  '})();',
  '',
  api.map((n) => `export const ${n} = __engine.${n};`).join('\n'),
  '',
  'export default __engine;',
  '',
].join('\n');

// --- CommonJS twin, used only as the golden baseline ---
const cjs = [
  BANNER,
  'module.exports = (function () {',
  '  "use strict";',
  body,
  STATE_API,
  '  return { ' + api.map((n) => n + ': ' + n).join(', ') + ' };',
  '})();',
  '',
].join('\n');

await mkdir(resolve(root, 'src/engine'), { recursive: true });
await mkdir(resolve(root, 'tests/golden'), { recursive: true });
await writeFile(resolve(root, 'src/engine/engine.js'), esm, 'utf8');
await writeFile(resolve(root, 'tests/golden/reference.cjs'), cjs, 'utf8');

console.log('Extracted engine:');
console.log('  src/engine/engine.js       ' + esm.split('\n').length + ' lines');
console.log('  tests/golden/reference.cjs ' + cjs.split('\n').length + ' lines');
console.log('  exports: ' + api.join(', '));
