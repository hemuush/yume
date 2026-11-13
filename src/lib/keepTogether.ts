/**
 * Joins the last two words of a short caption with a non-breaking space, so a caption that wraps never leaves
 * one word (or half a date: "Feb" over "2036") alone on its line.
 */
export function keepTogether(text: string): string {
  return text.replace(/ ([^ ]+)$/, '\u00A0$1');
}
