# Expense labels

Implemented on 13 October 2026 after `d2a0885`. The original picker was included in preview build 14; preview build 15 was submitted with the keyboard/loading refinement and final-audit fixes. Device acceptance remains pending.

## One field

Expenses have one optional Label field in place of the Note editor. Choose a previous label or type a new one. Selecting a suggestion or confirming Use label commits the choice; closing the picker leaves the original value intact. Clearing the text and confirming removes it. Income, transfer, loan and person notes keep their original meaning.

Existing expense text is reused through `transactions.note`, and recurring expenses use their existing `note` field. There is no second text value, separate tag table or destructive migration. Label matching uses exact trimmed text. Existing case variants are not silently merged or rewritten. Split, edit, refund, repeat, backup and restore continue through the original text-field contracts.

## Where to use it

- Add → Expense → Label: recent labels load once per opening/privacy scope, up to 50. Typing filters them locally without clearing or reloading suggestions. Eight show initially; Show more expands the list. The keyboard opens only when the field is tapped and is dismissed on selection/close. The confirmation action scrolls with the keyboard-aware content. Loading/error states are explicit; failures allow custom entry and retry.
- Activity → Filter → Expense label: choose a suggestion or enter an exact label. Labels narrow expenses and their refunds alongside existing date/category/account filters. Switching to income/transfers or clearing filters removes the incompatible label. The active label also has a removal control above the list.
- Reports → Breakdown → Spending → By category / By account menu → Explore expense labels: search label totals for the selected report window. Net totals subtract refunds using their recorded labels, keep unlabelled records, count expense entries and exclude unrelated income/transfers. No category or reason is inferred from the text.

Currency scope follows the existing default currency. Hidden sensitive category groups leave label suggestions and report totals. Reports show eight label rows initially and expand by 20 with Show more. Search is local, has a clear action, and does not trigger another load. Done, close and Show more dismiss the keyboard. The summary reserves space during loading; search becomes available after a successful read. Pending reads cannot replace newer scopes or update closed components. Comparisons, existing charts and financial calculations remain unchanged.

## Fresh validation

- Final full regression: 268 suites / 10,887 tests passed, exit 0, 465.534 seconds. Two opt-in performance tests were skipped by the ordinary Jest command; they were not rerun for this change.
- New real-SQLite tests cover old text reuse, date/currency scope, refund-only negative totals, unlabelled rows, income exclusion and sensitive-parent/sibling privacy.
- New UI tests cover previous/custom/cleared labels, read failure, exact Activity label filtering and selected-range report search.
- The first broad run had a test-only mock setup failure in the new report test. The mock was corrected, its focused rerun passed, and the final full rerun above passed.
- Header cold-start initial regression cases are included in the full run; the preceding local fix is retained.

Type checking, lint and formatting were checked separately. No phone installation, native keyboard layout review or new signed artifact is claimed. Test the picker keyboard/closing behaviour, long labels and enlarged text on the next requested APK.

### Reports presentation

Reports → Breakdown → the “By category / By account” menu offers “Explore expense labels” for spending. Income retains category/account grouping. The label sheet keeps the selected period's net total visible while searching; it includes unlabelled entries and subtracts recorded refunds. Searching filters rows, not that period total. Category percentage comparisons retain their full previous-period basis; “What changed?” insights use matching days, as explained in the comparison disclosure.
