/**
 * Prulene's Dashboard — app shell.
 *
 * Two tools, one shape: details on the left, live preview on the right, actions
 * along the bottom. Template browsing is a full-width gallery rather than a
 * third column, and the review is a drawer — both so the working view stays a
 * clean two panes with nothing nested inside its own scrollbar.
 */
import './styles.css';
import './workspace.css';
import { initWorkspace, workspaceToolChanged, resetWorkspace, addWorkspaceFollowup } from './workspace.js';
import {
  ALL_TEMPLATES as TEMPLATES, audienceForTemplate, CATEGORY_GROUPS, CATEGORY_LABELS, byCategory, search, fieldsFor,
  render, sampleValues, type Category, type Template,
} from './library/providers.js';
import {
  PALETTE_OPTIONS, THEME_OPTIONS, designWithDefaults, normalizeDesign, themeThumbnail,
  type DesignChoice, type GalleryLayout,
} from './design/index.js';
import { validateFields, type FieldDef, type FieldValues } from './merge/index.js';
import { toGmailHtml } from './export/gmail.js';
import { review, type Finding, type Review } from './checks/index.js';
import { openStorage, type StorageAdapter } from './store/adapter.js';
import {
  DEFAULT_BRAND, brandValues, incompleteBrandKeys, loadBrand,
  resetBrand, saveBrand, type BrandProfile,
} from './store/brand.js';
import {
  clearAll, clearDraft, describeStoredData, loadDraft, loadRecent,
  recordRecent, saveDraft, type RecentValues,
} from './store/drafts.js';
import {
  DEFAULT_EMAIL_IDENTITY, EMAIL_IDENTITY_KEY, loadEmailIdentity, saveEmailIdentity,
  type EmailIdentityConfig,
} from './store/email-identity.js';
import { BRAND_FIELDS } from './library/types.js';
import { STOCK_CATEGORIES, type StockPhoto } from './library/stock.js';
import {
  DEFAULT_LOGO, DEFAULT_SIGNATURE, SIGNATURE_SECTIONS, applyBrandToSignature, buildSignature,
  buildSignatureText, normalizeSignature, setSignatureValue, signatureSizeKb,
  type SigField, type SignatureConfig,
} from './signature/index.js';
import type { PdfEditorController } from './pdf/editor.js';
import { PDF_SIGNATURES_KEY } from './store/pdf-signatures.js';
import {
  ACCEPTED, ACCEPTED_LABEL, AudioDecodeError, decodeAudioFile, DEFAULT_TIER, encodePcmWav,
  FORMATS, LANGUAGES, TIERS,
  TranscribeCancelled, TranscribeRun, clock, deleteTranscript, duration, editText,
  formatBytes, formatById, languageLabel, listTranscripts, mergeWithPrevious, notesToText,
  readCall, removeSegment, renameSpeaker, safeFilename, saveTranscript, searchSegments,
  normalizeTier, releaseTranscriber, setSpeaker, setSpeakerFrom, tierById, toFormat, toTurns,
  webGpuAvailable, wordCount,
  type ActionItem, type CallNotes, type Detail, type ExportFormat, type Progress,
  type TierId, type Transcript, type Turn,
} from './transcribe/index.js';

/* ------------------------------------------------------------------ dom */

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const els = {
  toolSwitch: $('toolSwitch'),
  templatesTool: $('templatesTool'),
  signatureTool: $('signatureTool'),
  transcribeTool: $('transcribeTool'),
  pdfTool: $('pdfTool'),
  storageState: $('storageState'),
  openSettings: $<HTMLButtonElement>('openSettings'),

  // templates
  templateName: $('templateName'),
  templateDesc: $('templateDesc'),
  templateAudience: $('templateAudience'),
  templateType: $('templateType'),
  browseTemplates: $<HTMLButtonElement>('browseTemplates'),
  draftState: $('draftState'),
  resetFields: $<HTMLButtonElement>('resetFields'),
  identityState: $('identityState'),
  identityLogo: $('identityLogo'),
  identityName: $('identityName'),
  identitySummary: $('identitySummary'),
  uploadEmailLogo: $<HTMLButtonElement>('uploadEmailLogo'),
  emailLogoFile: $<HTMLInputElement>('emailLogoFile'),
  removeEmailLogo: $<HTMLButtonElement>('removeEmailLogo'),
  emailLogoMeta: $('emailLogoMeta'),
  emailLogoPlacement: $<HTMLSelectElement>('emailLogoPlacement'),
  form: $<HTMLFormElement>('fillForm'),
  sideTabs: $('sideTabs'),
  designPane: $('designPane'),
  recentOptions: $<HTMLDataListElement>('recentOptions'),
  subject: $('subjectLine'),
  viewSwitch: $('viewSwitch'),
  preview: $<HTMLIFrameElement>('preview'),
  previewText: $<HTMLPreElement>('previewText'),
  openReview: $<HTMLButtonElement>('openReview'),
  reviewPill: $('reviewPill'),
  status: $('status'),
  copyGmail: $<HTMLButtonElement>('copyGmail'),
  copyHtml: $<HTMLButtonElement>('copyHtml'),
  copyText: $<HTMLButtonElement>('copyText'),

  // gallery
  gallery: $('gallery'),
  galleryGrid: $('galleryGrid'),
  galleryCount: $('galleryCount'),
  galleryNav: $('galleryNav'),
  search: $<HTMLInputElement>('search'),
  closeGallery: $<HTMLButtonElement>('closeGallery'),

  // review
  scrim: $('scrim'),
  reviewDrawer: $('reviewDrawer'),
  reviewBody: $('reviewBody'),
  reviewSummary: $('reviewSummary'),
  closeReview: $<HTMLButtonElement>('closeReview'),

  // settings
  settings: $<HTMLDialogElement>('settings'),
  brandFields: $('brandFields'),
  brandStatus: $('brandStatus'),
  resetBrand: $<HTMLButtonElement>('resetBrand'),
  clearData: $<HTMLButtonElement>('clearData'),

  // signature
  sigForm: $<HTMLFormElement>('sigForm'),
  sigState: $('sigState'),
  sigReset: $<HTMLButtonElement>('sigReset'),
  sigSize: $('sigSize'),
  sigViewSwitch: $('sigViewSwitch'),
  sigPreview: $<HTMLIFrameElement>('sigPreview'),
  sigPreviewText: $<HTMLPreElement>('sigPreviewText'),
  sigStatus: $('sigStatus'),
  sigCopy: $<HTMLButtonElement>('sigCopy'),
  sigCopyHtml: $<HTMLButtonElement>('sigCopyHtml'),

  // transcribe
  engineState: $('engineState'),
  dropzone: $('dropzone'),
  dropTitle: $('dropTitle'),
  dropHint: $('dropHint'),
  audioFile: $<HTMLInputElement>('audioFile'),
  tierSelect: $<HTMLSelectElement>('tierSelect'),
  tierNote: $('tierNote'),
  langSelect: $<HTMLSelectElement>('langSelect'),
  runTranscribe: $<HTMLButtonElement>('runTranscribe'),
  stopTranscribe: $<HTMLButtonElement>('stopTranscribe'),
  progressBlock: $('progressBlock'),
  progressFill: $('progressFill'),
  progressLabel: $('progressLabel'),
  transcribeError: $('transcribeError'),
  savedList: $('savedList'),
  transcriptName: $('transcriptName'),
  transcriptViewSwitch: $('transcriptViewSwitch'),
  transcriptSearch: $<HTMLInputElement>('transcriptSearch'),
  transcriptSearchWrap: $('transcriptSearchWrap'),
  transcriptBody: $('transcriptBody'),
  notesBody: $('notesBody'),
  textPane: $('textPane'),
  transcriptText: $<HTMLTextAreaElement>('transcriptText'),
  textMeta: $('textMeta'),
  textSelectAll: $<HTMLButtonElement>('textSelectAll'),
  transcriptStatus: $('transcriptStatus'),
  player: $<HTMLAudioElement>('player'),
  audioPlayer: $('audioPlayer'),
  playerPlay: $<HTMLButtonElement>('playerPlay'),
  playerSkipBack: $<HTMLButtonElement>('playerSkipBack'),
  playerSkipForward: $<HTMLButtonElement>('playerSkipForward'),
  playerSeek: $<HTMLInputElement>('playerSeek'),
  playerCurrentTime: $('playerCurrentTime'),
  playerDuration: $('playerDuration'),
  playerState: $('playerState'),
  playerSpeed: $<HTMLSelectElement>('playerSpeed'),
  playerMute: $<HTMLButtonElement>('playerMute'),
  playerVolume: $<HTMLInputElement>('playerVolume'),
  formatSelect: $<HTMLSelectElement>('formatSelect'),
  copyTranscript: $<HTMLButtonElement>('copyTranscript'),
  downloadTranscript: $<HTMLButtonElement>('downloadTranscript'),

  toast: $('toast'),
};

/* ---------------------------------------------------------------- state */

type View = 'desktop' | 'mobile' | 'text';
type SigView = 'light' | 'dark' | 'noimg' | 'text';

type TranscriptView = 'transcript' | 'notes' | 'text';

type Tool = 'pdf' | 'templates' | 'signature' | 'transcribe';

const state = {
  tool: 'templates' as Tool,
  query: '',
  category: 'all' as Category | 'all',
  selected: null as Template | null,
  values: {} as FieldValues,
  touched: new Set<string>(),
  view: 'desktop' as View,
  pane: 'content' as 'content' | 'design',
  design: null as DesignChoice | null,
  sigView: 'light' as SigView,
  signature: { ...DEFAULT_SIGNATURE } as SignatureConfig,
  emailIdentity: { ...DEFAULT_EMAIL_IDENTITY } as EmailIdentityConfig,
  tier: DEFAULT_TIER as TierId,
  language: 'auto',
  transcriptView: 'transcript' as TranscriptView,
  transcriptQuery: '',
};

let current: ReturnType<typeof render> | null = null;
let currentReview: Review | null = null;

let store: StorageAdapter;
let persistent = false;
let brand: BrandProfile = { ...DEFAULT_BRAND };
let recent: RecentValues = {};
let pdfEditor: PdfEditorController | null = null;
let pdfEditorPromise: Promise<PdfEditorController | null> | null = null;

/* ----------------------------------------------------------- utilities */

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let toastTimer: number | undefined;
function toast(message: string): void {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { els.toast.hidden = true; }, 2600);
}

function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'} ago`;
}

function selectSegment(group: HTMLElement, value: string, attr: string): void {
  for (const button of group.querySelectorAll<HTMLButtonElement>('button')) {
    button.setAttribute('aria-selected', String(button.dataset[attr] === value));
  }
}

/* ========================================================== gallery ==== */

function visibleTemplates(): Template[] {
  const pool = state.category === 'all' ? TEMPLATES : byCategory(state.category);
  if (!state.query.trim()) return pool;
  const matches = new Set(search(state.query).map((t) => t.id));
  return pool.filter((t) => matches.has(t.id));
}

function renderGalleryNav(): void {
  const nav: HTMLElement[] = [];

  const allButton = el('button', undefined, 'All templates');
  allButton.type = 'button';
  allButton.setAttribute('aria-pressed', String(state.category === 'all'));
  allButton.append(el('span', 'n', String(TEMPLATES.length)));
  allButton.addEventListener('click', () => setCategory('all'));

  const allGroup = el('div', 'navgroup');
  allGroup.append(allButton);
  nav.push(allGroup);

  for (const group of CATEGORY_GROUPS) {
    const section = el('div', 'navgroup');
    section.append(el('h3', undefined, group.label), el('p', undefined, group.hint));

    for (const category of group.categories) {
      const count = byCategory(category).length;
      const button = el('button', undefined, CATEGORY_LABELS[category]);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.category === category));
      button.append(el('span', 'n', String(count)));
      button.addEventListener('click', () => setCategory(category));
      section.append(button);
    }
    nav.push(section);
  }

  els.galleryNav.replaceChildren(...nav);
}

function setCategory(category: Category | 'all'): void {
  state.category = category;
  renderGalleryNav();
  renderGallery();
}

function templateCard(template: Template): HTMLElement {
  const card = el('button', 'tcard');
  card.type = 'button';
  if (state.selected?.id === template.id) card.setAttribute('aria-current', 'true');

  const meta = el('div', 'meta');
  // A thumbnail of the template's own look, so the card shows what it produces
  // rather than only what it says.
  const swatch = el('span', 'swatch');
  swatch.innerHTML = themeThumbnail(template.theme, template.palette);
  meta.append(swatch, el('span', 'tag', CATEGORY_LABELS[template.category]));
  if (template.bulk) meta.append(el('span', 'tag bulk', 'Bulk'));

  card.append(el('b', undefined, template.name), el('p', undefined, template.description), meta);
  card.addEventListener('click', () => {
    void selectTemplate(template);
    closeGallery();
  });
  return card;
}

