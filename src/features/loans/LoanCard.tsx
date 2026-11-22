import { View, Pressable, Animated, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { weekdayDayMonthMaybeYear } from '@/lib/dateLabels';
import { payoffFraction } from '@/lib/loan';
import { roundedMinor } from '@/lib/round';
import { Loan } from '@/types';
import { usePressScale } from '@/hooks/usePressScale';
import { GrowFill } from '@/components/GrowFill';
import { CountUpAmount } from '@/components/CountUpAmount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { payoffMonthShort } from '@/lib/loanPayoff';
import type { LoanProgress } from '@/db/loans';
import { loanBarTone, loanGlyph, loanIcon, loanTint } from './loanIdentity';
import { flatSection } from '@/components/screenStyles';
import { DUE_SOON_DAYS } from '@/lib/dueDate';
import { daysUntilIsoDate, toLocalIsoDate } from '@/lib/date';

import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { themedStyles } from '@/theme/themedStyles';

/**
 * One loan in the list: flat card with its pale tile, progress and debt-free month; open loans end with the
 * next EMI and a Pay pill to its pay sheet. A closed loan is the same card in grey, "Paid off", no footer.
 */
export function LoanCard({
  loan,
  hue,
  progress,
  fadeStyle,
  onPress,
  onPay,
  compact = false,
  divider = false,
  nextPayment = false,
}: {
  loan: Loan;
  /** The loan's identity colour (loanHues). */
  hue: string;
  /** This loan's row from getLoanProgress: EMIs paid, next EMI, last EMI. */
  progress?: LoanProgress;
  fadeStyle?: React.ComponentProps<typeof Animated.View>['style'];
  onPress: () => void;
  /** Opens this loan's pay sheet for its next EMI. */
  onPay: () => void;
  compact?: boolean;
  divider?: boolean;
  nextPayment?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const isClosed = loan.status === 'closed';
  const isBorrowed = loan.direction === 'borrowed';
  const fraction = isClosed ? 1 : payoffFraction(loan.principalMinor, loan.outstandingPrincipalMinor);
  const lastDueDate = progress?.lastDueDate;
  const nextDueDate = progress ? progress.nextDueDate : loan.nextDueDate;
  const nextEmiMinor = progress?.nextEmiMinor ?? loan.emiAmountMinor;
  const dueSoon = !!nextDueDate && daysUntilIsoDate(nextDueDate) <= DUE_SOON_DAYS;
  // A late EMI says so, as it does everywhere else (Home, Plan, the widget), instead of showing only a past date.
  const lateDays =
    nextDueDate && nextDueDate < toLocalIsoDate(new Date()) ? -daysUntilIsoDate(nextDueDate) : 0;
  const nextWhen =
    nextDueDate && lateDays > 0
      ? `Overdue by ${lateDays} ${lateDays === 1 ? 'day' : 'days'}`
      : nextDueDate
        ? weekdayDayMonthMaybeYear(nextDueDate)
        : '';
  const repaidLine = progress
    ? `${progress.paidCount} of ${progress.totalCount} ${progress.totalCount === 1 ? 'EMI' : 'EMIs'}`
    : null;

  const payment = !isClosed && nextDueDate && (
    <View
      style={[
        styles.footer,
        compact && styles.compactFooter,
        compact && nextPayment && styles.priorityFooter,
        !compact && dueSoon && styles.footerDue,
      ]}
    >
      {compact && !nextPayment ? (
        <Text style={[styles.compactDate, styles.compactLine, lateDays > 0 && styles.late]} numberOfLines={1}>
          {`EMI ${formatMoney(nextEmiMinor)} · ${nextWhen}`}
        </Text>
      ) : compact ? (
        <>
          <View style={styles.compactDue}>
            <Text style={[styles.nextLabel, styles.priorityLabel]}>Next payment</Text>
            <Text style={[styles.compactDate, lateDays > 0 && styles.late]}>{nextWhen}</Text>
          </View>
          <Text style={[styles.compactEmi, styles.priorityAmount]}>{formatMoney(nextEmiMinor)}</Text>
        </>
      ) : (
        <View style={styles.footerText}>
          <Text style={styles.nextLine}>
            <Text style={[styles.nextLabel, dueSoon && styles.nextLabelDue]}>Next EMI · </Text>
            {nextWhen} · <Text style={styles.nextAmount}>{formatMoney(nextEmiMinor)}</Text>
          </Text>
        </View>
      )}
      <Pressable
        onPress={(event) => {
          event?.stopPropagation();
          onPay();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${isBorrowed ? 'Pay' : 'Mark received'} next EMI for ${loan.counterparty}`}
        accessibilityHint={compact ? `${formatMoney(nextEmiMinor)}, ${nextWhen}` : undefined}
        hitSlop={compact ? 12 : 8}
        style={({ pressed }) => [
          styles.pill,
          compact ? styles.compactPay : { backgroundColor: ink },
          pressed && styles.pillPressed,
        ]}
      >
        <Text
          style={[
            styles.pillText,
            compact && styles.compactPayText,
            compact && nextPayment && styles.priorityPay,
          ]}
        >
          {isBorrowed ? 'Pay' : 'Received'}
        </Text>
      </Pressable>
    </View>
  );

  if (compact) {
    return (
      <View style={[styles.compactCard, divider && styles.compactDivider]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={
            isClosed
              ? `${loan.counterparty}, paid off`
              : `${loan.counterparty}, ${formatMoney(roundedMinor(loan.outstandingPrincipalMinor))} ${isBorrowed ? 'remaining' : 'still to receive'}`
          }
          accessibilityHint="Opens loan details"
          style={withPressed(styles.compactDetails)}
        >
          <View style={[styles.icon, { backgroundColor: loanTint(hue) }]}>
            <MaterialCommunityIcons name={loanIcon(loan) as McIconName} size={16} color={loanGlyph(hue)} />
          </View>
          <View style={[styles.headText, styles.compactCopy]}>
            <Text style={styles.name}>{loan.counterparty}</Text>
            <Text style={styles.sub}>
              {isClosed
                ? 'Paid off'
                : repaidLine
                  ? `${repaidLine} paid`
                  : isBorrowed
                    ? 'Principal remaining'
                    : 'Still to receive'}
              {!isClosed && lastDueDate ? ` · ${payoffMonthShort(lastDueDate)}` : ''}
            </Text>
          </View>
          {!isClosed && (
            <CountUpAmount
              minor={roundedMinor(loan.outstandingPrincipalMinor)}
              style={styles.compactAmount}
            />
          )}
        </Pressable>
        {!isClosed && (
          <View
            style={styles.compactTrack}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={[
                styles.compactFill,
                { width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, backgroundColor: loanBarTone(hue) },
              ]}
            />
          </View>
        )}
        {payment}
      </View>
    );
  }

  return (
    <Animated.View style={fadeStyle}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          style={styles.card}
        >
          <View style={styles.head}>
            <View
              style={[styles.icon, { backgroundColor: isClosed ? theme.colors.surfaceAlt : loanTint(hue) }]}
            >
              <MaterialCommunityIcons
                name={loanIcon(loan) as McIconName}
                size={18}
                color={isClosed ? theme.colors.textMuted : loanGlyph(hue)}
              />
            </View>
            <View style={styles.headText}>
              <Text style={styles.name}>{loan.counterparty}</Text>
              <Text style={styles.sub}>
                {(loan.interestRateAnnualBp / 100).toFixed(2)}% ·{' '}
                {loan.rateType === 'floating' ? 'Floating' : 'Fixed'}
                {isBorrowed ? '' : ' · Lent'}
                {loan.status === 'defaulted' ? ' · Defaulted' : ''}
              </Text>
            </View>
          </View>
          <View style={styles.figs}>
            {isClosed ? (
              <Text style={styles.paidOff}>Paid off</Text>
            ) : (
              <>
                <Text style={styles.left}>{isBorrowed ? 'Principal remaining' : 'Still to receive'}</Text>
                <CountUpAmount
                  minor={roundedMinor(loan.outstandingPrincipalMinor)}
                  style={styles.outstanding}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
              </>
            )}
          </View>

          <View style={styles.track}>
            <GrowFill
              animKey={`loan:${loan.id}`}
              pct={fraction * 100}
              style={[styles.fill, { backgroundColor: isClosed ? theme.colors.textMuted : theme.colors.ink }]}
            />
          </View>
          <View style={styles.caption}>
            <Text style={styles.captionText}>
              <Text style={styles.captionBold}>{formatRatioPct(fraction)}</Text> repaid
              {repaidLine ? ` · ${repaidLine}` : ''}
            </Text>
            {!isClosed && lastDueDate ? (
              <Text style={styles.captionText}>
                {isBorrowed ? 'Debt-free' : 'Repaid'} {payoffMonthShort(lastDueDate)}
              </Text>
            ) : !isClosed && progress ? (
              <Text style={styles.captionText}>Payoff date unavailable</Text>
            ) : null}
          </View>

          {payment}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    // Flat supporting surface; identity colour is confined to the icon and progress.
    card: { ...flatSection(), marginHorizontal: 2, marginBottom: 12, padding: 14 },
    compactCard: {
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 4,
    },
    compactDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
    compactFooter: { marginTop: 0, paddingTop: 0, borderTopWidth: 0, gap: 6 },
    priorityFooter: {
      marginTop: 4,
      marginBottom: 4,
      paddingStart: 10,
      paddingEnd: 4,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.colors.home.control,
    },
    // How much of the loan is repaid, under the name: indented to sit beneath the text, past the icon.
    compactTrack: {
      height: 4,
      borderRadius: 2,
      marginStart: 42,
      marginBottom: 6,
      backgroundColor: theme.colors.inkHairline,
      overflow: 'hidden',
    },
    compactFill: { height: '100%', borderRadius: 2 },
    compactDue: { flex: 1, minWidth: 88, gap: 2 },
    compactLine: { flex: 1, minWidth: 0 },
    compactDate: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
    priorityLabel: { fontFamily: theme.font.bodyMedium, color: theme.colors.link },
    compactEmi: {
      flexShrink: 1,
      fontFamily: theme.font.bodyMedium,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
      textAlign: 'right',
    },
    late: { color: theme.colors.expenseText },
    priorityAmount: { fontFamily: theme.font.bodyBold, fontSize: 15 },
    compactPay: {
      backgroundColor: 'transparent',
      minWidth: 44,
      minHeight: 34,
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    compactPayText: {
      color: theme.colors.link,
      backgroundColor: theme.colors.home.control,
      borderRadius: 12,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },
    priorityPay: { backgroundColor: theme.colors.home.selected },
    compactDetails: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    compactCopy: { flexBasis: 110 },
    compactAmount: {
      fontFamily: theme.font.bodyBold,
      fontSize: 15,
      lineHeight: 20,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headText: { flex: 1, minWidth: 0 },
    name: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
    sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    figs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 6,
    },
    outstanding: {
      fontFamily: theme.font.bodyBold,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    left: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
    paidOff: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.incomeText },
    track: {
      height: 5,
      borderRadius: 4,
      backgroundColor: theme.colors.inkHairline,
      marginTop: 8,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 4 },
    caption: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 6,
      marginTop: 6,
    },
    captionText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, flexShrink: 1 },
    captionBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
    // A separated payment row instead of a second card inside the loan.
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.borderSoft,
    },
    footerDue: { paddingBottom: 6 },
    footerText: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
    nextLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.dueInk },
    nextLabelDue: { fontFamily: theme.font.bodyBold },
    nextLine: {
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      color: theme.colors.textPrimary,
      marginTop: 2,
    },
    nextAmount: { fontFamily: theme.font.bodyBold, fontVariant: ['tabular-nums'] },
    pill: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.action,
    },
    pillPressed: { opacity: theme.opacity.pressed },
    pillText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.onInk },
  })
);
