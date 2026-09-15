# Product Requirements Document
## Prulene's Dashboard (formerly Dispatch) — Email Template Studio for Virtual Healthcare Assistants

| | |
|---|---|
| **Product** | Prulene's Dashboard (formerly "Dispatch") |
| **Audience** | Virtual healthcare assistants — VAs supporting medical and behavioral health practices |
| **Origin** | Built for UpWell Psychiatry, LLC; generalized for any VHA |
| **Version** | 0.8 — Phases 0–2 and the call transcriber shipped, plus the provider workspace and PDF editor. Phase 3 not started. |
| **Date** | 2026-09-15 |
| **Status** | Live at https://prulz.vercel.app, deployed from `designhubofficial/prulz`. See §5 for feature status and §7 for phases. |

---

## 1. Summary

**This project is the email template studio.** Not a platform, not a dashboard, not a practice management system. One tool, built properly, for one job: helping a virtual healthcare assistant write, check, and send the email a medical practice runs on.

`dispatch_email_studio.html` already works — 1,469 lines, a markdown-ish parser, themes, palettes, a brand kit, live preview, and pre-send checks. This document is about **expanding it into something a VHA can run their week from**, and generalizing it beyond one practice.

### 1.1 What changes from the current tool

| Today | After |
|---|---|
| Blank editor every time | **A library of ~35 healthcare email templates**, ready to fill |
| `{{name}}` is only flagged inside links | **Real merge fields** — typed, validated, with a Fill mode that produces a finished email |
| Generic email checks | **Healthcare checks** — a PHI scanner, confidentiality notices, consent reminders |
| Two preview modes (dark, narrow) | **A client rendering matrix** — Outlook, Gmail, Apple Mail, mobile, dark mode |
| One file on one desktop | **Shareable** — export a bundle, or send a colleague a link, with no server and no login |
| Nothing is saved | **Local-first autosave** with version history |

### 1.2 What this is not

No accounts. No sign-in. No user roles. No server-side storage. No analytics on who wrote what.

Open the page and it works — including offline, including on a locked-down work laptop, including for a VA at a practice that will never provision them a login. That constraint is the product, not a limitation of it.

### 1.3 Success looks like

| Metric | Target |
|---|---|
| Time to produce a routine practice email | Under 2 minutes, from library to clipboard |
| Templates in the starter library at launch | ≥ 35, across 6 categories |
| Emails sent with an unfilled `{{merge_field}}` | 0 — hard-blocked at export |
| PHI written into a saved template | 0 — flagged before it can be saved |
| Setup required before first use | None. No install, no login, no config. |
| Works with no network connection | Yes, fully |

---

## 2. Who this is for

**A virtual healthcare assistant.** Remote administrative staff supporting a medical or behavioral health practice. They handle scheduling, intake, insurance verification, referral coordination, billing follow-up, and the practice inbox.

What shapes the design:

- **They write the same twelve emails constantly**, with small variations. That is a template problem.
- **They are not designers**, and the email still has to look professional and on-brand.
- **They are often not provisioned** with practice software licenses, admin rights, or a company laptop.
- **They handle PHI daily** and are the person most likely to accidentally put it somewhere it should not be.
- **They may support more than one practice**, so brand settings must be swappable, not hard-coded.

There are no roles and no permission tiers, because there are no accounts. Every user of this tool has the same capabilities.

---

## 3. Design constraints

### 3.1 No accounts, no server

The app is **a static site**. HTML, CSS, and JavaScript served from a CDN. There is no database, no auth provider, no API, and no backend to attack, bill, or maintain.

Consequences, all intentional:

- Nothing to sign up for, so nothing to abandon at a signup screen
- No password to leak, no session to hijack, no user table to breach
- Hosting cost is effectively zero and stays that way
- It works offline once loaded
- **Sharing has to be solved explicitly** — see §4.7. This is the one real cost of the constraint, and it is worth paying.

### 3.2 Nothing leaves the browser

All parsing, rendering, image processing, checking, and **speech recognition** happens client-side. No template, no draft, no logo, no typed text, and no audio is ever transmitted anywhere.

This is what makes the tool safe to use next to patient data. It is the same argument that makes a client-side PDF editor safe: **there is no server to trust, because there is no server.**

**The one exception, stated precisely.** The transcriber fetches Whisper's model
weights from Hugging Face the first time a tier is used, then serves them from
the browser's cache. That request is an outbound static file download. It
carries no audio, no transcript, no template, and no identifier, and nothing is
uploaded in it. Every run after it works with the network off.

