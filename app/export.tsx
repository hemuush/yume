import { useCallback, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { SkyHeader } from '@/features/home/SkyHeader';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { showAlert } from '@/components/AppDialog';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { useAppLock } from '@/lib/AppLockContext';
import { authenticate } from '@/lib/appLock';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { errorMessage } from '@/lib/errorMessage';
import { toLocalIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { shareTempFile } from '@/lib/shareTempFile';
import { generateExportWorkbookBytes } from '@/lib/exportExcel';
import { generateReportPdf } from '@/lib/exportPdf';
import { ReportPeriod, periodFileStem, periodLabel } from '@/lib/report/period';
import { getDefaultCurrency } from '@/db/settings';
import { EntryMonth, listEntryMonths } from '@/db/exportSummary';
import { openPeriod, previewFor, stepPeriod } from '@/features/export/exportChoice';
import { withPressed } from '@/lib/pressed';

type Format = 'pdf' | 'excel';

/**
 * Backup & restore › Reports & exports: one month, one year or everything, as a themed PDF report or an
 * Excel workbook. Built on the phone from the local database and handed to the share sheet; nothing is sent.
 */
export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary, dot } = useAccent();
  const { lockEnabled } = useAppLock();
  const [months, setMonths] = useState<EntryMonth[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [format, setFormat] = useState<Format>('pdf');
  const [busy, setBusy] = useState(false);
  const today = toLocalIsoDate(new Date());

  const load = useCallback(async () => {
    const cur = await getDefaultCurrency();
    const list = await listEntryMonths(cur);
    setCurrency(cur);
    setMonths(list);
    // Keep a still-valid choice across reloads; otherwise open on the latest month.
    setPeriod((old) =>
      old && (old.kind === 'all' || previewFor(list, old).count > 0)
        ? old
        : openPeriod(list, old?.kind ?? 'month', today)
    );
  }, [today]);
  const { loaded, hasData, loadError, reload } = useScreenLoad(load);

  const preview = useMemo(
    () => (period ? previewFor(months, period) : { count: 0, spentMinor: 0 }),
    [months, period]
  );
  const older = period ? stepPeriod(months, period, -1) : null;
  const newer = period ? stepPeriod(months, period, 1) : null;

  const create = useSaveOnce(async () => {
    if (!period) return;
    setBusy(true);
    try {
      // An export is the whole of someone's finances in plain text: with app lock on, the phone's unlock first.
      if (lockEnabled && !(await authenticate().catch(() => false))) return;
      const stem = periodFileStem(period);
      if (format === 'pdf') {
        const { bytes } = await generateReportPdf(period, { primary: accent, secondary, dot });
        await shareTempFile(`${stem}-report.pdf`, bytes, {
          mimeType: 'application/pdf',
          dialogTitle: `Yume report · ${periodLabel(period)}`,
        });
      } else {
        const bytes = await generateExportWorkbookBytes(period);
        await shareTempFile(`${stem}.xlsx`, bytes, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Yume export · ${periodLabel(period)}`,
        });
      }
    } catch (e) {
      showAlert("Couldn't create the export", errorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  if (loadError && !hasData) {
    return <ScreenLoadError title="Export" message={loadError} onRetry={() => void reload()} />;
  }

  const kind = period?.kind ?? 'month';
  const empty = loaded && months.length === 0;
  const title = period ? periodLabel(period) : '';
  const stepper = (dir: -1 | 1, to: ReportPeriod | null) => (
    <Pressable
      onPress={() => to && setPeriod(to)}
      disabled={!to}
      accessibilityRole="button"
      accessibilityLabel={dir === -1 ? 'Earlier' : 'Later'}
      accessibilityState={{ disabled: !to }}
      hitSlop={8}
      style={withPressed([styles.step, !to && styles.stepOff])}
    >
      <Feather
        name={dir === -1 ? 'chevron-left' : 'chevron-right'}
        size={20}
        color={theme.colors.textPrimary}
      />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + theme.layout.screenTopGap,
            paddingBottom: theme.layout.screenScrollPad + insets.bottom,
          },
        ]}
      >
        {loadError && (
          <ScreenLoadError title="Export" message={loadError} onRetry={() => void reload()} embedded />
        )}
        <Glass radius={28} tone="strong" style={styles.card}>
          <Text style={styles.label}>Period</Text>
          <SegmentedControl
            options={[
              { label: 'Month', value: 'month' },
              { label: 'Year', value: 'year' },
              { label: 'All time', value: 'all' },
            ]}
            value={kind}
            onChange={(next) => setPeriod(openPeriod(months, next, today))}
            disabled={busy || empty}
          />
          {period?.kind !== 'all' ? (
            <View style={styles.stepper}>
              {stepper(-1, older)}
              <Text style={styles.period} accessibilityLiveRegion="polite">
                {title}
              </Text>
              {stepper(1, newer)}
            </View>
          ) : (
            <Text style={styles.period}>Everything you have recorded</Text>
          )}
          <Text style={styles.preview}>
            {empty
              ? 'There are no entries to export yet.'
              : `${preview.count.toLocaleString('en-US')} ${preview.count === 1 ? 'entry' : 'entries'} · ${formatMoney(preview.spentMinor, currency)} spent`}
          </Text>
        </Glass>

        <Glass radius={28} tone="strong" style={styles.card}>
          <Text style={styles.label}>Format</Text>
          <SegmentedControl
            options={[
              { label: 'PDF report', value: 'pdf' },
              { label: 'Excel', value: 'excel' },
            ]}
            value={format}
            onChange={setFormat}
            disabled={busy}
          />
          <Text style={styles.hint}>
            {format === 'pdf'
              ? 'A4 pages in your theme: totals, where it went, charts, accounts and every entry day by day.'
              : 'A workbook you can sort and sum: transactions, accounts, categories, months, loans and people.'}
          </Text>
        </Glass>

        <PrimaryButton
          title={format === 'pdf' ? 'Create PDF' : 'Create Excel file'}
          loading={busy}
          disabled={busy || empty || preview.count === 0}
          onPress={() => void create()}
        />
        <Text style={styles.foot}>
          Made on this phone and handed to the share sheet; nothing is uploaded. For a copy you can restore
          into Yume, use the full backup on Backup &amp; restore.
        </Text>
      </ReanimatedAnimated.ScrollView>
      <SkyHeader collapse={collapse} title="Reports & exports" showBack hideUser wallpaper />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, gap: 12 },
  card: { padding: 14, gap: 12 },
  label: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  stepOff: { opacity: 0.35 },
  period: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.roundedBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  preview: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  foot: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
