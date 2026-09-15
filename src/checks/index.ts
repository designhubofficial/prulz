/**
 * The review suite.
 *
 * Runs on every keystroke, so it must stay fast — the budget is 150ms on a long
 * template. Everything here is regex over a few kilobytes of string; there is no
 * DOM parsing and no layout.
 */
import { a11yCheck } from './a11y.js';
import { complianceCheck } from './compliance.js';
import { deliverabilityCheck } from './deliverability.js';
import { phiCheck } from './phi.js';
import { renderingCheck } from './rendering.js';
import {
  GROUP_LABELS, bySeverity,
  type Check, type CheckContext, type CheckGroup, type Finding,
} from './types.js';

export * from './types.js';
export { contrastRatio } from './a11y.js';
export { hasPhiWarnings } from './phi.js';

const CHECKS: Check[] = [
  phiCheck,
  complianceCheck,
  a11yCheck,
  deliverabilityCheck,
  renderingCheck,
];

/** Display order — patient data first, because it is the one that cannot be undone. */
export const GROUP_ORDER: CheckGroup[] = [
  'phi', 'compliance', 'deliverability', 'accessibility', 'rendering', 'basics',
];

export interface Review {
  findings: Finding[];
  byGroup: Array<{ group: CheckGroup; label: string; findings: Finding[]; worst: Finding['severity'] }>;
  errors: number;
  warnings: number;
  passes: number;
  /** True when nothing blocks a send. Warnings do not block. */
  ok: boolean;
  summary: string;
}

export function review(context: CheckContext): Review {
  const findings: Finding[] = [];
  for (const check of CHECKS) {
    try {
      findings.push(...check(context));
    } catch (error) {
      // A broken check must never take the app down or, worse, silently make a
      // template look clean.
      findings.push({
        id: 'check-failed',
        group: 'basics',
        severity: 'warning',
        title: 'A check could not run',
        detail: `This email was not fully reviewed. ${(error as Error).message}`,
      });
    }
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const passes = findings.filter((f) => f.severity === 'pass').length;

  const byGroup = GROUP_ORDER
    .map((group) => {
      const inGroup = findings.filter((f) => f.group === group).sort(bySeverity);
      return {
        group,
        label: GROUP_LABELS[group],
        findings: inGroup,
        worst: inGroup[0]?.severity ?? ('pass' as const),
      };
    })
    .filter((section) => section.findings.length > 0);

  return {
    findings: [...findings].sort(bySeverity),
    byGroup,
    errors,
    warnings,
    passes,
    ok: errors === 0,
    summary: summarize(errors, warnings),
  };
}

function summarize(errors: number, warnings: number): string {
  if (errors && warnings) {
    return `${errors} problem${errors === 1 ? '' : 's'} to fix, ${warnings} to consider`;
  }
  if (errors) return `${errors} problem${errors === 1 ? '' : 's'} to fix`;
  if (warnings) return `${warnings} thing${warnings === 1 ? '' : 's'} to consider`;
  return 'Nothing flagged';
}

/**
 * Apply a finding's one-click fix to the template source.
 * Replaces the first occurrence only, so repeated text is corrected one
 * deliberate step at a time rather than in a single sweep the user cannot see.
 */
export function applyFix(body: string, finding: Finding): string {
  if (!finding.fix) return body;
  const { find, replace } = finding.fix;
  const at = body.indexOf(find);
  if (at < 0) return body;
  return body.slice(0, at) + replace + body.slice(at + find.length);
}
