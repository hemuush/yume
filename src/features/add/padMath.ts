import { MAX_AMOUNT_MAJOR } from '@/lib/amountLimits';

/**
 * The Add screen's number pad: what a key press does to the typed
 * expression, and what that expression is worth. Pure, so every rule below
 * is unit-tested without rendering anything.
 *
 * The expression is plain text in the pad's own symbols — digits, one `.`
 * per number, and the operators `+ − × ÷` between numbers — e.g. "120+45".
 */
export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | PadOperator | 'back';
export type PadOperator = '+' | '−' | '×' | '÷';

const OPERATORS: readonly string[] = ['+', '−', '×', '÷'];
/** Digits allowed before the decimal point in one number — ₹99,99,99,999 is plenty. */
const MAX_WHOLE_DIGITS = 9;
const MAX_DECIMALS = 2;

const isOperator = (c: string | undefined): c is PadOperator => c !== undefined && OPERATORS.includes(c);

/** The number currently being typed — everything after the last operator. */
function lastNumber(expr: string): string {
  const parts = expr.split(/[+−×÷]/);
  return parts[parts.length - 1];
}

/** The expression after pressing `key`. Presses that would make it invalid are ignored. */
export function applyPadKey(expr: string, key: PadKey): string {
  if (key === 'back') return expr.slice(0, -1);

  if (isOperator(key)) {
    if (expr === '') return expr; // an amount can't start with an operator
    // A second operator replaces the first ("12+" then "×" → "12×"); a
    // trailing "." is dropped first ("12." then "+" → "12+").
    const trimmed = isOperator(expr[expr.length - 1]) || expr.endsWith('.') ? expr.slice(0, -1) : expr;
    return trimmed === '' ? '' : trimmed + key;
  }

  const current = lastNumber(expr);
  if (key === '.') {
    if (current.includes('.')) return expr;
    return expr + (current === '' ? '0.' : '.');
  }

  // A digit.
  const [whole, decimals] = current.split('.');
  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? expr : expr + key;
  }
  if (whole === '0') return expr.slice(0, -1) + key; // "0" then "5" is "5", not "05"
  if (whole.length >= MAX_WHOLE_DIGITS) return expr;
  return expr + key;
}

/**
 * The expression's value in major units, rounded to two decimals, or null
 * when it has no usable value: empty, dividing by zero, or zero/negative
 * overall. A trailing operator is ignored, so "120+" is worth 120 while the
 * next number is still being typed. × and ÷ bind tighter than + and −.
 */
export function evaluateAmount(expr: string): number | null {
  let s = expr;
  while (s !== '' && (isOperator(s[s.length - 1]) || s.endsWith('.'))) s = s.slice(0, -1);
  if (s === '') return null;

  const tokens = s.match(/[+−×÷]|[0-9.]+/g) ?? [];
  // First pass: fold × and ÷ into the terms they belong to.
  const terms: number[] = [];
  const signs: number[] = [];
  let term = Number(tokens[0]);
  let sign = 1;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (op === '×') term *= n;
    else if (op === '÷') {
      if (n === 0) return null;
      term /= n;
    } else {
      terms.push(term);
      signs.push(sign);
      term = n;
      sign = op === '−' ? -1 : 1;
    }
  }
  terms.push(term);
  signs.push(sign);

  const total = terms.reduce((sum, t, i) => sum + signs[i] * t, 0);
  if (!Number.isFinite(total)) return null;
  const rounded = Math.round(total * 100) / 100;
  return rounded > 0 && rounded <= MAX_AMOUNT_MAJOR ? rounded : null;
}

/** True when the expression is a sum rather than a single number — the screen shows it under the amount. */
export function hasOperator(expr: string): boolean {
  return /[+−×÷]/.test(expr);
}

/** The pad text for an existing amount (editing an entry): 45000 minor → "450", 12345 → "123.45". */
export function exprFromMinor(minor: number): string {
  if (!Number.isFinite(minor) || minor <= 0) return '';
  return String(Math.round(minor) / 100);
}
