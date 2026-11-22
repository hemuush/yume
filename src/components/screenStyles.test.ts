import { softShadow } from './screenStyles';
import { applyScheme } from '@/theme/scheme';

afterEach(() => applyScheme('light'));

describe('softShadow', () => {
  it('lifts a card a little in light mode', () => {
    applyScheme('light');
    expect(softShadow()).toMatchObject({ elevation: 1, shadowOpacity: 0.05 });
  });

  it('leaves dark cards flat', () => {
    applyScheme('dark');
    expect(softShadow()).toEqual({});
  });
});
