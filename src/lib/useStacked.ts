import { useWindowDimensions } from 'react-native';

/**
 * The cut-offs for "a row of columns becomes a column": a phone narrower than `width` dp, or text past `fontScale`.
 * `normal` is the rule nearly every row and card shares (see src/__tests__/stackRule.test.ts); the other two are
 * the ones that have always differed, kept as they were so that a 360 dp phone lays them out as before:
 * - early: Add's amount card and Activity's period bar stack at 380 dp, and from 115% text;
 * - late: Plan's status tiles go to one column only under 340 dp, or past 130% text (tiles, not a row of figures).
 */
const AT = {
  normal: { width: 360, fontScale: 1.2 },
  early: { width: 380, fontScale: 1.15 },
  late: { width: 340, fontScale: 1.3 },
} as const;

export function useStacked(at: keyof typeof AT = 'normal'): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width < AT[at].width || fontScale > AT[at].fontScale;
}
