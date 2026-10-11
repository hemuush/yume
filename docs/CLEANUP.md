# Code cleanup â€” 11 October 2026

## Scope and decisions

Reviewed tracked source imports, named exports, route entry points, widget registration, native configuration, scripts, tests and documentation references. The repository already enforces unused locals and parameters through TypeScript.

Removed the unused Home headline label map and obsolete tap-cycle helper, including tests specific to the removed helper. Retained the live slice, percentage, privacy and resting-headline calculations used by Home and widgets. Removed the repository-specific Claude plugin configuration; it is not part of the Expo application.

Moved 16 historical reports into `docs/archive/` and updated their links. Kept current guides, licenses, brand source assets, backups, build artifacts and the separate design project. No runtime screen, dependency, database table or financial behavior was removed.

## Verification

Focused Home/widget validation passed: three suites, 30 tests. Two obsolete helper assertions initially failed after removal and were corrected; the final rerun passed. Post-change type checking and formatting passed. Android production export passed with 2,307 modules and 40 assets. Documentation links resolve. Repository lint and staged diff checks passed. The full Jest suite was not rerun; validation focused on the changed helper and its live widget consumers. An import-reference scan is a removal aid, not proof that every referenced export is needed. Physical-device performance is outside this cleanup pass.
