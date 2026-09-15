# Prulene's Dashboard

## September 2026 workspace upgrade

The app now opens to a daily overview with real follow-up counts, provider contacts,
favorites, recent templates, and an autosaving notepad. Its active email library
contains 75 templates across patient messages, patient outreach, provider
relationships, clinical coordination, and practice updates. The library includes
both one-to-one drafts and campaign-ready formats, with audience and message type
called out before a template is opened.

Use **Email library** (or Ctrl/Cmd+K) to search and filter templates. Star a template
to keep it in your favorites. Add providers in **Provider directory** and choose
**Write an introduction** to fill their name into the editor. **Follow-ups** supports
due dates, priorities, completion, and editing. Call-note actions can be added to
the follow-up tracker. Counts are derived from local records; the app does not
send email, synchronize across devices, or send scheduled notifications.

There is no chat. An earlier "General chat" was removed because it only saved
messages in the sender's own browser, so it looked like a team chat without being
one. Messages stored by that build are deleted the next time the workspace loads.

The redesign lives in `src/workspace.ts` and `src/workspace.css`; provider content
is in `src/library/providers.ts`. It uses the existing Vite/TypeScript stack and
IndexedDB adapter without new runtime dependencies. The damaged transcription
format and action modules were recovered from the prior build's source maps;
the summary helper now exposes the existing rule-based notes as text.

Run `npm run dev` for source development or `npm run build` followed by
`npm run preview` for a production preview. Older product notes follow below.

---

Three tools for a virtual healthcare assistant: a **template studio** that fills
itself in and checks itself before you send, an **email signature builder**, and
a **call transcriber** that turns a recording into a transcript and the
follow-ups it implies. The first two paste cleanly into Gmail; the third hands
off into the first.

**No accounts. No server. Nothing leaves the browser.**

Requirements and rationale live in [`doc/prd.md`](doc/prd.md).

---

## Quick start

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm test` | Full test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | Types only |
| `npm run extract` | Regenerate both engines from the original HTML files |
| `npm run vendor:ort` | Re-copy the ONNX runtime into `public/ort/` (also runs on install and build) |
| `npm run snapshots` | **Re-baseline the golden snapshots.** See the warning below. |
| `python scripts/build-library.py` | Rebuild `templates.json` after editing the library |

---

## How it fits together

```
dispatch_email_studio.html      the original single-file tool - the source of truth
        │  scripts/extract-engine.mjs
        ▼
src/engine/engine.js            generated, verbatim, never hand-edited
src/engine/engine.d.ts          types for the generated file

upwell-email-signature-builder.html   the original signature tool
        │  scripts/extract-signature.mjs
        ▼
src/signature/engine.js         generated the same way
        │
        ├── src/merge/          merge fields, validation, the export guard
        ├── src/library/        75 templates as data + the loader
        ├── src/checks/         PHI scanner, compliance, a11y, deliverability
        ├── src/export/gmail.ts Gmail-tuned paste output
        ├── src/store/          IndexedDB, practice profile, drafts
        └── src/main.ts         two-pane UI: details, preview, copy

src/transcribe/                 the call transcriber — no generated code here
        ├── audio.ts            any format → mono 16 kHz float, in the browser
        ├── worker.ts           Whisper via Transformers.js, off the main thread
        ├── engine.ts           the main thread's side: progress, cancel
        ├── segments.ts         chunks → speaker turns, and every edit to them
        ├── actions.ts          follow-ups, details, and which template to open
        ├── format.ts           TXT · Markdown · SRT · VTT · JSON
        └── store.ts            transcripts in IndexedDB; audio deliberately not
