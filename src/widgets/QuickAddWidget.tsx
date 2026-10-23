import { FlexWidget, TextWidget, IconWidget, type ColorProp } from 'react-native-android-widget';
import { WidgetShell, WidgetIcon, iconGlyph } from './WidgetShell';
import { widgetColor, widgetAlpha, widgetInk, WIDGET_FONT } from './widgetTheme';
import type { QuickAddWidgetData } from './data';

/**
 * "Quick Add" 2×2 widget: a dark theme-ink "Add expense" action, your four most-used expense categories
 * (each opens Add with it picked), then Income and Move. All are deep links into `add-transaction`.
 */
export function QuickAddWidget({ primary, categories }: QuickAddWidgetData) {
  const ink = widgetInk(primary);
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
          height: 38,
          borderRadius: 19,
          backgroundColor: ink,
        }}
      >
        <FlexWidget
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: widgetAlpha(widgetColor.white, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconWidget
            icon={iconGlyph('plus')}
            font={WIDGET_FONT.icons}
            size={13}
            style={{ color: widgetColor.cream }}
          />
        </FlexWidget>
        <TextWidget
          text="Add expense"
          style={{ fontFamily: WIDGET_FONT.rounded, fontSize: 13, color: widgetColor.cream, marginLeft: 7 }}
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
                  width: 'match_parent',
                  textAlign: 'center',
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
          color={ink}
          background={widgetColor.tray}
          uri="yume://add-transaction?type=income"
        />
        <FlexWidget style={{ width: 6, height: 1 }} />
        <SmallAction
          label="Move"
          icon="swap-horizontal"
          color={ink}
          background={widgetColor.tray}
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
        borderRadius: 14,
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
