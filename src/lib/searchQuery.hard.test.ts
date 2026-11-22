import { parseSearchQuery } from './searchQuery';

const T = '2026-11-22';
const p = (q: string) => parseSearchQuery(q, T);
const texts = (q: string) => p(q).words.map((w) => w.text);

describe('amounts', () => {
  it.each([
    ['184', 18350, 18449],
    ['1,807', 180650, 180749],
    ['₹1,807', 180650, 180749],
    ['$12,34,567', 123456650, 123456749],
    ['€5', 450, 549],
    ['0', 1, 49],
  ])('whole %s', (q, min, max) => {
    expect(p(q).words[0].amountMinor).toEqual({ min, max });
  });
  it.each([
    ['184.50', 18450],
    ['₹1,807.5', 180750],
    ['0.07', 7],
    ['1.99', 199],
    ['19.99', 1999],
    ['4.35', 435],
  ])('paise %s is exact', (q, v) => {
    expect(p(q).words[0].amountMinor).toEqual({ min: v, max: v });
  });
  it.each(['1,8', '1,8071', '12.345', '1.', '.5', '1e5', '-5', '5-', '1,,000', '₹', '12abc'])(
    '%s is not an amount',
    (q) => {
      expect(p(q).words.every((w) => !w.amountMinor)).toBe(true);
    }
  );
});

describe('dates', () => {
  it.each([
    ['24 sep', '2026-09-24'],
    ['24 September', '2026-09-24'],
    ['sep 24', '2026-09-24'],
    ['Sept 24', '2026-09-24'],
    ['24th sep', '2026-09-24'],
    ['1st jan', '2026-01-01'],
    ['2nd FEB', '2026-02-02'],
    ['3rd Mar', '2026-03-03'],
    ['24/9', '2026-09-24'],
    ['24-9', '2026-09-24'],
    ['24.9', '2026-09-24'],
    ['5/1', '2026-01-05'],
    ['22 nov', '2026-11-22'],
    ['23 nov', '2025-11-23'],
  ])('%s', (q, d) => {
    const r = p(q);
    expect(r.date).toBe(d);
  });
  it('29 feb is only valid in a leap year', () => {
    expect(parseSearchQuery('29 feb', '2028-03-01').date).toBe('2028-02-29');
    expect(parseSearchQuery('29 feb', '2027-03-01').date).toBeNull();
  });
  it.each(['31 apr', '0 jan', '32 jan', '30/2', '13/13', '0/5', '5/0'])('impossible %s stays text', (q) => {
    const r = p(q);
    expect(r.date).toBeNull();
    expect(r.words.length).toBeGreaterThan(0);
  });
  it('removes the date and keeps other words', () => {
    expect(p('coffee 24 sep latte').date).toBe('2026-09-24');
    expect(texts('coffee 24 sep latte')).toEqual(['coffee', 'latte']);
  });
  it('only the first date is consumed', () => {
    const r = p('24 sep 25 oct');
    expect(r.date).toBe('2026-09-24');
    expect(texts('24 sep 25 oct')).toEqual(['25', 'oct']);
  });
});

describe('month words that merely start like a month stay text', () => {
  it.each([
    '2 market',
    'jane 5',
    '5 mayor',
    'march1 5',
    '3 decor',
    '4 novel',
    '7 octopus',
    '2 marching',
    'sept5 3',
    '1 augustus',
    'may5 2',
  ])('%s', (q) => {
    expect(p(q).date).toBeNull();
    expect(texts(q).join(' ')).toBe(q);
  });
  it('"may" is a month and "5 may" a date', () => {
    expect(p('5 may').date).toBe('2026-05-05');
    expect(p('may 5').date).toBe('2026-05-05');
  });
  it('a bare month word without day stays text', () => {
    expect(p('sep').date).toBeNull();
    expect(texts('sep')).toEqual(['sep']);
  });
});

describe('odd input', () => {
  it('empty / whitespace', () => {
    for (const q of ['', ' ', '\t\n  ', ' ']) {
      const r = p(q);
      expect(r.date).toBeNull();
      expect(r.words.every((w) => w.text.trim() !== '' || false)).toBe(true);
    }
    expect(p('').words).toEqual([]);
    expect(p('   \n\t ').words).toEqual([]);
  });
  it('collapses whitespace', () => {
    expect(texts('  a \t b\n\nc  ')).toEqual(['a', 'b', 'c']);
  });
  it('unicode survives', () => {
    expect(texts('café 日本語 😀 ΑΒΓ')).toEqual(['café', '日本語', '😀', 'ΑΒΓ']);
  });
  it('regex metacharacters are plain text', () => {
    const q = String.raw`.* ( [a-z] ^$ \d + ? {2} | \ x`;
    expect(texts(q).join(' ')).toBe(q);
    expect(p(q).date).toBeNull();
  });
  it('very long input is fast and complete', () => {
    const q = Array.from({ length: 20000 }, (_, i) => `w${i}`).join(' ');
    const t0 = Date.now();
    const r = p(q);
    expect(r.words).toHaveLength(20000);
    expect(Date.now() - t0).toBeLessThan(2000);
    const long = '1'.repeat(50000);
    expect(p(long).words).toHaveLength(1);
    const pathological = '1 '.repeat(20000) + 'x';
    expect(Date.now() - t0).toBeLessThan(4000);
    expect(p(pathological).words.length).toBe(20001);
  });
  it('a very long digit string does not produce a bad amount range', () => {
    const w = p('9'.repeat(30)).words[0];
    if (w.amountMinor) expect(Number.isFinite(w.amountMinor.max)).toBe(true);
  });
});

it('d.m wins over paise when it is a real date (deliberate: "24.9" is 24 Sep)', () => {
  expect(p('1.10').date).toBe('2026-10-01');
  expect(p('1.10').words).toEqual([]);
});