function renderGallery(): void {
  const items = visibleTemplates();
  els.galleryCount.textContent = String(items.length);

  if (!items.length) {
    els.galleryGrid.replaceChildren(el('p', 'gallery-empty', 'No templates match that search.'));
    return;
  }

  // Under "All", keep the three families visible as sections rather than
  // flattening 35 cards into one undifferentiated wall.
  const grouped = state.category === 'all' && !state.query.trim();
  if (!grouped) {
    const section = el('div', 'grid-cards');
    section.append(...items.map(templateCard));
    els.galleryGrid.replaceChildren(section);
    return;
  }

  const sections: HTMLElement[] = [];
  for (const group of CATEGORY_GROUPS) {
    const inGroup = items.filter((t) => group.categories.includes(t.category));
    if (!inGroup.length) continue;

    const section = el('section', 'grid-section');
    const cards = el('div', 'grid-cards');
    cards.append(...inGroup.map(templateCard));
    section.append(el('h2', undefined, group.label), cards);
    sections.push(section);
  }
  els.galleryGrid.replaceChildren(...sections);
}

function openGallery(): void {
  els.gallery.hidden = false;
  renderGalleryNav();
  renderGallery();
  els.search.focus();
}

function closeGallery(): void {
  els.gallery.hidden = true;
}

/* ======================================================== templates ==== */

/** The single practice-mark source shared by Signature Studio and email templates. */
function sharedLogo(): string {
  const { builtinlogo, logo } = state.signature;
  return state.emailIdentity.logoData?.trim()
    || state.signature.logoData?.trim()
    || (builtinlogo ? DEFAULT_LOGO : logo.trim())
    || '';
}

function renderEmailIdentity(): void {
  const logo = sharedLogo();
  const practiceName = state.signature.org || brand.practice_name || 'Your practice';
  const custom = Boolean(state.emailIdentity.logoData?.trim() || state.signature.logoData?.trim());
  const placementLabels: Record<EmailIdentityConfig['logoPlacement'], string> = {
    header: 'Header / banner',
    above: 'Above content',
    footer: 'Email footer',
    hidden: 'Hidden',
  };
  const placement = state.emailIdentity.logoPlacement;
  els.identityName.textContent = practiceName;
  els.identitySummary.textContent = logo
    ? `${placementLabels[placement]} · ${custom ? 'custom PNG' : 'built-in practice mark'}`
    : 'Upload a transparent PNG to reuse it';
  els.emailLogoPlacement.value = placement;
  els.emailLogoPlacement.disabled = !logo;
  els.removeEmailLogo.disabled = !custom;
  els.emailLogoMeta.textContent = custom
    ? `${Math.max(1, Math.round((state.emailIdentity.logoData?.length ?? state.signature.logoData?.length ?? 0) * 0.75 / 1024))} KB PNG · saved on this device`
    : logo
      ? 'Using the built-in practice mark · upload a PNG to replace it'
      : 'PNG only · resized and saved on this device';
  els.identityState.textContent = persistent ? 'Saved' : 'Session only';
  els.identityState.classList.toggle('saved', persistent);

  els.identityLogo.replaceChildren();
  els.identityLogo.classList.toggle('identity-mark', !logo);
  if (logo) {
    const image = el('img');
    image.src = logo;
    image.alt = '';
    els.identityLogo.append(image);
  } else {
    els.identityLogo.textContent = practiceName.trim().charAt(0).toUpperCase() || 'P';
  }
}

async function selectTemplate(template: Template): Promise<void> {
  window.clearTimeout(saveTimer);
  state.selected = template;
  state.touched.clear();

  // Precedence: generic samples, then the practice profile over them, then any
  // saved draft. A sample is a placeholder; the user's own draft wins over both.
  const keys = fieldsFor(template).map((f) => f.key);
  const base = { ...sampleValues(template), ...brandValues(brand, keys) };
  const draft = await loadDraft(store, template.id);

  const storedDesign = await store.get<unknown>(DESIGN_PREFIX + template.id);
  state.design = storedDesign
    ? normalizeDesign(storedDesign, { theme: template.theme, palette: template.palette })
    : null;

  state.values = draft ? { ...base, ...draft.values } : base;
  if (draft) for (const key of Object.keys(draft.values)) state.touched.add(key);

  els.templateName.textContent = template.name;
  els.templateDesc.textContent = template.description;
  els.templateAudience.textContent = audienceForTemplate(template);
  els.templateType.textContent = template.bulk ? 'Bulk message' : '1:1 email';
  els.draftState.textContent = draft ? `Draft from ${relativeTime(draft.savedAt)}` : '';
  els.draftState.classList.remove('saved');

  renderFillForm();
  if (state.pane === 'design') renderDesignPane();
  update();
}

/**
 * The fill form.
 *
 * Fields the practice profile already answers are pushed into a collapsed
 * group, so a typical template asks four to eight questions instead of
 * fourteen. That is what keeps this panel off its own scrollbar.
 */
function renderFillForm(): void {
  const template = state.selected;
  if (!template) return;

  const fields = fieldsFor(template);
  const own = fields.filter((f) => !f.fromBrand);
  const fromBrand = fields.filter((f) => f.fromBrand);

  // Short on purpose: a paragraph of guidance above every form becomes noise
  // by the third template.
  const notice = el('p', 'notice',
    'Sample values are pre-filled. Replace them before sending.');

  const nodes: HTMLElement[] = [notice, ...own.map(fillField)];

  if (fromBrand.length) {
    const group = el('details', 'group');
    const summary = el('summary');
    summary.append(
      el('span', 'caret'),
      el('span', undefined, 'Practice details'),
      el('span', 'count', `${fromBrand.length} auto-filled`),
    );
    const body = el('div', 'group-body');
    body.append(...fromBrand.map(fillField));
    group.append(summary, body);
    nodes.push(group);
  }

  els.form.replaceChildren(...nodes);
}

function fillField(field: FieldDef): HTMLElement {
  const wrap = el('div', 'field');
  const id = `f-${field.key}`;

  const label = el('label');
  label.htmlFor = id;
  label.append(document.createTextNode(field.label));
  if (field.required !== false) {
    const req = el('span', 'req', '*');
    req.title = 'Required before you can export';
    label.append(req);
  }
  if (field.fromBrand) label.append(el('span', 'chip-brand', 'profile'));

  const control = fillControl(field, id);
  // The control may be a composite (image picker); read the value from the
  // element that actually fired the event rather than from the wrapper.
  control.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    state.values[field.key] = target.value ?? '';
    state.touched.add(field.key);
    update();
    scheduleSave();
  });

  wrap.append(label, control);
  if (field.help) wrap.append(el('p', 'help', field.help));

  const error = el('p', 'err');
  error.id = `${id}-err`;
  error.hidden = true;
  wrap.append(error);

  return wrap;
}

function fillControl(field: FieldDef, id: string): HTMLElement {
  const value = state.values[field.key] ?? '';

  if (field.type === 'image') return fillImageControl(field, id);
  if (field.type === 'text' && !field.fromBrand && (field.sample?.length ?? 0) > 70) {
    const textarea = el('textarea');
    textarea.id = id;
    textarea.value = value;
    textarea.rows = 3;
    textarea.placeholder = field.sample ?? '';
    return textarea;
  }

  if (field.type === 'choice' && field.options) {
    const select = el('select');
    select.id = id;
    for (const option of field.options) {
      const node = el('option', undefined, option);
      node.value = option;
      node.selected = option === value;
      select.append(node);
    }
    return select;
  }

  const input = el('input');
  input.id = id;
  input.value = value;
  input.type =
    field.type === 'date' ? 'date'
    : field.type === 'time' ? 'time'
    : field.type === 'email' ? 'email'
    : field.type === 'url' ? 'url'
    : field.type === 'phone' ? 'tel'
    : 'text';
  if (field.sample && !value) input.placeholder = field.sample;

  if (recent[field.key]?.length) {
    input.setAttribute('list', 'recentOptions');
    input.addEventListener('focus', () => {
      els.recentOptions.replaceChildren(
        ...(recent[field.key] ?? []).map((v) => {
          const option = el('option');
          option.value = v;
          return option;
        }),
      );
    });
  }

  return input;
}

/* ------------------------------------------------------- stock photos */

/**
 * An image field: URL input with a live thumbnail and a curated stock
 * picker. Photos are remote URLs, so recipients must be online to load them
 * — the same constraint as any hosted image in a sent email.
 */
function fillImageControl(field: FieldDef, id: string): HTMLElement {
  const wrap = el('div', 'imgcontrol');
  const rowEl = el('div', 'imgrow');

  const input = el('input');
  input.type = 'url';
  input.id = id;
  input.value = state.values[field.key] ?? '';
  if (field.sample && !input.value) input.placeholder = field.sample;
  input.spellcheck = false;

  if (recent[field.key]?.length) {
    input.setAttribute('list', 'recentOptions');
    input.addEventListener('focus', () => {
      els.recentOptions.replaceChildren(
        ...(recent[field.key] ?? []).map((v) => {
          const option = el('option');
          option.value = v;
          return option;
        }),
      );
    });
  }

  const browse = el('button', 'btn sm pick', 'Stock photos');
  browse.type = 'button';
  browse.addEventListener('click', () => openStockPicker(field, input));

  // Live preview: while the field is empty it shows the sample so the effect
  // of leaving the photo alone is visible.
  const preview = el('img', 'imgpreview');
  preview.alt = '';
  preview.hidden = true;
  const paintPreview = (): void => {
    const url = input.value.trim() || field.sample || '';
    if (!url) { preview.hidden = true; return; }
    if (preview.src !== url) preview.src = url;
  };
  input.addEventListener('input', paintPreview);
  preview.addEventListener('load', () => { preview.hidden = false; });
  preview.addEventListener('error', () => { preview.hidden = true; });

  rowEl.append(input, browse);
  wrap.append(rowEl, preview);
  paintPreview();
  return wrap;
}

/**
 * The stock picker overlay. Choosing a photo fills the URL field and, when a
 * matching "…_alt" field exists and is untouched, copies the suggested alt
 * text across — so the default state passes the accessibility review.
 */
