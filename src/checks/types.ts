import type { FieldDef } from '../merge/index.js';

export type Severity = 'error' | 'warning' | 'pass';

export type CheckGroup =
  | 'phi'
  | 'compliance'
  | 'accessibility'
  | 'deliverability'
  | 'rendering'
  | 'basics';

export const GROUP_LABELS: Record<CheckGroup, string> = {
  phi: 'Patient data',
  compliance: 'Compliance',
  accessibility: 'Accessibility',
  deliverability: 'Deliverability',
  rendering: 'Email clients',
  basics: 'Basics',
};

/** A one-click correction the review pane can apply to the template source. */
export interface Fix {
  label: string;
  /** Exact substring to replace. */
  find: string;
  replace: string;
}

export interface Finding {
  id: string;
  group: CheckGroup;
  severity: Severity;
  title: string;
  /** Why it matters, in plain language. Never just restate the title. */
  detail: string;
  /** The offending text, for the user to locate it. */
  excerpt?: string;
  fix?: Fix;
}

export interface CheckContext {
  /** Template source in block syntax, with merge fields unresolved. */
  body: string;
  subject: string;
  preheader: string;
  /** Fully rendered email. */
  html: string;
  /** Plain-text alternative. */
  text: string;
  /** True when this goes to a list, which triggers the CAN-SPAM rules. */
  bulk: boolean;
  fields: FieldDef[];
  /** Footer as rendered, used for the postal-address check. */
  footer?: string;
  unsubscribeUrl?: string;
}

export type Check = (context: CheckContext) => Finding[];

/** Order findings worst-first so the review pane leads with what blocks a send. */
export const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, pass: 2 };

export function bySeverity(a: Finding, b: Finding): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
}
