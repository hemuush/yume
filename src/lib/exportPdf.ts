import * as Print from 'expo-print';
import { File } from 'expo-file-system';
import { toLocalIsoDate } from './date';
import { REPORT_ASSETS } from './report/embeddedAssets';
import { buildReportHtml } from './report/pdfHtml';
import { loadReportInput } from './report/loadReportInput';
import { ReportPeriod } from './report/period';
import { computeReport } from './report/reportData';

/** One PDF holds this many entries; a longer period asks for a shorter one (or Excel) instead of a 400-page file. */
export const MAX_PDF_ENTRIES = 4000;

/** A4 in PDF points: Android's PDF maker takes points and ignores CSS page margins, so pages carry their own. */
const A4 = { width: 595, height: 842 };

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
  const input = await loadReportInput();
  const report = computeReport({ ...input, period, today });
  if (report.entries.length === 0) throw new Error('There are no entries in that period to put in a report.');
  if (report.entries.length > MAX_PDF_ENTRIES) {
    throw new Error(
      `That period has ${report.entries.length.toLocaleString('en-US')} entries, too many for one PDF. Choose a shorter period, or export to Excel.`
    );
  }
  const { html, pageCount } = buildReportHtml(report, { ...colors, assets: REPORT_ASSETS, today });
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