function openStockPicker(field: FieldDef, input: HTMLInputElement): void {
  openPhotoPicker((photo) => {
    input.value = photo.url;
    state.values[field.key] = photo.url;
    state.touched.add(field.key);
    copyAltSuggestion(field, photo.alt);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** The same curated picker is used for template images and marketing galleries. */
function openPhotoPicker(onPick: (photo: StockPhoto) => void): void {
  const priorFocus = document.activeElement as HTMLElement | null;

  const scrim = el('div', 'scrim stock-scrim open');
  const dialog = el('div', 'stock-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Choose a stock photo');

  const head = el('header');
  head.append(
    el('h3', undefined, 'Stock photos'),
    el('p', undefined,
      'Free to use from Unsplash. Choosing one pastes its URL into the field; ' +
      'recipients need internet access to load it.'),
  );
  const close = el('button', 'linkbtn', 'Close');
  close.type = 'button';
  head.append(close);

  const chips = el('div', 'stock-chips');
  const grid = el('div', 'stock-grid');
  let active = STOCK_CATEGORIES[0].key;

  const paintGrid = (): void => {
    const category = STOCK_CATEGORIES.find((c) => c.key === active) ?? STOCK_CATEGORIES[0];
    grid.replaceChildren(...category.photos.map((photo) => stockButton(photo, () => {
      onPick(photo);
      closeOverlay();
    })));
  };

  const paintChips = (): void => {
    chips.replaceChildren(...STOCK_CATEGORIES.map((category) => {
      const chip = el('button', 'stock-chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(category.key === active));
      chip.append(el('b', undefined, category.label), el('i', undefined, category.hint));
      chip.addEventListener('click', () => {
        active = category.key;
        paintChips();
        paintGrid();
      });
      return chip;
    }));
  };

  const closeOverlay = (): void => {
    scrim.remove();
    document.removeEventListener('keydown', onKey, true);
    priorFocus?.focus();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeOverlay();
    }
  };
  scrim.addEventListener('click', (event) => {
    if (event.target === scrim) closeOverlay();
  });
  close.addEventListener('click', closeOverlay);
  document.addEventListener('keydown', onKey, true);

  paintChips();
  paintGrid();
  dialog.append(head, chips, grid);
  scrim.append(dialog);
  document.body.append(scrim);
}

function stockButton(photo: StockPhoto, onPick: () => void): HTMLButtonElement {
  const button = el('button', 'stock-item');
  button.type = 'button';
  button.title = photo.alt;

  const image = el('img');
  image.src = photo.url;
  image.alt = '';
  image.loading = 'lazy';

  button.append(image, el('span', undefined, photo.label));
  button.addEventListener('click', onPick);
  return button;
}

/** Copy the photo's suggested alt into a sibling `…_alt` field, if untouched. */
function copyAltSuggestion(field: FieldDef, alt: string): void {
  const altKey = field.key.endsWith('_url') ? field.key.slice(0, -4) + '_alt' : '';
  if (!altKey) return;
  if (state.touched.has(altKey)) return;

  const current = (state.values[altKey] ?? '').trim();
  if (current) {
    // Keep a value the user typed or the profile provided, but replace a
    // still-unused sample that describes whatever photo was shown before.
    const altField = state.selected
      ? fieldsFor(state.selected).find((f) => f.key === altKey)
      : undefined;
    if (current !== (altField?.sample ?? '')) return;
  }

  const altInput = document.getElementById(`f-${altKey}`) as HTMLInputElement | null;
  if (!altInput) return;
  altInput.value = alt;
  state.values[altKey] = alt;
  altInput.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ----------------------------------------------------------- design */

const DESIGN_PREFIX = 'design:';

/** The design in force: the user's override if any, else how it was authored. */
function activeDesign(): DesignChoice {
  const template = state.selected;
  if (!template) return { theme: 'signal', palette: 'ocean' };
  return state.design ?? { theme: template.theme, palette: template.palette };
}

function renderDesignPane(): void {
  const template = state.selected;
  if (!template) return;
  const design = designWithDefaults(activeDesign());

  const sectionHeader = (title: string, copy: string): HTMLElement => {
    const head = el('header');
    head.append(el('h3', undefined, title), el('p', undefined, copy));
    return head;
  };

  const textControl = (
    labelText: string,
    value: string,
    placeholder: string,
    onInput: (value: string) => void,
    type: 'text' | 'url' = 'text',
  ): HTMLLabelElement => {
    const label = el('label', 'design-control');
    label.append(el('span', undefined, labelText));
    const input = el('input');
    input.setAttribute('aria-label', labelText);
    input.type = type;
    input.value = value;
    input.placeholder = placeholder;
    input.addEventListener('input', () => onInput(input.value));
    label.append(input);
    return label;
  };

  const selectControl = (
    labelText: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ): HTMLLabelElement => {
    const label = el('label', 'design-control');
    label.append(el('span', undefined, labelText));
    const select = el('select');
    select.setAttribute('aria-label', labelText);
    for (const option of options) {
      const node = el('option', undefined, option.label);
      node.value = option.value;
      node.selected = option.value === value;
      select.append(node);
    }
    select.addEventListener('change', () => onChange(select.value));
    label.append(select);
    return label;
  };

  const toggleControl = (
    title: string,
    copy: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLInputElement => {
    const label = el('label', 'check design-toggle');
    const input = el('input');
    input.type = 'checkbox';
    input.setAttribute('aria-label', title);
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const text = el('span');
    text.append(el('strong', undefined, title), el('small', undefined, copy));
    label.append(input, text);
    return input;
  };

  const changeDesign = (
    mutate: (current: ReturnType<typeof designWithDefaults>) => DesignChoice,
    redraw = false,
  ): void => {
    const next = mutate(designWithDefaults(activeDesign()));
    state.design = next;
    void store.set(DESIGN_PREFIX + template.id, next);
    if (redraw) renderDesignPane();
    update();
  };

  const themes = el('section', 'design-section');
  const themeHead = sectionHeader('Layout', 'How the masthead, section labels and cards are arranged.');
  const themeGrid = el('div', 'theme-grid');

  for (const option of THEME_OPTIONS) {
    const card = el('button', 'theme-card');
    card.type = 'button';
    card.setAttribute('aria-pressed', String(option.key === design.theme));

    const art = el('span', 'art');
    // Drawn in the palette currently chosen, so both decisions are visible at once.
    art.innerHTML = themeThumbnail(option.key, design.palette);

    const label = el('div', 'label');
    label.append(el('b', undefined, option.name), el('i', undefined, option.description));

    card.append(art, label);
    card.addEventListener('click', () => changeDesign((current) => ({ ...current, theme: option.key }), true));
    themeGrid.append(card);
  }
  themes.append(themeHead, themeGrid);

  const palettes = el('section', 'design-section');
  const palHead = sectionHeader('Colour', 'Applies to the masthead, links, rules and cards.');
  const palGrid = el('div', 'palette-grid');

  for (const option of PALETTE_OPTIONS) {
    const card = el('button', 'palette-card');
    card.type = 'button';
    card.setAttribute('aria-pressed', String(option.key === design.palette));

    const bars = el('div', 'bars');
    for (const colour of [option.primary, option.accent, option.tint]) {
      const bar = el('i');
      bar.style.background = colour;
      bars.append(bar);
    }

    card.append(bars, el('span', undefined, option.name));
    card.addEventListener('click', () => changeDesign((current) => ({ ...current, palette: option.key }), true));
    palGrid.append(card);
  }
  palettes.append(palHead, palGrid);

  const banner = el('section', 'design-section design-section-featured');
  banner.append(sectionHeader('Email banner', 'Edit the visible header without changing the message body.'));
  const bannerFields = el('div', 'design-fields');
  bannerFields.append(
    selectControl('Banner style', design.banner.style, [
      { value: 'template', label: 'Use template style' },
      { value: 'solid', label: 'Solid brand band' },
      { value: 'soft', label: 'Soft tinted band' },
      { value: 'clean', label: 'Clean header' },
    ], (value) => changeDesign((current) => ({
      ...current,
      banner: { ...current.banner, style: value as typeof current.banner.style },
    }), true)),
    textControl('Eyebrow', design.banner.eyebrow, 'Use template wording', (value) => changeDesign((current) => ({
      ...current, banner: { ...current.banner, eyebrow: value },
    }))),
    textControl('Headline', design.banner.title, 'Use template wording', (value) => changeDesign((current) => ({
      ...current, banner: { ...current.banner, title: value },
    }))),
    textControl('Support line', design.banner.subtitle, 'Optional supporting line', (value) => changeDesign((current) => ({
      ...current, banner: { ...current.banner, subtitle: value },
    }))),
  );
  banner.append(bannerFields);

  const cta = el('section', 'design-section design-section-featured');
  cta.append(sectionHeader('Call to action', 'Add one focused next step to marketing emails.'));
  const ctaToggle = toggleControl(
    'Add a CTA',
    'A single, prominent button keeps the message easy to act on.',
    design.cta.enabled,
    (checked) => changeDesign((current) => ({ ...current, cta: { ...current.cta, enabled: checked } }), true),
  );
  const ctaFields = el('div', 'design-fields design-fields-compact');
  ctaFields.append(
    textControl('Button label', design.cta.label, 'Learn more', (value) => changeDesign((current) => ({
      ...current, cta: { ...current.cta, label: value },
    }))),
    textControl('Destination URL', design.cta.url, 'https://example.com', (value) => changeDesign((current) => ({
      ...current, cta: { ...current.cta, url: value },
    })), 'url'),
  );
  ctaFields.hidden = !design.cta.enabled;
  cta.append(ctaToggle.closest('label') ?? ctaToggle, ctaFields);

  const gallery = el('section', 'design-section design-section-featured');
  gallery.append(sectionHeader('Photo gallery', 'Add a calm visual grid to outreach and newsletters.'));
  const galleryToggle = toggleControl(
    'Add a photo gallery',
    'Choose one, two, or three images with optional captions.',
    design.gallery.enabled,
    (checked) => changeDesign((current) => ({ ...current, gallery: { ...current.gallery, enabled: checked } }), true),
  );
  const galleryFields = el('div', 'gallery-fields');
  const galleryLayout = selectControl('Grid layout', design.gallery.layout, [
    { value: 'single', label: 'Single feature image' },
    { value: 'two', label: 'Two-up gallery' },
    { value: 'three', label: 'Three-up gallery' },
  ], (value) => changeDesign((current) => ({
    ...current,
    gallery: { ...current.gallery, layout: value as GalleryLayout },
  }), true));
  galleryFields.append(galleryLayout);

  const gallerySlots = el('div', 'gallery-slots');
  const slotCount = gallerySlotCount(design.gallery.layout);
  for (let index = 0; index < slotCount; index += 1) {
    const image = design.gallery.images[index] ?? { url: '', alt: '', caption: '' };
    const slot = el('div', 'gallery-slot');
    const slotHead = el('div', 'gallery-slot-head');
    slotHead.append(el('strong', undefined, `Photo ${index + 1}`));
    if (image.url) {
      const remove = el('button', 'linkbtn', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', () => changeDesign((current) => ({
        ...current,
        gallery: {
          ...current.gallery,
          images: current.gallery.images.filter((_, itemIndex) => itemIndex !== index),
        },
      }), true));
      slotHead.append(remove);
    }
    slot.append(slotHead);

    const preview = el('div', 'gallery-slot-preview');
    if (image.url) {
      const img = el('img');
      img.src = image.url;
      img.alt = image.alt;
      preview.append(img);
    } else {
      preview.append(el('span', undefined, 'No image selected'));
    }
    const pick = el('button', 'btn sm', 'Choose stock photo');
    pick.type = 'button';
    pick.addEventListener('click', () => openPhotoPicker((photo) => changeDesign((current) => {
      const images = [...current.gallery.images];
      images[index] = { ...images[index], url: photo.url, alt: images[index]?.alt || photo.alt };
      return { ...current, gallery: { ...current.gallery, images } };
    }, true)));
    preview.append(pick);
    slot.append(preview);

    const slotFields = el('div', 'design-fields design-fields-compact');
    slotFields.append(
      textControl('Image URL', image.url, 'https://images.example/photo.jpg', (value) => changeDesign((current) => {
        const images = [...current.gallery.images];
        images[index] = { ...images[index], url: value, alt: images[index]?.alt ?? '', caption: images[index]?.caption ?? '' };
        return { ...current, gallery: { ...current.gallery, images } };
      }), 'url'),
      textControl('Alt text', image.alt, 'Describe the image', (value) => changeDesign((current) => {
        const images = [...current.gallery.images];
        images[index] = { ...images[index], url: images[index]?.url ?? '', alt: value, caption: images[index]?.caption ?? '' };
        return { ...current, gallery: { ...current.gallery, images } };
      })),
      textControl('Caption (optional)', image.caption, 'Optional caption', (value) => changeDesign((current) => {
        const images = [...current.gallery.images];
        images[index] = { ...images[index], url: images[index]?.url ?? '', alt: images[index]?.alt ?? '', caption: value };
        return { ...current, gallery: { ...current.gallery, images } };
      })),
    );
    slot.append(slotFields);
    gallerySlots.append(slot);
  }
  galleryFields.append(gallerySlots);
  galleryFields.hidden = !design.gallery.enabled;
  gallery.append(galleryToggle.closest('label') ?? galleryToggle, galleryFields);

  const nodes: HTMLElement[] = [themes, palettes, banner, cta, gallery];

  if (state.design) {
    const reset = el('button', 'linkbtn design-reset', 'Reset to how this template was designed');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      state.design = null;
      void store.delete(DESIGN_PREFIX + template.id);
      renderDesignPane();
      update();
    });
    nodes.push(reset);
  }

  els.designPane.replaceChildren(...nodes);
}

function setPane(pane: 'content' | 'design'): void {
  state.pane = pane;
  selectSegment(els.sideTabs, pane, 'pane');
  els.form.hidden = pane !== 'content';
  els.designPane.hidden = pane !== 'design';
  if (pane === 'design') renderDesignPane();
}

/* --------------------------------------------------------- rendering */

const HTTP_URL = /^https:\/\/\S+$/i;

function gallerySlotCount(layout: GalleryLayout): number {
  return layout === 'three' ? 3 : layout === 'two' ? 2 : 1;
}

function customizationProblems(design: ReturnType<typeof designWithDefaults>): string[] {
  const problems: string[] = [];
  if (design.cta.enabled) {
    if (!design.cta.label.trim()) problems.push('Give the CTA a label.');
    if (!HTTP_URL.test(design.cta.url.trim())) problems.push('Use an https:// URL for the CTA.');
  }

  if (design.gallery.enabled) {
    const required = gallerySlotCount(design.gallery.layout);
    if (design.gallery.images.length < required) {
      problems.push(`Choose ${required} photo${required === 1 ? '' : 's'} for the ${design.gallery.layout} gallery.`);
    }
    design.gallery.images.slice(0, required).forEach((image, index) => {
      if (!HTTP_URL.test(image.url.trim())) problems.push(`Gallery photo ${index + 1} needs an https:// URL.`);
      if (!image.alt.trim()) problems.push(`Add alt text for gallery photo ${index + 1}.`);
    });
  }
  return problems;
}

