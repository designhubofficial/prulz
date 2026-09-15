import { degrees, PDFDocument, rgb, StandardFonts, type PDFImage } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { StorageAdapter } from '../store/adapter.js';
import {
  SIGNATURE_MAX_DIMENSION, SIGNATURE_UPLOAD_MAX_BYTES, addSignature, isPngBytes, loadSignatures,
  removeSignature, signatureName, type NewSignature, type SavedSignature,
} from '../store/pdf-signatures.js';

GlobalWorkerOptions.workerSrc = workerUrl;

type PdfTool =
  | 'select'
  | 'text'
  | 'highlight'
  | 'draw'
  | 'shape'
  | 'sign'
  | 'image'
  | 'organize'
  | 'merge'
  | 'split'
  | 'compress';

type Overlay =
  | { kind: 'text'; id: string; page: number; x: number; y: number; text: string; size: number; color: string }
  | { kind: 'mark'; id: string; page: number; x: number; y: number; w: number; h: number; color: string }
  | { kind: 'draw'; id: string; page: number; points: number[]; color: string; width: number }
  | { kind: 'shape'; id: string; page: number; x: number; y: number; w: number; h: number; color: string; width: number }
  | { kind: 'image' | 'signature'; id: string; page: number; x: number; y: number; w: number; h: number; dataUrl: string; name: string };

interface ImagePayload {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  kind: 'image' | 'signature';
}

interface PdfSnapshot {
  bytes: ArrayBuffer;
  overlays: Overlay[];
  currentPage: number;
  selectedPages: number[];
}

type PointerState =
  | { kind: 'move'; startX: number; startY: number; before: PdfSnapshot; original: Overlay }
  | { kind: 'box'; mode: 'highlight' | 'shape'; x0: number; y0: number; x: number; y: number }
  | { kind: 'draw'; points: number[] };

export interface PdfEditorController {
  setVisible(visible: boolean): void;
  /** Re-read saved signatures, e.g. after the user clears saved data. */
  reloadSignatures(): Promise<void>;
}

interface PdfEditorOptions {
  root: HTMLElement;
  toast: (message: string) => void;
  /** Where signatures are kept. Without one they last until the page closes. */
  store?: StorageAdapter;
  persistent?: boolean;
}

type SignatureSaveResult = 'saved' | 'session' | 'failed';

const MAX_HISTORY = 30;
const DEFAULT_COLOR = '#f3b72b';
const DEFAULT_INK = '#287450';

function id(): string {
  return crypto.randomUUID();
}

function byId<T extends HTMLElement>(root: HTMLElement, name: string): T {
  const node = root.querySelector<T>(`#${name}`);
  if (!node) throw new Error(`Missing PDF editor element #${name}`);
  return node;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'document';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = match?.[1] ?? '287450';
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(',')[1] ?? '';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl: string): Promise<{ image: HTMLImageElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    image.onerror = () => reject(new Error('The image could not be decoded.'));
    image.src = dataUrl;
  });
}

async function imageToPng(file: File): Promise<ArrayBuffer> {
  const dataUrl = await readDataUrl(file);
  const decoded = await decodeImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, decoded.width);
  canvas.height = Math.max(1, decoded.height);
  canvas.getContext('2d')?.drawImage(decoded.image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('The image could not be converted.'))), 'image/png');
  });
  return blob.arrayBuffer();
}

/**
 * Decode an uploaded PNG and re-encode it, scaled to fit SIGNATURE_MAX_DIMENSION.
 * Re-encoding keeps transparency, bounds what is stored, and fixes the data URL's
 * type for a file picked without a .png extension (which reads as octet-stream).
 */
