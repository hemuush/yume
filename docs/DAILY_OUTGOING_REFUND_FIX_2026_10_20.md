# Daily outgoing spending and refunds

The supplied backup reproduced two expenses totaling 270 major units and a 1,999 refund on the same date, with a saved daily limit of 500. The prior shared net query subtracted that refund, clamped the negative day to zero, and showed the full allowance remaining. This was a calculation-contract error, not a date or refresh failure.

Home daily/weekly bars and its daily allowance now use outgoing expense totals. getTodaySpend and Garden streaks use the same outgoing basis. Refunds do not refill the daily spending allowance. Reports/category/budget reads retain the default net basis and refund deductions. All date, default-currency and privacy scopes are retained. No fixed production date, amount or user record is introduced.

Expected reproduction: 270 spent and 230 remaining. The regression uses synthetic records matching the amounts; the private backup remains outside tracked files. Fresh validation: 29 suites / 364 tests passed, including real SQLite refund queries, privacy queries, Home screen save/edit/refund/deletion and Home/Garden presentation tests. TypeScript, scoped ESLint and Android Hermes export passed. No APK was built. Native phone acceptance remains outstanding. Nothing committed or pushed.