```

## Design presets

The engine has always carried **six layouts and six colour sets**; nothing
exposed them, so every template rendered in whatever combination it happened to
be authored with. The **Design** tab in the sidebar makes them selectable.

The thumbnails are schematics drawn in the palette currently chosen, so layout
and colour can be judged together rather than one at a time. Two tests keep the
picker honest: every layout must draw differently from every other, and every
palette must too — a picker of six identical pictures is worse than none.

A choice is stored **per template**, so a newsletter can be airy and a closure
notice loud, and `normalizeDesign()` discards a stored theme the engine no
longer has rather than rendering nothing.

## Photos in templates

Marketing and newsletter templates are photo-led these days: an `image` merge
field carries a hosted photo URL, with a required description field beside it
for readers whose clients block images. Three engine blocks place them:

| Syntax | Renders as |
|---|---|
| `[Image: url\|alt\|caption]` | Full-width rounded photo, optional centered caption |
| `[Quote: text\|name]` | Tinted pull-quote card with attribution |
| `[Feature: url\|alt\|heading\|body]` | Photo beside text, alternating sides, stacking on mobile |

An `image` field shows a live thumbnail and a **Stock photos** button in the
fill form: a small curated set of calm, healthcare-appropriate photos from
Unsplash's CDN (free to use, every URL verified). Picking one also fills the
matching `…_alt` field, so the default state passes the accessibility review.
Images are hosted URLs because a mail client cannot load a file off the
sender's drive — nothing is uploaded by this tool.

## Template organisation

The nine categories group into three families, split by **who the message is
for** — which is how a VA actually reaches for one:

| Family | Categories |
|---|---|
| Patient messages | Scheduling · Intake · Insurance & billing |
| Outreach & marketing | Marketing · Newsletter · Outreach |
| Practice & clinical | Clinical coordination · Care follow-up · Announcements |

The gallery uses them twice: as grouped navigation down the left, and as
section headings in the grid. Tests assert the families cover every category
exactly once and account for every template, so a new category cannot quietly
go homeless.

## Interface

Both tools use the same shape: **details on the left, live preview on the
right, actions along the bottom.**

Three decisions keep the working view free of nested scrollbars, which was the
main complaint about the previous layout:

- **The template library is a full-width gallery**, not a third column. It opens
  over the workspace, so browsing gets room and the working view stays two panes.
- **Fields the practice profile already answers collapse into a group.** A
  typical template asks four to eight questions instead of fourteen.
- **The review is a drawer**, not a pane competing for width.

Scrollbars that remain are thin and appear only on hover.

### The engines are generated, not written

Both are extracted verbatim from the original single-file tools. The signature
extractor makes exactly one change: the original read every input straight from
the DOM (`v('accent')` → `$('accent').value`), which made it unusable outside
that page. That reader becomes a config-object read; nothing else is touched.

`src/engine/engine.js` is extracted from `dispatch_email_studio.html`.
It is ~350 lines of dense email-HTML string building that already renders
correctly in Outlook, Gmail and Apple Mail. That correctness is expensive to
re-earn, so the code is **moved and typed, never rewritten**.

Do not edit `engine.js` by hand — the next `npm run extract` overwrites it.
To change rendering, edit the original HTML file and re-extract.

### The golden tests are the safety net

`tests/golden/snapshots/` holds 38 committed renders covering every theme, every
palette, every block type, and the non-default numeric settings. Any change to
the engine must reproduce them byte-for-byte.

> **`npm run snapshots` re-baselines those files.** Only run it when you have
> *intentionally* changed the output, and read the resulting diff carefully. A
> casual re-baseline silently discards the protection.

The suite is deliberately sensitive. When the body line-height multiplier was
changed from `1.62` to `1.6` during testing, exactly one snapshot failed — the
one using a non-default font size, because at the default 15px both round to the
same pixel value. A defaults-only suite would have missed it.

---

## The call transcriber

A VA's day is mostly the phone. The email they have to send afterwards is
already in this app; the call that decides which email it is was not.

**The audio never leaves the machine.** Whisper runs in the browser as ONNX —
WebGPU where the machine has it, WASM on CPU where it does not. There is no
API key, no account, no per-minute cost, and no request carrying patient audio
to anyone. That is not a cost optimisation; it is the only arrangement that
lets a VA transcribe a patient call without a business associate agreement.

### Why not Claude, or an API

Claude cannot do this. Its API accepts text, images and documents — there is no
audio input at all, on any model. Neither can a chat subscription be pointed at
the problem: Claude Pro/Max and ChatGPT Plus do not include API credits, and
API access is billed separately from zero.

The deeper reason is architectural. The dashboard is a static site with no server,
so any API key would ship to the browser in readable form, and `vercel.json`
sets `connect-src` narrowly enough that the call would be blocked anyway.
Adding a cloud transcriber means adding a backend, which costs the app its
offline guarantee and its central privacy claim in the same move.

An LLM would earn its place *after* transcription — summarising, drafting the
reply. That step is deliberately not here. See "call notes" below.

### The one network request

Model weights are fetched from Hugging Face on first use and then served from
the browser's cache. That fetch carries no audio, no transcript and no
identifier; it is a static file download, and it is the only request this tool
makes. Everything after it works with the network off.

| Tier | Model | On WebGPU | On CPU |
|---|---|---|---|
| Fast | `whisper-tiny` | ≈114 MB | ≈39 MB |
| Balanced *(default)* | `whisper-base` | ≈197 MB | ≈73 MB |
| Accurate | `whisper-small` | ≈300 MB | ≈250 MB |

Two figures because the backend picks the weight format, and the order
reverses: the CPU build uses 8-bit weights while the GPU build uses 4-bit
weights. Accurate deliberately uses Whisper Small rather than Large Turbo: it
is a meaningful quality step above Balanced without making a user wait for a
gigabyte-scale first load. The picker shows whichever number that machine will
actually download, because a size that is wrong half the time is worse than
none.

### Speaker labels are a guess, and say so

There is no acoustic diarization here. Telling voices apart needs a second
model and still needs correcting; instead, a silence longer than 0.9 seconds is
treated as a handover and speakers alternate. On a two-party phone call that is
right most of the time and *obviously* wrong when it is wrong, which is the
useful failure mode.

The heuristic's characteristic failure is missing one handover, which inverts
every label after it — so alongside the per-turn toggle there is a "from here
to the end" control, because fixing that a row at a time on an hour-long call
is not a feature anyone would use twice.

Every surface that shows a label says it was guessed, and so does the Markdown
export. A heuristic presented as "speaker identification" and then filed in a
chart is the genuinely harmful version of this feature.

### Call notes, without a model

Three rule-based passes over the transcript: commitments someone made,
details worth copying, and which of the template library's formats the call points at. A
suggestion opens the template — it does not fill it, because merge fields want
the practice's real values and pre-filling them from machine transcription
would put unread text into a patient's inbox.

The rules follow `checks/phi.ts`: **precision over recall.** A commitment needs
a first-person subject and a future verb, so `I'll send the superbill` is a
task and `we sent the forms` is not. A member number must be introduced by a
word like "member" or "policy" — unanchored, that pattern matches every dosage
and billing code in the call. A panel of eleven items that are mostly filler
gets collapsed once and never reopened, taking the two real ones with it.

