/** Seeded random keystroke fuzzing of the number pad against an independent reference evaluator. */
import { applyPadKey, evaluateAmount, exprFromMinor, hasOperator, type PadKey } from './padMath';
import { MAX_AMOUNT_MAJOR } from './amountLimits';
import { toMinor } from './money';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const KEYS: PadKey[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '−', '×', '÷', 'back'];
const WEIGHTED: PadKey[] = [...KEYS, '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '9', '9'];

/** Reference: recursive descent over the cleaned string, same float semantics but a different structure. */
function reference(expr: string): number | null {
  const s = expr.replace(/[+−×÷.]+$/, '');
  if (!s) return null;
  let i = 0;
  const num = () => {
    const m = /^[0-9.]+/.exec(s.slice(i))!;
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number | null => {
    let v: number = num();
    while (s[i] === '×' || s[i] === '÷') {
      const op = s[i++];
      const n = num();
      if (op === '÷' && n === 0) return null;
      v = op === '×' ? v * n : v / n;
    }
    return v;
  };
  let acc = factor();
  if (acc === null) return null;
  while (i < s.length) {
    const op = s[i++];
    const t = factor();
    if (t === null) return null;
    acc = op === '+' ? acc + t : acc - t;
  }
  if (!Number.isFinite(acc)) return null;
  const r = Math.round(Number((acc * 100).toPrecision(15))) / 100;
  return r > 0 && r <= MAX_AMOUNT_MAJOR ? r : null;
}

function run(seed: number, len: number, keys: PadKey[]) {
  const r = rng(seed);
  let e = '';
  const trail: string[] = [];
  for (let k = 0; k < len; k++) {
    e = applyPadKey(e, keys[Math.floor(r() * keys.length)]);
    trail.push(e);
  }
  return trail;
}

describe('padMath fuzz', () => {
  it('every reachable expression is well formed and within digit limits (400 runs x 60 keys)', () => {
    for (let seed = 1; seed <= 400; seed++) {
      for (const e of run(seed, 60, seed % 2 ? KEYS : WEIGHTED)) {
        expect(e).toMatch(/^([0-9]+(\.[0-9]{0,2})?([+−×÷]|$))*$/);
        expect(e).not.toMatch(/[+−×÷]{2}/);
        expect(e).not.toMatch(/(^|[+−×÷])0[0-9]/);
        for (const n of e.split(/[+−×÷]/)) {
          const [w, d] = n.split('.');
          expect(w.length).toBeLessThanOrEqual(9);
          expect((d ?? '').length).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('evaluateAmount never throws, is null or a finite 2dp value in range, and matches the reference', () => {
    for (let seed = 1000; seed < 1600; seed++) {
      for (const e of run(seed, 40, seed % 2 ? KEYS : WEIGHTED)) {
        const v = evaluateAmount(e);
        expect(v).toEqual(reference(e));
        if (v !== null) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThanOrEqual(MAX_AMOUNT_MAJOR);
          expect(Number.isSafeInteger(toMinor(v))).toBe(true);
        }
      }
    }
  });

  it('back always shortens by one char and eventually empties', () => {
    for (let seed = 5; seed < 105; seed++) {
      let e = run(seed, 30, WEIGHTED).pop()!;
      const n = e.length;
      for (let k = 0; k < n; k++) {
        const next = applyPadKey(e, 'back');
        expect(next.length).toBe(e.length - 1);
        e = next;
      }
      expect(e).toBe('');
      expect(applyPadKey('', 'back')).toBe('');
    }
  });

  it('plain-number expressions round trip through exprFromMinor', () => {
    const r = rng(77);
    for (let i = 0; i < 5000; i++) {
      const minor = 1 + Math.floor(r() * 10 ** (1 + Math.floor(r() * 11)));
      const text = exprFromMinor(minor);
      expect(text).toMatch(/^[0-9]+(\.[0-9]{1,2})?$/);
      expect(toMinor(evaluateAmount(text)!)).toBe(minor);
      expect(hasOperator(text)).toBe(false);
    }
    expect(exprFromMinor(NaN)).toBe('');
    expect(exprFromMinor(Infinity)).toBe('');
    expect(exprFromMinor(-5)).toBe('');
    expect(exprFromMinor(0)).toBe('');
  });

  it('known precedence, rounding and rejection cases', () => {
    expect(evaluateAmount('2+3×4')).toBe(14);
    expect(evaluateAmount('10−2−3')).toBe(5);
    expect(evaluateAmount('100÷3')).toBe(33.33);
    expect(evaluateAmount('1.005+0')).toBe(1.01);
    expect(evaluateAmount('0.1+0.2')).toBe(0.3);
    expect(evaluateAmount('5÷0')).toBeNull();
    expect(evaluateAmount('3−5')).toBeNull();
    expect(evaluateAmount('0')).toBeNull();
    expect(evaluateAmount('0.004')).toBeNull();
    expect(evaluateAmount('999999999×999999999')).toBeNull();
    expect(evaluateAmount('999999999×1000')).toBe(999999999000);
    expect(evaluateAmount('120+')).toBe(120);
    expect(evaluateAmount('12.')).toBe(12);
    expect(evaluateAmount('')).toBeNull();
  });
});
