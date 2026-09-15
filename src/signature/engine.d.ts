/**
 * Types for the generated `engine.js`.
 *
 * Extracted verbatim from upwell-email-signature-builder.html, so its public
 * surface is described here rather than annotated in a file that gets
 * overwritten on the next extraction.
 */

/** Build the signature HTML from a config object. */
export declare function build(config: Record<string, unknown>): string;

/** Build the plain-text fallback from a config object. */
export declare function buildPlain(config: Record<string, unknown>): string;

/** The practice logo, embedded as a data URI. */
export declare const DEFAULT_LOGO: string;