### What is not stored

**The recording.** A transcript is a few kilobytes; an hour of audio is tens of
megabytes, and keeping it would exhaust the origin's storage quota within a few
calls — at which point IndexedDB starts refusing writes and the *drafts* stop
saving too. Playback works from the file you opened, for as long as the tab is
open, and the UI says so rather than implying a recording is kept.

It is also the safer default. A browser profile quietly accumulating recordings
of patient calls is a liability on a shared or lost laptop, and nobody would
have chosen it on purpose. "Clear all saved data" counts transcripts separately
and names them, for the same reason.

Because of that, playback is tied to the **specific** transcript the open file
produced. Reopen a saved transcript from a different call and the player hides
and timecodes refuse to seek, rather than playing whatever audio happens to be
loaded. Playing the wrong recording gives no sign that it is wrong, which in
this setting means listening to a different patient.

The player first uses the browser's native audio decoder. If Chrome cannot
play a format that the transcriber can still read — some telephony WAV codecs
are the usual example — it converts the decoded samples to a temporary mono
PCM WAV in memory. That compatibility copy is local, is not uploaded or saved
to the transcript, and is released when another file is opened.

### Two pins worth knowing about

`@huggingface/transformers` is pinned to an **exact** 3.8.1. On 4.x every
Whisper model fails to open a session on the CPU backend with
`TransposeDQWeightsForMatMulNBits Missing required scale`. It reproduces with
the library's own default configuration — every model, every dtype including
fp32, every optimization level, weights vendored or from the library's own CDN.
Nothing here triggers it and nothing here can work around it. Before widening
that pin, transcribe a file on a machine with **no WebGPU adapter** and confirm
it still runs.

