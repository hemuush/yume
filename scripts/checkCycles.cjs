// Fails when app code (src/ and app/, tests excluded) has a circular import. A cycle works only while every module's
// cross-calls happen inside functions, so it makes load order fragile. `import type` is erased at build time and is
// not counted; neither are dynamic import() calls, which run later.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const ROOTS = ['src', 'app'];
const EXTENSIONS = ['.ts', '.tsx'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (
      EXTENSIONS.includes(path.extname(entry.name)) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      !full.includes(`${path.sep}test-support${path.sep}`)
    )
      out.push(full);
  }
  return out;
}

function resolveModule(from, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const candidate of [
    base,
    ...EXTENSIONS.map((e) => base + e),
    ...EXTENSIONS.map((e) => path.join(base, 'index' + e)),
  ]) {
    if (
      EXTENSIONS.includes(path.extname(candidate)) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    )
      return candidate;
  }
  return null;
}

const allTypeOnly = (clause) =>
  !clause ||
  clause.isTypeOnly ||
  (!clause.name &&
    clause.namedBindings &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((e) => e.isTypeOnly));

function importsOf(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = [];
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.importClause)
        found.push(node.moduleSpecifier.text); // import './x' still runs the module
      else if (!allTypeOnly(node.importClause)) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const named =
        node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : null;
      if (node.isTypeOnly || (named && named.length > 0 && named.every((e) => e.isTypeOnly))) continue;
      found.push(node.moduleSpecifier.text);
    }
  }
  return found;
}

function findCycles() {
  const files = ROOTS.flatMap((r) => walk(path.join(root, r)));
  const graph = new Map(
    files.map((f) => [
      f,
      [
        ...new Set(
          importsOf(f)
            .map((s) => resolveModule(f, s))
            .filter(Boolean)
        ),
      ],
    ])
  );
  // Tarjan's strongly connected components: any component of two or more modules (or a self-import) is a cycle.
  let index = 0;
  const indexOf = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  function visit(v) {
    indexOf.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!graph.has(w)) continue;
      if (!indexOf.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), indexOf.get(w)));
    }
    if (low.get(v) === indexOf.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1 || (graph.get(v) ?? []).includes(v))
        cycles.push(component.map((f) => path.relative(root, f)).sort());
    }
  }
  for (const f of graph.keys()) if (!indexOf.has(f)) visit(f);
  return { cycles, modules: files.length };
}

if (require.main === module) {
  const { cycles, modules } = findCycles();
  if (cycles.length === 0) {
    console.log(`No circular imports among ${modules} modules.`);
  } else {
    console.error(`Found ${cycles.length} circular import group(s):`);
    for (const group of cycles) console.error('  ' + group.join(' <-> '));
    process.exit(1);
  }
}
module.exports = { findCycles };
