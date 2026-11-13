/**
 * A caption joined from pieces with " · " wraps between its pieces, never inside one: a date must not break
 * ("next Sun, Nov" over "22"). Each screen that builds such a caption glues its pieces (`gluePiece`, `noBreak`).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

it.each([
  ['the SIP rows on Investments', 'app/investments.tsx'],
  ['a rule on Recurring', 'src/features/recurring/RuleRow.tsx'],
])('%s glues the pieces of its caption', (_name, file) => {
  expect(read(file)).toMatch(/gluePiece|noBreak/);
});
