import {
  applyScheme,
  getScheme,
  getSchemeVersion,
  isAppearancePreference,
  resolveScheme,
  subscribeScheme,
} from './scheme';

afterEach(() => {
  applyScheme('light');
});

describe('scheme', () => {
  it('starts in light', () => {
    expect(getScheme()).toBe('light');
  });

  it('changes mode, bumps the version and tells listeners once', () => {
    const before = getSchemeVersion();
    const listener = jest.fn();
    const stop = subscribeScheme(listener);
    expect(applyScheme('dark')).toBe(true);
    expect(getScheme()).toBe('dark');
    expect(getSchemeVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does nothing when the mode is already that mode', () => {
    const before = getSchemeVersion();
    const listener = jest.fn();
    const stop = subscribeScheme(listener);
    expect(applyScheme('light')).toBe(false);
    expect(getSchemeVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('stops telling a listener once it has unsubscribed', () => {
    const listener = jest.fn();
    const stop = subscribeScheme(listener);
    stop();
    applyScheme('dark');
    expect(listener).not.toHaveBeenCalled();
  });

  it('resolves a preference against what the phone says', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
  });

  it('recognises only the three preferences', () => {
    expect(isAppearancePreference('system')).toBe(true);
    expect(isAppearancePreference('light')).toBe(true);
    expect(isAppearancePreference('dark')).toBe(true);
    expect(isAppearancePreference('auto')).toBe(false);
    expect(isAppearancePreference(null)).toBe(false);
    expect(isAppearancePreference(undefined)).toBe(false);
  });
});
