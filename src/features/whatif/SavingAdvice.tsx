import { StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { themedStyles } from '@/theme/themedStyles';
import type { AdviceTone, SavingAdvice } from '@/lib/savingAdvice';

const ICON: Record<AdviceTone, React.ComponentProps<typeof Feather>['name']> = {
  good: 'check-circle',
  warn: 'alert-triangle',
  bad: 'alert-circle',
  info: 'target',
};
const inkFor = (tone: AdviceTone) =>
  ({
    good: theme.colors.incomeText,
    warn: theme.colors.warnInk,
    bad: theme.colors.expenseText,
    info: theme.colors.textSecondary,
  })[tone];

/** Advice drawn from the person’s own averages: one icon disc, a bold line and a short why, per point. */
export function SavingAdviceList({ advice }: { advice: SavingAdvice[] }) {
  return (
    <View style={s.card}>
      {advice.map((a, i) => (
        <View key={a.key} style={[s.row, i > 0 && s.divider]}>
          <View style={s.disc}>
            <Feather name={ICON[a.tone]} size={16} color={inkFor(a.tone)} />
          </View>
          <View style={s.copy}>
            <Text style={s.title}>{a.title}</Text>
            <Text style={s.body}>{a.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = themedStyles(() =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', gap: 12, padding: 12 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
    disc: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.home.control,
    },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    title: { fontFamily: theme.font.bodyBold, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
    body: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  })
);
