# Home and Plan sections: implementation record

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](../ARCHITECTURE.md); for the newer check results see the [repository re-audit](../REPOSITORY_REAUDIT_2026_10_25.md).

## Reading guide for this record

Reviewed against the repository on **11 October 2026**. The historical row-only Home spending redesign was subsequently revised. Plan now uses compact forecasts, budgets, debt and goals while retaining their detail links and actions.

Implementation: [app/(tabs)/plan.tsx](<../../app/(tabs)/plan.tsx>) and [src/features/plan](../../src/features/plan). Tests generally live beside these modules; use the [architecture and logic guide](../../docs/ARCHITECTURE.md) to find related flows.

This document preserves earlier findings and validation. Statements inside the historical record describe that revision, including old layouts, build status and test counts. They are not new verification results. See the [documentation index](../../docs/INDEX.md), [data model](../../DATA_MODEL.md), [backup guide](../../BACKUP.md) and [build guide](../../BUILD.md) for current contracts.

<details>
<summary>Historical findings, implementation and validation</summary>

## Plan: debt overview

Removed the individual loan names, installment counts, timeline lanes and payoff-axis labels from Plan. Loan schedules and details remain available on the Loans page.

The compact card retains total principal left, percentage repaid, the estimated debt-free month when all schedules support it, upcoming EMI information and money lent out. Its progress bar represents principal repaid rather than time until payoff. One explicit View loans action opens `/loans` without a loan parameter, so it does not automatically open a detail popup.

## Home: spending breakdown

Replaced the sparse curved icon selector with an existing-style glass card. It shows the period total, previous-period comparison, a colored share strip, and the four leading categories with readable names, amounts and shares. Categories remain selectable; selection updates immediately and survives data reordering. Remaining categories are available through Reports. Shares still use all visible positive categories as their denominator. The existing upstream privacy filtering remains in place.

The dial animation and its delayed detail update are no longer needed. Other Home animations and the rest of each page remain unchanged.

## Validation

- TypeScript and lint passed.
- Five regression suites passed: 154 tests, including the all-23-screen smoke suite, Plan navigation, compact debt presentation, Home selection and interrupted Home animations.
- Tests cover direct Loans navigation without selecting a specific loan and category shares including categories beyond the four displayed.
- Android Hermes export passed: 2,300 modules, 7.8MB bundle, `dist/home-plan-check/_expo/static/js/android/index-4e1790a9029592cbe08f263adebab364.hbc`.

No APK was built. Physical-phone visual and frame-rate verification remains pending.

</details>
