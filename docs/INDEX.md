# Documentation index

Start with the [README](../README.md), then [architecture and logic](ARCHITECTURE.md), [data model](../DATA_MODEL.md), [backup and restore](../BACKUP.md) and [build/release guide](../BUILD.md).

Reports retain previous evidence in an expandable historical section. Their dates, test counts and old UI descriptions belong to the recorded revision. Current behavior summaries link back to implementation; changing a contract requires updating its guide and meaningful tests.

| Document                                                                          | Purpose                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [ACTIVITY_FIX_REPORT.md](../ACTIVITY_FIX_REPORT.md)                               | Historical implementation and validation record      |
| [AGENTS.md](../AGENTS.md)                                                         | Current guide / project instructions                 |
| [APP_AUDIT.md](../APP_AUDIT.md)                                                   | Historical implementation and validation record      |
| [AUDIT.md](../AUDIT.md)                                                           | Historical implementation and validation record      |
| [BACKUP.md](../BACKUP.md)                                                         | Backup behavior and historical implementation record |
| [BUILD.md](../BUILD.md)                                                           | Current guide / project instructions                 |
| [CLAUDE.md](../CLAUDE.md)                                                         | Current guide / project instructions                 |
| [CODE_CLEANUP_REPORT.md](../CODE_CLEANUP_REPORT.md)                               | Historical implementation and validation record      |
| [DATA_MODEL.md](../DATA_MODEL.md)                                                 | Current guide / project instructions                 |
| [FIX_REPORT.md](../FIX_REPORT.md)                                                 | Historical implementation and validation record      |
| [FOLLOWUP_CODE_AUDIT.md](../FOLLOWUP_CODE_AUDIT.md)                               | Historical implementation and validation record      |
| [HOME_FIX_REPORT.md](../HOME_FIX_REPORT.md)                                       | Historical implementation and validation record      |
| [HOME_PLAN_SECTION_FIXES.md](../HOME_PLAN_SECTION_FIXES.md)                       | Historical implementation and validation record      |
| [PERFORMANCE_FIX_REPORT.md](../PERFORMANCE_FIX_REPORT.md)                         | Historical implementation and validation record      |
| [PLAN_FIX_REPORT.md](../PLAN_FIX_REPORT.md)                                       | Historical implementation and validation record      |
| [POPUP_REFINEMENT_REPORT.md](../POPUP_REFINEMENT_REPORT.md)                       | Historical implementation and validation record      |
| [README.md](../README.md)                                                         | Current guide / project instructions                 |
| [REPORTS_FIX_REPORT.md](../REPORTS_FIX_REPORT.md)                                 | Historical implementation and validation record      |
| [REPORTS_REDESIGN_IMPLEMENTATION.md](../REPORTS_REDESIGN_IMPLEMENTATION.md)       | Historical implementation and validation record      |
| [SECURITY_FOLLOWUP_REPORT.md](../SECURITY_FOLLOWUP_REPORT.md)                     | Historical implementation and validation record      |
| [SECURITY_PRODUCT_REVIEW.md](../SECURITY_PRODUCT_REVIEW.md)                       | Historical implementation and validation record      |
| [TRANSACTION_FIX_REPORT.md](../TRANSACTION_FIX_REPORT.md)                         | Historical implementation and validation record      |
| [UI_REFINEMENT_REPORT.md](../UI_REFINEMENT_REPORT.md)                             | Historical implementation and validation record      |
| [UI_UX_REFINEMENT_REPORT.md](../UI_UX_REFINEMENT_REPORT.md)                       | Historical implementation and validation record      |
| [vendor/decode-uri-component/README.md](../vendor/decode-uri-component/README.md) | Compatibility package maintenance                    |

## Maintaining documentation

- Verify names, commands, source links and behavior against code before describing them.
- Separate a proposed feature from implemented behavior and a past test run from fresh validation.
- Explain transaction boundaries, currency/privacy scope and failures where they affect a flow.
- Preserve product decisions unless the owner changes them; avoid promising perfect security or performance.
- Follow [AGENTS.md](../AGENTS.md) and the exact Expo version documentation before code changes.
