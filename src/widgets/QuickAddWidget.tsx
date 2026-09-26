import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { WidgetShell } from './WidgetShell';
import { widgetColor, widgetRgba } from './widgetTheme';

/**
 * "Quick Add" — the 2×2 widget. Two rows, each a direct deep link into
 * `add-transaction` pre-set to Expense or Income (see `app/add-transaction.tsx`'s
 * own `type` query param), skipping the app's Home screen entirely. No
 * figure to glance at here, so — deliberately, per the Yume Night design
 * pass — it's the one widget with no DotGothic16 numeral at all: quiet,
 * calm typography instead of a hero number. Colour is spent only on the
 * small plus badge per row, never a filled button.
 */
export function QuickAddWidget() {
  return (
    <WidgetShell flexDirection="column">
      <ActionRow
        label="Expense"
        tint={widgetColor.expense}
        clickActionData={{ uri: 'yume://add-transaction?type=expense' }}
      />
      <FlexWidget style={{ height: 8, width: 'match_parent' }} />
      <ActionRow
        label="Income"
        tint={widgetColor.income}
        clickActionData={{ uri: 'yume://add-transaction?type=income' }}
      />
    </WidgetShell>
  );
}

function ActionRow({
  label,
  tint,
  clickActionData,
}: {
  label: string;
  tint: `#${string}`;
  clickActionData: { uri: string };
}) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={clickActionData}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: 'match_parent',
        height: 0,
        flex: 1,
        borderRadius: 16,
        backgroundColor: widgetRgba(18, 19, 15, 0.04),
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <FlexWidget
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget text="+" style={{ fontSize: 13, fontWeight: '700', color: widgetColor.white }} />
      </FlexWidget>
      <FlexWidget style={{ width: 9, height: 'match_parent' }} />
      <TextWidget text={label} style={{ fontSize: 12.5, fontWeight: '600', color: widgetColor.ink }} />
    </FlexWidget>
  );
}
