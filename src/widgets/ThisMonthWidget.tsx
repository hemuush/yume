import {
  FlexWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type ColorProp,
} from 'react-native-android-widget';
import { formatMoney } from '@/lib/money';
import { heroPct, heroRestingMode, heroShare } from '@/features/home/heroSlices';
import { WidgetShell, WidgetTitle, WidgetLabel } from './WidgetShell';
import { widgetColor, widgetTint, asWidgetColor, WIDGET_FONT } from './widgetTheme';
import { ringSvg } from './ringSvg';
import type { ThisMonthWidgetData } from './data';

const RING = 92;

/**
 * "This Month" 4×2 widget, Home's month card in small: the month ring with the kept share on its face,
 * three figures as tinted tiles, and Home's pace line. Taps open the app.
 */
export function ThisMonthWidget(data: ThisMonthWidgetData) {
  const {
    monthLabel,
    daysLeft,
    spentMinor,
    savedMinor,
    hideSavings,
    freeMinor,
    slices,
    pace,
    primary,
    secondary,
  } = data;
  const over = slices.overMinor > 0;
  const mode = heroRestingMode(slices, hideSavings);
  const big = !slices.hasIncome ? '—' : over ? 'Over' : heroPct(heroShare(slices, mode));
  const label = !slices.hasIncome ? 'no income' : over ? `by ${formatMoney(slices.overMinor)}` : mode;
  const svg = ringSvg(
    slices,
    {
      spent: widgetColor.spentSoft,
      saved: secondary,
      free: primary,
      track: widgetColor.surfaceAlt,
      face: widgetColor.moonFace,
    },
    RING
  );
  return (
    <WidgetShell clickAction="OPEN_APP">
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <WidgetTitle text={monthLabel} />
        <WidgetLabel
          text={daysLeft === 0 ? 'Last day' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
        />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 8 }}>
        <OverlapWidget style={{ width: RING, height: RING }}>
          <SvgWidget svg={svg} style={{ width: RING, height: RING }} />
          <FlexWidget
            style={{
              width: RING,
              height: RING,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <TextWidget
              text={big}
              maxLines={1}
              style={{
                fontFamily: WIDGET_FONT.rounded,
                fontSize: big.length > 4 ? 18 : 22,
                color: widgetColor.ink,
              }}
            />
            <TextWidget
              text={label.toUpperCase()}
              maxLines={1}
              style={{
                fontFamily: WIDGET_FONT.bodyMedium,
                fontSize: 7.5,
                letterSpacing: 0.6,
                color: widgetColor.inkSoft,
                marginTop: 1,
              }}
            />
          </FlexWidget>
        </OverlapWidget>
        <FlexWidget style={{ width: 12, height: 1 }} />
        <FlexWidget style={{ flex: 1, width: 0, flexDirection: 'column' }}>
          <Tile
            label="Spent"
            dot={widgetColor.spentSoft}
            tint={widgetColor.idCoral}
            value={formatMoney(spentMinor)}
          />
          {!hideSavings && (
            <Tile
              label="Saved"
              dot={asWidgetColor(secondary)}
              tint={widgetTint(secondary)}
              value={formatMoney(savedMinor)}
              gap
            />
          )}
          <Tile
            label="Free"
            dot={asWidgetColor(primary)}
            tint={widgetTint(primary)}
            value={formatMoney(freeMinor)}
            gap
          />
          {pace ? (
            <TextWidget
              text={`On pace for about ${formatMoney(Math.round(pace.projectedMinor / 10000) * 10000)} by ${pace.byLabel}`}
              maxLines={1}
              truncate="END"
              style={{ fontFamily: WIDGET_FONT.body, fontSize: 10, color: widgetColor.inkSoft, marginTop: 6 }}
            />
          ) : !slices.hasIncome ? (
            <TextWidget
              text="Add income to see what you keep"
              maxLines={1}
              style={{ fontFamily: WIDGET_FONT.body, fontSize: 10, color: widgetColor.inkSoft, marginTop: 6 }}
            />
          ) : null}
        </FlexWidget>
      </FlexWidget>
    </WidgetShell>
  );
}

function Tile({
  label,
  dot,
  tint,
  value,
  gap = false,
}: {
  label: string;
  dot: ColorProp;
  tint: ColorProp;
  value: string;
  gap?: boolean;
}) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: 'match_parent',
        backgroundColor: tint,
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 5,
        marginTop: gap ? 4 : 0,
      }}
    >
      <FlexWidget style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dot }} />
      <TextWidget
        text={label}
        style={{
          fontFamily: WIDGET_FONT.bodyMedium,
          fontSize: 11,
          color: widgetColor.inkSoft,
          marginLeft: 6,
        }}
      />
      <FlexWidget style={{ flex: 1, width: 0, height: 1 }} />
      <TextWidget
        text={value}
        maxLines={1}
        style={{ fontFamily: WIDGET_FONT.mono, fontSize: 11.5, color: widgetColor.ink }}
      />
    </FlexWidget>
  );
}
