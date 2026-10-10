/** Separate enter/leave thresholds keep compact controls from flickering around the collapse boundary. */
export function headerIsCollapsed(progress: number, wasCollapsed: boolean): boolean {
  'worklet';
  return progress >= 0.9 || (wasCollapsed && progress > 0.75);
}
