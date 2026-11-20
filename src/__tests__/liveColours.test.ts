/**
 * Colours must be read when a screen is drawn, never when its file is loaded: the app has two modes, and a colour
 * captured at load would stay in the mode the app started in. This reads every source file and fails on
 *  - a `theme.colors` read outside any function (a constant at the top of a file), and
 *  - a `StyleSheet.create` outside any function (it must sit inside `themedStyles(() => ...)`), and
 *  - a themed constant or style sheet (made by `themedStyles` / `themedValue`) used outside any function: spreading
 *    or reading it at load time copies its colours as they are right then.
 * All are fixed the same way: wrap the sheet in `themedStyles`, or the constant in `themedValue`, or turn the
 * constant into a function. See `src/theme/themedStyles.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { contrastRatio } from '@/lib/color';
import { PALETTES } from '@/theme/palette';

const ROOT = path.resolve(__dirname, '../..');

it.each(['light', 'dark'] as const)('keeps Home text legible on the %s surfaces and controls', (scheme) => {
  const { home, textPrimary, textMuted, link, incomeText } = PALETTES[scheme];
  for (const surface of [home.background, home.surface, home.control, home.selected, home.pressed]) {
    expect(contrastRatio(textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(home.secondaryText, surface)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrastRatio(textMuted, home.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(link, home.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(link, home.pressed)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(incomeText, home.pressed)).toBeGreaterThanOrEqual(3);
});

it.each(['light', 'dark'] as const)('keeps Add Transaction readable in %s mode', (scheme) => {
  const { home, surfaceAlt, textPrimary } = PALETTES[scheme];
  for (const surface of [home.background, home.surface, home.control, home.selected, surfaceAlt]) {
    expect(contrastRatio(textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(home.secondaryText, surface)).toBeGreaterThanOrEqual(4.5);
  }
});

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|__tests__|test-support/.test(entry.name)) sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const isFunction = (n: ts.Node) => ts.isFunctionLike(n) || ts.isClassLike(n);

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

/** Names of the exported values a file makes with `themedStyles(...)` or `themedValue(...)`. */
function exportedThemedNames(file: string): string[] {
  const names: string[] = [];
  for (const statement of parse(file).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (
        ts.isIdentifier(declaration.name) &&
        init &&
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        (init.expression.text === 'themedStyles' || init.expression.text === 'themedValue')
      ) {
        names.push(declaration.name.text);
      }
    }
  }
  return names;
}

function findings(
  file: string,
  themedByModule: Map<string, Set<string>>
): { colourReads: string[]; styleSheets: string[]; themedUses: string[] } {
  const sf = parse(file);
  const colourReads: string[] = [];
  const styleSheets: string[] = [];
  const themedUses: string[] = [];
  // The names this file brings in (or makes itself) that are themed, however they are called here.
  const themed = new Set<string>(exportedThemedNames(file));
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const from = statement.moduleSpecifier.text;
    const target = from.startsWith('@/')
      ? path.join(ROOT, 'src', from.slice(2))
      : from.startsWith('.')
        ? path.resolve(path.dirname(file), from)
        : null;
    if (!target) continue;
    const known =
      themedByModule.get(target) ?? themedByModule.get(path.join(target, 'index')) ?? new Set<string>();
    for (const element of bindings.elements) {
      if (known.has((element.propertyName ?? element.name).text)) themed.add(element.name.text);
    }
  }
  const at = (n: ts.Node) =>
    `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const visit = (n: ts.Node, insideFunction: boolean) => {
    if (!insideFunction) {
      if (
        ts.isPropertyAccessExpression(n) &&
        n.name.text === 'colors' &&
        n.expression.getText() === 'theme'
      ) {
        colourReads.push(at(n));
      }
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === 'create' &&
        n.expression.expression.getText() === 'StyleSheet'
      ) {
        styleSheets.push(at(n));
      }
      // A themed name read at load time. Its own declaration (and the factory call) are the only top-level mentions.
      if (ts.isIdentifier(n) && themed.has(n.text)) {
        const parent = n.parent;
        const declaring = ts.isVariableDeclaration(parent) && parent.name === n;
        const importing = ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
        const propertyKey = ts.isPropertyAccessExpression(parent) && parent.name === n;
        const keyed = ts.isPropertyAssignment(parent) && parent.name === n;
        if (!declaring && !importing && !propertyKey && !keyed) themedUses.push(at(n));
      }
    }
    ts.forEachChild(n, (child) => visit(child, insideFunction || isFunction(n)));
  };
  visit(sf, false);
  return { colourReads, styleSheets, themedUses };
}

describe('colours are read when drawn, not when loaded', () => {
  const files = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'app'))];
  // module path (without extension) -> the names it exports that are made with themedStyles / themedValue
  const themedByModule = new Map<string, Set<string>>();
  for (const file of files) {
    const names = exportedThemedNames(file);
    if (names.length) themedByModule.set(file.replace(/\.(ts|tsx)$/, ''), new Set(names));
  }
  const all = files.map((file) => findings(file, themedByModule));

  it('reads the source files', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it('has no theme.colors read at the top level of a file', () => {
    expect(all.flatMap((f) => f.colourReads)).toEqual([]);
  });

  it('has no style sheet made at the top level of a file outside themedStyles', () => {
    expect(all.flatMap((f) => f.styleSheets)).toEqual([]);
  });

  it('has no themed constant or style sheet used at the top level of a file', () => {
    expect(all.flatMap((f) => f.themedUses)).toEqual([]);
  });

  it('knows the themed exports it looks for', () => {
    const names = [...themedByModule.values()].flatMap((set) => [...set]);
    expect(names).toEqual(expect.arrayContaining(['SECTION_TITLE', 'EYEBROW']));
  });
});
