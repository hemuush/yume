import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Appear } from '@/components/Appear';
import { LoadFade } from '@/components/LoadFade';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecurringHero } from '@/features/recurring/RecurringHero';
import { RecurringSheets } from '@/features/recurring/RecurringSheets';
import { RuleListItem } from '@/features/recurring/RuleListItem';
import { SuggestionsList } from '@/features/recurring/SuggestionsList';
import { SectionHead } from '@/features/recurring/SectionHead';
import { createRecurringSheets } from '@/features/recurring/recurringSheetsStore';
import { useRecurringData } from '@/features/recurring/useRecurringData';
import { useRecurringModel } from '@/features/recurring/useRecurringModel';
import { useRuleActions } from '@/features/recurring/useRuleActions';
import { ListCard } from '@/components/SummaryCard';
import { SummarySkeleton } from '@/components/ListSkeleton';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { styles } from '@/features/recurring/recurring.styles';
import { Skeleton } from '@/components/Skeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { usePrivacy } from '@/theme/PrivacyContext';
import { parentNameOf } from '@/lib/categoryLabel';

// The hero and the suggestions compare their props by identity: they are drawn again only when what they show changes.
const Hero = memo(RecurringHero);
const Suggestions = memo(SuggestionsList);

/**
 * Rent, subscriptions, salary: rules caught up on app open (runDueRecurringRules, src/db/recurring.ts, via
 * runAppMaintenance). This screen only edits/pauses rules; their entries show in Transactions.
 */
export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  // Which sheet is open is kept outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createRecurringSheets);
  const {
    rules,
    accounts,
    categories,
    suggestions,
    currency,
    today,
    // `loaded` keeps "Add an account first" (an `accounts.length === 0` check) from flashing on every cold open before
    // the DB has answered.
    loaded,
    hasData,
    loadError,
    reload: load,
    setRuleActive,
    dropSuggestion,
  } = useRecurringData();
  const { hideAmounts } = usePrivacy();
  const model = useRecurringModel({ rules, accounts, categories, currency, today }, hideAmounts);
  const { busyRuleIds, togglePause, hideSuggestion } = useRuleActions({
    reload: load,
    setRuleActive,
    dropSuggestion,
  });
  // A savings or investment charge (an SIP) shows its amount: left out while those are hidden.
  const shownSuggestions = useMemo(
    () => (hideAmounts ? suggestions.filter((s) => !s.isSensitive) : suggestions),
    [hideAmounts, suggestions]
  );
  const { activeRules, pausedRules, categoriesById, masked, investIds, accountName, accountCurrency } = model;

  const ruleRow = (rule: (typeof rules)[number], i: number, muted?: boolean) => (
    <RuleListItem
      key={rule.id}
      rule={rule}
      category={rule.categoryId ? categoriesById.get(rule.categoryId) : undefined}
      parentName={parentNameOf(rule.categoryId, categoriesById)}
      masked={masked.has(rule.id)}
      investIds={investIds}
      accountName={accountName}
      currency={accountCurrency(rule.accountId)}
      index={i}
      busy={busyRuleIds.has(rule.id)}
      muted={muted}
      onTogglePause={togglePause}
      onOpen={sheets.openRule}
    />
  );

  if (!hasData && loadError)
    return <ScreenLoadError title="Recurring" message={loadError} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          // No side padding: every block here (the cards, the headings, the notes) sits on the screen gutter
          // itself, as on every other screen. Padding the page as well put the cards at twice the gutter.
          // The first card brings the top gap itself (as on Budgets, Goals and Loans), so the page adds none.
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        <LoadFade loaded={loaded}>
          {loadError && (
            <Appear style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Couldn’t load recurring rules</Text>
              <Text style={styles.errorDetail}>{loadError}</Text>
              <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
            </Appear>
          )}
          {!loaded ? (
            <>
              <SummarySkeleton />
              <ListCard style={[styles.list, { marginTop: 16 }]}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonRow}>
                    <Skeleton width={34} height={34} radius={17} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width={140} height={13} radius={4} />
                      <Skeleton width={100} height={10} radius={4} />
                    </View>
                  </View>
                ))}
              </ListCard>
            </>
          ) : accounts.length === 0 ? (
            <EmptyState
              title="Add an account first"
              subtitle="A recurring entry needs an account to come out of, or go into."
            >
              <PrimaryButton title="Add an account" onPress={sheets.openAccountForm} />
            </EmptyState>
          ) : rules.length === 0 && suggestions.length === 0 ? (
            <EmptyState
              title="Nothing recurring yet"
              subtitle="Plan rent, subscriptions or salary so you can see what is coming."
            >
              <PrimaryButton title="Add a recurring entry" onPress={sheets.openAdd} />
            </EmptyState>
          ) : (
            <>
              {(activeRules.length > 0 || suggestions.length > 0) && (
                <Hero
                  totals={model.totals}
                  currency={currency}
                  hasOtherCurrencies={model.hasOtherCurrencies}
                  shares={model.shares}
                  nextDate={model.nextDate}
                  marks={model.marks}
                  today={model.todayIso}
                  onDatePress={sheets.openRunDate}
                />
              )}
              {activeRules.length > 0 && (
                <>
                  <SectionHead title="Running" note={activeRules.length > 1 ? 'Biggest first' : undefined} />
                  <ListCard style={styles.list}>{activeRules.map((rule, i) => ruleRow(rule, i))}</ListCard>
                  <Text style={styles.footnote}>
                    Due entries are added when you open Yume. Paused rules don’t create entries.
                  </Text>
                </>
              )}
              <Suggestions
                suggestions={shownSuggestions}
                onMakeRecurring={sheets.fromSuggestion}
                onHide={hideSuggestion}
              />
              {pausedRules.length > 0 && (
                <>
                  <SectionHead
                    title="Paused"
                    note={`${pausedRules.length} ${pausedRules.length === 1 ? 'rule' : 'rules'}`}
                  />
                  <ListCard style={styles.list}>
                    {pausedRules.map((rule, i) => ruleRow(rule, i, true))}
                  </ListCard>
                </>
              )}
            </>
          )}
        </LoadFade>
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          model.hasVisibleRules ? (
            <HeaderSummary
              figure={formatMoney(model.totals.monthlyMinor, currency)}
              rest="a month"
              dot={theme.colors.slice.free}
            />
          ) : undefined
        }
        title="Recurring"
        showBack
        hideUser
        wallpaper
        actions={<AddButton onPress={sheets.openAdd} disabled={accounts.length === 0} />}
      />
      <RecurringSheets
        sheets={sheets}
        accounts={accounts}
        categories={categories}
        categoriesById={categoriesById}
        activeRules={activeRules}
        masked={masked}
        investIds={investIds}
        accountName={accountName}
        todayIso={model.todayIso}
        busyRuleIds={busyRuleIds}
        onTogglePause={togglePause}
        reload={load}
      />
    </View>
  );
}