function dslSafe(value: string): string {
  return value.replace(/[|\[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildCustomizationSource(design: ReturnType<typeof designWithDefaults>): string {
  const lines: string[] = [];
  if (design.cta.enabled && HTTP_URL.test(design.cta.url.trim()) && design.cta.label.trim()) {
    lines.push(`[Button: ${dslSafe(design.cta.label)} | ${dslSafe(design.cta.url)}]`);
  }

  if (design.gallery.enabled) {
    const required = gallerySlotCount(design.gallery.layout);
    const images = design.gallery.images.slice(0, required);
    if (images.length === required && images.every((image) => HTTP_URL.test(image.url.trim()) && image.alt.trim())) {
      const parts = images.flatMap((image) => [
        dslSafe(image.url), dslSafe(image.alt), dslSafe(image.caption),
      ]);
      lines.push(`[Gallery: ${design.gallery.layout} | ${parts.join(' | ')}]`);
    }
  }
  return lines.join('\n\n');
}

let currentCustomizationProblems: string[] = [];

function update(): void {
  const template = state.selected;
  if (!template) return;

  renderEmailIdentity();
  const design = designWithDefaults(activeDesign());
  const logo = sharedLogo();
  currentCustomizationProblems = customizationProblems(design);
  current = render(template, state.values, {
    theme: design.theme,
    palette: design.palette,
    ...(logo
      ? { logo, logoWidth: state.signature.logow, logoPlacement: state.emailIdentity.logoPlacement }
      : {}),
    banner: design.banner,
    customBlocks: buildCustomizationSource(design),
  });

  els.subject.textContent = current.subject || '—';
  els.preview.srcdoc = current.html;
  els.previewText.textContent = current.text;

  currentReview = review({
    body: template.body,
    subject: current.subject,
    preheader: template.preheader,
    html: current.html,
    text: current.text,
    bulk: template.bulk,
    fields: fieldsFor(template),
    footer: template.bulk ? state.values.practice_address ?? '' : '',
    unsubscribeUrl: template.bulk ? state.values.unsubscribe_url ?? '' : '',
  });

  showFieldErrors();
  showReview();
  showStatus();
}

function showFieldErrors(): void {
  const template = state.selected;
  if (!template) return;

  const problems = new Map(
    validateFields(fieldsFor(template), state.values).map((p) => [p.key, p]),
  );

  for (const field of fieldsFor(template)) {
    const input = document.getElementById(`f-${field.key}`);
    const error = document.getElementById(`f-${field.key}-err`);
    if (!input || !error) continue;

    // Only nag about fields the user has actually been in.
    const problem = state.touched.has(field.key) ? problems.get(field.key) : undefined;
    input.setAttribute('aria-invalid', String(Boolean(problem)));
    error.hidden = !problem;
    error.textContent = problem?.message ?? '';
  }
}

/** Export needs resolved merge fields *and* no review errors. Warnings pass. */
function canExport(): boolean {
  if (!current?.gate.ok) return false;
  if (currentCustomizationProblems.length) return false;
  return !currentReview?.findings.some((f) => f.severity === 'error');
}

function showStatus(): void {
  if (!current) return;
  const reviewErrors = currentReview?.findings.filter((f) => f.severity === 'error') ?? [];
  const ok = canExport();

  els.status.className = `status ${ok ? 'ok' : 'blocked'}`;
  const message = ok
    ? 'Ready to send'
    : currentCustomizationProblems.length
      ? currentCustomizationProblems[0]
    : current.gate.ok
      ? `${reviewErrors.length} problem${reviewErrors.length === 1 ? '' : 's'} in Review`
      : current.gate.summary.replace(/^Cannot export — /, '');

  els.status.replaceChildren(el('span', 'dot'), el('span', undefined, message));

  for (const button of [els.copyGmail, els.copyHtml, els.copyText]) button.disabled = !ok;
}

function showReview(): void {
  if (!currentReview) return;
  const { byGroup, errors, warnings, summary } = currentReview;

  els.reviewPill.className = `pill ${errors ? 'error' : warnings ? 'warning' : 'pass'}`;
  els.reviewPill.textContent = errors || warnings ? String(errors || warnings) : '✓';
  els.reviewSummary.textContent = summary;

  els.reviewBody.replaceChildren(
    ...byGroup.map((section) => {
      const details = el('details', 'rgroup');
      details.open = section.worst !== 'pass';

      const summaryRow = el('summary');
      const bad = section.findings.filter((f) => f.severity !== 'pass').length;
      summaryRow.append(
        el('span', `sev ${section.worst}`),
        el('span', undefined, section.label),
        el('span', 'count', bad ? `${bad} to look at` : `${section.findings.length} passed`),
      );

      details.append(summaryRow, ...section.findings.map(findingRow));
      return details;
    }),
  );
}

function findingRow(finding: Finding): HTMLElement {
  const row = el('div', `finding ${finding.severity}`);
  const content = el('div');
  content.append(el('b', undefined, finding.title), el('p', undefined, finding.detail));
  if (finding.excerpt) content.append(el('code', undefined, finding.excerpt));
  row.append(el('span', `sev ${finding.severity}`), content);
  return row;
}

/* --------------------------------------------------------- persistence */

let saveTimer: number | undefined;
let emailIdentitySave: Promise<void> = Promise.resolve();

/** Keep successive practice-level identity writes in the order they were made. */
function queueEmailIdentitySave(): void {
  const snapshot = { ...state.emailIdentity };
  emailIdentitySave = emailIdentitySave
    .catch(() => undefined)
    .then(() => saveEmailIdentity(store, snapshot))
    .catch(() => undefined);
}

function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void persist(); }, 600);
}

async function persist(): Promise<void> {
  const template = state.selected;
  if (!template) return;

  await saveDraft(store, template.id, state.values);
  await recordRecent(store, state.values);
  recent = await loadRecent(store);

  els.draftState.textContent = persistent ? 'Saved' : 'Not saved — storage unavailable';
  els.draftState.classList.toggle('saved', persistent);
}

/* ======================================================== signature ==== */

const SIG_KEY = 'signature-config';

function renderSignatureForm(): void {
  els.sigForm.replaceChildren(
    ...SIGNATURE_SECTIONS.map((section, index) => {
      const fields = section.fields.map(sigField);

      // The first section is the one a person actually fills in; the rest are
      // practice-wide and start collapsed.
      if (!section.collapsed && index === 0) {
        const wrap = el('div');
        wrap.append(...fields);
        return wrap;
      }

      const group = el('details', 'group');
      const summary = el('summary');
      summary.append(
        el('span', 'caret'),
        el('span', undefined, section.title),
        el('span', 'count', `${section.fields.length} settings`),
      );
      const body = el('div', 'group-body');
      body.append(...fields);
      group.append(summary, body);
      return group;
    }),
  );
}

function sigField(field: SigField): HTMLElement {
  const value = state.signature[field.key];
  const id = `s-${field.key}`;

  if (field.type === 'check') {
    const wrap = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = Boolean(value);
    input.addEventListener('change', () => {
      setSignatureValue(state.signature, field.key as 'round', input.checked);
      updateSignature();
    });
    wrap.append(input, el('span', undefined, field.label));
    return wrap;
  }

  if (field.type === 'image') {
    return sigImageField(field);
  }

  const wrap = el('div', 'field');
  const label = el('label', undefined, field.label);
  label.htmlFor = id;
  if (field.fromBrand) label.append(el('span', 'chip-brand', 'profile'));

  let input: HTMLInputElement | HTMLSelectElement;
  if (field.type === 'select' && field.options) {
    const select = el('select');
    select.id = id;
    for (const option of field.options) {
      const node = el('option', undefined, option.label);
      node.value = option.value;
      node.selected = option.value === value;
      select.append(node);
    }
    input = select;
  } else {
    const text = el('input');
    text.id = id;
    text.type = field.type === 'color' ? 'color' : field.type;
    text.value = String(value ?? '');
    input = text;
  }

  input.addEventListener('input', () => {
    setSignatureValue(state.signature, field.key as 'name', input.value);
    updateSignature();
  });

  wrap.append(label, input);
  if (field.help) wrap.append(el('p', 'help', field.help));
  return wrap;
}

/** Headshot and practice-logo uploads. Resized and embedded in the browser; never transmitted. */
function setPracticeLogo(data: string | null): void {
  state.emailIdentity = { ...state.emailIdentity, logoData: data };
  state.signature.logoData = data;
  renderEmailIdentity();
  if (state.tool === 'templates') update();
  else updateSignature();
  queueEmailIdentitySave();
  void store.set(SIG_KEY, state.signature);
}

function sigImageField(field: SigField): HTMLElement {
  const wrap = el('div', 'field');
  wrap.append(el('label', undefined, field.label));

  const isLogo = field.key === 'logoData';
  const existing = isLogo
    ? state.emailIdentity.logoData ?? state.signature.logoData
    : state.signature.photoData;
  if (existing) {
    const pill = el('div', 'filepill');
    const img = el('img');
    img.src = existing;
    img.alt = '';
    const grow = el('span', 'grow', `${Math.round((existing.length * 0.75) / 1024)} KB embedded`);
    const remove = el('button', 'linkbtn', isLogo ? 'Use another logo' : 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      if (isLogo) setPracticeLogo(null);
      else state.signature.photoData = null;
      renderSignatureForm();
      if (!isLogo) updateSignature();
    });
    pill.append(img, grow, remove);
    wrap.append(pill);
  } else {
    const zone = el('label', 'dropzone');
    zone.append(
      el('p', undefined, isLogo ? 'Drop a logo here, or click to choose' : 'Drop a photo here, or click to choose'),
      el('span', 'hint', isLogo
        ? 'Resized and embedded locally. Nothing is uploaded.'
        : 'Cropped square, resized, and embedded. Nothing is uploaded.'),
    );
    const input = el('input');
    input.type = 'file';
    input.accept = isLogo ? 'image/png' : 'image/*';
    const readFile = (file: File | undefined): void => {
      if (!file) return;
      if (isLogo && file.type !== 'image/png' && !/\.png$/i.test(file.name)) {
        toast('Practice logos must be PNG files.');
        return;
      }
      void (isLogo ? readLogoImage(file, 420) : readSquareImage(file, 224))
        .then((data) => {
          if (isLogo) setPracticeLogo(data);
          else state.signature.photoData = data;
          renderSignatureForm();
          if (!isLogo) updateSignature();
        })
        .catch(() => toast('That image could not be read.'));
    };
    input.addEventListener('change', () => readFile(input.files?.[0]));
    zone.append(input);

    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('over');
      const file = (event as DragEvent).dataTransfer?.files?.[0];
      readFile(file);
    });

    wrap.append(zone);
  }

  if (field.help) wrap.append(el('p', 'help', field.help));
  return wrap;
}