The ONNX runtime's WASM binaries are vendored into `public/ort/` by
`scripts/vendor-ort.mjs` rather than loaded from a CDN, so `script-src 'self'`
holds and the tool does not depend on someone else's uptime. Two build details
keep that honest, both in `vite.config.ts`: the `onnxruntime-web-use-extern-wasm`
export condition, without which Vite bundles a second 23 MB copy of a binary
nothing fetches; and a dev-only middleware, because Vite's dev server refuses to
serve `public/` files through its module pipeline and the resulting failure
names neither `public/` nor the real cause.

### Security headers

Adding this widened `vercel.json` in three places, each the minimum the feature
needs:

| Directive | Added | Why |
|---|---|---|
| `script-src` | `'wasm-unsafe-eval'` | Compiling WebAssembly at all |
| `worker-src` | `'self' blob:` | The transcription worker |
| `connect-src` | `huggingface.co`, `*.hf.co` | Model weights, once |

Threads are deliberately left off. Multi-threaded ONNX needs `SharedArrayBuffer`
and therefore COOP/COEP, which would break every cross-origin photo the
template studio loads. WebGPU is where the speed comes from and needs none of it.

---

## The PDF editor

Opens, edits and exports PDFs entirely in the browser: `pdfjs-dist` renders the
pages and `pdf-lib` writes the result. Nothing is uploaded. Tools: add text,
highlight, draw, shapes, images, sign, organize pages (reorder, rotate,
duplicate, delete, insert blank or image pages), merge, split a selection into
its own file, and compress. Images dropped on the start screen become a new PDF.

**Signatures** can be drawn or uploaded as a PNG, and are saved in this browser
(up to 8) so the next document can reuse them. Uploads are checked by their bytes
rather than their extension, capped at 5 MB, and scaled to at most 1200px before
saving — see `src/store/pdf-signatures.ts`.

The editor module loads on demand, the first time the tool opens. Until it
arrives the start-screen controls are inert and a loading note shows, so nothing
looks clickable before it works; a file dropped in that moment is held rather
than letting the browser navigate away to open it.

---

## The export guard

The single most important behaviour in the app.

If any required merge field is empty, or any `{{placeholder}}` survives into the
rendered output, **export is blocked** — not warned about. Every copy button
disables and the reason is shown.

This exists to prevent one specific failure: sending
`Dear {{patient_first_name}},` to a real patient.

The guard inspects the body, the preheader, **and the final rendered HTML and
plain text**. Checking only the inputs is not enough; a placeholder reaching the
output through the footer or unsubscribe link is exactly how one slips through.

---

## Patient data

Templates are reusable documents, so they hold **merge fields, never literal
patient data** — `{{patient_first_name}}`, not `Sarah`. A reusable document
containing patient information is patient information waiting to be sent to the
wrong person.

Every shipped template is tested for this: no SSN-shaped strings, no `DOB`, no
`MRN`, and only `example.com` addresses.

Nothing is transmitted anywhere. There is no server, no analytics, and no
error reporting that could carry template content off the machine.

---

## The default signature

`DEFAULT_SIGNATURE` in `src/signature/index.ts` is a neutral placeholder
signature (example.com, a 555 number), mirrored in
`upwell-email-signature-builder.html`. The repository is public, so no real
practice or clinician details ship in the code; a test fails if they return.
Colours, logo width and notices still match the original tool, and it renders
complete with no edits.

Two of those fields are **branched on by the generator**, so an invented value
silently produces the wrong signature rather than an error:

| Field | Only valid values |
|---|---|
| `layout` | `photo`, `stack` |
| `logopos` | `under`, `name` |

Two guards keep that from recurring:

- A test renders **every select option** and asserts each produces different
  output. An option that renders identically to another is a dead option.
