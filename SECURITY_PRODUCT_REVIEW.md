# Yume security and product review

Reviewed source at commit 461ebfd on 11 October 2026. This is a focused source/configuration and dependency review, not a penetration test or certification of the installed APK. No application code changed.

## Network and entry points

- No application fetch/axios/WebSocket calls, HTTP server, or backend API URL found in app/, src/, plugins/, or Expo configuration. The SVG/XML http namespaces are not requests.
- app.config.js removes android.permission.INTERNET when EAS_BUILD_PROFILE is present. Local debug builds intentionally retain networking for Metro. The installed APK's merged manifest and network behavior were not inspected in this review.
- The yume:// deep-link scheme, notifications, widgets and Android shortcuts are intentional entry points, not HTTP endpoints. The app-level lock replaces the screen tree while locked. Route/query input remains an attack surface requiring validation and maintained router dependencies.
- app.json disables Android automatic backup, blocks overlay and broad legacy storage permissions, and enables release minification. No app API credential found in the searched application configuration. The EAS project identifier is configuration, not an authentication secret. This is not a full historical Git secret scan.

## Priority findings

1. **Dependency triage:** npm audit --omit=dev reports 26 affected package entries: 14 high, 12 moderate, 0 critical. These are package counts, including propagated findings, not 26 independent exploitable APK defects. Many belong to Expo/Metro build tooling despite being reached through production dependencies. Router's query-string depends on decode-uri-component 0.2.2; the advisory covers malformed URI decoding CPU exhaustion through 0.4.2, patched in 0.5.0. Confirm runtime reachability and use an SDK-compatible remedy. Do not run audit fix --force: its proposed Expo 44/React Native 0.72 downgrades are unsuitable for this SDK 57 app.
2. **Backup confidentiality:** localBackup.ts writes the complete ledger as plaintext JSON into the selected folder. Exported JSON/Excel also contains readable financial data. Export authentication and temporary-file cleanup are good existing protections, but do not encrypt copied files. Offer encrypted backups with a recoverable password/key workflow and clear labeling; preserve old-backup restore compatibility.
3. **Monetary precision:** money.ts intentionally uses Math.round(major) * 100. saveEntry.ts previews the same rounding, and tests encode that policy. A typed 49.50 becomes 50. This is a product limitation rather than an accidental regression. For precise accounting, preserve supported currency minor units across input, splits, exports and balances; avoid silently changing old ledger entries.
4. **Widget privacy:** widgets/data.ts exposes ordinary account balances on the launcher. The privacy preference masks savings accounts only, and widget rendering does not check app-lock state. This is an opt-in widget behavior, not evidence of remote exfiltration. Provide a separate hide-all-widget-values setting and explain that app lock does not protect launcher contents.
5. **Database protection:** client.ts opens ordinary SQLite; SQLCipher/key management is not configured. Android sandbox/device protection still applies, but the app lock is an access gate, not database encryption. Consider encryption when the desired threat model includes extracted app storage; plan safe migration and key recovery first.
6. **Lock behavior:** re-lock after 60 seconds away and a maximum five-minute own-picker exemption are deliberate. Offer immediate/shorter re-lock as a user preference rather than presenting the current behavior as a lock bypass.
7. **Performance verification:** recent Home changes have passing automated tests, but physical-device frame pacing, long-ledger scrolling, startup time, and memory use remain unverified. Profile a release build with representative large data before claiming smoothness.
8. **Backup schedule clarity:** automatic backup is checked at startup/foreground; it is not a guaranteed background job while the app is closed. Some next-backup labels imply a fixed date. State 'when next opened after ...' consistently.

## Features

Keep transactions/search, accounts/transfers, budgets, goals, loans, recurring entries, people/settlement, reports, backup/restore and recently deleted. They serve distinct financial tasks. Existing features should not be removed without usage evidence and approval.

Garden/Suu, What-if and additional widget variants are optional engagement features. Keep them accessible but avoid making them necessary for entering expenses or understanding balances. No usage telemetry was reviewed, so none can honestly be classified as unused.

After the priority work, useful candidate additions are CSV/bank-statement import with mapping, preview and duplicate detection, and an account reconciliation flow comparing the ledger balance with a real balance. Source search found no dedicated flow for either; existing people 'adjust balance' is a different feature. Encrypted backups and broader privacy controls have higher priority than additional visual sections.

## Evidence

- app.config.js: EAS INTERNET removal
- app.json: scheme, permissions, allowBackup and widget registrations
- src/db/client.ts: SQLite open
- src/lib/localBackup.ts: JSON writes and foreground/startup backup checks
- src/lib/money.ts; src/features/add/saveEntry.ts: whole-unit rounding
- src/widgets/data.ts; src/widgets/registry.tsx: widget data and rendering
- src/lib/appLock.ts; app/_layout.tsx: authentication, re-lock, screen-capture prevention and locked navigator gate
- src/lib/notifications.ts: private lock-screen notification visibility
- Local machine audit output: .expo/security-audit.json (ignored by Git)
- https://github.com/advisories/GHSA-vcc3-ghjq-m6fr
- https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/

No APK built or configuration/dependency change applied during this assessment.
