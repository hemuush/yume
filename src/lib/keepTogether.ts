/**
 * Joins the last two words of a short caption with a non-breaking space, so a caption that wraps never leaves
 * one word (or half a date: "Feb" over "2036") alone on its line.
 */
export function keepTogether(text: string): string {
  return text.replace(/ ([^ ]+)$/, '\u00A0$1');
}

/** Every space becomes a non-breaking one: a date range ("Jan 1 – Feb 2") wraps as a whole, never in the middle. */
export function noBreak(text: string): string {
  return text.replace(/ /g, '\u00A0');
}

/**
 * One piece of a caption that is joined with " · ": a short piece stays whole (a date, "From SBI", "Every month"),
 * a long one (an account called "HDFC Savings Account") may wrap but never leaves its last word alone. The caption
 * then wraps between its pieces, not inside one.
 */
export function gluePiece(text: string): string {
  return text.length <= 22 ? noBreak(text) : keepTogether(text);
}
