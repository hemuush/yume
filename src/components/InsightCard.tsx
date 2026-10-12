import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Text';
import { theme } from '@/constants/theme';

/** Compact financial summaries using the app's existing surfaces and typography. */
export function InsightHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}) {
  return (
    <View style={insight.header}>
      <View style={insight.icon}>
        <Feather name={icon} size={18} color={theme.colors.textPrimary} />
      </View>
      <View style={insight.main}>
        <Text style={insight.title}>{title}</Text>
        {subtitle && <Text style={insight.caption}>{subtitle}</Text>}
      </View>
    </View>
  );
}
export function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={insight.stat}>
      <Text style={insight.caption}>{label}</Text>
      <Text style={insight.value}>{value}</Text>
    </View>
  );
}
export function InsightRow({
  label,
  value,
  detail,
  onPress,
}: {
  label: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={insight.main}>
        <Text style={insight.label}>{label}</Text>
        {detail && <Text style={insight.caption}>{detail}</Text>}
      </View>
      {value && <Text style={insight.rowValue}>{value}</Text>}
      {onPress && <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, detail, value].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [insight.row, pressed && { opacity: 0.65 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={insight.row}>{content}</View>
  );
}
export function InsightDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen((v) => !v)}
        style={insight.disclosure}
      >
        <Text style={insight.link}>{title}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textSecondary} />
      </Pressable>
      {open && <View style={insight.content}>{children}</View>}
    </View>
  );
}
export const insight = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceAlt,
    marginVertical: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 16, color: theme.colors.textPrimary },
  caption: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexGrow: 1,
    flexBasis: 125,
    padding: 12,
    gap: 5,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  value: { fontFamily: theme.font.bodyMedium, fontSize: 22, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  rowValue: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary, flexShrink: 1 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
  },
  link: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 },
  content: { gap: 8, paddingBottom: 8 },
  result: { padding: 14, borderRadius: 18, backgroundColor: theme.colors.secondaryTint, gap: 10 },
  warning: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.expenseText,
  },
});
