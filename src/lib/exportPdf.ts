import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { toLocalIsoDate } from './date';
import { bytesToBase64 } from './report/base64';
import { buildReportHtml, ReportStyle } from './report/pdfHtml';
import { loadReportInput } from './report/loadReportInput';
import { ReportPeriod } from './report/period';
import { computeReport } from './report/reportData';

/** One PDF holds this many entries; a longer period asks for a shorter one (or Excel) instead of a 400-page file. */
export const MAX_PDF_ENTRIES = 4000;

/** A4 in PDF points: Android's PDF maker takes points and ignores CSS page margins, so pages carry their own. */
const A4 = { width: 595, height: 842 };

// The crescent and dot are alpha masks tinted with the theme in CSS, so the header mark follows the pack.
const MARKS = {
  markCrescent: require('../../assets/report-mark-crescent.png'),
  markDot: require('../../assets/report-mark-dot.png'),
};
const FONTS = { fredoka: Fredoka_600SemiBold, archivo: Archivo_400Regular, archivoBold: Archivo_600SemiBold };

let cachedAssets: ReportStyle['assets'] | null = null;

async function base64Of(moduleId: number): Promise<string> {
  const [asset] = await Asset.loadAsync(moduleId);
  const uri = asset.localUri ?? asset.uri;
  return bytesToBase64(await new File(uri).bytes());
}

/** Fonts and marks read once as base64: a WebView built from a string has no way to fetch them by path. */
async function loadAssets(): Promise<ReportStyle['assets']> {
  if (cachedAssets) return cachedAssets;
  const [fredoka, archivo, archivoBold, markCrescent, markDot] = await Promise.all([
    base64Of(FONTS.fredoka),
    base64Of(FONTS.archivo),
    base64Of(FONTS.archivoBold),
    base64Of(MARKS.markCrescent),
    base64Of(MARKS.markDot),
  ]);
  cachedAssets = { fredoka, archivo, archivoBold, markCrescent, markDot };
  return cachedAssets;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  dot: string;
}

/** Builds the money report for a period as PDF bytes, in the selected theme's colours. */
export async function generateReportPdf(
  period: ReportPeriod,
  colors: ThemeColors
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const today = toLocalIsoDate(new Date());
  const [input, assets] = await Promise.all([loadReportInput(), loadAssets()]);
  const report = computeReport({ ...input, period, today });
  if (report.entries.length === 0) throw new Error('There are no entries in that period to put in a report.');
  if (report.entries.length > MAX_PDF_ENTRIES) {
    throw new Error(
      `That period has ${report.entries.length.toLocaleString('en-US')} entries, too many for one PDF. Choose a shorter period, or export to Excel.`
    );
  }
  const { html, pageCount } = buildReportHtml(report, { ...colors, assets, today });
  const printed = await Print.printToFileAsync({ html, ...A4 });
  const file = new File(printed.uri);
  try {
    return { bytes: await file.bytes(), pageCount };
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // The report itself was made; a leftover cache file is cleared by Android.
    }
  }
}