This is worth naming rather than glossing, because "nothing leaves the browser"
is the claim the whole product rests on and a reader who later discovers an
unmentioned network call is right to distrust the rest. The alternative — a
transcription API — would mean sending patient audio to a third party under a
BAA, plus a backend to hold the key, and would end the claim rather than
qualify it. See §11 for the decision.

### 3.3 Templates contain no PHI, by design

A template is a *reusable* document. Patient information in a reusable document is patient information waiting to be sent to the wrong person.

**The rule: templates hold merge fields, never literal patient data.** `{{patient_first_name}}`, not `Sarah`.

Enforced by the PHI scanner (§4.3.1), which runs before a template is saved or exported, not only before send.

On emailing PHI generally — worth stating plainly, because VHAs ask:

- HIPAA **does** permit a practice to email PHI to a patient unencrypted where the patient has been informed of the risk and still asks for email. This falls under the individual's right to receive communications by a method they choose.
- The Security Rule treats encryption as *addressable*: a practice must either implement it or document why not, along with an equivalent safeguard.
- Behavioral health adds weight. Substance use disorder records under 42 CFR Part 2 carry stricter redisclosure rules than HIPAA.
- **None of this is the tool's decision.** Dispatch produces the message; the practice's policy governs how it is sent. What the tool does is make sure PHI is never baked into a stored template, and warn when it appears in a fill.

**This tool is not a sending platform.** It does not connect to a mailbox and does not transmit mail. It hands you finished HTML. That keeps it out of the transmission-security question entirely.

---

## 4. The expansion

This section is the project. Each part says what exists now and what gets added.

### 4.1 Template library

**The single highest-value addition.** A VHA opening a blank editor has to write from nothing; a VHA opening a library only has to edit.

~35 starters, written for a real practice, shipped with the app as data. Every one uses merge fields and contains no PHI.

| Category | Templates |
|---|---|
| **Scheduling** | Appointment confirmation · Reminder (24h / 48h) · Reschedule offer · Cancellation acknowledgement · No-show follow-up · Late-cancellation policy notice · Waitlist opening · Recurring series confirmation |
| **Intake** | New patient welcome · Intake packet delivery · Missing paperwork nudge · Insurance card request · Pre-visit checklist · Telehealth join instructions · First appointment what-to-expect |
| **Insurance & billing** | Benefits verification result · Prior authorization submitted · Prior auth approved / denied · Statement reminder · Payment plan offer · Superbill delivery · Out-of-network explanation |
| **Clinical coordination** | Referral acknowledgement to a referring provider · Records request (ROI) · Records release cover note · Provider-to-provider handoff · Care coordination update |
| **Practice announcements** | New provider joining · Holiday hours · Office closure / weather · Policy change notice · Provider departure and transition |
| **Outreach** | Referral partnership introduction · Provider recruiting outreach · Newsletter invitation (opt-in only — §4.3.2) · Community event |

Each template carries a name, a category, a short note on when to use it, its merge field manifest, a suggested subject line, and a preheader.

**Templates are data, not code** — a JSON file in the repo. Adding one is a pull request, not a rebuild. A user can save their own into the same shape.

### 4.2 Merge fields and Fill mode

**The biggest functional gap in the current tool.** Dispatch today builds templates but does not help you *use* one. `{{field}}` appears only as a flag in the link inventory.

**Merge field manifest.** Each template declares its fields:

```json
{ "key": "patient_first_name", "label": "Patient first name",
  "type": "text", "required": true, "sample": "Alex" }
```

Types: `text`, `date`, `time`, `datetime`, `phone`, `email`, `url`, `money`, `choice`. Type drives the input control, validation, and formatting — a `date` renders as *Tuesday, March 4* rather than `2026-03-04`.

**Fill mode.** Pick a template → a form of just its fields → live preview updating as you type → copy the finished email. This is the primary path for daily use; the full editor is for building and editing templates.

**Hard export guard.** If any `{{field}}` is unresolved, **export and copy are blocked**, not warned. This is the difference between a tool that helps and one that lets you send "Dear {{patient_first_name}}" to a patient. Show what is missing, with a jump-to-field link.

**Practice defaults.** Fields like `practice_name`, `practice_phone`, `provider_name` fill from the brand kit and are never re-typed per email.

**Recent values.** Frequently reused entries — provider names, locations — offer a dropdown of what you typed before, stored locally.

### 4.3 Pre-send review

The current `runChecks()` already covers subject length, preheader presence, the Gmail 102KB clipping limit, missing alt text, data-URI logos, text volume, unsubscribe presence, and a link inventory flagging `{{`, `$[`, and `example.com`. **All of that stays.** What follows is added around it, in five groups.

#### 4.3.1 PHI scanner — new, and the reason this tool is different