/** Centre-crop to a square and re-encode, entirely in the tab. */
function readSquareImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not decode that image'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Canvas unavailable'));
        const side = Math.min(image.width, image.height);
        context.drawImage(
          image,
          (image.width - side) / 2, (image.height - side) / 2, side, side,
          0, 0, size, size,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Resize a practice logo without cropping its horizontal lockup. */
function readLogoImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not decode that image'));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Canvas unavailable'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

let sigSaveTimer: number | undefined;

function updateSignature(): void {
  const html = buildSignature(state.signature);
  const text = buildSignatureText(state.signature);
  const kb = signatureSizeKb(html);

  els.sigSize.textContent = `${kb} KB`;
  els.sigPreviewText.textContent = text;
  els.sigPreview.srcdoc = signaturePreviewDoc(html);

  // Gmail's signature editor gets unhappy well before the email clip limit.
  const heavy = kb > 90;
  els.sigStatus.className = `status ${heavy ? 'blocked' : 'ok'}`;
  els.sigStatus.replaceChildren(
    el('span', 'dot'),
    el('span', undefined, heavy
      ? `${kb} KB is large for a signature — remove the photo or host it`
      : 'Ready to copy'),
  );

  // Keep the shared practice-mark card and active template live while the
  // separate signature editor is being used.
  renderEmailIdentity();
  if (state.tool === 'templates') update();

  window.clearTimeout(sigSaveTimer);
  sigSaveTimer = window.setTimeout(() => {
    void store.set(SIG_KEY, state.signature).then(() => {
      els.sigState.textContent = persistent ? 'Saved' : 'Not saved — storage unavailable';
      els.sigState.classList.toggle('saved', persistent);
    });
  }, 600);
}

/** Wrap the signature so it previews the way a mail client would show it. */
function signaturePreviewDoc(html: string): string {
  const dark = state.sigView === 'dark';
  const hideImages = state.sigView === 'noimg';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin:0; padding:26px; background:${dark ? '#1B1F22' : '#FFFFFF'};
           font-family:Arial,Helvetica,sans-serif; }
    .msg { font-size:14px; line-height:1.55; color:${dark ? '#D8DEE1' : '#333'}; margin:0 0 22px; }
    ${hideImages ? 'img{display:none !important;}' : ''}
  </style></head><body>
    <p class="msg">Thanks so much — I will follow up after your visit.</p>
    ${html}
  </body></html>`;
}

/* ======================================================= transcribe ==== */

// Version the preference so the old Fast default cannot silently override the
// new Balanced default for existing users.
const TIER_KEY = 'transcribe-tier-v2';
const LEGACY_TIER_KEY = 'transcribe-tier';
const LANG_KEY = 'transcribe-language';

let transcript: Transcript | null = null;
let notes: CallNotes | null = null;
let activeRun: TranscribeRun | null = null;
let pendingFile: File | null = null;

/**
 * The object URL backing the player.
 *
 * Revoked whenever it is replaced. Each one pins the whole decoded file in
 * memory until it is released, and a VA working through a morning of calls
 * would otherwise accumulate every recording they had opened.
 */
let audioUrl: string | null = null;

/**
 * Which transcript the loaded audio actually belongs to.
 *
 * Playback and the transcript are two separate things — one comes from the file
 * still open in the picker, the other can come from storage — and they are only
 * the same recording some of the time. Without this they drift: transcribe
 * call A, open saved transcript B, click a timecode, and the player seeks into
 * **A's audio** at B's timings. It plays, so nothing looks wrong; you are just
 * listening to a different patient.
 *
 * `null` means the open file has not produced a transcript yet.
 */
let audioForId: string | null = null;

type PlayerStatus = 'empty' | 'loading' | 'recovering' | 'error' | 'blocked';

/** State that must survive media events instead of being inferred from duration alone. */
let playerStatus: PlayerStatus = 'empty';
let playerErrorMessage = '';
let playerLoadGeneration = 0;
let playerLoadTimer: number | undefined;
let playerFallbackAttempted = false;
let playerUsingFallback = false;
const PLAYER_PREPARE_TIMEOUT_MS = 12_000;

/** Keep the user's last audible level so mute can be reversed cleanly. */
let lastVolume = 1;

/**
 * Which backend will run, once detection has answered.
 *
 * It decides the dtype, which decides the download size, so the tier picker
 * cannot quote an honest figure until this is known. Null means "not yet
 * checked" — the GPU number is shown in the meantime because it is the one
 * most users will get.
 */
let hasWebGpu: boolean | null = null;

function recommendedTier(): TierId {
  // Balanced is the quality-first daily default on both backends. Fast remains
  // available for long calls on CPU, but should be an intentional tradeoff.
  return DEFAULT_TIER;
}

/** The download this machine will actually make for a tier. */
function tierMegabytes(tier: { megabytes: number; megabytesCpu: number }): number {
  return hasWebGpu === false ? tier.megabytesCpu : tier.megabytes;
}

function renderTierSelect(): void {
  els.tierSelect.replaceChildren(
    ...TIERS.map((tier) => {
      const recommended = tier.id === recommendedTier() ? ' · Recommended' : '';
      const option = el('option', undefined,
        `${tier.label}${recommended} — ≈${tierMegabytes(tier)} MB`);
      option.value = tier.id;
      option.title = tier.note;
      return option;
    }),
  );
  els.tierSelect.value = state.tier;
  showTierNote();
}

function showTierNote(): void {
  const tier = tierById(state.tier);
  const backend = hasWebGpu === null
    ? 'Checking this device'
    : hasWebGpu
      ? 'WebGPU acceleration is ready'
      : 'CPU mode — Balanced is the default; Fast is quicker for long calls';
  const recommendation = tier.id === recommendedTier()
    ? ` Recommended for ${hasWebGpu === false ? 'this device' : 'everyday calls'}.`
    : '';
  const languageHint = state.language === 'auto'
    ? 'Set the spoken language when you know it for steadier decoding.'
    : `Locked to ${languageLabel(state.language)} for a faster, steadier pass.`;
  const accurateHint = tier.id === 'accurate' && hasWebGpu === false
    ? ' It is still slower on CPU than the smaller tiers.'
    : '';
  els.tierNote.textContent =
    `${tier.note} ${backend}.${recommendation} Downloaded once (≈${tierMegabytes(tier)} MB), ` +
    `then kept in this browser.${accurateHint} ${languageHint}`;
}

function renderLanguageSelect(): void {
  els.langSelect.replaceChildren(
    ...LANGUAGES.map((language) => {
      const option = el('option', undefined, language.label);
      option.value = language.code;
      return option;
    }),
  );
  els.langSelect.value = state.language;
}

function renderFormatSelect(): void {
  els.formatSelect.replaceChildren(
    ...FORMATS.map((format) => {
      const option = el('option', undefined, format.label);
      option.value = format.id;
      option.title = format.note;
      return option;
    }),
  );
}

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"></path></svg>';
const VOLUME_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"></path><path d="M16 9.5a4 4 0 0 1 0 5"></path><path d="M18.5 7a7.5 7.5 0 0 1 0 10"></path></svg>';
const MUTED_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"></path><path d="m17 9 4 6m0-6-4 6"></path></svg>';

function audioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
    : `${minutes}:${secs}`;
}

function playerMediaReady(): boolean {
  const sourceMatches = !els.player.currentSrc || els.player.currentSrc === audioUrl;
  return Boolean(audioUrl) && sourceMatches
    && els.player.readyState >= HTMLMediaElement.HAVE_METADATA
    && Number.isFinite(els.player.duration)
    && els.player.duration > 0;
}

function clearPlayerLoadTimer(): void {
  if (playerLoadTimer !== undefined) {
    window.clearTimeout(playerLoadTimer);
    playerLoadTimer = undefined;
  }
}

function armPlayerLoadTimer(generation: number): void {
  clearPlayerLoadTimer();
  playerLoadTimer = window.setTimeout(() => {
    playerLoadTimer = undefined;
    if (generation !== playerLoadGeneration || !audioUrl || playerMediaReady()) return;
    recoverPlayerPlayback();
  }, PLAYER_PREPARE_TIMEOUT_MS);
}

function nativePlayerErrorMessage(): string {
  switch (els.player.error?.code) {
    case 3:
      return 'Chrome could not decode this recording. Preparing a compatible local copy…';
    case 4:
      return 'This recording format is not directly playable in Chrome. Preparing a compatible local copy…';
    case 2:
      return 'Chrome could not read the recording. Preparing a compatible local copy…';
    default:
      return 'The recording did not finish loading. Preparing a compatible local copy…';
  }
}

/**
 * Some accepted inputs can be decoded by the transcriber but not by an HTML
 * media element. Convert those locally to mono PCM WAV so replay still works.
 */
function recoverPlayerPlayback(): void {
  if (!pendingFile || !audioUrl || playerStatus === 'recovering') return;

  if (playerFallbackAttempted) {
    playerStatus = 'error';
    playerErrorMessage = 'This recording could not be played in this browser. Try a PCM WAV or MP3 export.';
    updatePlayerUI();
    return;
  }

  playerFallbackAttempted = true;
  const file = pendingFile;
  const generation = playerLoadGeneration;
  clearPlayerLoadTimer();
  playerStatus = 'recovering';
  playerErrorMessage = 'Preparing a compatible local copy…';
  updatePlayerUI();

  void decodeAudioFile(file).then(({ samples }) => {
    if (generation !== playerLoadGeneration || pendingFile !== file || !audioUrl) return;

    const compatibilityFile = new Blob([encodePcmWav(samples)], { type: 'audio/wav' });
    URL.revokeObjectURL(audioUrl);
    playerUsingFallback = true;
    audioUrl = URL.createObjectURL(compatibilityFile);
    playerStatus = 'loading';
    playerErrorMessage = '';
    els.player.src = audioUrl;
    els.player.load();
    updatePlayerUI();
    armPlayerLoadTimer(generation);
  }).catch((error: unknown) => {
    if (generation !== playerLoadGeneration || pendingFile !== file) return;
    playerStatus = 'error';
    playerErrorMessage = error instanceof AudioDecodeError
      ? error.message
      : 'This recording could not be decoded for playback. Try a PCM WAV or MP3 export.';
    updatePlayerUI();
  });
}

/** Repaint the compact player from the audio element's authoritative state. */
function updatePlayerUI(): void {
  const durationSec = Number.isFinite(els.player.duration) ? Math.max(0, els.player.duration) : 0;
  const currentSec = Number.isFinite(els.player.currentTime)
    ? Math.max(0, els.player.currentTime)
    : 0;
  const ready = playerMediaReady();
  const controlsReady = ready && playerStatus !== 'recovering' && playerStatus !== 'error';
  const muted = els.player.muted || els.player.volume === 0;

  els.playerCurrentTime.textContent = audioClock(currentSec);
  els.playerDuration.textContent = audioClock(durationSec);
  els.playerSeek.max = String(durationSec);
  els.playerSeek.value = String(Math.min(currentSec, durationSec));
  els.playerSeek.disabled = !controlsReady;
  els.playerPlay.disabled = !controlsReady;
  els.playerSkipBack.disabled = !controlsReady;
  els.playerSkipForward.disabled = !controlsReady;
  els.playerMute.disabled = !controlsReady;
  els.playerVolume.disabled = !controlsReady;

  els.playerPlay.innerHTML = els.player.paused ? PLAY_ICON : PAUSE_ICON;
  els.playerPlay.setAttribute('aria-label', els.player.paused ? 'Play recording' : 'Pause recording');
  els.playerPlay.title = els.player.paused ? 'Play recording' : 'Pause recording';
  els.playerMute.innerHTML = muted ? MUTED_ICON : VOLUME_ICON;
  els.playerMute.setAttribute('aria-label', muted ? 'Unmute recording' : 'Mute recording');
  els.playerMute.title = muted ? 'Unmute recording' : 'Mute recording';
  els.playerVolume.value = String(els.player.volume);

  if (!audioUrl) {
    els.playerState.textContent = 'Choose a recording to replay it';
  } else if (playerStatus === 'recovering') {
    els.playerState.textContent = playerErrorMessage;
  } else if (playerStatus === 'error') {
    els.playerState.textContent = playerErrorMessage || 'This recording cannot be played in the browser.';
  } else if (playerStatus === 'blocked') {
    els.playerState.textContent = playerErrorMessage || 'Playback was blocked — press play again.';
  } else if (!ready) {
    els.playerState.textContent = 'Preparing recording…';
  } else if (!els.player.paused) {
    els.playerState.textContent = 'Playing recording';
  } else if (els.player.ended) {
    els.playerState.textContent = 'Replay complete';
  } else if (currentSec > 0) {
    els.playerState.textContent = `Paused at ${audioClock(currentSec)}`;
  } else {
    els.playerState.textContent = playerUsingFallback
      ? 'Ready to replay recording · converted locally'
      : 'Ready to replay recording';
  }
}

function togglePlayback(): void {
  if (!audioUrl) return;
  if (!playerMediaReady()) {
    updatePlayerUI();
    return;
  }
  if (els.player.paused || els.player.ended) {
    if (els.player.ended) els.player.currentTime = 0;
    void els.player.play().catch((error: unknown) => {
      const name = error instanceof Error ? error.name : '';
      playerStatus = name === 'NotAllowedError' ? 'blocked' : 'error';
      playerErrorMessage = name === 'NotAllowedError'
        ? 'Playback was blocked — press play again.'
        : 'Playback could not start. Try pressing play again.';
      updatePlayerUI();
    });
  } else {
    els.player.pause();
  }
}

function skipPlayback(seconds: number): void {
  if (!playerMediaReady()) return;
  els.player.currentTime = Math.max(
    0,
    Math.min(els.player.duration, els.player.currentTime + seconds),
  );
  updatePlayerUI();
}

/* ------------------------------------------------------------ the input */

function setPendingFile(file: File | null): void {
  pendingFile = file;
  playerLoadGeneration += 1;
  clearPlayerLoadTimer();
  playerFallbackAttempted = false;
  playerUsingFallback = false;
  playerErrorMessage = '';
  playerStatus = file ? 'loading' : 'empty';
  els.runTranscribe.disabled = !file;
  els.transcribeError.hidden = true;

  els.player.pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  audioForId = null;
  els.player.removeAttribute('src');
  els.player.load();

  if (!file) {
    els.dropTitle.textContent = 'Drop a recording here';
    els.dropHint.textContent = 'or click to choose a file';
    els.dropzone.classList.remove('has-file');
    showPlayerFor(null);
    return;
  }

  // The dropzone becomes a "loaded" chip: what is queued, how big it is, and
  // that clicking swaps it — not an instruction to drop again.
  els.dropTitle.textContent = file.name;
  els.dropHint.textContent = `${formatBytes(file.size)} · click to choose a different file`;
  els.dropzone.classList.add('has-file');

  // Playback is from the file the user just opened, not from anything saved.
  // See transcribe/store.ts for why no audio is kept.
  audioUrl = URL.createObjectURL(file);
  els.player.src = audioUrl;
  els.player.load();
  showPlayerFor(transcript);
  armPlayerLoadTimer(playerLoadGeneration);
}

/**
 * Show the player only when it holds this transcript's own recording.
 *
 * Hiding it is the honest state: no audio was saved, so for a transcript
 * reopened from storage there is nothing to play until the file is opened again.
 */
function showPlayerFor(current: Transcript | null): void {
  // A newly picked file can be previewed before transcription. Once a saved
  // transcript is selected, hide an unrelated open file rather than letting
  // its timestamps appear to control the wrong recording.
  els.audioPlayer.hidden = !audioUrl || (!!current && audioForId !== current.id);
  updatePlayerUI();
}

function showProgress(progress: Progress): void {
  const labels: Record<string, string> = {
    download: 'Downloading the model — once only, then it is cached',
    load: 'Starting the transcriber',
    transcribe: 'Transcribing',
    done: 'Finishing up',
  };

  els.progressBlock.hidden = false;
  els.progressFill.style.width =
    progress.ratio == null ? '100%' : `${Math.round(progress.ratio * 100)}%`;
  // An unknown-length phase gets a moving stripe rather than a bar frozen at a
  // number, which reads as a stall.
  els.progressFill.classList.toggle('indeterminate', progress.ratio == null);

  const percent = progress.ratio == null ? '' : ` ${Math.round(progress.ratio * 100)}%`;
  const detail = progress.detail ? ` · ${progress.detail}` : '';
  els.progressLabel.textContent = `${labels[progress.phase] ?? ''}${percent}${detail}`;
}

async function startRun(): Promise<void> {
  if (!pendingFile || activeRun) return;

  els.transcribeError.hidden = true;
  els.runTranscribe.hidden = true;
  els.stopTranscribe.hidden = false;
  showProgress({ phase: 'load', detail: 'Reading the audio' });

  const run = new TranscribeRun({
    file: pendingFile,
    tier: state.tier,
    language: state.language,
    onProgress: showProgress,
  });
  activeRun = run;

  try {
    const result = await run.start();
    await saveTranscript(store, result);
    // The open file is this transcript's recording, so playback is valid for it
    // and for nothing else.
    audioForId = result.id;
    await selectTranscript(result);
    toast(`Transcribed ${result.segments.length} segments.`);
  } catch (error) {
    if (!(error instanceof TranscribeCancelled)) {
      els.transcribeError.hidden = false;
      els.transcribeError.textContent = error instanceof AudioDecodeError
        ? error.message
        : `Transcription failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  } finally {
    activeRun = null;
    els.runTranscribe.hidden = false;
    els.stopTranscribe.hidden = true;
    els.progressBlock.hidden = true;
    els.progressFill.classList.remove('indeterminate');
  }
}

