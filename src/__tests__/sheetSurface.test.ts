/**
 * A sheet's surface is a plain View. A Modal is its own Android window: its content is laid out once at one size
 * and again when the window reports its real one, and a Reanimated entering, exiting or layout animation on the
 * surface can keep the first frame, which left sheets standing about a status bar plus a navigation bar above the
 * bottom of the screen (seen on a Samsung phone with three-button navigation). The Modal's own fade does the
 * arriving. Animations on views inside the sheet are fine; none belongs on its surface.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, '..', 'components', 'ModalSheet.tsx'), 'utf8');

it('does not import Reanimated: the surface has no layout animation to run', () => {
  expect(source).not.toMatch(/from 'react-native-reanimated'/);
});

it('puts no entering, exiting or layout animation on the sheet', () => {
  expect(source).not.toMatch(/\b(entering|exiting|layout)=\{/);
});

it('keeps every surface findable for the tests that read it', () => {
  expect((source.match(/testID="sheet-surface"/g) ?? []).length).toBeGreaterThanOrEqual(2);
});
