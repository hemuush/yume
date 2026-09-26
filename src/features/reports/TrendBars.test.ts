jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { compactRupees } from './TrendBars';

describe('compactRupees', () => {
  it('shortens amounts to fit above a narrow bar', () => {
    expect(compactRupees(0)).toBe('₹0');
    expect(compactRupees(45_000)).toBe('₹450');
    expect(compactRupees(2_107_900)).toBe('₹21k');
    expect(compactRupees(48_260_000)).toBe('₹4.8L');
    expect(compactRupees(50_000_000)).toBe('₹5L');
    expect(compactRupees(-2_107_900)).toBe('-₹21k');
  });
});
