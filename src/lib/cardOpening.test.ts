import { isCard, openingLabel, openingToField, openingToMinor } from './cardOpening';

describe('a card’s opening balance is what it owes', () => {
  it('stores what is typed for a card as money owing, and leaves every other account as typed', () => {
    expect(openingToMinor('credit_card', '20000')).toBe(-2_000_000);
    expect(openingToMinor('bank', '20000')).toBe(2_000_000);
    expect(openingToMinor('cash', '1234.56')).toBe(123_500);
    expect(openingToMinor('savings', '')).toBe(0);
  });

  it('keeps nothing owed at exactly zero, never negative zero', () => {
    for (const text of ['', '0', '0.4', '-0']) {
      expect(Object.is(openingToMinor('credit_card', text), -0)).toBe(false);
      expect(Object.is(openingToMinor('bank', text), -0)).toBe(false);
    }
  });

  it('reads a card that started with money in it as a minus', () => {
    expect(openingToMinor('credit_card', '-20000')).toBe(2_000_000);
    expect(openingToField('credit_card', 2_000_000)).toBe('-20000');
  });

  it('turns a stored amount back into the field’s text, the inverse of typing it', () => {
    for (const type of ['credit_card', 'bank'] as const) {
      for (const text of ['0', '5000', '-750']) {
        expect(openingToField(type, openingToMinor(type, text))).toBe(text);
      }
    }
    expect(openingToField('credit_card', -2_000_000)).toBe('20000');
    expect(openingToField('credit_card', 0)).toBe('0');
    expect(openingToField('bank', 123_456)).toBe('1234.56');
  });

  it('passes a value that is not a number through, for the caller to refuse', () => {
    expect(Number.isNaN(openingToMinor('credit_card', 'abc'))).toBe(true);
    expect(Number.isNaN(openingToMinor('credit_card', '1e30'))).toBe(true);
  });

  it('labels the field for what the number means', () => {
    expect(openingLabel('credit_card', false)).toBe('Owed on it now');
    expect(openingLabel('bank', false)).toBe('Opening balance');
    expect(openingLabel('savings', true)).toBe('Invested before Yume');
    expect(isCard('credit_card')).toBe(true);
    expect(isCard('bank')).toBe(false);
  });
});
