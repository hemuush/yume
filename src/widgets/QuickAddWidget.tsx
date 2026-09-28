import { FlexWidget, TextWidget, IconWidget, type ColorProp } from 'react-native-android-widget';
import { WidgetShell, WidgetIcon, iconGlyph } from './WidgetShell';
import { widgetColor, widgetAlpha, asWidgetColor, WIDGET_FONT } from './widgetTheme';
import type { QuickAddWidgetData } from './data';

/**
 * "Quick Add" — the 2×2 widget (the Home A widgets sign-off). One big "Add
 * expense" in the theme pack's colour, your four most-used expense
 * categories below it (each opens Add with that category already picked),
 * then Income and Move. Every part is a direct deep link into
 * `add-transaction`, skipping Home.
 */
export function QuickAddWidget({ primary, categories }: QuickAddWidgetData) {
  return (
    <WidgetShell padding={12}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'yume://add-transaction?type=expense' }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'match_parent',
          height: 36,
          borderRadius: 14,
          backgroundColor: asWidgetColor(primary),
        }}
      >
        <FlexWidget
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: widgetAlpha(widgetColor.white, 0.75),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconWidget
            icon={iconGlyph('plus')}
            font={WIDGET_FONT.icons}
            size={13}
            style={{ color: widgetColor.ink }}
          />
        </FlexWidget>
        <TextWidget
          text="Add expense"
          style={{ fontFamily: WIDGET_FONT.rounded, fontSize: 13.5, color: widgetColor.ink, marginLeft: 7 }}
        />
      </FlexWidget>

      <FlexWidget style={{ flex: 1, height: 0, width: 'match_parent' }} />
      {categories.length > 0 && (
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
          {categories.map((c) => (
            <FlexWidget
              key={c.id}
              clickAction="OPEN_URI"
              clickActionData={{
                uri: `yume://add-transaction?type=expense&categoryId=${encodeURIComponent(c.id)}`,
              }}
              style={{ flex: 1, width: 0, flexDirection: 'column', alignItems: 'center' }}
            >
              <WidgetIcon name={c.icon} background={widgetAlpha(c.color, 0.25)} size={28} />
              <TextWidget
                text={c.name}
                maxLines={1}
                truncate="END"
                style={{
                  fontFamily: WIDGET_FONT.body,
                  fontSize: 9,
                  color: widgetColor.inkSoft,
                  marginTop: 3,
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
      <FlexWidget style={{ flex: 1, height: 0, width: 'match_parent' }} />

      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
        <SmallAction
          label="Income"
          icon="plus"
          color={widgetColor.income}
          background={widgetColor.idSage}
          uri="yume://add-transaction?type=income"
        />
        <FlexWidget style={{ width: 6, height: 1 }} />
        <SmallAction
          label="Move"
          icon="swap-horizontal"
          color={widgetColor.ink}
          background={widgetColor.surfaceAlt}
          uri="yume://add-transaction?type=transfer"
        />
      </FlexWidget>
    </WidgetShell>
  );
}

function SmallAction({
  label,
  icon,
  color,
  background,
  uri,
}: {
  label: string;
  icon: string;
  color: ColorProp;
  background: ColorProp;
  uri: string;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flex: 1,
        width: 0,
        height: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: background,
      }}
    >
      <IconWidget icon={iconGlyph(icon)} font={WIDGET_FONT.icons} size={12} style={{ color }} />
      <TextWidget
        text={label}
        style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 11, color, marginLeft: 4 }}
      />
    </FlexWidget>
  );
}
