import { useCallback, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
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
import { shareTempFile } from '@/lib/shareTempFile';
import { generateExportWorkbookBytes } from '@/lib/exportExcel';
import { generateReportPdf } from '@/lib/exportPdf';
import { ReportPeriod, periodFileStem, periodLabel } from '@/lib/report/period';
import { getDefaultCurrency } from '@/db/settings';
import { EntryMonth, listEntryMonths } from '@/db/exportSummary';
import { openPeriod, previewFor, stepPeriod } from '@/features/export/exportChoice';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';

type Format = 'pdf' | 'excel';

/**
 * Settings › Export: one month, one year or everything, as a themed PDF report or an
 * Excel workbook. Built on the phone from the local database and handed to the share sheet; nothing is sent.
 */
export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary, dot } = useAccent();
  const { lockEnabled } = useAppLock();
  const [months, setMonths] = useState<EntryMonth[]>([]);
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [format, setFormat] = useState<Format>('pdf');
  const [busy, setBusy] = useState(false);
  const today = toLocalIsoDate(new Date());

  const load = useCallback(async () => {
    const cur = await getDefaultCurrency();
    const list = await listEntryMonths(cur);
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
      onPress={() => !busy && to && setPeriod(to)}
      disabled={busy || !to}
      accessibilityRole="button"
      accessibilityLabel={dir === -1 ? 'Earlier' : 'Later'}
      accessibilityState={{ disabled: busy || !to }}
      hitSlop={8}
      style={withPressed([styles.step, (busy || !to) && styles.stepOff])}
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
        style={styles.scroll}
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + theme.layout.screenTopGap,
            paddingBottom: 24,
          },
        ]}
      >
        {loadError && (
          <ScreenLoadError title="Export" message={loadError} onRetry={() => void reload()} embedded />
        )}
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: shade(accent, 88) }]}>
            <Feather name="download" size={22} color={theme.colors.ink} />
          </View>
          <Text style={styles.introTitle}>Export your entries</Text>
          <Text style={styles.hint}>Create a report or spreadsheet in two steps.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>1. Choose a period</Text>
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
            {!loaded
              ? 'Loading entries…'
              : empty
                ? 'There are no entries to export yet.'
                : `${preview.count.toLocaleString('en-US')} ${preview.count === 1 ? 'entry' : 'entries'} included`}
          </Text>
        </View>

        <Text style={styles.label}>2. Choose a file type</Text>
        <View style={styles.formats} accessibilityRole="radiogroup">
          {(
            [
              { value: 'pdf', title: 'PDF report', hint: 'Ready to read, print or share', icon: 'file-text' },
              {
                value: 'excel',
                title: 'Excel spreadsheet',
                hint: 'Sort, filter and work with your numbers',
                icon: 'grid',
              },
            ] as const
          ).map((choice) => (
            <Pressable
              key={choice.value}
              onPress={() => setFormat(choice.value)}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityLabel={choice.title}
              accessibilityState={{
                checked: format === choice.value,
                selected: format === choice.value,
                disabled: busy,
              }}
              style={withPressed([
                styles.format,
                format === choice.value && {
                  borderColor: theme.colors.textSecondary,
                  backgroundColor: shade(accent, 94),
                },
              ])}
            >
              <View
                style={[
                  styles.formatIcon,
                  { backgroundColor: choice.value === 'pdf' ? theme.colors.idCoral : theme.colors.idTeal },
                ]}
              >
                <Feather name={choice.icon} size={22} color={theme.colors.ink} />
              </View>
              <View style={styles.formatText}>
                <Text style={styles.formatTitle}>{choice.title}</Text>
                <Text style={styles.hint}>{choice.hint}</Text>
              </View>
              <View style={[styles.radio, format === choice.value && styles.radioOn]}>
                {format === choice.value && <Feather name="check" size={13} color={theme.colors.surface} />}
              </View>
            </Pressable>
          ))}
        </View>
      </ReanimatedAnimated.ScrollView>
      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <PrimaryButton
          title={format === 'pdf' ? 'Create PDF' : 'Create Excel file'}
          loading={busy}
          disabled={busy || empty || preview.count === 0}
          onPress={() => void create()}
        />
        <Text style={styles.foot}>Choose where to save or share. Nothing is uploaded automatically.</Text>
      </View>
      <SkyHeader collapse={collapse} title="Export" showBack hideUser wallpaper />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  intro: { gap: 8, marginBottom: 6 },
  introIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontFamily: theme.font.roundedBold, fontSize: 22, color: theme.colors.textPrimary },
  card: {
    padding: 14,
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  label: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  formats: { gap: 10 },
  format: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    minHeight: 86,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  formatIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formatText: { flex: 1, minWidth: 0, gap: 4 },
  formatTitle: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.colors.inkOff,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  footer: {
    padding: 16,
    paddingTop: 12,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSoft,
  },
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
