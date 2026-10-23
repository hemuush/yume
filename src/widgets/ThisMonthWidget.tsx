import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { formatMoney } from '@/lib/money';
import { WidgetShell, WidgetLabel } from './WidgetShell';
import { widgetColor, widgetTint, WIDGET_FONT } from './widgetTheme';
import type { ThisMonthWidgetData } from './data';

/** Home's free-balance headline and proportional month line, sized for a 4×2 widget. */
export function ThisMonthWidget({
  monthLabel,
  daysLeft,
  spentMinor,
  savedMinor,
  hideSavings,
  freeMinor,
  dueMinor,
  slices,
  pace,
  primary,
}: ThisMonthWidgetData) {
  const over = slices.overMinor > 0;
  const label = over
    ? 'Over by'
    : freeMinor < 0
      ? dueMinor > 0
        ? 'Short after bills'
        : 'Short by'
      : dueMinor > 0
        ? 'Free after bills'
        : 'Free to use';
  // Android consumes weights via getInt; scale shares so positive segments never truncate to zero.
  const parts = [
    { key: 'spent', share: slices.spent, color: widgetColor.slice.spent },
    { key: 'saved', share: hideSavings ? 0 : slices.saved, color: widgetColor.slice.saved },
    { key: 'due', share: slices.due ?? 0, color: widgetColor.slice.due },
    { key: 'free', share: slices.free, color: widgetColor.slice.free },
  ].filter((p) => p.share > 0);
  return (
    <WidgetShell
      clickAction="OPEN_APP"
      justifyContent="space-between"
      backgroundColor={widgetTint(primary, 98)}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: 'match_parent',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text={label}
          style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 12, color: widgetColor.inkSoft }}
        />
        <WidgetLabel text={monthLabel} />
      </FlexWidget>
      <TextWidget
        text={slices.hasIncome ? formatMoney(over ? slices.overMinor : Math.abs(freeMinor)) : '—'}
        maxLines={1}
        style={{
          width: 'match_parent',
          fontFamily: WIDGET_FONT.body,
          fontSize: 30,
          adjustsFontSizeToFit: true,
          color: over || freeMinor < 0 ? widgetColor.expenseText : widgetColor.ink,
        }}
      />
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 7,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: widgetColor.surfaceAlt,
        }}
      >
        {parts.map((p) => (
          <FlexWidget
            key={p.key}
            style={{
              width: 0,
              flex: Math.max(1, Math.round(p.share * 10000)),
              height: 7,
              backgroundColor: p.color,
            }}
          />
        ))}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 6 }}>
        <Figure label="Spent" value={formatMoney(spentMinor)} color={widgetColor.slice.spent} />
        {!hideSavings && (
          <Figure label="Saved" value={formatMoney(savedMinor)} color={widgetColor.slice.saved} />
        )}
        {dueMinor > 0 && (
          <Figure label="Bills left" value={formatMoney(dueMinor)} color={widgetColor.slice.due} />
        )}
      </FlexWidget>
      <TextWidget
        text={
          !slices.hasIncome
            ? 'Add income to see what is free'
            : pace
              ? `Pace ${formatMoney(Math.round(pace.projectedMinor / 10000) * 10000)} by ${pace.byLabel}`
              : daysLeft === 0
                ? 'Last day of the month'
                : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left this month`
        }
        maxLines={1}
        truncate="END"
        style={{ fontFamily: WIDGET_FONT.body, fontSize: 10, color: widgetColor.textMuted, marginTop: 6 }}
      />
    </WidgetShell>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color: ColorProp }) {
  return (
    <FlexWidget style={{ flex: 1, width: 0, flexDirection: 'column' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget
          style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginRight: 4 }}
        />
        <TextWidget
          text={label}
          style={{ fontFamily: WIDGET_FONT.body, fontSize: 10, color: widgetColor.inkSoft }}
        />
      </FlexWidget>
      <TextWidget
        text={value}
        maxLines={1}
        style={{
          width: 'match_parent',
          fontFamily: WIDGET_FONT.amount,
          fontSize: 12,
          adjustsFontSizeToFit: true,
          color: widgetColor.ink,
          marginTop: 2,
        }}
      />
    </FlexWidget>
  );
}
