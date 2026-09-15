import type { Template } from './library/types.js';
import type { StorageAdapter } from './store/adapter.js';
import { audienceForTemplate, CATEGORY_GROUPS, CATEGORY_LABELS } from './library/providers.js';

type View = 'overview' | 'library' | 'followups' | 'providers' | 'pdf' | 'templates' | 'signature' | 'transcribe';
interface Followup { id: string; title: string; due: string; priority: string; done: boolean }
interface Provider { id: string; name: string; specialty: string; practice: string; email: string }
interface ChatMessage { id: string; authorName: string; text: string; createdAt: number }
interface ChatState { displayName: string; messages: ChatMessage[]; readMessageIds: string[] }
interface ChatPosition { left: number; top: number }
interface WorkspaceData { followups: Followup[]; providers: Provider[]; favorites: string[]; recent: string[]; note: string; chat: ChatState }
interface Options {
  store: StorageAdapter; persistent: boolean; templates: Template[]; toast: (message: string) => void;
  openTool: (tool: 'pdf' | 'templates' | 'signature' | 'transcribe') => void;
  openTemplate: (template: Template, recipient?: string) => Promise<void>;
  openSettings: () => void;
}
const KEY = 'workspace:v1';
const CHAT_MESSAGE_LIMIT = 200;
const CHAT_NAME_LIMIT = 60;
const CHAT_TEXT_LIMIT = 1000;
const emptyData = (): WorkspaceData => ({
  followups: [], providers: [], favorites: [], recent: [], note: '',
  chat: { displayName: '', messages: [], readMessageIds: [] },
});
let data = emptyData();
let options: Options;
let view: View = 'overview';
let query = '';
let category = 'all';
let onlyFavorites = false;
let taskFilter = 'open';
let chatOpen = false;
let chatPosition: ChatPosition | null = null;
let chatDrag: { pointerId: number; offsetX: number; offsetY: number } | null = null;
let ready = false;
let writeQueue: Promise<void> = Promise.resolve();
const $ = (id: string) => document.getElementById(id)!;
const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const today = (): string => {
  const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const dateLabel = (date: string): string => date ? new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date';
const paths: Record<string, string> = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  library: '<path d="M4 4h16v16H4zM4 9h16M9 9v11"/>',
  templates: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 6 9 7 9-7"/>',
  followups: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 2v4m8-4v4M8 13l3 3 5-6"/>',
  providers: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 6"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-7.8 7.5c-1.3 0-2.5-.3-3.6-.9L4 20l1.2-3.7A7.4 7.4 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5h1A7.5 7.5 0 0 1 20 11.5Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
  signature: '<path d="m4 16 11-11 4 4-11 11H4v-4Zm9-9 4 4M3 23h18"/>',
  transcribe: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  pdf: '<path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 13h5M8 17h6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
};
const icon = (name: string) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.templates) + '</svg>';
const labels: Record<View, string> = { overview: 'Overview', library: 'Email library', followups: 'Follow-ups', providers: 'Provider directory', pdf:'PDF editor', templates: 'Email editor', signature: 'Signature studio', transcribe: 'Call transcriber' };

