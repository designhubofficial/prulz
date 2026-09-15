/**
 * Email-wide identity preferences.
 *
 * These are deliberately separate from individual template drafts. A brand
 * mark and its placement are practice-level choices: set them once, then carry
 * them into every message without copying markup between templates.
 */
import type { StorageAdapter } from './adapter.js';
import type { LogoPlacement } from '../engine/types.js';

export const EMAIL_IDENTITY_KEY = 'email-identity';

export type { LogoPlacement } from '../engine/types.js';

export interface EmailIdentityConfig {
  /** A resized, local PNG that can be reused across every email. */
  logoData: string | null;
  /** Where the reusable practice mark should appear in each email. */
  logoPlacement: LogoPlacement;
}

export const DEFAULT_EMAIL_IDENTITY: EmailIdentityConfig = {
  logoData: null,
  logoPlacement: 'header',
};

export function normalizeEmailIdentity(input: unknown): EmailIdentityConfig {
  const out = { ...DEFAULT_EMAIL_IDENTITY };
  if (!input || typeof input !== 'object') return out;

  const value = input as Record<string, unknown>;
  if (typeof value.logoData === 'string' && value.logoData.startsWith('data:image/png')) {
    out.logoData = value.logoData;
  }

  if (value.logoPlacement === 'header' || value.logoPlacement === 'above'
    || value.logoPlacement === 'footer' || value.logoPlacement === 'hidden') {
    out.logoPlacement = value.logoPlacement;
  } else if (value.useLogo === false) {
    // Migrate the short-lived shared-signature preference from the previous UI.
    out.logoPlacement = 'hidden';
  }
  return out;
}

export async function loadEmailIdentity(store: StorageAdapter): Promise<EmailIdentityConfig> {
  return normalizeEmailIdentity(await store.get<EmailIdentityConfig>(EMAIL_IDENTITY_KEY));
}

export async function saveEmailIdentity(
  store: StorageAdapter,
  config: EmailIdentityConfig,
): Promise<void> {
  await store.set(EMAIL_IDENTITY_KEY, normalizeEmailIdentity(config));
}

export async function resetEmailIdentity(store: StorageAdapter): Promise<void> {
  await store.delete(EMAIL_IDENTITY_KEY);
}
