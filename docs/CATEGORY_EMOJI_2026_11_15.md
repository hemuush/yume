# Your own emoji for a category (15 November 2026)

A person can give a category their own emoji, and the built-in icon picker is cut from about 110 icons to fifteen. Nothing here was run on a phone: the tests drive the real database, the real backup code and the real components in Jest, not an Android device.

## What changed for the person

- **New category and Edit category** show fifteen built-in icons (tag, food, groceries, home, bills, car, health, shopping, fun, education, travel, gift, work, savings, card), then a **Use your own emoji** row. It opens a field: type, or paste, one emoji from the phone's keyboard. The preview card shows it as it is typed.
- **A wrong entry says so** and holds Save: more than one emoji ("One emoji only."), or something that is not an emoji (letters, digits). The last good emoji stays in the preview. Picking one of the icons instead clears the problem. Clearing the field returns to the tag icon.
- **"Browse all icons" is gone.** Anything more specific than the fifteen (a pet, a gym, a streaming service) is an emoji.
- **Nothing existing changes.** The default categories keep the icons they were seeded with (a few, such as Fuel's `gas-station` and Insurance's `shield-check`, are not among the fifteen), and so does every category made before. Editing one shows its current icon as an extra tile for as long as the sheet is open, so opening the editor loses nothing.

## How an icon is stored

One text value, `categories.icon`, as before: a built-in name (`silverware-fork-knife`) or the emoji itself (`☕`, a family, a flag). No new column, no migration, backup format still 6. [categoryIcon](../src/lib/categoryIcon.ts) holds the rules:

- `isEmojiIcon` accepts exactly one emoji: a picture with an optional emoji selector or skin tone, a flag (two regional letters), a keycap, a region flag (tag characters), or such pieces joined by zero-width joiners (a family, a person with a job), at most 20 UTF-16 units. It rejects letters, digits, a second emoji and anything else.
- `normalizeCategoryIcon` returns a built-in-shaped name (lower-case words joined by dashes) or one emoji as it is and anything else as `tag`. It never throws, because an icon is cosmetic and must not block saving a category or restoring a backup.
- The emoji check is written over code points on purpose. Regular-expression property escapes such as `\p{Extended_Pictographic}` are not guaranteed on the phone's JavaScript engine, and a pattern it cannot read would stop the app at start-up. (The Add form's mock-up used `Intl.Segmenter`; the app does not.)

## Where the check runs

| Where                                                | What happens                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| The category form                                    | Checks as it is typed, shows the reason, holds Save                                            |
| `createCategory` and `updateCategory`                | Store `normalizeCategoryIcon(icon)`: nothing else can be saved, whoever the caller is           |
| `restoreFromSnapshot` (file backup and folder backup) | Each restored category's icon goes through the same function; the rest of the file is restored |
| Undo of a delete, archive and restore                | Copy the stored row, so the emoji comes back as it was                                         |

## Where an icon is drawn

Every screen draws a category's icon through one component, [CategoryGlyph](../src/components/CategoryGlyph.tsx): a built-in name as an icon in the given colour, an emoji as text at 1.1 times the icon's size, never scaled by the phone's font size and hidden from screen readers (it is decoration; the name carries the meaning). It is used by `CategoryIcon` (rows, tiles, pickers, budgets, recurring, Tidy up), and by the cards that drew an icon themselves: `DraftCard`, `BudgetHero`, `EntryHero`, `PlanSummaryRow`, Plan's budget tiles and `Chip`. The Quick Add widget draws an emoji as text in the system font (the widget's icon font has no emoji and would draw a dot): `WidgetIcon`.

Not category icons, and unchanged: account, loan, goal and settings icons (built-in names only), Excel and PDF exports (they use a category's name and colour, never its icon), notifications (text only).

## Checked

- `categoryIcon.test.ts`: 64 cases for the rules (the emoji kinds above accepted; letters, digits, doubles, lone modifiers and joiners, too long, and a built-in name rejected as an emoji).
- `db/categoryIcon.test.ts`, on real SQLite: an emoji, a built-in name, a name the picker no longer lists and a family emoji are stored exactly; invalid values are stored as `tag`; rename, colour change, archive, restore, and delete with undo (parent and subcategory) keep the emoji; the **file backup** (the pretty-printed JSON the app shares) and the **folder backup** (written and read through the same code, with Android's storage in memory) restore every icon on a fresh phone and over a phone that already has other data; a backup from before emoji restores with its old icon names; damaged icons (a number, empty, words, two emoji, markup, 5,000 characters, null) become `tag` while the rest of the file restores; the format version and the columns are unchanged. Three of these fail without the validation.
- The randomized integrity test now gives its categories every icon shape and checks, for every seed (60 run here), that each icon is a built-in name or one emoji after edits, undo and the backup round trip.
- `AddCategoryModal.test.tsx`: fifteen icons and no browse list; the emoji field, its two kinds of error, held Save, clearing, switching back to an icon and re-picking the typed emoji; editing a category that has an emoji, one with an icon outside the fifteen (still on offer, can be switched back to), one on the list (no extra tile) and a damaged one.
- `CategoryGlyph.test.tsx` and `CategoryGlyphEverywhere.test.tsx`: the glyph, and every surface above drawing an emoji as text and a built-in name as an icon (six of the twelve fail without the shared component).
- `widgets.test.ts`: Quick Add draws an emoji as plain text with no custom font, and a built-in name as the icon font's glyph.

## Not checked, and why

- **Any phone.** How an emoji looks differs by brand (Samsung, Google and Xiaomi each draw their own), and a very new emoji can show as an empty box on an old Android version. The backup holds the emoji itself, so restoring onto a newer phone shows it properly. Worth a look on a Samsung, a Pixel and an older phone before release, including how the emoji sits in its tile (Android adds text padding; `includeFontPadding` is off).
- **The home-screen widget** is built by a native layer outside React; the test checks what it is asked to draw, not what the phone draws.
- **An older app version reading a newer backup.** The format is still 6, so an older version restores an emoji into the icon column and draws a blank icon for that category until it is updated.
- **Expo's v58 documentation** could not be fetched (the session cannot reach docs.expo.dev); the one library API used (the icon font's names) was read from the installed `@expo/vector-icons`.

## Design

The picker differs from the first mock-up in one way: the "Your own" tile became a full-width row below the grid. Sixteen tiles do not fill rows of six (the editor's column count), and a labelled row says what it is. The mock-up canvas is not updated.
