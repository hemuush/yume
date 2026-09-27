import { applyPadKey, evaluateAmount, exprFromMinor, hasOperator, PadKey } from './padMath';

/** Presses each key in turn, starting from an empty pad. */
const type = (keys: PadKey[] | string, start = '') =>
  [...keys].reduce((expr, k) => applyPadKey(expr, (k === '<' ? 'back' : k) as PadKey), start);

describe('applyPadKey', () => {
  it('builds numbers and sums from key presses', () => {
    expect(type('120+45')).toBe('120+45');
    expect(type('7×3−1')).toBe('7×3−1');
  });

  it('ignores an operator at the start, and swaps one operator for the next', () => {
    expect(type('+5')).toBe('5');
    expect(type('12+×')).toBe('12×');
  });

  it('allows one decimal point per number and at most two decimals', () => {
    expect(type('1.2.3')).toBe('1.23');
    expect(type('9.999')).toBe('9.99');
    expect(type('.5')).toBe('0.5');
    expect(type('3+.')).toBe('3+0.');
  });

  it('drops a dangling decimal point when an operator follows', () => {
    expect(type('12.+3')).toBe('12+3');
  });

  it('never keeps a leading zero', () => {
    expect(type('05')).toBe('5');
    expect(type('10+05')).toBe('10+5');
    expect(type('0.05')).toBe('0.05');
  });

  it('caps a number at nine digits before the decimal point', () => {
    expect(type('1234567890')).toBe('123456789');
  });

  it('deletes one character at a time', () => {
    expect(type('120+4<<')).toBe('120');
    expect(applyPadKey('', 'back')).toBe('');
  });
});

describe('evaluateAmount', () => {
  it('adds, subtracts, multiplies and divides with the usual precedence', () => {
    expect(evaluateAmount('120+45')).toBe(165);
    expect(evaluateAmount('1500÷3')).toBe(500);
    expect(evaluateAmount('2+3×4')).toBe(14);
    expect(evaluateAmount('100−20×2')).toBe(60);
  });

  it('rounds to two decimals', () => {
    expect(evaluateAmount('100÷3')).toBe(33.33);
    expect(evaluateAmount('0.1+0.2')).toBe(0.3);
  });

  it('ignores a trailing operator or decimal point while typing', () => {
    expect(evaluateAmount('120+')).toBe(120);
    expect(evaluateAmount('45.')).toBe(45);
  });

  it('has no value when empty, zero, negative, or dividing by zero', () => {
    expect(evaluateAmount('')).toBeNull();
    expect(evaluateAmount('0')).toBeNull();
    expect(evaluateAmount('5−9')).toBeNull();
    expect(evaluateAmount('8÷0')).toBeNull();
  });
});

describe('hasOperator / exprFromMinor', () => {
  it('tells a sum from a single number', () => {
    expect(hasOperator('120+45')).toBe(true);
    expect(hasOperator('120.5')).toBe(false);
  });

  it('turns a stored amount back into pad text', () => {
    expect(exprFromMinor(45000)).toBe('450');
    expect(exprFromMinor(12345)).toBe('123.45');
    expect(exprFromMinor(0)).toBe('');
  });
});