async function signatureFromPng(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const decoded = await decodeImage(await readDataUrl(new File([file], file.name, { type: 'image/png' })));
  const scale = Math.min(1, SIGNATURE_MAX_DIMENSION / decoded.width, SIGNATURE_MAX_DIMENSION / decoded.height);
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The image could not be converted.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

function signatureSaveMessage(result: SignatureSaveResult): string {
  if (result === 'saved') return 'Signature saved in this browser. Click the page to place it.';
  if (result === 'session') return 'Signature ready for this session — saving is off in this browser. Click the page to place it.';
  return 'Signature ready, but it could not be saved in this browser. Click the page to place it.';
}

function downloadBytes(bytes: ArrayBuffer, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function cloneOverlays(overlays: Overlay[]): Overlay[] {
  return overlays.map((item) => (item.kind === 'draw'
    ? { ...item, points: [...item.points] }
    : { ...item })) as Overlay[];
}

function overlayLabel(item: Overlay): string {
  if (item.kind === 'text') return item.text.split('\n')[0].slice(0, 28) || 'Text';
  if (item.kind === 'mark') return 'Highlight';
  if (item.kind === 'draw') return 'Drawing';
  if (item.kind === 'shape') return 'Rectangle';
  return item.name || (item.kind === 'signature' ? 'Signature' : 'Image');
}

async function copyPagesInOrder(source: PDFDocument, output: PDFDocument, order: number[]): Promise<void> {
  for (const pageNumber of order) {
    const [page] = await output.copyPages(source, [pageNumber - 1]);
    if (page) output.addPage(page);
  }
}

async function rebuildPageOrder(bytes: ArrayBuffer, order: number[]): Promise<ArrayBuffer> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const output = await PDFDocument.create();
  await copyPagesInOrder(source, output, order);
  return toArrayBuffer(await output.save({ useObjectStreams: true }));
}

async function applyOverlays(bytes: ArrayBuffer, overlays: Overlay[]): Promise<ArrayBuffer> {
  if (overlays.length === 0) return bytes.slice(0);
  const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const imageCache = new Map<string, PDFImage>();

  for (const item of overlays) {
    const page = document.getPage(item.page - 1);
    if (!page) continue;
    const pageHeight = page.getHeight();
    const [r, g, b] = hexToRgb(item.kind === 'mark' ? item.color : item.kind === 'text' ? item.color : item.kind === 'shape' ? item.color : item.kind === 'draw' ? item.color : '#111827');
    const color = rgb(r, g, b);

    if (item.kind === 'text') {
      const lines = item.text.split('\n');
      page.drawText(lines.join('\n'), {
        x: item.x,
        y: pageHeight - item.y - item.size,
        size: item.size,
        lineHeight: item.size * 1.28,
        font,
        color,
      });
    } else if (item.kind === 'mark') {
      page.drawRectangle({
        x: item.x,
        y: pageHeight - item.y - item.h,
        width: item.w,
        height: item.h,
        color,
        opacity: 0.28,
        borderWidth: 0,
      });
    } else if (item.kind === 'shape') {
      page.drawRectangle({
        x: item.x,
        y: pageHeight - item.y - item.h,
        width: item.w,
        height: item.h,
        borderColor: color,
        borderWidth: item.width,
      });
    } else if (item.kind === 'draw') {
      for (let i = 0; i < item.points.length - 2; i += 2) {
        page.drawLine({
          start: { x: item.points[i], y: pageHeight - item.points[i + 1] },
          end: { x: item.points[i + 2], y: pageHeight - item.points[i + 3] },
          thickness: item.width,
          color,
          lineCap: 1,
        });
      }
    } else {
      let image = imageCache.get(item.dataUrl);
      if (!image) {
        image = item.dataUrl.startsWith('data:image/jpeg') || item.dataUrl.startsWith('data:image/jpg')
          ? await document.embedJpg(dataUrlToBytes(item.dataUrl))
          : await document.embedPng(dataUrlToBytes(item.dataUrl));
        imageCache.set(item.dataUrl, image);
      }
      page.drawImage(image, {
        x: item.x,
        y: pageHeight - item.y - item.h,
        width: item.w,
        height: item.h,
      });
    }
  }

  return toArrayBuffer(await document.save({ useObjectStreams: true }));
}

export function initPdfEditor({ root, toast, store, persistent = false }: PdfEditorOptions): PdfEditorController {
  const els = {
    empty: byId<HTMLElement>(root, 'pdfEmpty'),
    editorShell: byId<HTMLElement>(root, 'pdfEditorShell'),
    dropzone: byId<HTMLElement>(root, 'pdfDropzone'),
    fileInput: byId<HTMLInputElement>(root, 'pdfFileInput'),
    mergeInput: byId<HTMLInputElement>(root, 'pdfMergeInput'),
    imageInput: byId<HTMLInputElement>(root, 'pdfImageInput'),
    imagePageInput: byId<HTMLInputElement>(root, 'pdfImagePageInput'),
    signatureUploadInput: byId<HTMLInputElement>(root, 'pdfSignatureUploadInput'),
    newFile: byId<HTMLButtonElement>(root, 'pdfNewFile'),
    undo: byId<HTMLButtonElement>(root, 'pdfUndo'),
    redo: byId<HTMLButtonElement>(root, 'pdfRedo'),
    pageInput: byId<HTMLInputElement>(root, 'pdfPageInput'),
    pageCount: byId<HTMLElement>(root, 'pdfPageCount'),
    exportPdf: byId<HTMLButtonElement>(root, 'pdfExport'),
    fileName: byId<HTMLElement>(root, 'pdfFileName'),
    fileMeta: byId<HTMLElement>(root, 'pdfFileMeta'),
    dirty: byId<HTMLElement>(root, 'pdfDirty'),
    zoomOut: byId<HTMLButtonElement>(root, 'pdfZoomOut'),
    zoomIn: byId<HTMLButtonElement>(root, 'pdfZoomIn'),
    fit: byId<HTMLButtonElement>(root, 'pdfFit'),
    zoomLabel: byId<HTMLElement>(root, 'pdfZoomLabel'),
    railCount: byId<HTMLElement>(root, 'pdfRailCount'),
    pagesList: byId<HTMLElement>(root, 'pdfPagesList'),
    selectionMeta: byId<HTMLElement>(root, 'pdfSelectionMeta'),
    canvasScroll: byId<HTMLElement>(root, 'pdfCanvasScroll'),
    pageWrap: byId<HTMLElement>(root, 'pdfPageWrap'),
    baseCanvas: byId<HTMLCanvasElement>(root, 'pdfBaseCanvas'),
    overlayCanvas: byId<HTMLCanvasElement>(root, 'pdfOverlayCanvas'),
    renderLoading: byId<HTMLElement>(root, 'pdfRenderLoading'),
    canvasTitle: byId<HTMLElement>(root, 'pdfCanvasTitle'),
    canvasHint: byId<HTMLElement>(root, 'pdfCanvasHint'),
    inspectorBody: byId<HTMLElement>(root, 'pdfInspectorBody'),
    toolButtons: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pdf-tool]')),
    signatureDialog: byId<HTMLDialogElement>(root, 'pdfSignatureDialog'),
    signatureClose: byId<HTMLButtonElement>(root, 'pdfSignatureClose'),
    signaturePad: byId<HTMLCanvasElement>(root, 'pdfSignaturePad'),
    signatureName: byId<HTMLInputElement>(root, 'pdfSignatureName'),
    signatureClear: byId<HTMLButtonElement>(root, 'pdfSignatureClear'),
    signatureSave: byId<HTMLButtonElement>(root, 'pdfSignatureSave'),
  };

  const state = {
    visible: false,
    fileName: '',
    bytes: null as ArrayBuffer | null,
    originalBytes: null as ArrayBuffer | null,
    pdf: null as PDFDocumentProxy | null,
    loadingTask: null as ReturnType<typeof getDocument> | null,
    currentPage: 1,
    anchorPage: 1,
    selectedPages: new Set<number>(),
    zoom: 1,
    zoomMode: 'fit' as 'fit' | 'manual',
    activeTool: 'select' as PdfTool,
    color: DEFAULT_COLOR,
    inkColor: DEFAULT_INK,
    width: 2,
    textSize: 16,
    textDraft: '',
    overlays: [] as Overlay[],
    selection: null as string | null,
    pendingImage: null as ImagePayload | null,
    history: [] as PdfSnapshot[],
    redo: [] as PdfSnapshot[],
    dirty: false,
    renderToken: 0,
    pageSize: { width: 0, height: 0 },
    pointer: null as PointerState | null,
    imageCache: new Map<string, HTMLImageElement>(),
    signatureHasInk: false,
    signatureDrawing: false,
    savedSignatures: [] as SavedSignature[],
  };

  function notify(message: string): void {
    toast(message);
  }

  function setStatus(message: string, kind: 'ready' | 'working' | 'warn' = 'ready'): void {
    els.canvasHint.textContent = message;
    els.canvasHint.dataset.state = kind;
  }

  function snapshot(): PdfSnapshot {
    return {
      bytes: state.bytes?.slice(0) ?? new ArrayBuffer(0),
      overlays: cloneOverlays(state.overlays),
      currentPage: state.currentPage,
      selectedPages: [...state.selectedPages],
    };
  }

  function pushHistory(value: PdfSnapshot): void {
    state.history.push(value);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.redo = [];
    state.dirty = true;
    updateToolbar();
  }

  function selectedPageNumbers(): number[] {
    if (state.selectedPages.size === 0) return [state.currentPage];
    return [...state.selectedPages].sort((a, b) => a - b);
  }

  function updateToolbar(): void {
    const pageCount = state.pdf?.numPages ?? 0;
    els.pageCount.textContent = String(pageCount);
    els.railCount.textContent = String(pageCount);
    els.fileName.textContent = state.fileName || 'Untitled.pdf';
    els.fileMeta.textContent = state.bytes
      ? `${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(state.bytes.byteLength)}`
      : 'Ready to edit';
    els.dirty.textContent = state.dirty ? 'Unsaved changes' : 'Saved';
    els.dirty.classList.toggle('is-dirty', state.dirty);
    els.undo.disabled = state.history.length === 0;
    els.redo.disabled = state.redo.length === 0;
    els.pageInput.max = String(Math.max(1, pageCount));
    els.pageInput.value = String(state.currentPage);
    els.zoomLabel.textContent = state.zoomMode === 'fit' ? 'Fit' : `${Math.round(state.zoom * 100)}%`;
    const count = selectedPageNumbers().length;
    els.selectionMeta.textContent = `${count} page${count === 1 ? '' : 's'} selected${state.overlays.length ? ` · ${state.overlays.length} edit${state.overlays.length === 1 ? '' : 's'}` : ''}`;
  }

  function updateToolButtons(): void {
    for (const button of els.toolButtons) {
      const active = button.dataset.pdfTool === state.activeTool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  function bounds(item: Overlay): { x: number; y: number; w: number; h: number } {
    if (item.kind === 'text') {
      const lineCount = item.text.split('\n').length;
      return { x: item.x, y: item.y, w: Math.max(26, item.text.length * item.size * 0.56), h: Math.max(item.size, lineCount * item.size * 1.28) };
    }
    if (item.kind === 'draw') {
      const xs = item.points.filter((_, index) => index % 2 === 0);
      const ys = item.points.filter((_, index) => index % 2 === 1);
      const x = Math.min(...xs, 0);
      const y = Math.min(...ys, 0);
      return { x, y, w: Math.max(8, Math.max(...xs, 0) - x), h: Math.max(8, Math.max(...ys, 0) - y) };
    }
    return { x: item.x, y: item.y, w: item.w, h: item.h };
  }

  function drawOverlayItem(ctx: CanvasRenderingContext2D, item: Overlay, selected: boolean): void {
    const scale = state.zoom;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (item.kind === 'text') {
      ctx.font = `${item.size * scale}px Inter, Arial, sans-serif`;
      ctx.fillStyle = item.color;
      ctx.textBaseline = 'top';
      item.text.split('\n').forEach((line, index) => ctx.fillText(line, item.x * scale, (item.y + index * item.size * 1.28) * scale));
    } else if (item.kind === 'mark') {
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(item.x * scale, item.y * scale, item.w * scale, item.h * scale);
      ctx.globalAlpha = 1;
    } else if (item.kind === 'shape') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width * scale;
      ctx.strokeRect(item.x * scale, item.y * scale, item.w * scale, item.h * scale);
    } else if (item.kind === 'draw') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width * scale;
      ctx.beginPath();
      for (let i = 0; i < item.points.length; i += 2) {
        const x = item.points[i] * scale;
        const y = item.points[i + 1] * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      let image = state.imageCache.get(item.dataUrl);
      if (!image) {
        image = new Image();
        image.onload = () => renderOverlay();
        image.src = item.dataUrl;
        state.imageCache.set(item.dataUrl, image);
      }
      if (image.complete) ctx.drawImage(image, item.x * scale, item.y * scale, item.w * scale, item.h * scale);
    }

    if (selected) {
      const box = bounds(item);
      ctx.strokeStyle = '#287450';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(box.x * scale - 4, box.y * scale - 4, box.w * scale + 8, box.h * scale + 8);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#287450';
      ctx.lineWidth = 1.5;
      ctx.fillRect(box.x * scale - 5, box.y * scale - 5, 10, 10);
      ctx.strokeRect(box.x * scale - 5, box.y * scale - 5, 10, 10);
      ctx.fillRect((box.x + box.w) * scale - 5, (box.y + box.h) * scale - 5, 10, 10);
      ctx.strokeRect((box.x + box.w) * scale - 5, (box.y + box.h) * scale - 5, 10, 10);
    }
    ctx.restore();
  }

  function drawDraft(ctx: CanvasRenderingContext2D): void {
    const draft = state.pointer;
    if (!draft || draft.kind === 'move') return;
    const scale = state.zoom;
    ctx.save();
    ctx.strokeStyle = draft.kind === 'box' && draft.mode === 'highlight' ? state.color : state.inkColor;
    ctx.lineWidth = state.width * scale;
    if (draft.kind === 'box') {
      const x = Math.min(draft.x0, draft.x);
      const y = Math.min(draft.y0, draft.y);
      const w = Math.abs(draft.x - draft.x0);
      const h = Math.abs(draft.y - draft.y0);
      if (draft.mode === 'highlight') {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = state.color;
        ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeRect(x * scale, y * scale, w * scale, h * scale);
      }
    } else {
      ctx.beginPath();
      for (let i = 0; i < draft.points.length; i += 2) {
        if (i === 0) ctx.moveTo(draft.points[i] * scale, draft.points[i + 1] * scale);
        else ctx.lineTo(draft.points[i] * scale, draft.points[i + 1] * scale);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderOverlay(): void {
    const canvas = els.overlayCanvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Number.parseFloat(canvas.style.width) || els.pageWrap.clientWidth;
    const cssHeight = Number.parseFloat(canvas.style.height) || els.pageWrap.clientHeight;
    if (!cssWidth || !cssHeight) return;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    for (const item of state.overlays.filter((entry) => entry.page === state.currentPage)) {
      drawOverlayItem(ctx, item, item.id === state.selection);
    }
    drawDraft(ctx);
  }

  async function destroyPdf(): Promise<void> {
    const task = state.loadingTask;
    state.pdf = null;
    state.loadingTask = null;
    if (task) {
      try {
        await task.destroy();
      } catch {
        // PDF.js can already be torn down after a failed render.
      }
    }
  }

  async function refreshPdf(): Promise<void> {
    if (!state.bytes) return;
    await destroyPdf();
    state.loadingTask = getDocument({ data: new Uint8Array(state.bytes.slice(0)) });
    state.pdf = await state.loadingTask.promise;
    const total = state.pdf.numPages;
    state.currentPage = clamp(state.currentPage, 1, total);
    state.selectedPages = new Set([...state.selectedPages].filter((page) => page <= total));
    if (state.selectedPages.size === 0) state.selectedPages.add(state.currentPage);
    updateToolbar();
    renderThumbnails();
    await fitToPage(false);
    await renderPage();
  }

  async function renderThumbnail(document: PDFDocumentProxy, pageNumber: number, target: HTMLElement): Promise<void> {
    try {
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 106 / base.width });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      if (state.pdf !== document) return;
      target.replaceChildren(canvas);
    } catch {
      target.textContent = 'PDF';
    }
  }

  function renderThumbnails(): void {
    const document = state.pdf;
    els.pagesList.replaceChildren();
    if (!document) return;
    const fragment = window.document.createDocumentFragment();
    for (let page = 1; page <= document.numPages; page++) {
      const button = window.document.createElement('button');
      button.type = 'button';
      button.className = 'pdf-page-thumb';
      button.dataset.pdfPage = String(page);
      button.setAttribute('aria-label', `Go to page ${page}`);
      button.setAttribute('aria-current', String(page === state.currentPage));
      button.setAttribute('aria-pressed', String(state.selectedPages.has(page)));
      const number = window.document.createElement('span');
      number.className = 'pdf-thumb-number';
      number.textContent = String(page).padStart(2, '0');
      const paper = window.document.createElement('span');
      paper.className = 'pdf-thumb-paper';
      paper.textContent = 'Rendering';
      button.append(paper, number);
      button.addEventListener('click', (event) => selectPage(page, event));
      fragment.append(button);
      void renderThumbnail(document, page, paper);
    }
    els.pagesList.append(fragment);
  }

  function selectPage(page: number, event: MouseEvent): void {
    const total = state.pdf?.numPages ?? 0;
    if (!total) return;
    if (event.shiftKey) {
      const start = Math.min(state.anchorPage, page);
      const end = Math.max(state.anchorPage, page);
      state.selectedPages = new Set(Array.from({ length: end - start + 1 }, (_, index) => start + index));
    } else if (event.ctrlKey || event.metaKey) {
      const next = new Set(state.selectedPages);
      if (next.has(page) && next.size > 1) next.delete(page);
      else next.add(page);
      state.selectedPages = next;
      state.anchorPage = page;
    } else {
      state.selectedPages = new Set([page]);
      state.anchorPage = page;
    }
    state.currentPage = page;
    state.selection = null;
    updateToolbar();
    renderThumbnails();
    void renderPage();
    renderInspector();
  }

  async function renderPage(): Promise<void> {
    const document = state.pdf;
    if (!document) return;
    const token = ++state.renderToken;
    els.renderLoading.hidden = false;
    try {
      const page = await document.getPage(state.currentPage);
      const viewport = page.getViewport({ scale: state.zoom });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      els.pageWrap.style.width = `${Math.ceil(viewport.width)}px`;
      els.pageWrap.style.height = `${Math.ceil(viewport.height)}px`;
      els.baseCanvas.width = Math.ceil(viewport.width * dpr);
      els.baseCanvas.height = Math.ceil(viewport.height * dpr);
      els.baseCanvas.style.width = `${Math.ceil(viewport.width)}px`;
      els.baseCanvas.style.height = `${Math.ceil(viewport.height)}px`;
      els.overlayCanvas.style.width = `${Math.ceil(viewport.width)}px`;
      els.overlayCanvas.style.height = `${Math.ceil(viewport.height)}px`;
      state.pageSize = { width: viewport.width / state.zoom, height: viewport.height / state.zoom };
      await page.render({
        canvas: els.baseCanvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
      if (token !== state.renderToken) return;
      els.canvasTitle.textContent = `Page ${state.currentPage}`;
      renderOverlay();
      els.renderLoading.hidden = true;
    } catch {
      if (token === state.renderToken) {
        els.renderLoading.hidden = true;
        setStatus('This page could not be rendered. Try opening the file again.', 'warn');
      }
    }
  }

  async function fitToPage(render = true): Promise<void> {
    const document = state.pdf;
    if (!document) return;
    const page = await document.getPage(state.currentPage);
    const base = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(340, els.canvasScroll.clientWidth - 84);
    const availableHeight = Math.max(420, els.canvasScroll.clientHeight - 84);
    state.zoom = clamp(Math.min(1.24, Math.min(availableWidth / base.width, availableHeight / base.height)), 0.5, 1.6);
    state.zoomMode = 'fit';
    updateToolbar();
    if (render) await renderPage();
  }

  function setZoom(value: number): void {
    state.zoom = clamp(Number(value.toFixed(2)), 0.5, 2.6);
    state.zoomMode = 'manual';
    updateToolbar();
    void renderPage();
  }

  function pagePoint(event: PointerEvent): { x: number; y: number } {
    const rect = els.overlayCanvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / state.zoom, 0, state.pageSize.width),
      y: clamp((event.clientY - rect.top) / state.zoom, 0, state.pageSize.height),
    };
  }

  function hitTest(x: number, y: number): Overlay | null {
    const current = state.overlays.filter((item) => item.page === state.currentPage).reverse();
    for (const item of current) {
      const box = bounds(item);
      const padding = 8;
      if (x >= box.x - padding && x <= box.x + box.w + padding && y >= box.y - padding && y <= box.y + box.h + padding) return item;
    }
    return null;
  }

  function movedOverlay(item: Overlay, dx: number, dy: number): Overlay {
    if (item.kind === 'draw') return { ...item, points: item.points.map((value, index) => value + (index % 2 === 0 ? dx : dy)) };
    if (item.kind === 'text' || item.kind === 'mark' || item.kind === 'shape' || item.kind === 'image' || item.kind === 'signature') return { ...item, x: item.x + dx, y: item.y + dy };
    return item;
  }

  async function placePendingImage(x: number, y: number): Promise<void> {
    const pending = state.pendingImage;
    if (!pending) {
      selectTool('image');
      notify('Choose an image in the tool panel first.');
      return;
    }
    const maxWidth = Math.min(220, state.pageSize.width - x - 20);
    const width = clamp(Math.min(maxWidth, pending.width), 50, 260);
    const height = Math.max(36, width * (pending.height / Math.max(1, pending.width)));
    const before = snapshot();
    pushHistory(before);
    state.overlays.push({ kind: pending.kind, id: id(), page: state.currentPage, x, y, w: width, h: height, dataUrl: pending.dataUrl, name: pending.name });
    state.selection = state.overlays[state.overlays.length - 1]?.id ?? null;
    state.dirty = true;
    updateToolbar();
    renderOverlay();
    renderInspector();
    notify(`${pending.kind === 'signature' ? 'Signature' : 'Image'} placed. Export when you’re ready.`);
  }

  function pointerDown(event: PointerEvent): void {
    if (!state.pdf) return;
    const point = pagePoint(event);
    els.overlayCanvas.setPointerCapture(event.pointerId);
    if (state.activeTool === 'select') {
      const hit = hitTest(point.x, point.y);
      state.selection = hit?.id ?? null;
      state.pointer = hit ? { kind: 'move', startX: point.x, startY: point.y, before: snapshot(), original: { ...hit, ...(hit.kind === 'draw' ? { points: [...hit.points] } : {}) } as Overlay } : null;
      renderOverlay();
      renderInspector();
      return;
    }
    if (state.activeTool === 'text') {
      const text = state.textDraft.trim();
      if (!text) {
        notify('Type your text in the tool panel, then click the page.');
        root.querySelector<HTMLTextAreaElement>('#pdfTextDraft')?.focus();
        return;
      }
      pushHistory(snapshot());
      const item: Overlay = { kind: 'text', id: id(), page: state.currentPage, x: point.x, y: point.y, text, size: state.textSize, color: state.inkColor };
      state.overlays.push(item);
      state.selection = item.id;
      state.dirty = true;
      renderOverlay();
      updateToolbar();
      renderInspector();
      notify('Text placed. Keep clicking to add another copy.');
      return;
    }
    if (state.activeTool === 'sign' || state.activeTool === 'image') {
      void placePendingImage(point.x, point.y);
      return;
    }
    if (state.activeTool === 'highlight' || state.activeTool === 'shape') {
      state.pointer = { kind: 'box', mode: state.activeTool, x0: point.x, y0: point.y, x: point.x, y: point.y };
      renderOverlay();
      return;
    }
    if (state.activeTool === 'draw') {
      state.pointer = { kind: 'draw', points: [point.x, point.y] };
      renderOverlay();
    }
  }

  function pointerMove(event: PointerEvent): void {
    const pointer = state.pointer;
    if (!pointer) return;
    const point = pagePoint(event);
    if (pointer.kind === 'move') {
      const dx = point.x - pointer.startX;
      const dy = point.y - pointer.startY;
      state.overlays = state.overlays.map((item) => item.id === pointer.original.id ? movedOverlay(pointer.original, dx, dy) : item);
    } else if (pointer.kind === 'box') {
      pointer.x = point.x;
      pointer.y = point.y;
    } else {
      pointer.points.push(point.x, point.y);
    }
    renderOverlay();
  }

  function pointerUp(event: PointerEvent): void {
    const pointer = state.pointer;
    if (!pointer) return;
    const point = pagePoint(event);
    if (pointer.kind === 'move') {
      const moved = Math.abs(point.x - pointer.startX) > 0.5 || Math.abs(point.y - pointer.startY) > 0.5;
      if (moved) {
        state.history.push(pointer.before);
        if (state.history.length > MAX_HISTORY) state.history.shift();
        state.redo = [];
        state.dirty = true;
      }
    } else if (pointer.kind === 'box') {
      const x = Math.min(pointer.x0, pointer.x);
      const y = Math.min(pointer.y0, pointer.y);
      const w = Math.abs(pointer.x - pointer.x0);
      const h = Math.abs(pointer.y - pointer.y0);
      if (w > 4 && h > 4) {
        pushHistory(snapshot());
        const item: Overlay = pointer.mode === 'highlight'
          ? { kind: 'mark', id: id(), page: state.currentPage, x, y, w, h, color: state.color }
          : { kind: 'shape', id: id(), page: state.currentPage, x, y, w, h, color: state.inkColor, width: state.width };
        state.overlays.push(item);
        state.selection = item.id;
        notify(pointer.mode === 'highlight' ? 'Highlight added.' : 'Rectangle added.');
      }
    } else if (pointer.points.length >= 4) {
      pushHistory(snapshot());
      const item: Overlay = { kind: 'draw', id: id(), page: state.currentPage, points: [...pointer.points], color: state.inkColor, width: state.width };
      state.overlays.push(item);
      state.selection = item.id;
      notify('Drawing added.');
    }
    state.pointer = null;
    updateToolbar();
    renderOverlay();
    renderInspector();
  }

  function removeSelectedOverlay(): void {
    if (!state.selection) return;
    const item = state.overlays.find((entry) => entry.id === state.selection);
    if (!item) return;
    pushHistory(snapshot());
    state.overlays = state.overlays.filter((entry) => entry.id !== state.selection);
    state.selection = null;
    updateToolbar();
    renderOverlay();
    renderInspector();
    notify(`${overlayLabel(item)} removed.`);
  }

  async function mutateDocument(label: string, transform: (bytes: ArrayBuffer) => Promise<ArrayBuffer>): Promise<void> {
    if (!state.bytes) return;
    setStatus(`Working on ${label.toLowerCase()}…`, 'working');
    try {
      const before = snapshot();
      const materialized = await applyOverlays(state.bytes, state.overlays);
      const next = await transform(materialized);
      pushHistory(before);
      state.bytes = next;
      state.overlays = [];
      state.selection = null;
      await refreshPdf();
      setStatus('Select an object or choose a tool to start');
      notify(`${label} complete. Export when you’re ready.`);
    } catch {
      setStatus(`${label} failed. Try a smaller file or open it again.`, 'warn');
      notify(`${label} failed — the original document is still here.`);
    }
  }

  async function rotateSelected(direction: 90 | -90): Promise<void> {
    await mutateDocument('Rotation', async (bytes) => {
      const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (const pageNumber of selectedPageNumbers()) {
        const page = document.getPage(pageNumber - 1);
        if (!page) continue;
        const angle = page.getRotation().angle;
        page.setRotation(degrees((angle + direction + 360) % 360));
      }
      return toArrayBuffer(await document.save({ useObjectStreams: true }));
    });
  }

  async function deleteSelectedPages(): Promise<void> {
    const selected = new Set(selectedPageNumbers());
    const total = state.pdf?.numPages ?? 0;
    if (selected.size >= total) {
      notify('Keep at least one page in the document.');
      return;
    }
    const nextPage = Math.min(state.currentPage, total - selected.size);
    await mutateDocument('Page deletion', (bytes) => rebuildPageOrder(bytes, Array.from({ length: total }, (_, index) => index + 1).filter((page) => !selected.has(page))));
    state.currentPage = clamp(nextPage, 1, Math.max(1, total - selected.size));
    state.selectedPages = new Set([state.currentPage]);
    updateToolbar();
    renderThumbnails();
    void renderPage();
  }

  async function duplicateSelectedPages(): Promise<void> {
    const selected = new Set(selectedPageNumbers());
    const total = state.pdf?.numPages ?? 0;
    const order: number[] = [];
    for (let page = 1; page <= total; page++) {
      order.push(page);
      if (selected.has(page)) order.push(page);
    }
    await mutateDocument('Page duplication', (bytes) => rebuildPageOrder(bytes, order));
    state.currentPage = Math.min(state.currentPage + (selected.has(state.currentPage) ? 1 : 0), order.length);
    state.selectedPages = new Set([state.currentPage]);
    updateToolbar();
    renderThumbnails();
    void renderPage();
  }

  async function moveCurrentPage(direction: -1 | 1): Promise<void> {
    const total = state.pdf?.numPages ?? 0;
    const target = state.currentPage + direction;
    if (target < 1 || target > total) return;
    const order = Array.from({ length: total }, (_, index) => index + 1);
    [order[state.currentPage - 1], order[target - 1]] = [order[target - 1]!, order[state.currentPage - 1]!];
    await mutateDocument('Page reorder', (bytes) => rebuildPageOrder(bytes, order));
    state.currentPage = target;
    state.selectedPages = new Set([target]);
    updateToolbar();
    renderThumbnails();
    void renderPage();
  }

  async function addBlankPage(): Promise<void> {
    const afterPage = state.currentPage;
    await mutateDocument('Blank page insertion', async (bytes) => {
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const output = await PDFDocument.create();
      const copies = await output.copyPages(source, source.getPageIndices());
      const size = source.getPage(afterPage - 1).getSize();
      for (let index = 0; index < copies.length; index++) {
        output.addPage(copies[index]!);
        if (index + 1 === afterPage) output.addPage([size.width, size.height]);
      }
      return toArrayBuffer(await output.save({ useObjectStreams: true }));
    });
    state.currentPage = afterPage + 1;
    state.selectedPages = new Set([state.currentPage]);
    updateToolbar();
    renderThumbnails();
    void renderPage();
  }

  async function addImagePage(files: File[]): Promise<void> {
    const image = files[0];
    if (!image || !state.bytes) return;
    await mutateDocument('Image page insertion', async (bytes) => {
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const output = await PDFDocument.create();
      const copies = await output.copyPages(source, source.getPageIndices());
      const png = await imageToPng(image);
      const embedded = await output.embedPng(png);
      for (let index = 0; index < copies.length; index++) {
        output.addPage(copies[index]!);
        if (index + 1 === state.currentPage) {
          const page = output.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
        }
      }
      return toArrayBuffer(await output.save({ useObjectStreams: true }));
    });
    state.currentPage += 1;
    state.selectedPages = new Set([state.currentPage]);
    updateToolbar();
    renderThumbnails();
    void renderPage();
  }

  async function mergeFiles(files: File[]): Promise<void> {
    if (!state.bytes || files.length === 0) return;
    await mutateDocument('PDF merge', async (bytes) => {
      const output = await PDFDocument.create();
      const current = await PDFDocument.load(bytes, { ignoreEncryption: true });
      await copyPagesInOrder(current, output, Array.from({ length: current.getPageCount() }, (_, index) => index + 1));
      for (const file of files) {
        const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        await copyPagesInOrder(source, output, Array.from({ length: source.getPageCount() }, (_, index) => index + 1));
      }
      return toArrayBuffer(await output.save({ useObjectStreams: true }));
    });
  }

  async function exportSelected(): Promise<void> {
    if (!state.bytes) return;
    try {
      const materialized = await applyOverlays(state.bytes, state.overlays);
      const source = await PDFDocument.load(materialized, { ignoreEncryption: true });
      const output = await PDFDocument.create();
      await copyPagesInOrder(source, output, selectedPageNumbers());
      const bytes = toArrayBuffer(await output.save({ useObjectStreams: true }));
      downloadBytes(bytes, `${baseName(state.fileName)}-selection.pdf`);
      notify('Selected pages downloaded.');
    } catch {
      notify('Selected pages could not be exported.');
    }
  }

  async function compress(): Promise<void> {
    const beforeSize = state.bytes?.byteLength ?? 0;
    await mutateDocument('PDF optimization', async (bytes) => {
      const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return toArrayBuffer(await document.save({ useObjectStreams: true }));
    });
    const afterSize = state.bytes?.byteLength ?? beforeSize;
    notify(afterSize < beforeSize ? `Optimized from ${formatBytes(beforeSize)} to ${formatBytes(afterSize)}.` : 'PDF structure optimized. The file was already compact.');
  }

  async function exportPdf(): Promise<void> {
    if (!state.bytes) return;
    try {
      setStatus('Preparing your export…', 'working');
      const bytes = await applyOverlays(state.bytes, state.overlays);
      downloadBytes(bytes, `${baseName(state.fileName)}-edited.pdf`);
      state.dirty = false;
      updateToolbar();
      setStatus('Exported locally. Your source file stays open.');
      notify('PDF exported.');
    } catch {
      setStatus('Export failed. The source file is still open.', 'warn');
      notify('Export failed — try again.');
    }
  }

  async function undo(): Promise<void> {
    const previous = state.history.pop();
    if (!previous || !state.bytes) return;
    state.redo.push(snapshot());
    await restore(previous);
    updateToolbar();
    renderInspector();
    notify('Undone.');
  }

  async function redo(): Promise<void> {
    const next = state.redo.pop();
    if (!next || !state.bytes) return;
    state.history.push(snapshot());
    await restore(next);
    updateToolbar();
    renderInspector();
    notify('Redone.');
  }

  function toolInstruction(tool: PdfTool): string {
    const instructions: Record<PdfTool, string> = {
      select: 'Select an object or choose a tool to start',
      text: 'Click anywhere on the page to place text',
      highlight: 'Click and drag across the passage you want to mark',
      draw: 'Click and drag to draw freehand on the page',
      shape: 'Click and drag to frame an area',
      sign: state.pendingImage ? 'Click the page to place your signature' : 'Create a signature, then click the page',
      image: state.pendingImage ? 'Click the page to place your image' : 'Choose an image, then click the page',
      organize: 'Select pages in the rail, then choose an action',
      merge: 'Add another PDF and its pages will follow this document',
      split: 'Select pages in the rail, then export that selection',
      compress: 'Repack the document locally and compare the result',
    };
    return instructions[tool];
  }

  function inspectorHeader(kicker: string, title: string, description: string): string {
    return `<div class="pdf-inspector-card pdf-inspector-intro"><span class="pdf-panel-kicker">${kicker}</span><h3>${title}</h3><p>${description}</p></div>`;
  }

  function renderInspector(): void {
    const pages = selectedPageNumbers();
    const selectedItem = state.selection ? state.overlays.find((item) => item.id === state.selection) : null;
    let html = '';
    if (state.activeTool === 'select') {
      html = inspectorHeader('SELECTED PAGE', `${pages.length} page${pages.length === 1 ? '' : 's'} in focus`, selectedItem ? `${escapeHtml(overlayLabel(selectedItem))} selected. Drag it on the page or remove it with Delete.` : 'Choose a page or an edit on the canvas. Hold Ctrl/Cmd to select several pages.')
        + '<div class="pdf-selection-summary"><span class="pdf-selection-number">' + String(state.currentPage).padStart(2, '0') + '</span><div><strong>Page ' + state.currentPage + '</strong><small>' + (state.selectedPages.size > 1 ? `${state.selectedPages.size} pages selected` : 'Ready for edits') + '</small></div></div>'
        + '<div class="pdf-inspector-actions"><button type="button" class="btn" data-pdf-action="delete-overlay" ' + (selectedItem ? '' : 'disabled') + '>Remove selected edit</button><button type="button" class="btn quiet" data-pdf-action="clear-overlays" ' + (state.overlays.length ? '' : 'disabled') + '>Clear all edits</button></div>';
    } else if (state.activeTool === 'text') {
      html = inspectorHeader('ADD TEXT', 'Write it once', 'Add a clean text layer anywhere on the page. It remains movable until you export.')
        + '<label class="pdf-field-label" for="pdfTextDraft">Text to place</label><textarea id="pdfTextDraft" rows="4" placeholder="Type a note, label, or correction…"></textarea><div class="pdf-field-row"><label class="pdf-field-label" for="pdfTextSize">Size<input id="pdfTextSize" type="number" min="8" max="72" value="' + state.textSize + '"></label><label class="pdf-field-label" for="pdfInkColor">Color<input id="pdfInkColor" type="color" value="' + state.inkColor + '"></label></div><button type="button" class="btn primary pdf-wide-action" data-pdf-action="activate-text">Place on page</button>';
    } else if (state.activeTool === 'highlight') {
      html = inspectorHeader('ANNOTATE', 'Mark a passage', 'Drag over a block of text or an area that needs attention. Highlights are baked into the exported PDF.')
        + '<label class="pdf-field-label" for="pdfHighlightColor">Highlight color<input id="pdfHighlightColor" type="color" value="' + state.color + '"></label><div class="pdf-color-swatches"><button type="button" data-pdf-color="#f3b72b" style="--swatch:#f3b72b" aria-label="Yellow highlight"></button><button type="button" data-pdf-color="#a7d8bd" style="--swatch:#a7d8bd" aria-label="Green highlight"></button><button type="button" data-pdf-color="#9ec5f8" style="--swatch:#9ec5f8" aria-label="Blue highlight"></button><button type="button" data-pdf-color="#f2a6bc" style="--swatch:#f2a6bc" aria-label="Pink highlight"></button></div><p class="pdf-tip">Tip: use the page rail with Shift to mark a range of pages, then switch to Organize.</p>';
    } else if (state.activeTool === 'draw') {
      html = inspectorHeader('ANNOTATE', 'Draw with intent', 'A lightweight pen for circling, underlining, or leaving a quick visual cue.')
        + '<div class="pdf-field-row"><label class="pdf-field-label" for="pdfInkColor">Ink color<input id="pdfInkColor" type="color" value="' + state.inkColor + '"></label><label class="pdf-field-label" for="pdfLineWidth">Weight<select id="pdfLineWidth"><option value="1" ' + (state.width === 1 ? 'selected' : '') + '>Fine</option><option value="2" ' + (state.width === 2 ? 'selected' : '') + '>Regular</option><option value="4" ' + (state.width === 4 ? 'selected' : '') + '>Bold</option></select></label></div><p class="pdf-tip">Drawings stay editable while you work and export as vector lines.</p>';
    } else if (state.activeTool === 'shape') {
      html = inspectorHeader('ANNOTATE', 'Frame an area', 'Draw a simple rectangle around a section you want to call out.')
        + '<div class="pdf-field-row"><label class="pdf-field-label" for="pdfInkColor">Line color<input id="pdfInkColor" type="color" value="' + state.inkColor + '"></label><label class="pdf-field-label" for="pdfLineWidth">Weight<select id="pdfLineWidth"><option value="1" ' + (state.width === 1 ? 'selected' : '') + '>Fine</option><option value="2" ' + (state.width === 2 ? 'selected' : '') + '>Regular</option><option value="4" ' + (state.width === 4 ? 'selected' : '') + '>Bold</option></select></label></div><p class="pdf-tip">Click and drag on the page to draw a rectangle.</p>';
    } else if (state.activeTool === 'sign') {
      const pending = state.pendingImage?.kind === 'signature' ? state.pendingImage : null;
      const pendingIsSaved = !!pending && state.savedSignatures.some((entry) => entry.dataUrl === pending.dataUrl);
      const preview = pending && !pendingIsSaved ? `<div class="pdf-pending-preview"><img src="${escapeHtml(pending.dataUrl)}" alt="${escapeHtml(pending.name)}"><div><strong>${escapeHtml(pending.name)}</strong><small>Ready to place on page</small></div></div>` : '';
      const saved = state.savedSignatures.map((entry) => {
        const active = entry.dataUrl === pending?.dataUrl;
        const name = escapeHtml(entry.name);
        return `<li class="pdf-saved-signature${active ? ' is-active' : ''}"><button type="button" class="pdf-saved-signature-use" data-pdf-signature-use="${escapeHtml(entry.id)}" aria-pressed="${active}"><img src="${escapeHtml(entry.dataUrl)}" alt=""><span><strong>${name}</strong><small>${active ? 'Ready — click the page' : entry.source === 'upload' ? 'Uploaded PNG' : 'Drawn'}</small></span></button><button type="button" class="pdf-saved-signature-remove" data-pdf-signature-remove="${escapeHtml(entry.id)}" aria-label="Remove ${name}" title="Remove from this browser">×</button></li>`;
      }).join('');
      html = inspectorHeader('SIGN', 'Make it official', 'Upload a PNG of your signature or draw one. Saved signatures stay in this browser for your next document.')
        + (saved ? '<span class="pdf-inspector-label">Saved signatures</span><ul class="pdf-saved-signatures">' + saved + '</ul>' : '')
        + preview
        + '<button type="button" class="btn primary pdf-wide-action" data-pdf-action="upload-signature">↑ Upload PNG signature</button>'
        + '<button type="button" class="btn pdf-wide-action" data-pdf-action="open-signature">✎ Draw a signature</button>'
        + (pending ? '<button type="button" class="btn quiet pdf-wide-action" data-pdf-action="clear-pending">Stop placing signature</button>' : '')
        + '<p class="pdf-tip">' + (store && persistent ? 'A PNG with a transparent background looks best. Choose a saved signature, then click the page to place it. Drag to adjust later.' : 'Saving is off in this browser, so signatures last for this session only.') + '</p>';
    } else if (state.activeTool === 'image') {
      const preview = state.pendingImage ? `<div class="pdf-pending-preview"><img src="${escapeHtml(state.pendingImage.dataUrl)}" alt="${escapeHtml(state.pendingImage.name)}"><div><strong>${escapeHtml(state.pendingImage.name)}</strong><small>Ready to place on page</small></div></div>` : '';
      html = inspectorHeader('IMAGE', 'Bring in a visual', 'Add a logo, scan, or supporting image without leaving the editor.') + preview + '<button type="button" class="btn primary pdf-wide-action" data-pdf-action="choose-image">' + (state.pendingImage ? 'Choose a different image' : 'Choose image') + '</button>' + '<p class="pdf-tip">Click the page after choosing an image. Select it later to move it.</p>';
    } else if (state.activeTool === 'organize') {
      html = inspectorHeader('ORGANIZE', `${pages.length} page${pages.length === 1 ? '' : 's'} selected`, 'Keep the document in order with page-level actions. Use Ctrl/Cmd or Shift in the rail for multi-select.')
        + '<div class="pdf-action-grid"><button type="button" class="btn" data-pdf-action="move-page-up">↑ Move up</button><button type="button" class="btn" data-pdf-action="move-page-down">↓ Move down</button><button type="button" class="btn" data-pdf-action="rotate-left">↺ Rotate left</button><button type="button" class="btn" data-pdf-action="rotate-right">↻ Rotate right</button><button type="button" class="btn" data-pdf-action="duplicate-pages">＋ Duplicate</button><button type="button" class="btn danger" data-pdf-action="delete-pages">× Delete</button></div><div class="pdf-divider"></div><button type="button" class="btn pdf-wide-action" data-pdf-action="add-blank">＋ Insert blank page</button><button type="button" class="btn quiet pdf-wide-action" data-pdf-action="insert-image">▧ Insert image page</button>';
    } else if (state.activeTool === 'merge') {
      html = inspectorHeader('MERGE', 'Bring files together', 'Add one or more PDFs. Their pages will be appended to the document you have open.')
        + '<button type="button" class="btn primary pdf-wide-action" data-pdf-action="merge">＋ Add PDF files</button><p class="pdf-tip">Everything happens locally. Existing edits are included before the merge.</p>';
    } else if (state.activeTool === 'split') {
      html = inspectorHeader('SPLIT', 'Take a section with you', 'Select the pages you need in the rail, then download them as a clean, separate PDF.')
        + '<div class="pdf-selection-summary"><span class="pdf-selection-number">' + String(pages.length).padStart(2, '0') + '</span><div><strong>' + pages.length + ' selected page' + (pages.length === 1 ? '' : 's') + '</strong><small>Pages ' + pages.join(', ') + '</small></div></div><button type="button" class="btn primary pdf-wide-action" data-pdf-action="export-selected">↓ Export selection</button><p class="pdf-tip">The original document stays open after export.</p>';
    } else {
      html = inspectorHeader('COMPRESS', 'Make the file lighter', `Current size: ${formatBytes(state.bytes?.byteLength ?? 0)}. Repack the structure locally and compare before exporting.`)
        + '<button type="button" class="btn primary pdf-wide-action" data-pdf-action="compress">↘ Optimize PDF</button><p class="pdf-tip">This keeps the text layer intact. Image-heavy scans may need a dedicated raster export to shrink dramatically.</p>';
    }
    els.inspectorBody.innerHTML = html;
    const draft = els.inspectorBody.querySelector<HTMLTextAreaElement>('#pdfTextDraft');
    if (draft) {
      draft.value = state.textDraft;
      draft.addEventListener('input', () => { state.textDraft = draft.value; });
    }
    els.inspectorBody.querySelector<HTMLInputElement>('#pdfTextSize')?.addEventListener('input', (event) => {
      state.textSize = clamp(Number((event.target as HTMLInputElement).value) || 16, 8, 72);
    });
    els.inspectorBody.querySelector<HTMLInputElement>('#pdfHighlightColor')?.addEventListener('input', (event) => { state.color = (event.target as HTMLInputElement).value; });
    els.inspectorBody.querySelector<HTMLInputElement>('#pdfInkColor')?.addEventListener('input', (event) => { state.inkColor = (event.target as HTMLInputElement).value; });
    els.inspectorBody.querySelector<HTMLSelectElement>('#pdfLineWidth')?.addEventListener('change', (event) => { state.width = Number((event.target as HTMLSelectElement).value) || 2; });
    els.inspectorBody.querySelectorAll<HTMLButtonElement>('[data-pdf-color]').forEach((button) => button.addEventListener('click', () => {
      state.color = button.dataset.pdfColor ?? DEFAULT_COLOR;
      renderInspector();
    }));
    els.inspectorBody.querySelectorAll<HTMLButtonElement>('[data-pdf-action]').forEach((button) => button.addEventListener('click', () => { void handleAction(button.dataset.pdfAction ?? ''); }));
    els.inspectorBody.querySelectorAll<HTMLButtonElement>('[data-pdf-signature-use]').forEach((button) => button.addEventListener('click', () => useSavedSignature(button.dataset.pdfSignatureUse ?? '')));
    els.inspectorBody.querySelectorAll<HTMLButtonElement>('[data-pdf-signature-remove]').forEach((button) => button.addEventListener('click', () => { void removeSavedSignature(button.dataset.pdfSignatureRemove ?? ''); }));
  }

  function selectTool(tool: PdfTool): void {
    state.activeTool = tool;
    state.selection = null;
    updateToolButtons();
    els.canvasHint.textContent = toolInstruction(tool);
    renderOverlay();
    renderInspector();
  }

  async function handleAction(action: string): Promise<void> {
    if (action === 'delete-overlay') removeSelectedOverlay();
    else if (action === 'clear-overlays') {
      if (state.overlays.length === 0) return;
      pushHistory(snapshot());
      state.overlays = [];
      state.selection = null;
      updateToolbar();
      renderOverlay();
      renderInspector();
      notify('All in-progress edits cleared.');
    } else if (action === 'activate-text') {
      selectTool('text');
      root.querySelector<HTMLTextAreaElement>('#pdfTextDraft')?.focus();
    } else if (action === 'open-signature') openSignatureDialog();
    else if (action === 'upload-signature') els.signatureUploadInput.click();
    else if (action === 'clear-pending') {
      state.pendingImage = null;
      renderInspector();
    } else if (action === 'choose-image') els.imageInput.click();
    else if (action === 'insert-image') els.imagePageInput.click();
    else if (action === 'merge') els.mergeInput.click();
    else if (action === 'add-blank') await addBlankPage();
    else if (action === 'rotate-left') await rotateSelected(-90);
    else if (action === 'rotate-right') await rotateSelected(90);
    else if (action === 'delete-pages') await deleteSelectedPages();
    else if (action === 'duplicate-pages') await duplicateSelectedPages();
    else if (action === 'move-page-up') await moveCurrentPage(-1);
    else if (action === 'move-page-down') await moveCurrentPage(1);
    else if (action === 'export-selected') await exportSelected();
    else if (action === 'compress') await compress();
  }

  function clearSignaturePad(): void {
    const ctx = els.signaturePad.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, els.signaturePad.width, els.signaturePad.height);
    ctx.strokeStyle = '#cbd8d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, els.signaturePad.height - 42);
    ctx.lineTo(els.signaturePad.width - 24, els.signaturePad.height - 42);
    ctx.stroke();
    state.signatureHasInk = false;
  }

  function signaturePoint(event: PointerEvent): { x: number; y: number } {
    const rect = els.signaturePad.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * els.signaturePad.width / rect.width, y: (event.clientY - rect.top) * els.signaturePad.height / rect.height };
  }

  function openSignatureDialog(): void {
    clearSignaturePad();
    els.signatureName.value = 'My signature';
    if (typeof els.signatureDialog.showModal === 'function') els.signatureDialog.showModal();
    else els.signatureDialog.setAttribute('open', '');
    window.setTimeout(() => els.signaturePad.focus(), 0);
  }

  function closeSignatureDialog(): void {
    if (els.signatureDialog.open) els.signatureDialog.close();
    else els.signatureDialog.removeAttribute('open');
  }

  async function useSignature(): Promise<void> {
    if (!state.signatureHasInk) {
      notify('Draw a signature first.');
      return;
    }
    const dataUrl = els.signaturePad.toDataURL('image/png');
    const result = await keepSignature({ dataUrl, name: signatureName(els.signatureName.value), width: els.signaturePad.width, height: els.signaturePad.height, source: 'drawn' });
    closeSignatureDialog();
    selectTool('sign');
    notify(signatureSaveMessage(result));
  }

  async function refreshSavedSignatures(): Promise<void> {
    if (!store) return;
    try {
      state.savedSignatures = await loadSignatures(store);
    } catch {
      state.savedSignatures = [];
    }
    if (state.activeTool === 'sign') renderInspector();
  }

  /** Make a signature the next one to place, and keep it in this browser. */
  async function keepSignature(signature: NewSignature): Promise<SignatureSaveResult> {
    state.pendingImage = { dataUrl: signature.dataUrl, name: signatureName(signature.name), width: signature.width, height: signature.height, kind: 'signature' };
    if (!store) return 'session';
    try {
      state.savedSignatures = await addSignature(store, signature);
      return persistent ? 'saved' : 'session';
    } catch {
      return 'failed';
    }
  }

  async function uploadSignature(file: File): Promise<void> {
    if (file.size > SIGNATURE_UPLOAD_MAX_BYTES) {
      notify(`That PNG is over ${formatBytes(SIGNATURE_UPLOAD_MAX_BYTES)}. Choose a smaller signature image.`);
      return;
    }
    // Check the bytes, not the extension: a renamed JPEG would otherwise be
    // accepted and lose the transparent background a signature needs.
    if (!isPngBytes(new Uint8Array(await file.slice(0, 8).arrayBuffer()))) {
      notify('Choose a PNG file. That file is not a PNG image.');
      return;
    }
    const image = await signatureFromPng(file);
    const result = await keepSignature({ ...image, name: signatureName(file.name), source: 'upload' });
    selectTool('sign');
    notify(signatureSaveMessage(result));
  }

  function useSavedSignature(signatureId: string): void {
    const signature = state.savedSignatures.find((entry) => entry.id === signatureId);
    if (!signature) return;
    state.pendingImage = { dataUrl: signature.dataUrl, name: signature.name, width: signature.width, height: signature.height, kind: 'signature' };
    selectTool('sign');
    notify(`${signature.name} is ready. Click the page to place it.`);
  }

  async function removeSavedSignature(signatureId: string): Promise<void> {
    const signature = state.savedSignatures.find((entry) => entry.id === signatureId);
    if (!signature || !store) return;
    try {
      state.savedSignatures = await removeSignature(store, signatureId);
    } catch {
      notify('That signature could not be removed. Try again.');
      return;
    }
    if (state.pendingImage?.kind === 'signature' && state.pendingImage.dataUrl === signature.dataUrl) state.pendingImage = null;
    els.canvasHint.textContent = toolInstruction(state.activeTool);
    renderInspector();
    notify(`${signature.name} removed from this browser. Signatures already on the page stay put.`);
  }

  async function openDocument(bytes: ArrayBuffer, name: string): Promise<void> {
    try {
      setStatus('Opening document…', 'working');
      await destroyPdf();
      state.bytes = bytes.slice(0);
      state.originalBytes = bytes.slice(0);
      state.fileName = name || 'Untitled.pdf';
      state.history = [];
      state.redo = [];
      state.overlays = [];
      state.selection = null;
      state.pendingImage = null;
      state.currentPage = 1;
      state.anchorPage = 1;
      state.selectedPages = new Set([1]);
      state.dirty = false;
      state.loadingTask = getDocument({ data: new Uint8Array(state.bytes.slice(0)) });
      state.pdf = await state.loadingTask.promise;
      if (state.pdf.numPages < 1) throw new Error('This PDF has no pages.');
      els.empty.hidden = true;
      els.editorShell.hidden = false;
      updateToolbar();
      renderThumbnails();
      await fitToPage(false);
      await renderPage();
      selectTool('select');
      setStatus('Select an object or choose a tool to start');
    } catch {
      await destroyPdf();
      state.bytes = null;
      state.originalBytes = null;
      notify('This file could not be opened. Try a standard, unencrypted PDF.');
      setStatus('Open a PDF to begin', 'warn');
    }
  }

  async function openFile(file: File): Promise<void> {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      notify('Choose a PDF. Images can be imported from the Images to PDF shortcut.');
      return;
    }
    await openDocument(await file.arrayBuffer(), file.name);
  }

  async function mergeInitialFiles(files: File[]): Promise<void> {
    const pdfs = files.filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
    if (pdfs.length < 2) {
      if (pdfs[0]) await openFile(pdfs[0]);
      else await imagesToPdf(files.filter((file) => file.type.startsWith('image/')));
      return;
    }
    try {
      setStatus('Combining PDFs…', 'working');
      const output = await PDFDocument.create();
      for (const file of pdfs) {
        const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        await copyPagesInOrder(source, output, Array.from({ length: source.getPageCount() }, (_, index) => index + 1));
      }
      await openDocument(toArrayBuffer(await output.save({ useObjectStreams: true })), `${pdfs.length}-merged.pdf`);
      notify(`${pdfs.length} PDFs merged. You can reorder or refine the pages now.`);
    } catch {
      setStatus('Open a PDF to begin', 'warn');
      notify('Those PDFs could not be merged. Try standard, unencrypted files.');
    }
  }

  async function imagesToPdf(files: File[]): Promise<void> {
    if (files.length === 0) return;
    try {
      const document = await PDFDocument.create();
      for (const file of files) {
        const dataUrl = await readDataUrl(file);
        const decoded = await decodeImage(dataUrl);
        const png = await imageToPng(file);
        const image = await document.embedPng(png);
        const page = document.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        void decoded;
      }
      await openDocument(toArrayBuffer(await document.save({ useObjectStreams: true })), files.length === 1 ? `${baseName(files[0]!.name)}.pdf` : `${files.length}-images.pdf`);
      notify(`${files.length} image${files.length === 1 ? '' : 's'} turned into a PDF.`);
    } catch {
      notify('Those images could not be turned into a PDF.');
    }
  }

  async function restore(snapshotValue: PdfSnapshot): Promise<void> {
    state.bytes = snapshotValue.bytes.slice(0);
    state.overlays = cloneOverlays(snapshotValue.overlays);
    state.currentPage = snapshotValue.currentPage;
    state.selectedPages = new Set(snapshotValue.selectedPages);
    state.selection = null;
    await refreshPdf();
  }

  function resetToEmpty(): void {
    void destroyPdf();
    state.bytes = null;
    state.originalBytes = null;
    state.fileName = '';
    state.history = [];
    state.redo = [];
    state.overlays = [];
    state.selection = null;
    state.pendingImage = null;
    state.currentPage = 1;
    state.selectedPages.clear();
    state.dirty = false;
    els.editorShell.hidden = true;
    els.empty.hidden = false;
    updateToolbar();
  }

  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      els.fileInput.click();
    }
  });
  els.dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    els.dropzone.classList.add('is-dragging');
  });
  els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('is-dragging'));
  els.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('is-dragging');
    const files = Array.from(event.dataTransfer?.files ?? []);
    void mergeInitialFiles(files);
  });
  els.fileInput.addEventListener('change', () => {
    const files = Array.from(els.fileInput.files ?? []);
    void mergeInitialFiles(files);
    els.fileInput.value = '';
  });
  els.mergeInput.addEventListener('change', () => {
    void mergeFiles(Array.from(els.mergeInput.files ?? []));
    els.mergeInput.value = '';
  });
  els.imagePageInput.addEventListener('change', () => {
    void addImagePage(Array.from(els.imagePageInput.files ?? []));
    els.imagePageInput.value = '';
  });
  els.imageInput.addEventListener('change', () => {
    const file = els.imageInput.files?.[0];
    if (!file) return;
    void readDataUrl(file).then((dataUrl) => decodeImage(dataUrl).then((decoded) => {
      state.pendingImage = { dataUrl, name: file.name, width: decoded.width, height: decoded.height, kind: 'image' };
      selectTool('image');
      notify('Image ready. Click the page to place it.');
    })).catch(() => notify('That image could not be loaded.'));
    els.imageInput.value = '';
  });
  els.signatureUploadInput.addEventListener('change', () => {
    const file = els.signatureUploadInput.files?.[0];
    els.signatureUploadInput.value = '';
    if (!file) return;
    void uploadSignature(file).catch(() => notify('That PNG could not be read. Try saving it again and re-uploading.'));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-pdf-empty-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.pdfEmptyAction;
    if (action === 'merge') els.fileInput.click();
    else if (action === 'images') els.fileInput.click();
    else if (action === 'annotate') els.fileInput.click();
  }));
  els.newFile.addEventListener('click', resetToEmpty);
  els.exportPdf.addEventListener('click', () => { void exportPdf(); });
  els.undo.addEventListener('click', () => { void undo(); });
  els.redo.addEventListener('click', () => { void redo(); });
  els.zoomOut.addEventListener('click', () => setZoom(state.zoom - 0.15));
  els.zoomIn.addEventListener('click', () => setZoom(state.zoom + 0.15));
  els.fit.addEventListener('click', () => { void fitToPage(); });
  els.pageInput.addEventListener('change', () => {
    const page = clamp(Number(els.pageInput.value) || 1, 1, state.pdf?.numPages ?? 1);
    state.currentPage = page;
    state.selectedPages = new Set([page]);
    state.anchorPage = page;
    updateToolbar();
    renderThumbnails();
    void renderPage();
    renderInspector();
  });
  els.pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') els.pageInput.blur();
  });
  els.overlayCanvas.addEventListener('pointerdown', pointerDown);
  els.overlayCanvas.addEventListener('pointermove', pointerMove);
  els.overlayCanvas.addEventListener('pointerup', pointerUp);
  els.overlayCanvas.addEventListener('pointercancel', pointerUp);
  els.toolButtons.forEach((button) => button.addEventListener('click', () => selectTool(button.dataset.pdfTool as PdfTool)));
  els.signatureClose.addEventListener('click', closeSignatureDialog);
  els.signatureClear.addEventListener('click', clearSignaturePad);
  els.signatureSave.addEventListener('click', () => { void useSignature(); });
  els.signaturePad.addEventListener('pointerdown', (event) => {
    const point = signaturePoint(event);
    els.signaturePad.setPointerCapture(event.pointerId);
    state.signatureDrawing = true;
    state.signatureHasInk = true;
    const ctx = els.signaturePad.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1c3b32';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  });
  els.signaturePad.addEventListener('pointermove', (event) => {
    if (!state.signatureDrawing) return;
    const point = signaturePoint(event);
    const ctx = els.signaturePad.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  });
  els.signaturePad.addEventListener('pointerup', () => { state.signatureDrawing = false; });
  els.signaturePad.addEventListener('pointercancel', () => { state.signatureDrawing = false; });
  root.querySelectorAll<HTMLButtonElement>('[data-pdf-action]').forEach((button) => button.addEventListener('click', () => { void handleAction(button.dataset.pdfAction ?? ''); }));

  document.addEventListener('keydown', (event) => {
    if (!state.visible || !state.pdf) return;
    const target = event.target as HTMLElement | null;
    const inField = target?.matches('input, textarea, select');
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'z' && !inField) {
      event.preventDefault();
      if (event.shiftKey) void redo();
      else void undo();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !inField && state.selection) {
      event.preventDefault();
      removeSelectedOverlay();
    } else if (event.key === 'Escape') {
      selectTool('select');
    } else if (event.key === 'ArrowRight' && !inField) {
      state.currentPage = clamp(state.currentPage + 1, 1, state.pdf.numPages);
      state.selectedPages = new Set([state.currentPage]);
      updateToolbar();
      renderThumbnails();
      void renderPage();
      renderInspector();
    } else if (event.key === 'ArrowLeft' && !inField) {
      state.currentPage = clamp(state.currentPage - 1, 1, state.pdf.numPages);
      state.selectedPages = new Set([state.currentPage]);
      updateToolbar();
      renderThumbnails();
      void renderPage();
      renderInspector();
    }
  });

  window.addEventListener('resize', () => {
    if (!state.visible || !state.pdf) return;
    if (state.zoomMode === 'fit') void fitToPage();
    else void renderPage();
  });

  clearSignaturePad();
  void refreshSavedSignatures();
  els.editorShell.hidden = true;
  els.empty.hidden = false;
  updateToolButtons();
  updateToolbar();
  renderInspector();

  return {
    setVisible(visible: boolean): void {
      state.visible = visible;
      if (!visible) return;
      if (state.pdf) {
        window.requestAnimationFrame(() => {
          if (state.zoomMode === 'fit') void fitToPage();
          else void renderPage();
        });
      }
    },
    reloadSignatures: refreshSavedSignatures,
  };
}