- `normalizeSignature()` reconciles a stored config against the schema on load,
  so a config saved by an older build cannot carry a value this one does not
  understand.

The shipped values are placeholders, so the practice profile overrides them,
the same way it overrides a template's sample values. The practice profile
itself starts empty. Anything actually typed is left alone.

---

## Adding a template

1. Add an entry in `scripts/build-library.py` — bodies are authored there so the
   block syntax stays readable and JSON escaping stays correct.
2. Run `python scripts/build-library.py`.
3. Run `npm test`. Every template is held to the same standard the tool enforces
   on users: it must parse, declare every field it uses, supply a sample for
   each, resolve completely, and refuse to export when empty.

Mark a template `bulk: true` if it goes to a list. Bulk templates automatically
ask for a postal address and an unsubscribe link, which CAN-SPAM requires.

---

## Deploying

Static output, no backend.

```bash
npm run build      # → dist/
```

`vercel.json` sets the build command, output directory, and security headers
(CSP, `X-Frame-Options`, `nosniff`). Point Vercel at the repo and it will pick
those up.

`dist/` is about 42 MB, nearly all of it the four ONNX runtime binaries in
`dist/ort/`. A browser downloads exactly one of them — the runtime picks by
feature detection — so shipping all four is a deployment cost, not a user one,
and guessing wrong would mean a 404 and a dead tool on somebody's browser.
They are served `immutable` with a one-year cache.

---

## Saved data

Everything is stored in **this browser only**, via IndexedDB. Nothing syncs
between machines, because there is no server.

| What | Where |
|---|---|
| Practice details | One profile — the practice name, phone, booking link, your name. Starts empty |
| Workspace | Follow-ups, provider directory, favorites, recently opened templates, and notes |
| Drafts | One per template, autosaved as you type, restored on return |
| Recent values | Per field, so a provider name typed last week is one click away |
| Transcripts | One per call, with your speaker names and edits. The audio is not kept |
| PDF signatures | Up to 8 uploaded or drawn PNG signatures, reused across documents |

All three editors debounce their writes by about half a second, and flush them
when the page is hidden — otherwise an edit made immediately before closing the
tab sits in a timer and is lost, which is exactly the moment someone believes
the work is done.

Field precedence when a template opens: **template samples → practice profile →
saved draft.** A sample is a placeholder, so the real practice name overrides it;
the user's own draft overrides both.

Recent values deliberately skip one-off fields — patient first names, specific
appointment dates. Remembering a patient's name is exactly what this tool should
not do.

If IndexedDB is unavailable (private browsing, blocked storage), the app still
works and says so in the header rather than silently losing work.

"Clear all saved data" names what it is about to delete instead of asking for
blind confirmation.

---

## Testing status

922 tests across twelve suites:

| Suite | Covers |
|---|---|
| `golden/engine.test.ts` | 38 byte-exact snapshots, parser, inline formatting, output invariants |
| `library.test.ts` | The core patient, outreach, and practice catalogue |
| `providers.test.ts` | Provider-facing templates, fields, categories, and safe defaults |
| `merge.test.ts` | Field extraction, formatting, validation, the export guard |
| `checks.test.ts` | The pre-send review: the PHI scanner and the other check groups, including the 150ms budget |
| `gmail.test.ts` | What survives a Gmail paste, and what is reported as lost |
| `store.test.ts` | Storage adapter, practice profile (ships empty), drafts, recent values |
| `signature.test.ts` | Signature generator, form schema, profile fill-in, placeholder defaults |
| `pdf-signatures.test.ts` | Saved PDF signatures: PNG only, no duplicates, the 8-signature limit, removal |
| `design.test.ts` | Theme/palette presets, thumbnails, category grouping |
| `transcribe.test.ts` | Segment assembly, speaker rules, every export format, the call-notes rules |
| `scratch-summary.test.ts` | Prints sample call-note summaries to read by eye — a smoke test more than an assertion |

The storage layer is tested through a pluggable adapter, so the logic runs in
Node against an in-memory backend and the IndexedDB implementation stays thin.