function stopRun(): void {
  activeRun?.stop();
  toast('Stopped.');
}

/* ------------------------------------------------------- saved transcripts */

/* --------------------------------------------------------- empty states */

const GLYPH_WAVE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M4 13v-2"/><path d="M8 17V7"/><path d="M12 20V4"/><path d="M16 17V7"/><path d="M20 13v-2"/></svg>';

const GLYPH_NOTES =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/></svg>';

function emptyGlyph(svg: string): HTMLElement {
  const glyph = el('span', 'glyph');
  glyph.innerHTML = svg;
  return glyph;
}

function emptyTranscriptPane(): HTMLElement {
  const wrap = el('div', 'empty-stage');

  const ol = el('ol', 'steps');
  for (const step of [
    'Choose the recording — MP3, M4A, WAV, AAC, OGG, FLAC, WebM, MP4 or MOV.',
    'Pick Fast for speed or Balanced for everyday accuracy. The model downloads once, then runs offline.',
    'Transcribe, then correct names and words beside the playback.',
  ]) ol.append(el('li', undefined, step));

  wrap.append(
    emptyGlyph(GLYPH_WAVE),
    el('h2', undefined, 'A call in, a follow-up out'),
    el('p', 'muted',
      'Drop a recording on the left and it becomes an editable transcript with ' +
      'speaker turns, call notes, and a suggested follow-up email.'),
    ol,
    el('p', 'fine', 'Audio is decoded on this machine and is never stored or uploaded.'),
  );
  return wrap;
}

function emptyNotesPane(): HTMLElement {
  const wrap = el('div', 'empty-stage');

  const what = el('ul', 'mini-list');
  for (const item of [
    'Follow-ups someone promised',
    'Details worth copying — numbers, dates, references',
    'A suggested template to open when the call ends',
  ]) what.append(el('li', undefined, item));

  wrap.append(
    emptyGlyph(GLYPH_NOTES),
    el('h2', undefined, 'Call notes land here'),
    el('p', 'muted', 'Open a transcript and this pane reads it for what the follow-up needs.'),
    what,
    el('p', 'fine',
      'Notes are read from the transcript by rules that run offline — check them ' +
      'against the recording before anything goes in a chart.'),
  );
  return wrap;
}

function paintTranscribeEmpties(): void {
  els.transcriptBody.replaceChildren(emptyTranscriptPane());
  els.notesBody.replaceChildren(emptyNotesPane());
}

async function renderSavedList(): Promise<void> {
  const saved = await listTranscripts(store);

  const heading = el('h2', 'saved-head');
  heading.append('Saved transcripts', el('span', 'count-pill', String(saved.length)));

  if (!saved.length) {
    els.savedList.replaceChildren(
      heading,
      el('p', 'saved-empty',
        'Nothing saved yet. Audio is never kept — a transcript is, once you make one.'),
    );
    return;
  }

  const rows = saved.map((item) => {
    const row = el('div', 'saved-row');
    if (transcript?.id === item.id) row.classList.add('current');

    const open = el('button', 'saved-open');
    open.append(
      el('strong', undefined, item.name),
      el('span', 'muted', `${duration(item.durationSec)} · ${relativeTime(item.createdAt)}`),
    );
    open.addEventListener('click', () => void selectTranscript(item));

    const remove = el('button', 'linkbtn danger', 'Delete');
    remove.addEventListener('click', async () => {
      await deleteTranscript(store, item.id);
      if (transcript?.id === item.id) clearTranscript();
      await renderSavedList();
      toast('Transcript deleted.');
    });

    row.append(open, remove);
    return row;
  });

  els.savedList.replaceChildren(heading, ...rows);
}

function clearTranscript(): void {
  transcript = null;
  notes = null;
  showPlayerFor(null);
  els.transcriptName.textContent = '—';
  paintTranscribeEmpties();
  els.copyTranscript.disabled = true;
  els.downloadTranscript.disabled = true;
  els.transcriptStatus.querySelector('span:last-child')!.textContent = 'No transcript yet';
  if (state.transcriptView === 'text') refreshTranscriptText();
}

async function selectTranscript(next: Transcript): Promise<void> {
  transcript = next;
  notes = readCall(next);
  els.transcriptName.textContent = next.name;
  els.copyTranscript.disabled = false;
  els.downloadTranscript.disabled = false;
  showPlayerFor(next);
  renderTranscript();
  renderNotes();
  showTranscriptStatus();
  if (state.transcriptView === 'text') refreshTranscriptText();
  // Repaint the list so the "current" marker follows the selection instead of
  // staying on whichever transcript was open before.
  await renderSavedList();
}

function showTranscriptStatus(): void {
  if (!transcript) return;
  const words = wordCount(transcript.segments);
  const language = transcript.language === 'auto' ? 'auto-detected' : languageLabel(transcript.language);
  els.transcriptStatus.querySelector('span:last-child')!.textContent =
    `${duration(transcript.durationSec)} · ${words} words · ${transcript.segments.length} segments · ${language}`;
}

/**
 * Persist an edit.
 *
 * Debounced the same way template drafts are, and for the same reason: typing
 * into a segment should not mean a write per keystroke.
 */
let transcriptSaveTimer: number | undefined;
function scheduleTranscriptSave(): void {
  window.clearTimeout(transcriptSaveTimer);
  transcriptSaveTimer = window.setTimeout(() => {
    if (transcript) void saveTranscript(store, transcript);
  }, 500);
}

/** Apply an edit, re-derive the notes from it, and repaint. */
function updateTranscript(next: Transcript, repaint = true): void {
  transcript = next;
  notes = readCall(next);
  scheduleTranscriptSave();
  if (repaint) renderTranscript();
  renderNotes();
  showTranscriptStatus();
}

/* ------------------------------------------------------------ transcript */

function renderTranscript(): void {
  if (!transcript) return;

  const query = state.transcriptQuery.trim();
  const matches = query ? new Set(searchSegments(transcript.segments, query).map((s) => s.id)) : null;

  const parts: HTMLElement[] = [speakerBar(transcript), disclaimer()];

  if (matches && !matches.size) {
    parts.push(el('p', 'empty-note', `Nothing matches “${query}”.`));
  }

  for (const turn of toTurns(transcript.segments)) {
    // While searching, a turn with no hit is dropped entirely rather than shown
    // greyed — a filtered view that still requires scrolling past the misses is
    // not a filter.
    if (matches && !turn.segments.some((s) => matches.has(s.id))) continue;
    parts.push(turnBlock(turn, matches));
  }

  els.transcriptBody.replaceChildren(...parts);
}

/** Speaker names, editable in one place rather than per row. */
function speakerBar(current: Transcript): HTMLElement {
  const bar = el('div', 'speaker-bar');
  bar.append(el('span', 'eyebrow', 'Speakers'));

  current.speakers.forEach((name, index) => {
    const input = el('input');
    input.className = `speaker-name s${index % 4}`;
    input.value = name;
    input.setAttribute('aria-label', `Name of speaker ${index + 1}`);
    input.addEventListener('change', () => {
      if (!transcript) return;
      updateTranscript(renameSpeaker(transcript, index, input.value));
    });
    bar.append(input);
  });

  return bar;
}

function disclaimer(): HTMLElement {
  return el('p', 'transcript-caveat',
    'Speaker labels are guessed from pauses, not from voice recognition, and the text is machine ' +
    'transcription. Check both against the recording before anything goes in a chart.');
}

function turnBlock(turn: Turn, matches: Set<number> | null): HTMLElement {
  const block = el('div', 'turn');
  const head = el('div', 'turn-head');

  const name = transcript?.speakers[turn.speaker] ?? `Speaker ${turn.speaker + 1}`;
  const chip = el('button', `speaker-chip s${turn.speaker % 4}`, name);
  chip.title = 'Assign this turn to the other speaker';
  chip.addEventListener('click', () => {
    if (!transcript) return;
    const next = (turn.speaker + 1) % Math.max(2, transcript.speakers.length);
    let updated = transcript;
    for (const segment of turn.segments) updated = setSpeaker(updated, segment.id, next);
    updateTranscript(updated);
  });

  // The heuristic's usual failure is one missed handover, which inverts every
  // label after it. Fixing that a turn at a time is not viable on a long call.
  const cascade = el('button', 'turn-cascade', '↓');
  cascade.title = 'Assign this speaker from here to the end';
  cascade.setAttribute('aria-label', 'Assign this speaker from here to the end');
  cascade.addEventListener('click', () => {
    if (!transcript) return;
    const next = (turn.speaker + 1) % Math.max(2, transcript.speakers.length);
    updateTranscript(setSpeakerFrom(transcript, turn.segments[0].id, next));
  });

  const time = el('button', 'turn-time', clock(turn.start));
  time.title = 'Play from here';
  time.addEventListener('click', () => seek(turn.start));

  head.append(chip, cascade, time);
  block.append(head);

  for (const segment of turn.segments) {
    const row = el('div', 'segment');
    if (matches?.has(segment.id)) row.classList.add('hit');

    const text = el('div', 'segment-text');
    text.contentEditable = 'true';
    text.spellcheck = true;
    text.textContent = segment.text;
    text.setAttribute('role', 'textbox');
    text.setAttribute('aria-label', `Transcript at ${clock(segment.start)}`);

    // Committed on blur, not on input: re-rendering mid-edit would move the
    // caret, and the notes are re-derived from the text on every commit.
    text.addEventListener('blur', () => {
      if (!transcript) return;
      const value = (text.textContent ?? '').trim();
      if (value === segment.text) return;
      updateTranscript(editText(transcript, segment.id, value), false);
    });

    // Whisper breaks on its own rhythm, so a sentence is regularly split across
    // two rows. Joining them is the second most common edit after fixing a word.
    const join = el('button', 'segment-join', '⌃');
    join.title = 'Join to the line above';
    join.setAttribute('aria-label', 'Join to the line above');
    // Nothing to join the first line to. `mergeWithPrevious` would no-op anyway,
    // but a button that does nothing when pressed is worse than a hidden one.
    join.disabled = transcript?.segments[0]?.id === segment.id;
    join.addEventListener('click', () => {
      if (!transcript) return;
      updateTranscript(mergeWithPrevious(transcript, segment.id));
    });

    const drop = el('button', 'segment-drop', '×');
    drop.title = 'Remove this line';
    drop.setAttribute('aria-label', 'Remove this line');
    drop.addEventListener('click', () => {
      if (!transcript) return;
      updateTranscript(removeSegment(transcript, segment.id));
    });

    row.append(text, join, drop);
    block.append(row);
  }

  return block;
}

function seek(seconds: number): void {
  // Never seek into audio belonging to a different call. Refusing is the only
  // safe answer — playing the wrong recording gives no sign that it is wrong.
  if (!audioUrl || !transcript || audioForId !== transcript.id) {
    toast('Open this call’s audio file again to play along — recordings are not saved.');
    return;
  }
  if (!playerMediaReady()) {
    toast('The recording is still preparing — playback will be available shortly.');
    return;
  }
  const max = els.player.duration;
  els.player.currentTime = Math.max(0, Math.min(max, seconds));
  void els.player.play().catch((error: unknown) => {
    const name = error instanceof Error ? error.name : '';
    playerStatus = name === 'NotAllowedError' ? 'blocked' : 'error';
    playerErrorMessage = name === 'NotAllowedError'
      ? 'Playback was blocked — press play again.'
      : 'Playback could not start. Try pressing play again.';
    updatePlayerUI();
  });
}

/* ---------------------------------------------------------- call notes */

function renderNotes(): void {
  if (!transcript || !notes) return;

  const parts: HTMLElement[] = [];

  const toolbar = el('div', 'notes-toolbar');
  toolbar.append(el('span', 'muted',
    'Read from this transcript by rules that run on this machine.'));
  const copy = el('button', 'btn sm', 'Copy notes');
  copy.title = 'Copies as a checklist, with the recording caveat attached';
  copy.addEventListener('click', () => {
    if (transcript && notes) {
      void copyPlain(notesToText(transcript, notes), 'Notes copied.')
        .then((ok) => { if (ok) flashCopied(copy); });
    }
  });
  toolbar.append(copy);
  parts.push(toolbar);

  parts.push(notesSection('Follow-ups', notes.actions.length, notes.actions.length
    ? notes.actions.map(actionRow)
    : [el('p', 'empty-note', 'Nothing that reads as a commitment or a request. Scan the transcript yourself before closing the call out.')]));

  parts.push(notesSection('Details mentioned', notes.details.length, notes.details.length
    ? notes.details.map(detailRow)
    : [el('p', 'empty-note', 'No numbers, dates or addresses picked up.')]));

  const providerMap: Record<string, string> = {
    'crd-records-request': 'provider-records',
    'crd-referral-ack': 'provider-referral-received',
    'care-referral-status': 'provider-referral-followup',
    'care-question': 'provider-consult',
    'ann-hours': 'provider-office-update',
    'ann-closure': 'provider-office-update',
  };
  const providerSuggestions = notes.suggestions.flatMap(s => {
    const match = TEMPLATES.find(t => t.id === providerMap[s.templateId]);
    return match ? [{ ...s, templateId: match.id, label: match.name }] : [];
  });
  parts.push(notesSection('Suggested provider email', providerSuggestions.length, providerSuggestions.length
    ? providerSuggestions.map(suggestionRow)
    : [el('p', 'empty-note', 'Nothing in the call points at a particular template.')]));

  els.notesBody.replaceChildren(...parts);
}

