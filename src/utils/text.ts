/**
 * Text formatting utilities for proper case / grammar normalisation.
 * Applied consistently across all noun/name inputs in the portal.
 */

/**
 * Words that should remain lowercase in the middle of a title
 * (conjunctions, prepositions, articles) — unless they are the first word.
 */
const LOWERCASE_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'or', 'but', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'by', 'of', 'up', 'as', 'if',
  'with', 'from', 'into', 'over', 'via', 'per', 'vs',
]);

/**
 * Converts any string to Proper Case (Title Case).
 * Handles ALL CAPS, all-lowercase, or mixed-case input.
 * Common conjunctions / prepositions stay lowercase mid-phrase.
 * Trims and collapses extra whitespace.
 */
export function toProperCase(str: string): string {
  if (!str || !str.trim()) return str;

  return str
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Capitalise only the first letter of the string — for descriptions/notes.
 */
export function toSentenceCase(str: string): string {
  if (!str || !str.trim()) return str;
  const trimmed = str.trim().replace(/\s+/g, ' ');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Strips extra whitespace and trims.
 */
export function normaliseWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}
