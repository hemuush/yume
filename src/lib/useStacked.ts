import { useWindowDimensions } from 'react-native';

/**
 * Whether a row of columns should become a column: a phone under 360 dp wide, or text past 120%. The one rule
 * the screens share, so neighbouring cards flip at the same size (see src/__tests__/stackRule.test.ts).
 */
export function useStacked(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width < 360 || fontScale > 1.2;
}