Runs on the template body before save and before export. Matches patterns that should never appear in a reusable template:

| Pattern | Example |
|---|---|
| SSN | `123-45-6789` |
| Date of birth in context | `DOB: 04/12/1988`, `b. 1988` |
| Medical record / member ID | `MRN 88421`, `Member ID: XZ4419` |
| ICD-10 codes | `F41.1`, `Dx:` |
| Medication with dose | `sertraline 50mg` |
| A person's name beside a clinical term | heuristic, low confidence, flagged softly |
| Literal contact details where a merge field belongs | a real phone number in body text |

**Findings are advisory but loud.** Saving with an unresolved PHI flag requires an explicit "this is sample data, keep it" acknowledgement — the tool cannot know for certain, so it must not block silently, and must not pass quietly either.

A one-click **"replace with merge field"** action on each finding turns `Sarah` into `{{patient_first_name}}`. Fixing has to be easier than dismissing, or it will be dismissed.

#### 4.3.2 Compliance checks — new

- **Physical postal address present** on anything marked bulk or marketing (CAN-SPAM)
- **Working unsubscribe** on bulk — expands the current footer check
- **Newsletter consent reminder.** Outreach templates carry a standing note that a newsletter invitation must go to someone who opted in, or be a genuine one-to-one message. Automated harvesting into a bulk list is an aggravating factor under CAN-SPAM, and spam complaints degrade the same sending domain the practice uses for patient mail.
- **Confidentiality notice** available as a snippet, flagged as missing on clinical-coordination templates
- **42 CFR Part 2 notice** offered where substance use disorder content is detected

#### 4.3.3 Accessibility checks — new

- Minimum body font size (14px; 16px recommended)
- Text/background contrast — **port the contrast meter that already exists in the signature builder**, which does this well
- Heading order sequential, no skipped levels
- Layout tables carry `role="presentation"`
- Document `lang` attribute set
- Descriptive link text — flags "click here" and bare URLs
- Meaningful alt text on images; decorative images have empty alt

#### 4.3.4 Deliverability checks — new

- Spam trigger vocabulary, weighted, with the specific words highlighted
- ALL CAPS and excessive punctuation in subject or headings
- Image-to-text ratio
- Link count, and any URL shortener (shorteners hurt healthcare mail badly)
- Subject line emoji — inconsistent rendering, reads as promotional
- Preheader length (40–100 characters)
- Merge field inside a URL — flagged today, promoted to a blocking error

#### 4.3.5 Rendering checks — new

- **Outlook (Word engine):** flags `border-radius`, `background-image`, `flex`, `max-width`, and padding on `<a>` — none of which Outlook honors. Offers the VML button fallback (§4.4).
- **Dark mode:** flags pure-white logos and hard-coded near-black text that inverts badly
- **Gmail:** `<style>` block handling, alongside the existing 102KB clipping check
- **Mobile:** fixed widths over 600px, tap targets under 44px

### 4.4 Client rendering matrix

Today: dark and narrow previews. Becomes a proper matrix, switchable, two at a time side by side:

| Preview | Simulates |
|---|---|
| **Outlook (Windows)** | Word rendering engine — no rounded corners, no background images, VML buttons |
| **Gmail (web)** | Style handling, with the 102KB clip point drawn as a line in the preview |
| **Apple Mail** | Close to standards |
| **Mobile 375px** | iPhone width |
| **Mobile 320px** | Smallest realistic |
| **Dark mode** | Forced inversion, as Outlook.com and Gmail apply it |
| **Images blocked** | Default state in many clients — partly present today, formalized |
| **Plain text** | The text alternative, already produced by `buildText()` |

**VML button fallback** is a concrete generator change: wrap buttons in conditional `<!--[if mso]>` VML roundrect markup so Outlook renders a button rather than a bare link.

### 4.5 Snippets and new block syntax

**Snippets** are reusable partials — write once, use across templates:

Confidentiality notice · Telehealth join instructions · Cancellation policy · Office directions and parking · Insurance disclaimer · Crisis resources (988) · Practice signature block

Additions to the block syntax (full reference in Appendix A):

| Syntax | Effect |
|---|---|
| `[Snippet: name]` | Insert a saved snippet |
| `[Spacer: 24]` | Explicit vertical space |
| `[Columns: left \|\| right]` | Two-column row, stacking on mobile |

Deferred to roadmap: conditional blocks (`[If: has_copay] … [/If]`). Genuinely useful for templates like benefits verification, but they complicate the parser, the checker, and Fill mode all at once. Not in v1.

### 4.6 Export targets

Current: copy rich, download HTML, download text. Adds:

- **`.eml` file** — opens directly in Outlook or Apple Mail as a real draft, subject and preheader intact. The most-requested export in tools like this.
- **Paste-tuned HTML** for Gmail, Outlook, and Zoho (UpWell already uses Zoho), each accounting for what that editor strips
- **Template bundle `.json`** — the shareable unit, §4.7
- **Print / PDF** of the rendered email, for a chart copy or a paper file

### 4.7 Sharing without accounts

The constraint in §3.1 means sharing must be explicit. Three mechanisms, covering different cases:

**1. Bundle file (`.dispatch.json`).** Export one template or the whole library — including brand kit and snippets — as a file. Email it, drop it in shared storage, commit it to a repo. Import merges into the local library with a conflict prompt. Full fidelity, any size, works offline. **This is the primary mechanism.**

**2. Share link.** Template JSON → compressed → base64url → placed in the **URL fragment**. A fragment is never sent to the server, so the template stays private even though the link travels over the internet. Opening the link loads it into the editor.
Images are stripped from share links and replaced with a placeholder, because base64 images blow past practical URL limits — the UI says so when it strips one. Past roughly 8KB compressed, the tool declines and points at the bundle file.

**3. Shipped starter library.** The ~35 templates in §4.1 ship with the app, so a new user has everything without importing anything.

### 4.8 Persistence and version history

- **IndexedDB autosave** on every edit, debounced. Closing the tab loses nothing.
- **Version history** per template — last 20 versions, with restore and a visual diff
- **Draft recovery** after a crash or accidental close
- **Explicit "clear all local data"** control, with a confirmation naming what will be deleted
- A clear statement in the UI that storage is per-browser: another machine, another browser, or a cleared cache means the data is not there. Bundle export is how you move it.

---

## 5. Feature requirements

A feature is done when every box is checked.

### F1 — Template library
- [x] ≥ 35 starter templates across the 6 categories in §4.1 — 75 across 9 categories, grouped into three families
- [x] Templates are JSON data, not hard-coded markup — `templates.json`, plus provider templates declared as data in `providers.ts`
- [x] Browse by category; search by name and body text
- [x] Preview before opening — gallery cards show a thumbnail of the template's own design
- [ ] Duplicate any template to a personal copy
- [x] Every starter passes the full check suite with zero errors — **the library is the reference implementation of good practice**
- [x] No starter contains PHI, real names, or real contact details

### F2 — Merge fields and Fill mode
- [x] Field manifest per template with the nine types in §4.2 — plus `image` (F10)
- [x] Type-appropriate inputs and validation; dates render in long form
- [x] Fill mode: form on one side, live preview on the other
- [x] **Export and copy hard-blocked while any required field is unresolved**, with a list of what is missing
- [x] Practice defaults auto-fill from the brand kit
- [x] Recent values offered per field, stored locally
- [x] Fields auto-detected from body text when a manifest is absent

### F3 — Pre-send review
- [x] All existing checks preserved and passing
- [x] Five new groups per §4.3, each collapsible, each finding explaining *why* it matters
- [x] Findings ranked error → warning → pass
- [ ] PHI scanner runs before save and before export — it runs live on every keystroke and gates export; there is no save-a-template step yet
- [ ] PHI findings offer one-click replacement with a merge field — `phi.ts` produces the replacement suggestion; no button applies it yet
- [x] Errors block export; warnings do not
- [x] The whole suite runs in under 150ms on a long template — it runs on every keystroke

### F4 — Rendering matrix
- [ ] Eight preview modes per §4.4 — three so far: desktop, mobile, plain text (the signature preview adds light, dark, images off)
- [ ] Two modes side by side
- [ ] Gmail clip point drawn as a line in the preview — the size limit is checked in the review instead
- [x] VML button fallback in generated Outlook HTML
- [ ] Preview switching does not re-parse from scratch

### F5 — Snippets and syntax
- [ ] Seven starter snippets per §4.5
- [ ] User-created snippets, saved locally
- [ ] `[Snippet:]`, `[Spacer:]`, `[Columns:]` implemented in parser, renderer, plain-text output, and checks
- [ ] Existing syntax unchanged — **every current template must still parse identically**
- [ ] In-app syntax reference matching Appendix A

### F6 — Export
- [x] Copy rich, HTML, plain text — preserved
- [ ] `.eml` export opening correctly in Outlook and Apple Mail
- [ ] Paste-tuned variants for Gmail, Outlook, Zoho — Gmail done (`src/export/gmail.ts`); Outlook and Zoho not yet
- [ ] Print/PDF of the rendered email
- [x] Every export path runs the export guard first

