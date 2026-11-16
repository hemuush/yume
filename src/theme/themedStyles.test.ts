import { StyleSheet } from 'react-native';
import { applyScheme } from './scheme';
import { themedStyles, themedValue } from './themedStyles';

afterEach(() => {
  applyScheme('light');
});

describe('themedStyles', () => {
  it('runs the factory at once and not again while the mode stays the same', () => {
    const factory = jest.fn(() => StyleSheet.create({ row: { backgroundColor: '#fff' } }));
    const styles = themedStyles(factory);
    expect(factory).toHaveBeenCalledTimes(1);
    void styles.row;
    void styles.row;
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('returns the very same style object on every read within a mode', () => {
    const styles = themedStyles(() => StyleSheet.create({ row: { flex: 1 } }));
    expect(styles.row).toBe(styles.row);
  });

  it('is made again on the first read after the mode changes, once', () => {
    let colour = 'light';
    const factory = jest.fn(() => StyleSheet.create({ row: { backgroundColor: colour } }));
    const styles = themedStyles(factory);
    expect(styles.row.backgroundColor).toBe('light');
    colour = 'dark';
    // Nothing has changed yet: the old sheet is still current until the mode changes.
    expect(styles.row.backgroundColor).toBe('light');
    applyScheme('dark');
    expect(styles.row.backgroundColor).toBe('dark');
    void styles.row;
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('gives a new object for a changed mode, so a memoized row redraws', () => {
    const styles = themedStyles(() => StyleSheet.create({ row: { flex: 1 } }));
    const light = styles.row;
    applyScheme('dark');
    expect(styles.row).not.toBe(light);
    expect(styles.row).toEqual(light);
  });

  it('behaves like a normal object: keys, spread and flatten', () => {
    const styles = themedStyles(() => StyleSheet.create({ a: { margin: 1 }, b: { padding: 2 } }));
    expect(Object.keys(styles)).toEqual(['a', 'b']);
    expect({ ...styles.a, ...styles.b }).toEqual({ margin: 1, padding: 2 });
    expect(StyleSheet.flatten([styles.a, styles.b])).toEqual({ margin: 1, padding: 2 });
  });

  it('survives being frozen, as React and react-native-web do to what they are handed', () => {
    const styles = themedStyles(() => ({ a: { margin: 1 } }));
    Object.freeze(styles);
    expect(styles.a).toEqual({ margin: 1 });
    applyScheme('dark');
    expect(styles.a).toEqual({ margin: 1 });
    expect(Object.keys(styles)).toEqual(['a']);
  });

  it('answers undefined for a name that is not in the sheet', () => {
    const styles = themedStyles(() => ({ a: { margin: 1 } })) as Record<string, unknown>;
    expect(styles.missing).toBeUndefined();
  });

  it('works for a constant too: a text style, a tone map', () => {
    let colour = 'ink-light';
    const text = themedValue(() => ({ fontSize: 12, color: colour }));
    expect(text.color).toBe('ink-light');
    colour = 'ink-dark';
    applyScheme('dark');
    expect(text.color).toBe('ink-dark');
    expect({ ...text }).toEqual({ fontSize: 12, color: 'ink-dark' });
  });
});
