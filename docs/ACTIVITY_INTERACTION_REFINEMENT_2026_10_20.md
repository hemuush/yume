# Activity interaction refinement

Reviewed Activity, its filter sheet, transaction detail actions and recurring handoff. Filters now put type/accounts/categories first and payment/label refinements later, with clearer multi-select headings and spacing. Detail actions use theme-derived icon tints and concise visible captions. The recurring modal hides its parent details sheet and restores it when closed.

Fixed incompatible category picks surviving quick type changes and payment method loss when logging an entry again today. Persisted figures and selected theme colors are unchanged.

Fresh verification: all 14 Activity suites passed (125 tests); the detail suite was rerun after adding child-dismissal coverage. TypeScript, scoped ESLint and Android Hermes export passed. No native phone visual/keyboard/transition acceptance was performed; no APK was built. Changes remain uncommitted.
