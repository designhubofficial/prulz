import type { FieldDef } from '../merge/index.js';
import type { PaletteKey, ThemeKey } from '../engine/index.js';

export type Category =
  | 'marketing'
  | 'newsletter'
  | 'scheduling'
  | 'intake'
  | 'care'
  | 'billing'
  | 'coordination'
  | 'announcements'
  | 'outreach';

export const CATEGORY_LABELS: Record<Category, string> = {
  marketing: 'Marketing',
  newsletter: 'Newsletter',
  scheduling: 'Scheduling',
  intake: 'Intake',
  care: 'Care follow-up',
  billing: 'Insurance & billing',
  coordination: 'Clinical coordination',
  announcements: 'Announcements',
  outreach: 'Outreach',
};

/**
 * The nine categories group into three families.
 *
 * Nine flat filter chips is a list to read; three families is a shape to scan.
 * The split is by *who the message is for*, which is how a VA actually reaches
 * for one — a patient, a prospect, or a colleague.
 */
export type CategoryGroup = 'patients' | 'growth' | 'clinical';

export const CATEGORY_GROUPS: Array<{
  key: CategoryGroup;
  label: string;
  hint: string;
  categories: Category[];
}> = [
  {
    key: 'patients',
    label: 'Patient messages',
    hint: 'One-to-one mail about a specific appointment, form, or bill',
    categories: ['scheduling', 'intake', 'billing'],
  },
  {
    key: 'growth',
    label: 'Outreach & marketing',
    hint: 'Mail that goes to a list, or opens a new relationship',
    categories: ['marketing', 'newsletter', 'outreach'],
  },
  {
    key: 'clinical',
    label: 'Practice & clinical',
    hint: 'Care follow-ups to patients, hand-offs to colleagues, notices to everyone',
    categories: ['coordination', 'care', 'announcements'],
  },
];

export function groupOf(category: Category): CategoryGroup {
  const found = CATEGORY_GROUPS.find((g) => g.categories.includes(category));
  if (!found) throw new Error(`Category "${category}" belongs to no group`);
  return found.key;
}

export interface Template {
  id: string;
  name: string;
  category: Category;
  /** When to reach for this one. Shown on the library card. */
  description: string;
  /**
   * Bulk mail carries CAN-SPAM obligations: a physical postal address and a
   * working unsubscribe link. The review pane enforces both when this is true.
   */
  bulk: boolean;
  theme: ThemeKey;
  palette: PaletteKey;
  preheader: string;
  fields: FieldDef[];
  /** Block syntax, including the `Subject:` line. */
  body: string;
}

/**
 * Fields every practice supplies once, in the brand profile, rather than
 * retyping per email. Templates reference them like any other merge field.
 */
export const BRAND_FIELDS: FieldDef[] = [
  { key: 'practice_name', label: 'Practice name', type: 'text', fromBrand: true, sample: 'Example Health' },
  { key: 'practice_phone', label: 'Practice phone', type: 'phone', fromBrand: true, sample: '503-555-0100' },
  { key: 'practice_email', label: 'Practice email', type: 'email', fromBrand: true, sample: 'hello@example.com' },
  { key: 'practice_website', label: 'Practice website', type: 'url', fromBrand: true, sample: 'https://example.com' },
  { key: 'practice_address', label: 'Practice postal address', type: 'text', fromBrand: true, sample: '123 Example St, Portland OR 97201' },
  { key: 'booking_url', label: 'Booking link', type: 'url', fromBrand: true, sample: 'https://example.com/book' },
  { key: 'unsubscribe_url', label: 'Unsubscribe link', type: 'url', fromBrand: true, sample: 'https://example.com/unsubscribe' },
  { key: 'sender_name', label: 'Your name', type: 'text', fromBrand: true, sample: 'Jordan Lee' },
  { key: 'sender_title', label: 'Your title', type: 'text', fromBrand: true, sample: 'Patient Care Coordinator' },
];