### F7 — Sharing
- [ ] Bundle export/import per §4.7, with conflict resolution on import
- [ ] Share link via URL fragment, compressed
- [ ] Images stripped from share links, with a visible notice
- [ ] Oversize share links refused, pointing at bundle export
- [ ] **Imported bundles treated as untrusted input** — HTML sanitized, no script execution, no `javascript:` URLs

### F8 — Persistence
- [x] IndexedDB autosave, debounced
- [ ] 20-version history per template, with restore and diff
- [x] Draft recovery after unexpected close
- [x] Clear-all-data control naming what it deletes
- [x] Graceful behavior in private browsing where IndexedDB may be unavailable — the app still works and says saving is off

### F9 — Brand kit (multi-practice)
- [ ] Colors, fonts, logo, practice name, contact details, social links, booking link — covered, but spread across design presets, the email identity logo, Practice details and the signature rather than one brand kit
- [ ] ~~**Multiple named profiles**, switchable~~ — dropped: §10 Q3 settled on one practice per install
- [x] Starts empty; each install enters its own practice values (no real practice's details ship in the public repo)
- [x] Feeds merge field defaults and template rendering
- [ ] Included in bundle export

### F10 — Photography and visual content
- [x] `image` merge-field type with http(s) validation, formatted verbatim into `<img src>`
- [x] Curated stock library (Unsplash CDN, free to use) grouped into three moods, each URL verified to serve `image/jpeg`
- [x] Image fields render a live thumbnail plus a "Stock photos" picker in Fill mode
- [x] Picking a photo also fills the matching `…_alt` field when untouched, so the default state passes the accessibility review
- [x] Captions: `[Image: url|alt|caption]` renders a centered caption beneath the photo
- [x] Social proof: `[Quote: text|name]` renders a tinted pull-quote card
- [x] Editorial pair: `[Feature: url|alt|heading|body]` renders photo beside text, alternating sides (zig-zag), stacking on mobile
- [x] Growth templates (marketing, newsletter, referral outreach) re-authored around photos with one primary CTA per mail
- [ ] Uploaded/embedded images for email bodies (deferred: mail clients need hosted URLs, which the stock library already provides)

---

## 6. Architecture

### 6.1 Stack

| Layer | Choice | Why |
|---|---|---|
| App | **Static site** — HTML/CSS/JS | No backend to run; secure, offline-capable, free to host |
| Build | **Vite + TypeScript** | Types on the parser and checker; existing logic ports directly |
| Framework | **None, or Preact if the UI demands it** | The current tool is vanilla and works. Do not add React for its own sake. |
| Storage | **IndexedDB**, behind a small in-house adapter (`src/store/adapter.ts`) | Drafts, practice profile, workspace, transcripts, PDF signatures |
| Compression | `CompressionStream`, `lz-string` fallback — planned, Phase 3 | Share links |
| Hosting | **Vercel static** — live at https://prulz.vercel.app | Push to deploy, preview per branch |
| Source | **GitHub**, public repo `designhubofficial/prulz` | Public, so no real practice or clinician details are committed |
| Sanitizer | **DOMPurify** — planned, Phase 3 | Imported bundles and share links are untrusted |

**No Supabase. No auth provider. No database.** All dropped along with accounts — they solved a problem that no longer exists.

### 6.2 Porting the existing tool

`dispatch_email_studio.html` is working, proven-in-the-wild code. Email HTML is unforgiving, and that generator is already correct. **It is moved and typed, never rewritten from scratch.**

1. **Extract the engine.** `parse`, `renderBlocks`, `buildEmail`, `buildText`, `runChecks`, and the theme/palette tables move into `src/engine/` as TypeScript modules. Behavior unchanged.
2. **Lock it with golden tests.** Snapshot the current HTML output for a set of representative templates *before* any change. Those snapshots become the regression suite — every later change has to prove it did not alter existing output.
3. **Build the new UI around the engine**, then add §4 features one at a time, with the golden tests staying green.

Step 2 is not optional. It is what makes everything after it safe.

### 6.3 Project layout

The layout planned in the original spec. The tree as built is in the README, under "How it fits together".

```
src/
  engine/      parse.ts  render.ts  buildEmail.ts  buildText.ts
               themes.ts  palettes.ts
  checks/      phi.ts  compliance.ts  a11y.ts  deliverability.ts
               rendering.ts  index.ts
  library/     templates/*.json   snippets/*.json
  store/       db.ts  history.ts  brand.ts
  share/       bundle.ts  link.ts  sanitize.ts
  export/      html.ts  eml.ts  text.ts  print.ts
  ui/          editor  fill  library  review  preview
tests/
  golden/      snapshots of current output — the regression net
  checks/      one fixture per rule, positive and negative
doc/
  prd.md
```

### 6.4 Security

A small surface, but not zero:

- **Imported bundles and share links are untrusted.** Sanitize with DOMPurify before render; strip `<script>`, event handlers, and `javascript:` URLs. A malicious `.dispatch.json` is the only real attack path this app has.
- Preview renders in a **sandboxed iframe**, so template content cannot reach app state
- Strict CSP; no `eval`, no remote script
- No telemetry, no analytics, no error reporting that transmits template content

---

## 7. Phases

| Phase | Scope | Effort | Exit criteria |
|---|---|---|---|
| **0 — Port and lock** ✅ | Repo, Vite scaffold, engine extracted + typed, **38 golden snapshots**, builds clean | done | Output reproduced byte-for-byte; regression net verified by deliberately breaking it |
| **1 — Make it usable daily** ✅ | 35-template library, merge fields, Fill mode, export guard, Gmail export, three-pane UI, IndexedDB autosave, draft recovery, recent values, practice profile | done | A VHA can send a real practice email from a library template |
| **2 — Make it safe** ✅ | PHI scanner, compliance / a11y / deliverability / rendering checks, rendering matrix, VML buttons | done | A template containing PHI cannot be saved unacknowledged |
| **3 — Make it shareable** | Bundle export/import, share links, snippets, new syntax, `.eml` and paste-tuned exports, version history | ~2 weeks · not started | One VHA sends another a template and it opens correctly |
| **T — Call transcriber** ✅ | Local Whisper, speaker turns, transcript editing, five export formats, rules-based call notes, hand-off into the template picker | done | A recording becomes an editable transcript with the network off, after one model download |
| **W — Provider workspace** ✅ | Overview, email library (75 templates), follow-ups, provider directory, favorites, notes | done | A VA can run the day from one screen |
| **P — PDF editor** ✅ | Local PDF editing: text, highlight, draw, shapes, images, organize, merge, split, compress, and signatures (drawn or uploaded PNG, saved in the browser) | done | A PDF can be signed and exported with the network off |

Multi-practice brand profiles were dropped from Phase 3 (§10 Q3). Each phase ends deployable and useful; the app has been live on Vercel since 2026-09-15.

---

## 8. Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Rewriting the generator breaks email rendering | Broken or off-brand mail reaching patients | **High** if rewritten | §6.2 — extract and snapshot, never rewrite. Golden tests gate every change. |
| PHI scanner false positives get everything dismissed | The one healthcare-specific feature becomes noise | **High** | Tune for precision over recall; make one-click fixing easier than dismissing; never block silently |
| PHI scanner false negatives breed false confidence | PHI ships inside a template | Medium | State plainly in the UI that it is an aid, not a guarantee. It never says a template is "clean" — only that it found nothing. |
| Browser storage cleared, work lost | Frustration, abandonment | Medium | Prominent bundle export, autosave, version history, explicit per-browser warning |
| Malicious imported bundle | XSS in the user's browser | Low | Sanitize on import, sandboxed preview iframe, strict CSP |
| Feature creep back toward a platform | Never ships | Medium | §1.2 is the scope boundary. Other tools live in §9 as roadmap, not this project. |
| Users expect it to send email | Confusion, support burden | Medium | Say it on the surface: this produces the email, your mail client sends it |
| Guessed speaker labels are trusted as identification | Wrong attribution filed in a patient record | **High** if unlabelled | Never call it identification. Every surface and the Markdown export state that labels are guessed from pauses. One-click reassignment, including "from here to the end". |
| Transcription errors treated as verbatim | A misheard dose or number acted on | Medium | The transcript is editable in place, playback is beside it, and the caveat sits above the text rather than in a footer |
| Saved transcripts accumulate on a shared laptop | PHI at rest on an uncontrolled machine | Medium | Audio is never stored; transcripts are counted and named by "clear all saved data" rather than deleted silently |
| Model weights fetched from a third party | A network dependency inside a no-server tool | Low | One static download, no audio or identifier attached, cached afterwards. The runtime's own binaries are vendored so nothing else is fetched at runtime. |

---

## 9. Roadmap — the rest of the toolkit

Deferred, not cancelled. Each would be a **separate static tool sharing the same shell and brand kit** — the model that keeps this one simple.

| Tool | Note |
|---|---|
| **Email signature builder** ✅ | Ported. Shares the brand kit and the contrast meter. |
| **Call transcriber** ✅ | Shipped as `src/transcribe/`. Whisper in the browser via Transformers.js — WebGPU with a WASM fallback, weights cached after one fetch. The exception to the separate-tool rule: it earns its place in *this* shell because its output is the email the studio already builds, and it hands off directly into the template picker. |
| **PDF suite** — partly ✅ | Shipped as the PDF editor inside this shell: merge, split, sign, annotate, organize, compress. Form fill, redaction and OCR remain. Same no-server argument. |
| **Provider lead finder** | Verified research preserved in Appendix B — that work is done and still valid. |
| **Screening calculators** | PHQ-9, GAD-7, ASRS, C-SSRS. Compute-only, nothing stored. |
| **Coding cheat sheet** | E/M plus psychotherapy add-ons, ICD-10 quick reference. |

---

## 10. Open questions

1. ~~Which mail client do users paste into most?~~ **Answered: Gmail.** `src/export/gmail.ts` is built and tested against what Gmail strips.
2. ~~Is the starter library UpWell-flavored or practice-neutral?~~ **Answered: neutral.** The templates use `example.com` and a generic practice; the practice name is a merge field.
3. ~~How many practices does a typical user support?~~ **Answered: one.** The profile is a settings panel, not a header switcher. The storage layer keys a single profile; multi-profile would be an additive change if that ever alters.
4. **Should templates support Spanish or bilingual output?** Real value in healthcare, meaningful scope. Not in v1. The transcriber already accepts Spanish and Tagalog audio, so the input half of this is answered.
4a. **Should the transcriber ever gain an LLM summariser?** Deferred deliberately, not forgotten. It would need a backend to hold a key, a BAA with the provider, and the PHI scanner gating what may be sent — three things the current architecture does not have. The rules-based call notes cover the common cases without any of them.
5. ~~Who owns the GitHub repo and Vercel project?~~ **Answered:** the code lives at `github.com/designhubofficial/prulz` (public) and deploys to Vercel at https://prulz.vercel.app.
6. **Is the template coverage right?** The library has grown from 35 to 75 templates across 9 categories; marketing and newsletter stay weighted per the team's priority. Gaps are cheap to fill — a template is a data entry, not code.

---

## 11. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-07 | **Transcription runs locally, never through an AI API** | Claude accepts no audio on any model, and chat subscriptions carry no API credits — but the deciding reason is §3.1/§3.2: a static site cannot hold a key, and patient audio to a third party needs a BAA. Local Whisper keeps the guarantee the product is built on. |
| 2026-09-07 | **Speaker labels are a pause heuristic, presented as a guess** | Acoustic diarization is a second model and still needs correcting. A silence-based guess on a two-party call is right often enough to save time and wrong visibly, which is the safe failure. |
| 2026-09-07 | **Call notes are rules, not a language model** | Same constraint as above, and rules run with the wifi off. Precision over recall, as in `checks/phi.ts`. |
| 2026-09-07 | **Recordings are not stored; transcripts are** | An hour of audio would exhaust the origin's storage quota within a few calls and stop drafts saving. It is also the wrong thing to leave on a shared laptop. |
| 2026-09-06 | **Scope narrowed to the email template studio** | One tool built properly beats five built partly |
| 2026-09-06 | **No accounts, no server, static site** | Nothing to sign up for, nothing to breach, free to host, works offline. Sharing solved explicitly instead (§4.7). |
| 2026-09-06 | Supabase, auth, and RLS dropped entirely | They existed to serve accounts and roles, which no longer exist |
| 2026-09-06 | Audience generalized to virtual healthcare assistants | UpWell becomes the default brand profile, not a hard-coded assumption |
| 2026-09-06 | Templates hold merge fields, never literal patient data | A reusable document containing PHI is PHI waiting to be missent |
| 2026-09-06 | Unresolved merge fields hard-block export | The failure mode is sending "Dear {{patient_first_name}}" to a patient |
| 2026-09-06 | Existing generator extracted and snapshot-tested, never rewritten | Email HTML is unforgiving; the current output is already correct |
| 2026-09-06 | Conditional blocks deferred | They complicate parser, checker, and Fill mode simultaneously |
| 2026-09-06 | Tool produces email but never sends it | Keeps it out of transmission-security scope entirely |
| 2026-09-06 | Engine extracted by script, not retyped | 350 lines of proven email HTML; a hand-port is a rewrite with transcription risk. `npm run extract` is reproducible. |
| 2026-09-06 | Golden snapshots cover non-default settings, not just defaults | A line-height regression was invisible at the default font size and caught only by the large-type fixture |
| 2026-09-06 | The export guard inspects rendered output, not just inputs | A placeholder leaked through the footer while the gate reported "Ready to send" |
| 2026-09-06 | Bulk templates ask for postal address and unsubscribe as real fields | CAN-SPAM requires both; making them fields means they are validated and gated like everything else |
| 2026-09-06 | Storage sits behind a pluggable adapter | Logic is testable in Node; the IndexedDB implementation stays thin, and a browser that blocks storage degrades to "works but forgets" rather than failing |
| 2026-09-15 | Default profile and signature ship placeholders, not a real practice's details | The repository is public. The postal address still stays blank: CAN-SPAM needs a genuine address, and a plausible-looking placeholder is worse than an empty required field |
| 2026-09-06 | Field precedence is samples → profile → draft | A sample is a placeholder, not user work, so the profile must be able to override it |
| 2026-09-06 | Recent values skip patient names and specific dates | Remembering a patient's name is exactly what this tool should not do |
| 2026-09-06 | Email images are hosted URLs, chosen from a curated stock library or pasted in | Mail clients cannot load a file from the sender's drive; a small verified set of calm, healthcare-appropriate photos beats a search field |
| 2026-09-06 | Photo fields are required and pair URL with alt text | Every image block must survive image-blocked clients; the stock picker pre-fills the alt field |

---

## Appendix A — Block syntax reference

**Existing**, unchanged:

| Syntax | Block |
|---|---|
| `Subject: …` | Subject line, travels with the template |
| `# / ## / ###` | Headings |
| `~ text` | Eyebrow label |
| `> text` | Callout |
| `- ` or `* ` | Bulleted list |
| `1. ` | Numbered list |
| `+ ` | Card |
| `\| label \| value` | Table row |
| `@ name \| title \| detail` | Signature block |
| `[Button: label\|url]` | Button |
| `[Stat: value\|label]` | Statistic |
| `---` or `***` | Divider |

**Added** in this project:

| Syntax | Block |
|---|---|
| `[Image: url\|alt\|caption]` | Image with optional caption (engine already parsed `url\|alt`; caption is new) |
| `[Quote: text\|name]` | Tinted pull-quote card with attribution |
| `[Feature: url\|alt\|heading\|body]` | Photo beside text; alternating sides, stacking on mobile |
| `[Snippet: name]` | Insert a saved snippet |
| `[Spacer: 24]` | Vertical space in pixels |
| `[Columns: left \|\| right]` | Two columns, stacking on mobile |
| `{{field_name}}` | Merge field — resolved in Fill mode; blocks export if left unresolved |

---

## Appendix B — Provider lead generation research (preserved)

Verified against the live NPPES API on 2026-09-06. Kept because the work is done and the findings stay valid whenever the lead finder gets built.

**NPI Registry (NPPES)** — `https://npiregistry.cms.hhs.gov/api/?version=2.1` — free, no key, public domain, no redistribution restrictions. The best available source for US healthcare providers.

1. **`enumeration_type` splits the use cases.** `NPI-1` returns individuals (recruiting); `NPI-2` returns organizations (referral partnerships).
2. **Organization records include a named decision-maker** — `authorized_official_*` fields carry name, title, and phone. A live query returned a psychiatry practice's owner — name, credentials, and a direct number. That is a complete outreach record, free.
3. **`taxonomy_description` is a loose prefix match and rejects codes.** `Psychiatry` works; `363LP0808X` fails; strings containing commas fail. `Psychiatry & Neurology` silently matched a *neurologist*, and `Counselor` returned a **massage therapist**. → Query the broad prefix, then filter by exact NUCC code. A `Nurse Practitioner` search in Oregon returned 200 rows, only **10** of them PMHNPs after code filtering, so pagination must be deep.
4. **`state` matches any address on the record, including mailing.** A `state=OR` search returned a provider in Sugar Land, Texas, and a Portland-located provider carried a `TX` license. **License state ≠ practice state ≠ mailing state** — qualify on the license row and show all three.
5. **Limits:** `limit` caps at 200; paginate with `skip`. `result_count` reports the current page only — there is no total-count field. Duplicate rows occur, so dedupe on NPI.

Codes for behavioral health: `2084P0800X` Psychiatry · `363LP0808X` PMHNP · `103TC0700X` Psychologist, Clinical · `1041C0700X` Social Worker, Clinical · `101YM0800X` Counselor, Mental Health · `207Q00000X` Family Medicine · `208000000X` Pediatrics · `207V00000X` OB-GYN. Validate against the current NUCC release before use.

**Not yet verified:** whether NPPES sends CORS headers permitting direct browser calls. The testing above used server-side requests. If CORS is absent, a static build needs a small proxy — which would be the only server component in the whole toolkit, so check this before designing around it.

**Google Places API** is enrichment only — per-record, on explicit click, never bulk. Place IDs may be stored; most other content may not be cached long-term. Map rendering should use MapLibre + OpenStreetMap: free, no key.

**Do not scrape** Psychology Today, Zocdoc, Healthgrades, or LinkedIn.

---

*End of document.*