async function save(): Promise<boolean> {
  const snapshot = structuredClone(data);
  writeQueue = writeQueue.catch(() => {}).then(() => options.store.set(KEY, snapshot));
  try { await writeQueue; return true; } catch { options.toast('Your changes could not be saved. Keep this tab open and try again.'); return false; }
}
function navItem(key: View): string {
  return '<button data-nav="' + key + '" aria-label="' + labels[key] + '" title="' + labels[key] + '" class="rail-link ' + (view === key ? 'active' : '') + '"' + (view === key ? ' aria-current="page"' : '') + '>' + icon(key) + '<span>' + labels[key] + '</span>' + (key === 'followups' && data.followups.some(t => !t.done) ? '<b>' + data.followups.filter(t => !t.done).length + '</b>' : '') + '</button>';
}
function shell(): void {
  $('appRail').innerHTML = '<a href="#overview" class="dispatch-logo" aria-label="Prulene\'s Dashboard"><span class="logo-symbol">P<span>•</span></span><span class="logo-text"><strong>Prulene\'s</strong><small>Dashboard</small></span></a><div class="practice-switch"><span class="practice-avatar">+</span><div><strong>Provider workspace</strong><small>Your practice, connected</small></div></div><span class="rail-label">WORKSPACE</span><nav>' + ['overview', 'library', 'followups', 'providers'].map(k => navItem(k as View)).join('') + '</nav><span class="rail-label tools-label">YOUR TOOLS</span><nav>' + ['pdf', 'templates', 'signature', 'transcribe'].map(k => navItem(k as View)).join('') + '</nav><div class="rail-bottom"><div class="local-card"><span class="local-dot"></span><strong>A little less admin.</strong><p>A little more room for care.</p></div><button class="rail-link" data-settings>' + icon('settings') + 'Practice settings</button><div class="rail-profile"><span class="profile-avatar">VA</span><div><strong>My workspace</strong><small>Saved on this device</small></div></div></div>';
  $('workspaceBar').innerHTML = '<div class="breadcrumb">Workspace <span>/</span> <strong>' + labels[view] + '</strong></div><div class="top-actions"><button class="global-search" data-nav="library">' + icon('search') + '<span>Find a template</span><kbd>Ctrl K</kbd></button><span class="local-status"><i></i> Local workspace</span><span class="top-avatar">VA</span></div>';
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(b => b.onclick = () => navigate(b.dataset.nav as View));
  document.querySelectorAll<HTMLElement>('[data-settings]').forEach(b => b.onclick = options.openSettings);
  document.querySelector('.dispatch-logo')?.addEventListener('click', e => { e.preventDefault(); navigate('overview'); });
  const globalSearch = document.querySelector('.global-search');
  globalSearch?.setAttribute('aria-label', 'Find a template');
  const avatar = document.querySelector('.top-avatar');
  if (avatar) {
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'top-avatar';
    settings.textContent = 'VA';
    settings.setAttribute('aria-label', 'Open practice settings');
    settings.title = 'Practice settings';
    settings.onclick = options.openSettings;
    avatar.replaceWith(settings);
  }
  const skipLink = document.querySelector('.skip-link');
  skipLink?.setAttribute('href', ['pdf', 'templates', 'signature', 'transcribe'].includes(view) ? '#' + view + 'Tool' : '#hub');
  if (!options.persistent) {
    const status = document.querySelector('.local-status');
    if (status) status.textContent = 'Storage unavailable — this session only';
  }
  renderChatWidget();
}
export function workspaceToolChanged(tool: 'pdf' | 'templates' | 'signature' | 'transcribe'): void {
  if (!ready) return;
  view = tool;
  $('hub').hidden = true;
  document.body.dataset.page = tool;
  shell();
}
function navigate(next: View): void {
  view = next;
  query = '';
  document.body.dataset.page = next;
  $('gallery').hidden = true;
  if (['pdf', 'templates', 'signature', 'transcribe'].includes(next)) {
    options.openTool(next as 'pdf' | 'templates' | 'signature' | 'transcribe');
  } else {
    for (const id of ['templatesTool', 'signatureTool', 'transcribeTool', 'pdfTool']) $(id).hidden = true;
    $('hub').hidden = false;
    shell(); render();
  }
}
function heading(eyebrow: string, title: string, description: string, action = ''): string {
  return '<div class="page-heading"><div><div class="overline">' + eyebrow + '</div><h1>' + title + '</h1><p>' + description + '</p></div>' + action + '</div>';
}
function taskRows(tasks: Followup[], compact = false): string {
  if (!tasks.length) return '<div class="empty-state">' + icon('followups') + '<h3>' + (taskFilter === 'done' && !compact ? 'No completed follow-ups yet' : 'You’re all caught up') + '</h3><p>Add a follow-up to keep your next steps in one place.</p><button class="btn" data-add-task>＋ Add a follow-up</button></div>';
  return tasks.map(t => '<div class="task-row ' + (t.done ? 'completed' : '') + '"><input type="checkbox" data-complete="' + t.id + '" aria-label="Mark ' + escape(t.title) + ' ' + (t.done ? 'incomplete' : 'complete') + '"' + (t.done ? ' checked' : '') + '><div class="task-copy"><strong>' + escape(t.title) + '</strong><span class="' + (!t.done && t.due && t.due < today() ? 'overdue' : '') + '">' + (!t.done && t.due && t.due < today() ? 'Overdue · ' : '') + dateLabel(t.due) + '</span></div><span class="priority ' + escape(t.priority) + '">' + escape(t.priority) + '</span><button class="icon-button" data-edit-task="' + t.id + '" aria-label="Edit follow-up">···</button></div>').join('');
}
function templateCards(templates: Template[], mini = false): string {
  if (!templates.length) return '<div class="empty-state"><h3>No templates found</h3><p>Try another search or clear your filters.</p><button class="btn" data-reset-filters>Clear filters</button></div>';
  return templates.map((t, i) => {
    const kind = audienceForTemplate(t);
    const recipient = kind === 'Patient message' || kind === 'Patient outreach'
      ? 'Hi Alex,' : 'Dear Dr. Morgan,';
    const preview = t.description.replace(/\.$/, '');
    return '<article class="email-card">'
      + '<div class="email-art tone-' + i % 5 + ' paper-' + escape(t.theme) + '">'
      + '<button class="favorite-button ' + (data.favorites.includes(t.id) ? 'is-favorite' : '') + '" data-favorite="' + escape(t.id) + '" aria-label="Favorite ' + escape(t.name) + '" aria-pressed="' + data.favorites.includes(t.id) + '">' + icon('star') + '</button>'
      + '<button class="paper-button" data-template="' + escape(t.id) + '" aria-label="Open ' + escape(t.name) + '"><div class="mini-paper">'
      + '<div class="paper-top"><span class="paper-brand"><span class="paper-mark">p</span> prulene\'s</span><span class="paper-type">' + (t.bulk ? 'LIST' : '1:1') + '</span></div>'
      + '<div class="paper-rule"></div><span class="paper-eyebrow">' + escape(CATEGORY_LABELS[t.category] ?? 'Email template') + '</span>'
      + '<strong>' + escape(t.name) + '</strong><small>' + escape(recipient) + '</small><p class="paper-copy">' + escape(preview) + '</p>'
      + '<div class="paper-lines"><i></i><i></i><i></i></div><div class="paper-cta">' + (t.bulk ? 'View details' : 'Open draft') + ' <span>↗</span></div>'
      + '</div></button></div>'
      + '<div class="email-card-body"><span class="category-label">' + escape(CATEGORY_LABELS[t.category] ?? 'Email template') + '</span><h3><button data-template="' + escape(t.id) + '">' + escape(t.name) + '</button></h3>'
      + (mini ? '' : '<p>' + escape(t.description) + '</p>')
      + '<div class="card-footer"><span>' + escape(kind) + '</span><button data-template="' + escape(t.id) + '" aria-label="Use ' + escape(t.name) + '">' + icon('arrow') + '</button></div></div></article>';
  }).join('');
}
function overview(): string {
  const open = data.followups.filter(t => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const due = open.filter(t => t.due && t.due <= today()).length;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const recent = data.recent.map(id => options.templates.find(t => t.id === id)).filter((t): t is Template => !!t);
  const favorites = options.templates.filter(t => data.favorites.includes(t.id));
  const selected = [...favorites, ...options.templates.filter(t => !data.favorites.includes(t.id))].slice(0, 3);
  return heading(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), greeting + ', care team <span class="greeting-spark">✳</span>', 'A clear workspace for the people behind better care.', '<button class="btn primary" data-nav="library">＋ Create an email</button>')
    + '<div class="overview-grid"><div class="overview-main"><section class="welcome-panel"><div><span class="welcome-label"><span></span> BUILT FOR YOUR PRACTICE</span><h2>Good communication.<br>Better connections.</h2><p>Thoughtful emails for patients, providers, and practice teams.<br>Start with a template. Make it your own.</p><button class="btn dark" data-nav="library">Explore all templates ' + icon('arrow') + '</button></div><div class="welcome-illustration" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="floating-message"><div class="message-avatar">+</div><div><b>A better handoff starts here.</b><span>Provider to provider</span></div><i>↗</i></div><div class="illustration-envelope">' + icon('templates') + '</div><span class="illustration-star">✳</span></div></section>'
    + '<div class="metrics"><button data-nav="followups"><span>Open follow-ups ' + icon('followups') + '</span><strong>' + open.length + '</strong><small>' + (due ? due + ' due today or overdue' : 'Nothing due today') + '</small></button><button data-nav="providers"><span>Your network ' + icon('providers') + '</span><strong>' + data.providers.length + '</strong><small>Saved provider contacts</small></button><button data-nav="library"><span>Ready to personalize ' + icon('templates') + '</span><strong>' + options.templates.length + '</strong><small>Professional email templates</small></button></div>'
    + '<section class="recommended"><div class="section-heading"><div><h2>' + (favorites.length ? 'Your go-to templates' : 'A good place to start') + '</h2><p>Less time drafting. More time connecting.</p></div><button class="text-button" data-nav="library">View library ' + icon('arrow') + '</button></div><div class="email-grid compact">' + templateCards(selected, true) + '</div></section>'
    + '<section class="quick-tools"><button data-nav="pdf"><span class="tool-icon pdf">' + icon('pdf') + '</span><span><strong>Make a PDF ready to move</strong><small>Edit, sign, and organize on your device</small></span>' + icon('arrow') + '</button><button data-nav="signature"><span class="tool-icon">' + icon('signature') + '</span><span><strong>A signature that feels like you</strong><small>Build a consistent practice identity</small></span>' + icon('arrow') + '</button><button data-nav="transcribe"><span class="tool-icon lilac">' + icon('transcribe') + '</span><span><strong>Turn conversations into clarity</strong><small>Transcribe calls on your device</small></span>' + icon('arrow') + '</button></section></div>'
    + '<aside class="overview-side"><section class="panel today-panel"><div class="section-heading"><h2>Your next steps</h2><button class="icon-button" data-add-task aria-label="Add follow-up">＋</button></div><p class="panel-subtitle">Keep the important things moving.</p>' + taskRows(open.slice(0, 4), true) + '<button class="panel-link" data-nav="followups">All follow-ups ' + icon('arrow') + '</button></section>'
    + '<section class="panel notes-panel"><div class="section-heading"><h2>A little space to think</h2><span class="note-mark">✎</span></div><p class="panel-subtitle">Quick notes for your working day.</p><label class="visually-hidden" for="workspaceNote">Workspace notes</label><textarea id="workspaceNote" placeholder="A reminder, a thought, a next step…">' + escape(data.note) + '</textarea><div class="note-foot"><span id="noteSaveState">Saved on this device</span><span>↵</span></div></section>'
    + '<section class="recent-panel"><h2>Recently opened</h2>' + (recent.length ? recent.slice(0, 3).map(t => '<button data-template="' + t.id + '">' + icon('templates') + '<span>' + escape(t.name) + '</span>' + icon('arrow') + '</button>').join('') : '<p>The templates you open will appear here.</p>') + '</section><p class="sidebar-footnote"><span class="local-dot"></span> Your workspace stays in this browser.</p></aside></div>';
}
function library(): string {
  const filtered = options.templates.filter(t => (!onlyFavorites || data.favorites.includes(t.id)) && (category === 'all' || t.category === category) && (t.name + ' ' + t.description).toLowerCase().includes(query.toLowerCase()));
  const categories = CATEGORY_GROUPS.flatMap(group => group.categories);
  const tabs = ['all', ...categories].map(c => '<button data-category="' + c + '" aria-pressed="' + (category === c) + '">' + (c === 'all' ? 'All templates' : CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]) + '</button>').join('');
  return heading('YOUR CORRESPONDENCE TOOLKIT', 'Make every message feel considered.', 'Patient-ready notes, provider handoffs, and practice updates with a polished starting point for every moment.')
    + '<div class="library-toolbar"><label class="hub-search">' + icon('search') + '<input id="hubSearch" type="search" placeholder="Search by moment, audience, or topic…" value="' + escape(query) + '" aria-label="Search all email templates"></label><button id="favoritesOnly" class="btn ' + (onlyFavorites ? 'selected-filter' : '') + '" aria-pressed="' + onlyFavorites + '">' + icon('star') + ' Favorites</button></div><div class="category-tabs" role="group" aria-label="Template category">' + tabs + '</div><p class="result-count">' + filtered.length + ' templates · 1:1, patient, and campaign-ready</p><div class="email-grid">' + templateCards(filtered) + '</div>';
}
function followups(): string {
  const filtered = data.followups.filter(t => taskFilter === 'all' || (taskFilter === 'done' ? t.done : !t.done)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return heading('KEEP THINGS MOVING', 'Every follow-up, accounted for.', 'Capture the next step, choose a due date, and close the loop.', '<button class="btn primary" data-add-task>＋ Add follow-up</button>')
    + '<div class="category-tabs">' + ['open', 'done', 'all'].map(f => '<button data-task-filter="' + f + '" aria-pressed="' + (taskFilter === f) + '">' + ({ open: 'Open', done: 'Completed', all: 'All follow-ups' })[f] + '</button>').join('') + '</div><section class="panel followup-list">' + taskRows(filtered) + '</section>';
}
function providers(): string {
  const filtered = data.providers.filter(p => (p.name + ' ' + p.specialty + ' ' + p.practice).toLowerCase().includes(query.toLowerCase()));
  return heading('YOUR PROFESSIONAL NETWORK', 'Good care is a team effort.', 'Keep provider contacts close. Start a personalized email in one click.', '<button class="btn primary" data-add-provider>＋ Add provider</button>')
    + '<label class="hub-search provider-search">' + icon('search') + '<input type="search" id="hubSearch" placeholder="Search name, practice, or specialty…" aria-label="Search providers" value="' + escape(query) + '"></label><div class="provider-grid">' + (filtered.length ? filtered.map(p => '<article class="panel provider-card"><div class="provider-card-top"><span class="contact-avatar">' + escape(p.name.split(' ').filter(Boolean).slice(-2).map(s => s[0]).join('')) + '</span><button class="icon-button" data-edit-provider="' + p.id + '" aria-label="Edit ' + escape(p.name) + '">···</button></div><h2>' + escape(p.name) + '</h2><span class="category-label">' + escape(p.specialty || 'Provider') + '</span><p>' + escape(p.practice || 'Practice not added') + '</p><p class="contact-email">' + escape(p.email || 'Email not added') + '</p><button class="btn" data-compose-provider="' + p.id + '">' + icon('templates') + ' Write an introduction</button></article>').join('') : '<div class="empty-state"><span class="empty-network">' + icon('providers') + '</span><h3>' + (query ? 'No matching providers' : 'Your network starts with one connection') + '</h3><p>' + (query ? 'Try a different name or specialty.' : 'Add a colleague to start building your practice directory.') + '</p><button class="btn primary" data-add-provider>＋ Add provider</button></div>') + '</div>';
}

function chatInitials(name: string): string {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
  return (initials || '?').toUpperCase();
}
function chatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const CHAT_EMOJIS = ['👋', '✨', '😊', '👍', '❤️', '🙌', '😂', '💡', '🎉', '🤝', '🌿', '☕'];
function chatUnreadCount(messages: ChatMessage[] = data.chat.messages): number {
  const readIds = new Set(data.chat.readMessageIds);
  return messages.filter(message => !readIds.has(message.id)).length;
}
function markChatRead(): boolean {
  const readIds = new Set(data.chat.readMessageIds);
  const before = data.chat.readMessageIds.join('|');
  data.chat.messages.forEach(message => readIds.add(message.id));
  data.chat.readMessageIds = Array.from(readIds).slice(-CHAT_MESSAGE_LIMIT);
  return before !== data.chat.readMessageIds.join('|');
}
function clampChatPosition(panel: HTMLElement, left: number, top: number): ChatPosition {
  const gutter = 12;
  const maxLeft = Math.max(gutter, window.innerWidth - panel.offsetWidth - gutter);
  const maxTop = Math.max(gutter, window.innerHeight - panel.offsetHeight - gutter);
  return {
    left: Math.round(Math.min(Math.max(left, gutter), maxLeft)),
    top: Math.round(Math.min(Math.max(top, gutter), maxTop)),
  };
}
function applyChatPosition(panel: HTMLElement, position: ChatPosition): void {
  chatPosition = clampChatPosition(panel, position.left, position.top);
  panel.style.left = chatPosition.left + 'px';
  panel.style.top = chatPosition.top + 'px';
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}
function chatMessageMarkup(message: ChatMessage): string {
  const date = new Date(message.createdAt);
  const datetime = Number.isNaN(date.getTime()) ? '' : ' datetime="' + date.toISOString() + '"';
  return '<article class="chat-widget-message"><div class="chat-widget-avatar" aria-hidden="true">' + escape(chatInitials(message.authorName)) + '</div><div class="chat-widget-message-copy"><div class="chat-widget-message-meta"><strong>' + escape(message.authorName) + '</strong><time' + datetime + '>' + escape(chatTime(message.createdAt)) + '</time></div><p>' + escape(message.text).replace(/\n/g, '<br>') + '</p></div></article>';
}
function chatWidgetMarkup(): string {
  const displayName = data.chat.displayName.trim();
  const messages = data.chat.messages.slice().sort((a, b) => a.createdAt - b.createdAt);
  const unreadCount = chatUnreadCount(messages);
  const messageCount = messages.length === 1 ? '1 message' : messages.length + ' messages';
  const messageList = messages.length
    ? messages.map(chatMessageMarkup).join('')
    : '<div class="chat-widget-empty"><span class="chat-widget-empty-mark">✦</span><strong>No messages yet</strong><p>Be the first to say hello.</p></div>';
  const identity = displayName
    ? '<div class="chat-widget-identity"><div><span class="chat-widget-identity-label">Chatting as</span><strong>' + escape(displayName) + '</strong></div><button type="button" class="chat-widget-link" data-chat-change-name>Change name</button></div>'
    : '<form class="chat-widget-name-form" id="chatNameForm"><div class="chat-widget-name-copy"><span class="chat-widget-kicker">FIRST, SAY HELLO</span><label for="chatName">What should we call you?</label><p>Your name appears beside each message.</p></div><div class="chat-widget-name-controls"><input id="chatName" name="name" type="text" maxlength="' + CHAT_NAME_LIMIT + '" autocomplete="nickname" placeholder="e.g. Maya" required><button type="submit" class="chat-widget-join">Join</button></div></form>';
  const composer = displayName
    ? '<form class="chat-widget-composer" id="chatComposer"><div class="chat-widget-compose-row"><button type="button" class="chat-widget-emoji-toggle" data-chat-emoji-toggle aria-expanded="false" aria-controls="chatEmojiMenu" aria-label="Add an emoji" title="Add an emoji">☺</button><label class="visually-hidden" for="chatMessage">Write a message</label><textarea id="chatMessage" name="message" maxlength="' + CHAT_TEXT_LIMIT + '" rows="1" placeholder="Write something kind…" required></textarea><button type="submit" class="chat-widget-send" aria-label="Send message" title="Send message">↗</button></div><div class="chat-emoji-menu" id="chatEmojiMenu" role="toolbar" aria-label="Choose an emoji" hidden>' + CHAT_EMOJIS.map(emoji => '<button type="button" data-chat-emoji="' + emoji + '" aria-label="Insert ' + emoji + '">' + emoji + '</button>').join('') + '</div><div class="chat-widget-composer-hint"><span>Enter to send</span><span>Shift + Enter for a new line</span></div></form>'
    : '<div class="chat-widget-locked"><span class="chat-widget-locked-icon">↳</span><span>Set your name above to join the conversation.</span></div>';

  const launcherLabel = chatOpen
    ? 'Close general chat'
    : unreadCount ? 'Open general chat, ' + unreadCount + (unreadCount === 1 ? ' unread message' : ' unread messages') : 'Open general chat';
  return '<button type="button" class="chat-launcher' + (chatOpen ? ' is-open' : '') + '" data-chat-launcher aria-expanded="' + chatOpen + '" aria-controls="globalChatPanel" aria-label="' + launcherLabel + '" title="' + launcherLabel + '"><span class="chat-launcher-icon">' + icon('chat') + '</span>' + (unreadCount ? '<span class="chat-launcher-count" aria-label="' + unreadCount + ' unread messages">' + unreadCount + '</span>' : '') + '</button>'
    + (chatOpen ? '<section class="chat-popover" id="globalChatPanel" data-chat-drag-panel role="dialog" aria-modal="false" aria-labelledby="globalChatTitle" aria-describedby="globalChatMoveHint"><div class="chat-popover-head" data-chat-drag-handle title="Drag to move chat"><div class="chat-popover-brand"><span class="chat-popover-icon">' + icon('chat') + '</span><div><span class="chat-widget-kicker">TEAM SPACE</span><h2 id="globalChatTitle">General chat</h2></div></div><div class="chat-popover-actions"><span class="chat-online"><i></i> Open to everyone</span><button type="button" class="chat-popover-minimize" data-chat-minimize aria-label="Minimize general chat" title="Minimize chat">−</button><button type="button" class="chat-popover-close" data-chat-close aria-label="Close general chat" title="Close chat">×</button></div></div><p class="visually-hidden" id="globalChatMoveHint">Drag the chat header to move this window.</p><div class="chat-popover-meta"><span>' + messageCount + '</span><span><i class="local-dot"></i> Saved here</span></div>' + identity + '<div class="chat-widget-messages" id="chatMessages" role="log" aria-live="polite" aria-label="Global chat messages">' + messageList + '</div>' + composer + '</section>' : '');
}
function focusChatWidget(): void {
  window.requestAnimationFrame(() => {
    const target = document.getElementById(data.chat.displayName ? 'chatMessage' : 'chatName');
    target?.focus();
    const messages = document.getElementById('chatMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}
function focusChatLauncher(): void {
  window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-chat-launcher]')?.focus());
}
function insertChatEmoji(textarea: HTMLTextAreaElement, emoji: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.setRangeText(emoji, start, end, 'end');
  textarea.focus();
}
function bindChatWidget(): void {
  const root = document.getElementById('chatWidget');
  if (!root) return;
  root.querySelector<HTMLButtonElement>('[data-chat-launcher]')?.addEventListener('click', () => {
    chatOpen = !chatOpen;
    chatDrag = null;
    if (chatOpen && markChatRead()) void save();
    renderChatWidget();
    if (chatOpen) focusChatWidget();
    else focusChatLauncher();
  });
  if (!chatOpen) return;
  root.querySelector<HTMLButtonElement>('[data-chat-close]')?.addEventListener('click', () => {
    chatOpen = false;
    chatDrag = null;
    renderChatWidget();
    focusChatLauncher();
  });
  root.querySelector<HTMLButtonElement>('[data-chat-minimize]')?.addEventListener('click', () => {
    chatOpen = false;
    chatDrag = null;
    renderChatWidget();
    focusChatLauncher();
  });
  const chatPanel = root.querySelector<HTMLElement>('[data-chat-drag-panel]');
  const dragHandle = root.querySelector<HTMLElement>('[data-chat-drag-handle]');
  if (chatPanel && dragHandle) {
    const stopDragging = () => {
      chatDrag = null;
      chatPanel.classList.remove('is-dragging');
    };
    dragHandle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || (event.target as Element | null)?.closest('button, a, input, textarea, select')) return;
      const rect = chatPanel.getBoundingClientRect();
      applyChatPosition(chatPanel, { left: rect.left, top: rect.top });
      chatDrag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - (chatPosition?.left ?? rect.left),
        offsetY: event.clientY - (chatPosition?.top ?? rect.top),
      };
      chatPanel.classList.add('is-dragging');
      dragHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    dragHandle.addEventListener('pointermove', event => {
      if (!chatDrag || event.pointerId !== chatDrag.pointerId) return;
      applyChatPosition(chatPanel, {
        left: event.clientX - chatDrag.offsetX,
        top: event.clientY - chatDrag.offsetY,
      });
    });
    dragHandle.addEventListener('pointerup', event => {
      if (chatDrag?.pointerId !== event.pointerId) return;
      if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
      stopDragging();
    });
    dragHandle.addEventListener('pointercancel', stopDragging);
    dragHandle.addEventListener('lostpointercapture', stopDragging);
  }
  const chatNameForm = root.querySelector<HTMLFormElement>('#chatNameForm');
  const chatName = root.querySelector<HTMLInputElement>('#chatName');
  if (chatNameForm && chatName) chatNameForm.onsubmit = event => {
    event.preventDefault();
    const name = chatName.value.trim().replace(/\s+/g, ' ').slice(0, CHAT_NAME_LIMIT);
    if (!name) { chatName.focus(); return; }
    data.chat.displayName = name;
    void save();
    renderChatWidget();
    focusChatWidget();
  };
  root.querySelectorAll<HTMLElement>('[data-chat-change-name]').forEach(button => button.addEventListener('click', () => {
    data.chat.displayName = '';
    void save();
    renderChatWidget();
    focusChatWidget();
  }));
  const chatForm = root.querySelector<HTMLFormElement>('#chatComposer');
  const chatMessage = root.querySelector<HTMLTextAreaElement>('#chatMessage');
  const emojiToggle = root.querySelector<HTMLButtonElement>('[data-chat-emoji-toggle]');
  const emojiMenu = root.querySelector<HTMLElement>('#chatEmojiMenu');
  if (emojiToggle && emojiMenu && chatMessage) {
    emojiToggle.onclick = () => {
      const open = emojiMenu.hidden;
      emojiMenu.hidden = !open;
      emojiToggle.setAttribute('aria-expanded', String(open));
    };
    emojiMenu.querySelectorAll<HTMLButtonElement>('[data-chat-emoji]').forEach(button => button.onclick = () => {
      insertChatEmoji(chatMessage, button.dataset.chatEmoji ?? '');
      emojiMenu.hidden = true;
      emojiToggle.setAttribute('aria-expanded', 'false');
    });
  }
  if (chatForm && chatMessage) {
    chatMessage.onkeydown = event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        chatForm.requestSubmit();
      }
    };
    chatForm.onsubmit = event => {
      event.preventDefault();
      const text = chatMessage.value.trim().slice(0, CHAT_TEXT_LIMIT);
      const authorName = data.chat.displayName.trim();
      if (!authorName || !text) { chatMessage.focus(); return; }
      data.chat.messages = [...data.chat.messages, {
        id: crypto.randomUUID(), authorName, text, createdAt: Date.now(),
      }].slice(-CHAT_MESSAGE_LIMIT);
      markChatRead();
      void save();
      renderChatWidget();
      focusChatWidget();
    };
  }
}
function renderChatWidget(): void {
  const root = document.getElementById('chatWidget');
  if (!root) return;
  root.innerHTML = chatWidgetMarkup();
  const panel = root.querySelector<HTMLElement>('[data-chat-drag-panel]');
  if (panel && chatPosition) applyChatPosition(panel, chatPosition);
  bindChatWidget();
}
function render(): void {
  $('hub').innerHTML = view === 'overview' ? overview() : view === 'library' ? library() : view === 'followups' ? followups() : providers();
  const count = document.querySelector('.result-count');
  if (count) count.textContent = count.textContent?.replace(/^1 templates/, '1 template') ?? '';
  if (!options.persistent) {
    const status = document.getElementById('noteSaveState');
    if (status) status.textContent = 'This session only — storage unavailable';
  }
  bind();
}
async function openTemplate(id: string, recipient?: string): Promise<void> {
  const t = options.templates.find(t => t.id === id);
  if (!t) return;
  data.recent = [id, ...data.recent.filter(r => r !== id)].slice(0, 6);
  void save();
  await options.openTemplate(t, recipient);
}
function bind(): void {
  const hub = $('hub');
  hub.querySelectorAll<HTMLElement>('[data-nav]').forEach(b => b.onclick = () => navigate(b.dataset.nav as View));
  hub.querySelectorAll<HTMLElement>('[data-template]').forEach(b => b.onclick = () => { void openTemplate(b.dataset.template!); });
  hub.querySelectorAll<HTMLElement>('[data-favorite]').forEach(b => b.onclick = () => {
    const id = b.dataset.favorite!;
    data.favorites = data.favorites.includes(id) ? data.favorites.filter(f => f !== id) : [...data.favorites, id];
    void save(); render();
  });
  hub.querySelectorAll<HTMLElement>('[data-category]').forEach(b => b.onclick = () => { category = b.dataset.category!; render(); });
  hub.querySelectorAll<HTMLElement>('[data-task-filter]').forEach(b => b.onclick = () => { taskFilter = b.dataset.taskFilter!; render(); });
  hub.querySelectorAll<HTMLElement>('[data-add-task]').forEach(b => b.onclick = () => editTask());
  hub.querySelectorAll<HTMLElement>('[data-edit-task]').forEach(b => b.onclick = () => editTask(data.followups.find(t => t.id === b.dataset.editTask)));
  hub.querySelectorAll<HTMLInputElement>('[data-complete]').forEach(b => b.onchange = () => {
    const t = data.followups.find(t => t.id === b.dataset.complete)!; t.done = b.checked; void save(); shell(); render();
    options.toast(t.done ? 'Follow-up completed. Nice work.' : 'Follow-up reopened.');
  });
  hub.querySelectorAll<HTMLElement>('[data-add-provider]').forEach(b => b.onclick = () => editProvider());
  hub.querySelectorAll<HTMLElement>('[data-edit-provider]').forEach(b => b.onclick = () => editProvider(data.providers.find(p => p.id === b.dataset.editProvider)));
  hub.querySelectorAll<HTMLElement>('[data-compose-provider]').forEach(b => b.onclick = () => {
    const p = data.providers.find(p => p.id === b.dataset.composeProvider)!;
    void openTemplate('provider-introduction', p.name);
  });
  const search = document.getElementById('hubSearch') as HTMLInputElement | null;
  if (search) search.oninput = () => {
    const pos = search.selectionStart; query = search.value; render();
    const next = $('hubSearch') as HTMLInputElement; next.focus();
    if (pos !== null) next.setSelectionRange(pos, pos);
  };
  const favorites = document.getElementById('favoritesOnly');
  if (favorites) favorites.onclick = () => { onlyFavorites = !onlyFavorites; render(); };
  hub.querySelectorAll<HTMLElement>('[data-reset-filters]').forEach(b => b.onclick = () => { query = ''; category = 'all'; onlyFavorites = false; render(); });
  const note = document.getElementById('workspaceNote') as HTMLTextAreaElement | null;
  if (note) note.oninput = () => { data.note = note.value; $('noteSaveState').textContent = 'Saving…'; void save().then(ok => { const status = document.getElementById('noteSaveState'); if (status) status.textContent = !ok ? 'Not saved — please try again' : options.persistent ? 'Saved on this device' : 'This session only'; }); };
}
function dialog(title: string, subtitle: string, fields: string, onSave: (form: FormData) => void): void {
  const modal = document.createElement('dialog');
  modal.className = 'workspace-dialog';
  modal.innerHTML = '<form><div class="section-heading"><h2>' + title + '</h2><button type="button" class="icon-button" data-close aria-label="Close dialog">×</button></div><p>' + subtitle + '</p>' + fields + '<div class="dialog-actions"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Save</button></div></form>';
  document.body.append(modal);
  modal.querySelectorAll<HTMLElement>('[data-close]').forEach(b => b.onclick = () => modal.close());
  modal.addEventListener('close', () => modal.remove());
  modal.querySelector('form')!.onsubmit = async e => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const primary = form.querySelector<HTMLInputElement>('input[required]');
    if (primary && !primary.value.trim()) {
      primary.setCustomValidity('Please enter a value.'); primary.reportValidity();
      primary.oninput = () => primary.setCustomValidity('');
      return;
    }
    const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
    submit.disabled = true;
    onSave(values);
    const ok = await save();
    modal.close(); shell(); render();
    if (ok) options.toast(options.persistent ? 'Saved to your workspace.' : 'Kept for this session only.');
  };
  modal.showModal();
}
function input(name: string, label: string, value: string, type = 'text', required = false): string {
  return '<label class="dialog-field">' + label + '<input name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (required ? ' required' : '') + ' maxlength="250"></label>';
}
function editTask(task?: Followup, initialTitle = ''): void {
  dialog(task ? 'Edit follow-up' : 'One less thing to remember', 'Add an administrative next step for your practice.', input('title', 'What needs to happen?', task?.title ?? initialTitle, 'text', true) + input('due', 'Due date', task?.due ?? today(), 'date') + '<label class="dialog-field">Priority<select name="priority">' + ['Normal', 'High', 'Low'].map(p => '<option' + (task?.priority === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label>', form => {
    const next: Followup = { id: task?.id ?? crypto.randomUUID(), title: String(form.get('title')).trim(), due: String(form.get('due')), priority: String(form.get('priority')), done: task?.done ?? false };
    data.followups = task ? data.followups.map(t => t.id === task.id ? next : t) : [...data.followups, next];
  });
}
function editProvider(provider?: Provider): void {
  dialog(provider ? 'Edit provider' : 'Add a provider', 'Contact details are saved in this browser.', input('name', 'Name and title', provider?.name ?? '', 'text', true) + input('specialty', 'Specialty', provider?.specialty ?? '') + input('practice', 'Practice / organization', provider?.practice ?? '') + input('email', 'Email address', provider?.email ?? '', 'email'), form => {
    const next: Provider = { id: provider?.id ?? crypto.randomUUID(), name: String(form.get('name')).trim(), specialty: String(form.get('specialty')).trim(), practice: String(form.get('practice')).trim(), email: String(form.get('email')).trim() };
    data.providers = provider ? data.providers.map(p => p.id === provider.id ? next : p) : [...data.providers, next];
  });
}
export async function initWorkspace(config: Options): Promise<void> {
  options = config;
  const stored = await options.store.get<WorkspaceData>(KEY);
  data = { ...emptyData(), ...(stored ?? {}) };
  const storedChat = stored?.chat;
  const messages = Array.isArray(storedChat?.messages)
    ? storedChat.messages.filter((message): message is ChatMessage => !!message
      && typeof message.id === 'string'
      && typeof message.authorName === 'string'
      && typeof message.text === 'string'
      && typeof message.createdAt === 'number').slice(-CHAT_MESSAGE_LIMIT)
    : [];
  const messageIds = new Set(messages.map(message => message.id));
  data.chat = {
    displayName: typeof storedChat?.displayName === 'string' ? storedChat.displayName.slice(0, CHAT_NAME_LIMIT) : '',
    messages,
    readMessageIds: Array.isArray(storedChat?.readMessageIds)
      ? storedChat.readMessageIds.filter((id): id is string => typeof id === 'string' && messageIds.has(id)).slice(-CHAT_MESSAGE_LIMIT)
      : [],
  };
  ready = true;
  navigate('overview');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && chatOpen) {
      chatOpen = false;
      chatDrag = null;
      renderChatWidget();
      focusChatLauncher();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
      event.preventDefault(); navigate('library'); $('hubSearch').focus();
    }
  });
  window.addEventListener('resize', () => {
    const panel = document.querySelector<HTMLElement>('[data-chat-drag-panel]');
    if (chatOpen && panel && chatPosition) applyChatPosition(panel, chatPosition);
  });
}
export function addWorkspaceFollowup(title: string): void { if (ready) editTask(undefined, title); }
export async function resetWorkspace(): Promise<void> {
  await writeQueue.catch(() => {});
  data = emptyData();
  chatOpen = false;
  chatPosition = null;
  chatDrag = null;
  if (ready) { shell(); if (!$('hub').hidden) render(); }
}
