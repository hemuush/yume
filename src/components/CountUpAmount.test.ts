import { splitLeadingSymbol } from './CountUpAmount';

describe('splitLeadingSymbol', () => {
  it('splits a leading currency symbol from the digits', () => {
    expect(splitLeadingSymbol('₹37,300')).toEqual(['', '₹', '37,300']);
  });

  it('keeps a minus sign out of the symbol', () => {
    expect(splitLeadingSymbol('-₹1,200')).toEqual(['-', '₹', '1,200']);
    expect(splitLeadingSymbol('−$5')).toEqual(['−', '$', '5']);
  });

  it('returns null when the symbol trails or is missing', () => {
    expect(splitLeadingSymbol('1.234 €')).toBeNull();
    expect(splitLeadingSymbol('500')).toBeNull();
  });
});