function notesSection(title: string, count: number, children: HTMLElement[]): HTMLElement {
  const section = el('section', 'notes-section');
  const head = el('div', 'notes-head');
  head.append(el('h2', undefined, title));
  if (count > 0) head.append(el('span', 'count-pill', String(count)));
  section.append(head, ...children);
  return section;
}

function actionRow(action: ActionItem): HTMLElement {
  const row = el('label', 'note-row check');
  const box = el('input');
  box.type = 'checkbox';

  const body = el('div');
  body.append(el('strong', undefined, action.label));

  const jump = el('button', 'note-time', clock(action.atSec));
  jump.type = 'button';
  jump.addEventListener('click', (event) => { event.preventDefault(); seek(action.atSec); });

  const quote = el('span', 'note-quote', `“${action.excerpt}”`);
  body.append(jump, quote);
  const track = el('button', 'btn sm', 'Track follow-up');
  track.type = 'button';
  track.addEventListener('click', event => { event.preventDefault(); addWorkspaceFollowup(action.label); });
  body.append(track);

  row.append(box, body);
  return row;
}

function detailRow(detail: Detail): HTMLElement {
  const row = el('div', 'note-row');
  const body = el('div');
  body.append(
    el('span', 'note-kind', detail.label),
    el('strong', 'detail-value', detail.value),
  );

  const copy = el('button', 'linkbtn', 'Copy');
  copy.addEventListener('click', () => void copyPlain(detail.value, 'Copied.'));

  row.append(body, copy);
  return row;
}

/**
 * The hand-off into the template studio.
 *
 * This is the point of putting a transcriber in an email tool: the call ends
 * and the follow-up email is the next thing that has to happen. It opens the
 * template rather than filling it — the merge fields want the practice's real
 * values, and pre-filling them from a machine transcript would put transcribed
 * text into an email nobody had read.
 */
function suggestionRow(suggestion: { templateId: string; label: string; reason: string }): HTMLElement {
  const row = el('div', 'note-row');
  const body = el('div');
  body.append(el('strong', undefined, suggestion.label));

  const template = TEMPLATES.find((t) => t.id === suggestion.templateId);
  if (template) {
    body.append(el('span', 'tpl-tag', CATEGORY_LABELS[template.category]));
  }
  body.append(el('span', 'note-quote', suggestion.reason));

  const open = el('button', 'btn sm');
  open.textContent = 'Open';
  open.disabled = !template;
  open.addEventListener('click', async () => {
    if (!template) return;
    setTool('templates');
    await selectTemplate(template);
  });

  row.append(body, open);
  return row;
}

/**
 * The pane that shows exactly what "Copy" will put on the clipboard.
 *
 * The transcript view is built for editing; selecting clean text out of a wall
 * of contenteditable rows is fiddly. This view shows the plain exported text
 * in a read-only field that selects normally — click, Ctrl+A or "Select all",
 * paste it into the chart note.
 */
function refreshTranscriptText(): void {
  if (!transcript) {
    els.transcriptText.value = '';
    els.textMeta.textContent = 'Text appears here once a call is transcribed.';
    els.textSelectAll.disabled = true;
    return;
  }
  const spec = formatById(currentFormat());
  els.transcriptText.value = toFormat(transcript, spec.id);
  els.textMeta.textContent =
    `Showing the ${spec.label} export. Correct anything on the Transcript view — it refreshes here.`;
  els.textSelectAll.disabled = false;
}

function setTranscriptView(view: TranscriptView): void {
  state.transcriptView = view;
  selectSegment(els.transcriptViewSwitch, view, 'tview');
  els.transcriptBody.hidden = view !== 'transcript';
  els.notesBody.hidden = view !== 'notes';
  els.textPane.hidden = view !== 'text';
  // Search only searches the transcript rows, so it has no business on the
  // other two views (it used to sit there doing nothing).
  els.transcriptSearchWrap.hidden = view !== 'transcript';
  if (view === 'text') refreshTranscriptText();
}

/* -------------------------------------------------------------- export */

function currentFormat(): ExportFormat {
  return formatById(els.formatSelect.value).id;
}

function downloadTranscript(): void {
  if (!transcript) return;

  const spec = formatById(currentFormat());
  const blob = new Blob([toFormat(transcript, spec.id)], { type: `${spec.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename(transcript.name, spec.extension);
  link.click();

  // Revoking immediately can cancel the download in Firefox; a tick is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Downloaded as ${spec.label}.`);
}

/* ============================================================ tools ==== */

function setTool(tool: Tool): void {
  workspaceToolChanged(tool);
  state.tool = tool;
  selectSegment(els.toolSwitch, tool, 'tool');
  els.pdfTool.hidden = tool !== 'pdf';
  els.templatesTool.hidden = tool !== 'templates';
  els.signatureTool.hidden = tool !== 'signature';
  els.transcribeTool.hidden = tool !== 'transcribe';
  if (tool === 'pdf') ensurePdfEditor();
  pdfEditor?.setVisible(tool === 'pdf');
  if (tool === 'signature') updateSignature();
}

/**
 * While the editor module downloads, its start-screen controls are inert (see
 * index.html). A file dropped in that window would make the browser navigate
 * away to open it, so hold the drop and say why.
 */
function holdEarlyPdfDrop(event: DragEvent): void {
  if (pdfEditor) return;
  event.preventDefault();
  if (event.type === 'drop') toast('The PDF editor is still loading. Drop the file again in a moment.');
}

function ensurePdfEditor(): void {
  if (pdfEditor || pdfEditorPromise) return;
  const note = els.pdfTool.querySelector<HTMLElement>('#pdfLoadingNote');
  if (note) note.textContent = 'Loading the PDF editor…';
  els.pdfTool.addEventListener('dragover', holdEarlyPdfDrop);
  els.pdfTool.addEventListener('drop', holdEarlyPdfDrop);
  pdfEditorPromise = import('./pdf/editor.js').then(({ initPdfEditor }) => {
    const controller = initPdfEditor({ root: els.pdfTool, toast, store, persistent });
    pdfEditor = controller;
    els.pdfTool.removeEventListener('dragover', holdEarlyPdfDrop);
    els.pdfTool.removeEventListener('drop', holdEarlyPdfDrop);
    controller.setVisible(state.tool === 'pdf');
    return controller;
  }).catch(() => {
    pdfEditorPromise = null;
    if (note) note.textContent = 'The PDF editor could not load. Check your connection, then reopen the PDF editor.';
    toast('The PDF editor could not load. Refresh and try again.');
    return null;
  });
}

/* ========================================================= settings ==== */

function renderBrandForm(): void {
  els.brandFields.replaceChildren(
    ...BRAND_FIELDS.map((field) => {
      const wrap = el('div', 'field');
      const id = `b-${field.key}`;
      const label = el('label', undefined, field.label);
      label.htmlFor = id;

      const input = el('input');
      input.id = id;
      input.type = field.type === 'email' ? 'email'
        : field.type === 'url' ? 'url'
        : field.type === 'phone' ? 'tel' : 'text';
      input.value = brand[field.key] ?? '';
      if (field.sample) input.placeholder = field.sample;

      input.addEventListener('input', () => {
        brand[field.key] = input.value;
        void saveBrand(store, brand).then(showBrandStatus);
      });

      wrap.append(label, input);
      if (field.key === 'practice_address') {
        wrap.append(el('p', 'help',
          'Required by CAN-SPAM on any email sent to a list. Must be a real postal address.'));
      }
      return wrap;
    }),
  );
  showBrandStatus();
}

function showBrandStatus(): void {
  const missing = incompleteBrandKeys(brand);
  if (!missing.length) {
    els.brandStatus.textContent = '';
    return;
  }
  const labels = missing.map((key) => BRAND_FIELDS.find((f) => f.key === key)?.label ?? key);
  els.brandStatus.textContent =
    `Still blank: ${labels.join(', ')}. Templates that use these will ask before you can export.`;
}

/* -------------------------------------------------------------- copying */

async function copyRich(html: string, plain: string, message: string): Promise<boolean> {
  try {
    if (navigator.clipboard && 'ClipboardItem' in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(html);
    }
    toast(message);
    return true;
  } catch {
    toast('Copy failed — your browser blocked clipboard access.');
    return false;
  }
}

async function copyPlain(text: string, message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
    return true;
  } catch {
    toast('Copy failed — your browser blocked clipboard access.');
    return false;
  }
}

/**
 * A brief "Copied ✓" on the button that did the copying.
 *
 * The toast already says it, but the eye is on the button when it is clicked;
 * confirming there too makes the action feel acknowledged.
 */
function flashCopied(button: HTMLButtonElement): void {
  const btn = button as HTMLButtonElement & { _flash?: number; _label?: string };
  if (!btn._label) btn._label = button.textContent ?? 'Copy';
  window.clearTimeout(btn._flash);
  button.classList.add('copied');
  button.textContent = 'Copied ✓';
  btn._flash = window.setTimeout(() => {
    button.classList.remove('copied');
    button.textContent = btn._label ?? 'Copy';
  }, 1400);
}

/* ---------------------------------------------------------------- wiring */

for (const button of els.toolSwitch.querySelectorAll<HTMLButtonElement>('button')) {
  button.addEventListener('click', () => setTool(button.dataset.tool as Tool));
}

for (const button of els.transcriptViewSwitch.querySelectorAll<HTMLButtonElement>('button')) {
  button.addEventListener('click', () =>
    setTranscriptView(button.dataset.tview as TranscriptView));
}

els.dropzone.addEventListener('click', () => els.audioFile.click());
els.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    els.audioFile.click();
  }
});
els.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  els.dropzone.classList.add('over');
});
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('over'));
els.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('over');
  const file = event.dataTransfer?.files?.[0];
  if (file) setPendingFile(file);
});

els.audioFile.addEventListener('change', () => {
  setPendingFile(els.audioFile.files?.[0] ?? null);
});

els.tierSelect.addEventListener('change', () => {
  state.tier = els.tierSelect.value as TierId;
  showTierNote();
  void store.set(TIER_KEY, state.tier);
});

els.langSelect.addEventListener('change', () => {
  state.language = els.langSelect.value;
  showTierNote();
  void store.set(LANG_KEY, state.language);
});

els.runTranscribe.addEventListener('click', () => void startRun());
els.stopTranscribe.addEventListener('click', stopRun);

els.playerPlay.addEventListener('click', togglePlayback);
els.playerSkipBack.addEventListener('click', () => skipPlayback(-10));
els.playerSkipForward.addEventListener('click', () => skipPlayback(30));
els.playerSeek.addEventListener('input', () => {
  if (!playerMediaReady()) return;
  els.player.currentTime = Math.max(
    0,
    Math.min(els.player.duration, Number(els.playerSeek.value)),
  );
});
els.playerSpeed.addEventListener('change', () => {
  const rate = Number(els.playerSpeed.value);
  if (Number.isFinite(rate) && rate > 0) els.player.playbackRate = rate;
});
els.playerMute.addEventListener('click', () => {
  if (els.player.muted || els.player.volume === 0) {
    els.player.muted = false;
    els.player.volume = lastVolume || 1;
  } else {
    lastVolume = els.player.volume;
    els.player.muted = true;
  }
  updatePlayerUI();
});
els.playerVolume.addEventListener('input', () => {
  const volume = Math.max(0, Math.min(1, Number(els.playerVolume.value)));
  els.player.volume = volume;
  els.player.muted = volume === 0;
  if (volume > 0) lastVolume = volume;
  updatePlayerUI();
});
els.player.addEventListener('loadstart', () => {
  if (audioUrl && playerStatus !== 'recovering') {
    playerStatus = 'loading';
    playerErrorMessage = '';
  }
  updatePlayerUI();
});
for (const event of ['durationchange', 'loadeddata', 'canplay', 'progress', 'stalled', 'suspend', 'timeupdate', 'volumechange'] as const) {
  els.player.addEventListener(event, updatePlayerUI);
}
const markPlayerReady = (): void => {
  if (playerMediaReady()) {
    clearPlayerLoadTimer();
    if (playerStatus !== 'recovering' && playerStatus !== 'error' && playerStatus !== 'blocked') {
      playerStatus = 'loading';
    }
  }
  updatePlayerUI();
};
els.player.addEventListener('loadedmetadata', markPlayerReady);
els.player.addEventListener('loadeddata', markPlayerReady);
els.player.addEventListener('canplay', markPlayerReady);
els.player.addEventListener('play', () => {
  if (playerMediaReady() && playerStatus !== 'recovering' && playerStatus !== 'error') {
    playerStatus = 'loading';
  }
  updatePlayerUI();
});
els.player.addEventListener('playing', () => {
  if (playerMediaReady()) playerStatus = 'loading';
  updatePlayerUI();
});
els.player.addEventListener('pause', () => {
  if (playerMediaReady() && playerStatus !== 'recovering' && playerStatus !== 'error' && playerStatus !== 'blocked') {
    playerStatus = 'loading';
  }
  updatePlayerUI();
});
els.player.addEventListener('ended', updatePlayerUI);
els.player.addEventListener('error', () => {
  clearPlayerLoadTimer();
  if (audioUrl && els.player.currentSrc && els.player.currentSrc !== audioUrl) return;
  if (!audioUrl || playerStatus === 'recovering') {
    updatePlayerUI();
    return;
  }
  if (!playerFallbackAttempted) {
    playerErrorMessage = nativePlayerErrorMessage();
    updatePlayerUI();
    recoverPlayerPlayback();
    return;
  }
  playerStatus = 'error';
  playerErrorMessage = 'This recording could not be played in the browser. Try a PCM WAV or MP3 export.';
  updatePlayerUI();
});
updatePlayerUI();

