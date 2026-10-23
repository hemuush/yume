import fs from 'fs';
import path from 'path';
import { buildReportHtml, esc, paginate, ReportStyle } from './pdfHtml';
import { computeReport } from './reportData';
import { sampleLedger } from '@/test-support/reportFixture';

const root = path.resolve(__dirname, '../../..');
const b64 = (file: string) => fs.readFileSync(path.join(root, file)).toString('base64');
const style: ReportStyle = {
  primary: '#8FCBFF',
  secondary: '#8FE8C8',
  dot: '#F0876A',
  today: '2026-10-23',
  assets: {
    fredoka: b64('node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
    archivo: b64('node_modules/@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
    archivoBold: b64('node_modules/@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf'),
    markCrescent: b64('assets/report-mark-crescent.png'),
    markDot: b64('assets/report-mark-dot.png'),
  },
};
const ledger = sampleLedger();
const report = (period: Parameters<typeof computeReport>[0]['period']) =>
  computeReport({ ...ledger, period, today: '2026-10-23' });

describe('report PDF html', () => {
  it('escapes anything the user typed', () => {
    expect(esc(`<img src=x onerror="a">&'`)).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
    const r = report({ kind: 'month', year: 2026, month: 9 });
    r.entries[0] = { ...r.entries[0], title: '<script>alert(1)</script>' };
    expect(buildReportHtml(r, style).html).not.toContain('<script>alert');
  });

  it('numbers every page truthfully', () => {
    const { html, pageCount } = buildReportHtml(report({ kind: 'month', year: 2026, month: 9 }), style);
    expect(pageCount).toBeGreaterThan(2);
    expect((html.match(/<section class="page">/g) ?? []).length).toBe(pageCount);
    expect(html).toContain(`Page ${pageCount} of ${pageCount}`);
    expect(html).toContain('Page 1 of ' + pageCount);
  });

  it('splits long lists across pages without leaving a day header stranded', () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      i % 5 === 0 ? { h: 7, keepNext: true, html: `<b>H${i}</b>` } : { h: 8.2, html: `<i>R${i}</i>` }
    );
    const head = { h: 8, html: '<h>head</h>' };
    const pages = paginate([{ head, contHead: { h: 8, html: '<h>cont</h>' }, rows }]);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages.slice(1)) expect(page[0]).toContain('cont');
    for (const page of pages) expect(page[page.length - 1]).not.toMatch(/<b>H/);
    expect(pages.flat().join('').match(/<i>R/g)).toHaveLength(48);
  });

  it('builds month, year, all-time and empty reports', () => {
    for (const p of [
      { kind: 'month', year: 2026, month: 9 },
      { kind: 'year', year: 2026 },
      { kind: 'all' },
      { kind: 'month', year: 1999, month: 1 },
    ] as const) {
      const { html, pageCount } = buildReportHtml(report(p), style);
      expect(pageCount).toBeGreaterThanOrEqual(1);
      expect(html).toContain('Money report');
    }
  });

  it('writes a preview when asked', () => {
    const out = process.env.REPORT_PREVIEW_DIR;
    if (!out) return;
    const sets: [string, Parameters<typeof report>[0]][] = [
      ['month', { kind: 'month', year: 2026, month: 9 }],
      ['year', { kind: 'year', year: 2026 }],
      ['empty', { kind: 'month', year: 1999, month: 1 }],
    ];
    for (const [name, p] of sets)
      fs.writeFileSync(path.join(out, `${name}.html`), buildReportHtml(report(p), style).html);
  });
});
