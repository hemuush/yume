# Approved Home refinement — 5 November 2026

The user approved the second screenshot direction after rejecting the first concept's departure from Yume's identity. This implementation retains the selected theme, actual logo, cream surfaces, Fredoka headings, Archivo amounts, rounded cards, account carousel, semantic allocation colors and existing floating navigation.

## Implemented presentation

- The available amount is the primary figure at 42 logical pixels, with the current label, signed arithmetic, period control and caption retained. The redundant SVG glow inside the card is removed; the existing themed page background remains.
- **How it adds up** is a visible text action below the caption instead of an information icon competing with the period control. It opens the same calculation, forecast and recap disclosure. Bills left still opens it too.
- The per-day estimate sits beside that action without a separate progress-ring tile. The accessible description retains the number of remaining days. It remains distinct from the user's saved daily spending goal and is absent when the existing calculation returns no allowance.
- The allocation line is thinner and draws over the standard 180 ms interval. Its legend shows full formatted monetary amounts, with longer values and enlarged text able to wrap into fewer columns. Percentages remain in the accessible labels and allocation-line description, rather than an extra visible row.
- The spending chart stays inside the summary card. Only the selected day's/week's exact amount is shown above it; each other bar retains its exact amount in its accessible label and reveals it on selection. Bar heights appear immediately on entry and animate actual changes over 180 ms, without staggered growth or a second entrance fade. The selected day, outgoing-spend basis, goal markers and allowance explanation remain.
- The date precedes the greeting; the greeting has a slightly stronger hierarchy. Logo-to-top, bell, profile, collapsing-header interaction and reduced motion are preserved.
- **Your accounts** retains the horizontal carousel, zero-balance access through View all, eight-account preview limit, current per-account currencies and savings masking. Tiles have more room and a clearer balance. Home's initial loading placeholders follow the updated figure, disclosure, legend, chart and account-tile shapes.

Coming up, refunds, recent entries, account summaries, entry shortcuts and destination forms retain their existing data and actions. This pass changes Home presentation, not ledger queries, stored data, financial validation or the shared bottom-navigation implementation.

## Verification

The focused Home, motion, font-scaling, contrast and consistency run passed all 137 tests. Existing assertions were updated for the intentionally changed visible labels, full monetary values and selected-value chart treatment; exact accessible amounts, percentages and the remaining-day estimate are still checked.

The full suite passed: 367 suites and 11,804 tests, with two existing skips. Typecheck, lint, formatting and import-cycle checks passed, as did Android JavaScript export. The final screen smoke run passed all 139 tests. The browser prototype's screenshots and interaction checks establish only the approved reference direction; they are not screenshots or performance measurements of this React Native implementation.

Physical Pixel acceptance must check 100%/200% text, large/negative amounts, all selected themes, month/year navigation, hidden savings, refresh, bar selection, calculator disclosure, account sheets and vertical versus horizontal gestures. No frame-rate improvement is claimed from source changes alone.

## Design references

- [Nielsen Norman Group — Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/): reduce competing detail while keeping necessary actions.
- [Apple Human Interface Guidelines — Motion](https://developer.apple.com/design/human-interface-guidelines/motion): brief, purposeful, optional feedback.
- [Nielsen Norman Group — Animation for Attention and Comprehension](https://www.nngroup.com/articles/animation-usability/): choose motion by its goal and frequency.

External guidance informs the refinement; Yume's existing identity and the approved second concept take precedence over copying another product.