els.transcriptSearch.addEventListener('input', () => {
  state.transcriptQuery = els.transcriptSearch.value;
  renderTranscript();
});

els.formatSelect.addEventListener('change', () => {
  // The footer format picker drives Copy and Download; when the Text view is
  // open it also drives what the text field shows, live.
  if (state.transcriptView === 'text') refreshTranscriptText();
});

els.textSelectAll.addEventListener('click', () => {
  els.transcriptText.focus();
  els.transcriptText.select();
});

els.copyTranscript.addEventListener('click', () => {
  if (!transcript) return;
  void copyPlain(toFormat(transcript, currentFormat()), 'Transcript copied.')
    .then((ok) => { if (ok) flashCopied(els.copyTranscript); });
});

els.copyTranscript.title = 'Copies the transcript in the format chosen above';

els.downloadTranscript.addEventListener('click', downloadTranscript);

/**
 * Leaving mid-run would silently discard it.
 *
 * The model does not resume, so a reload means starting the whole recording
 * over — worth one browser prompt.
 */
window.addEventListener('beforeunload', (event) => {
  if (!activeRun?.running) return;
  event.preventDefault();
  event.returnValue = '';
});

/**
 * Write pending edits out before the page goes away.
 *
 * All three editors debounce their saves by about half a second, so anything
 * typed, joined or reassigned in that last moment is still sitting in a timer
 * when the tab closes — and is simply lost. It is a narrow window, but it is
 * the window right after someone finishes an edit and immediately navigates
 * away, which is exactly when they believe the work is done.
 *
 * `visibilitychange` rather than `beforeunload`: it fires on tab close,
 * navigation and backgrounding alike, and is the one browsers still honour for
 * this. The writes are fired without awaiting because nothing can be awaited at
 * this point; IndexedDB carries out an already-issued transaction on its own.
 */
function flushPendingSaves(): void {
  window.clearTimeout(saveTimer);
  window.clearTimeout(sigSaveTimer);
  window.clearTimeout(transcriptSaveTimer);

  if (state.selected) void saveDraft(store, state.selected.id, state.values);
  void store.set(SIG_KEY, state.signature);
  queueEmailIdentitySave();
  if (transcript) void saveTranscript(store, transcript);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingSaves();
});

for (const button of els.sideTabs.querySelectorAll<HTMLButtonElement>('button')) {
  button.addEventListener('click', () => setPane(button.dataset.pane as 'content' | 'design'));
}

function setEmailIdentity(patch: Partial<EmailIdentityConfig>): void {
  state.emailIdentity = { ...state.emailIdentity, ...patch };
  renderEmailIdentity();
  update();
  queueEmailIdentitySave();
}

els.uploadEmailLogo.addEventListener('click', () => {
  els.emailLogoFile.click();
});

els.emailLogoFile.addEventListener('change', () => {
  const file = els.emailLogoFile.files?.[0];
  els.emailLogoFile.value = '';
  if (!file) return;
  if (file.type !== 'image/png' && !/\.png$/i.test(file.name)) {
    toast('Brand logos must be PNG files.');
    return;
  }
  void readLogoImage(file, 420)
    .then((data) => {
      setPracticeLogo(data);
      toast('Brand logo saved and applied to your email templates.');
    })
    .catch(() => toast('That PNG could not be read.'));
});

els.removeEmailLogo.addEventListener('click', () => {
  setPracticeLogo(null);
  toast('Custom brand logo removed.');
});

els.emailLogoPlacement.addEventListener('change', () => {
  const placement = els.emailLogoPlacement.value as EmailIdentityConfig['logoPlacement'];
  if (placement === 'header' || placement === 'above' || placement === 'footer' || placement === 'hidden') {
    setEmailIdentity({ logoPlacement: placement });
  }
});

els.browseTemplates.addEventListener('click', openGallery);
els.closeGallery.addEventListener('click', closeGallery);
els.search.addEventListener('input', () => {
  state.query = els.search.value;
  renderGallery();
});

for (const button of els.viewSwitch.querySelectorAll<HTMLButtonElement>('button')) {
  button.addEventListener('click', () => {
    state.view = button.dataset.view as View;
    selectSegment(els.viewSwitch, state.view, 'view');
    els.preview.hidden = state.view === 'text';
    els.previewText.hidden = state.view !== 'text';
    els.preview.classList.toggle('mobile', state.view === 'mobile');
  });
}

for (const button of els.sigViewSwitch.querySelectorAll<HTMLButtonElement>('button')) {
  button.addEventListener('click', () => {
    state.sigView = button.dataset.view as SigView;
    selectSegment(els.sigViewSwitch, state.sigView, 'view');
    els.sigPreview.hidden = state.sigView === 'text';
    els.sigPreviewText.hidden = state.sigView !== 'text';
    updateSignature();
  });
}

function setReviewOpen(open: boolean): void {
  els.reviewDrawer.classList.toggle('open', open);
  els.scrim.classList.toggle('open', open);
  els.reviewDrawer.setAttribute('aria-hidden', String(!open));
}

els.openReview.addEventListener('click', () => setReviewOpen(true));
els.closeReview.addEventListener('click', () => setReviewOpen(false));
els.scrim.addEventListener('click', () => setReviewOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.gallery.hidden) closeGallery();
  else setReviewOpen(false);
});

els.copyGmail.addEventListener('click', () => {
  if (!canExport() || !current) return;
  const gmail = toGmailHtml(current.html);
  void copyRich(gmail.html, current.text, 'Copied — paste into Gmail with Ctrl+V.');
});
els.copyHtml.addEventListener('click', () => {
  if (!canExport() || !current) return;
  void copyPlain(current.html, 'Full HTML copied.');
});
els.copyText.addEventListener('click', () => {
  if (!canExport() || !current) return;
  void copyPlain(current.text, 'Plain text copied.');
});

els.sigCopy.addEventListener('click', () => {
  void copyRich(
    buildSignature(state.signature),
    buildSignatureText(state.signature),
    'Copied — paste into Gmail settings, under Signature.',
  );
});
els.sigCopyHtml.addEventListener('click', () => {
  void copyPlain(buildSignature(state.signature), 'Signature HTML copied.');
});

els.sigReset.addEventListener('click', async () => {
  state.signature = applyBrandToSignature({ ...DEFAULT_SIGNATURE }, brand);
  await store.delete(SIG_KEY);
  renderSignatureForm();
  updateSignature();
  toast('Signature reset.');
});

els.resetFields.addEventListener('click', async () => {
  const template = state.selected;
  if (!template) return;
  await clearDraft(store, template.id);
  await selectTemplate(template);
  toast('Fields reset to samples.');
});

els.openSettings.addEventListener('click', () => {
  renderBrandForm();
  els.settings.showModal();
});

els.settings.addEventListener('close', () => {
  // Practice details feed both tools, so re-seed whatever is open.
  state.signature = applyBrandToSignature(state.signature, brand);
  renderSignatureForm();
  renderEmailIdentity();
  if (state.selected) void selectTemplate(state.selected);
  else if (state.tool === 'signature') updateSignature();
});

els.resetBrand.addEventListener('click', async () => {
  await resetBrand(store);
  brand = await loadBrand(store);
  renderBrandForm();
  toast('Practice details reset to defaults.');
});

els.clearData.addEventListener('click', async () => {
  // Name what is about to go rather than asking for blind confirmation.
  const summary = await describeStoredData(store);
  const parts = [
    (await store.get('workspace:v1')) ? 'your follow-ups, provider directory, favorites and workspace notes' : '',
    summary.drafts ? `${summary.drafts} saved draft${summary.drafts === 1 ? '' : 's'}` : '',
    summary.transcripts
      ? `${summary.transcripts} call transcript${summary.transcripts === 1 ? '' : 's'}`
      : '',
    summary.hadBrand ? 'your practice details' : '',
    summary.hadRecent ? 'your recently used values' : '',
    (await store.get(SIG_KEY)) || (await store.get(EMAIL_IDENTITY_KEY))
      ? 'your shared email identity' : '',
    // File storage was removed, but files saved before then are still in the
    // store and clearAll() deletes them, so the confirmation keeps naming them.
    (await store.get<unknown>('file-storage:index:v1')) ? 'files saved by the old file storage' : '',
    (await store.get<unknown>(PDF_SIGNATURES_KEY)) ? 'your saved PDF signatures' : '',
  ].filter(Boolean);

  if (!parts.length) {
    toast('Nothing is saved yet.');
    return;
  }
  if (!window.confirm(`This deletes ${parts.join(', ')}. It cannot be undone.`)) return;

  await resetWorkspace();
  await emailIdentitySave.catch(() => undefined);
  await clearAll(store);
  brand = await loadBrand(store);
  recent = await loadRecent(store);
  state.signature = applyBrandToSignature({ ...DEFAULT_SIGNATURE }, brand);
  state.emailIdentity = { ...DEFAULT_EMAIL_IDENTITY };
  renderBrandForm();
  renderSignatureForm();
  renderEmailIdentity();
  clearTranscript();
  setPendingFile(null);
  await pdfEditor?.reloadSignatures();
  // "Clear saved data" is the one moment someone has said, explicitly, that
  // they want this machine tidied. The loaded model is hundreds of megabytes of
  // resident memory and it is theirs to reclaim too — the weights stay in the
  // browser's cache, so the next run reloads without re-downloading.
  releaseTranscriber();
  await renderSavedList();
  if (state.selected) await selectTemplate(state.selected);
  toast('Saved data cleared.');
});

/* ------------------------------------------------------------------ boot */

async function boot(): Promise<void> {
  const opened = await openStorage();
  store = opened.adapter;
  persistent = opened.persistent;

  brand = await loadBrand(store);
  recent = await loadRecent(store);
  state.emailIdentity = await loadEmailIdentity(store);

  const savedSignature = await store.get<unknown>(SIG_KEY);
  state.signature = applyBrandToSignature(
    normalizeSignature(savedSignature),
    brand,
  );

  // One practice mark, two surfaces: an existing Signature Studio logo is
  // adopted by the email editor, and a logo already chosen in the editor is
  // visible when the studio opens.
  if (state.emailIdentity.logoData && !state.signature.logoData) {
    state.signature.logoData = state.emailIdentity.logoData;
  } else if (!state.emailIdentity.logoData && state.signature.logoData) {
    state.emailIdentity.logoData = state.signature.logoData;
    queueEmailIdentitySave();
  }

  if (!persistent) {
    // Say it plainly rather than letting someone lose an afternoon's drafts.
    els.storageState.textContent = 'Storage unavailable — work will not be saved';
    els.storageState.classList.add('alert');
  }

  const savedTier = await store.get<unknown>(TIER_KEY);
  if (savedTier !== undefined) {
    state.tier = normalizeTier(savedTier);
  } else {
    // Accurate was never the old default, so preserve that deliberate choice;
    // reset the old Fast preference to Balanced as part of this default change.
    const legacyTier = await store.get<unknown>(LEGACY_TIER_KEY);
    state.tier = legacyTier === 'accurate' ? 'accurate' : DEFAULT_TIER;
    await store.set(TIER_KEY, state.tier);
  }
  state.language = (await store.get<string>(LANG_KEY)) ?? 'auto';

  els.audioFile.accept = ACCEPTED;
  renderTierSelect();
  renderLanguageSelect();
  renderFormatSelect();
  await renderSavedList();
  paintTranscribeEmpties();

  // Say up front which backend will run. On WASM a long recording takes minutes
  // rather than seconds, and that is worth knowing before starting, not after.
  hasWebGpu = await webGpuAvailable();
  els.engineState.textContent = hasWebGpu
    ? `WebGPU ready · faster local inference · ${ACCEPTED_LABEL}`
    : `CPU mode · Balanced is the default · ${ACCEPTED_LABEL}`;
  if (!hasWebGpu) els.engineState.classList.add('warn');

  // Detection is async, so the picker was built with the GPU figures. Redraw it
  // now that the real ones are known.
  renderTierSelect();

  renderGalleryNav();
  renderGallery();
  renderSignatureForm();
  renderEmailIdentity();
  await selectTemplate(TEMPLATES.find((template) => template.id === 'provider-introduction') ?? TEMPLATES[0]);
  await initWorkspace({
    store, persistent, templates: TEMPLATES, toast,
    openTool: setTool,
    openTemplate: async (template, recipient) => {
      await persist();
      await selectTemplate(template);
      if (recipient) {
        state.values.recipient_name = recipient;
        renderFillForm();
        update();
        scheduleSave();
      }
      setTool('templates');
    },
    openSettings: () => els.openSettings.click(),
  });
}

void boot();
