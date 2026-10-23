import { formatMoney } from '@/lib/money';
import type { Report, ReportEntry, CategoryRow } from './reportData';
import { MONTH_SHORT, WEEKDAY_SHORT, periodLabel } from './period';

/**
 * The money report as HTML for Android's PDF maker (expo-print). Android ignores CSS page margins and cannot
 * number pages, so every page is built here: a fixed A4 box with its own padding, blocks of known height, and
 * a paginator that never splits a row. Text is one line with an ellipsis, so heights are exact, and "Page n of
 * N" is real. Everything is absolute units (mm/pt) so the page scales the same however the WebView sizes CSS px.
 */

export interface ReportStyle {
  primary: string;
  secondary: string;
  /** Suu's dot colour in the header mark. */
  dot: string;
  /** Embedded base64 so the PDF never needs the network: fonts as TTF, marks as PNG alpha masks. */
  assets: { fredoka: string; archivo: string; archivoBold: string; markCrescent: string; markDot: string };
  /** Today as `YYYY-MM-DD`, for "made on". */
  today: string;
}

/** Mirrors src/constants/theme.ts: cream paper, hairlines, ink, and the app's income/expense text colours. */
const C = {
  paper: '#FFFDF8',
  ink: '#12130F',
  muted: '#6F6A5B',
  faint: '#948E7C',
  line: '#E8E1D1',
  card: '#F8F4EA',
  income: '#167747',
  incomeTint: '#DDF2E5',
  expense: '#BD3547',
  expenseTint: '#FBE1E4',
  other: '#CFC8B6',
};

// ---- page geometry (mm)
const PAGE_W = 210;
const PAGE_H = 297;
const SIDE = 15;
const FOOT_ZONE = 18; // bottom margin holding the footer
const BAND_H = 40;
const RUN_H = 12;
const GAP = 5;
const CONTENT_W = PAGE_W - SIDE * 2;
const FIRST_TOP = BAND_H + 7;
const NEXT_TOP = RUN_H + 8;
const LIMIT = PAGE_H - FOOT_ZONE;

export const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeColor = (hex: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback);
const mm = (n: number) => `${Math.round(n * 100) / 100}mm`;

interface Fixed {
  h: number;
  html: string;
}
interface RowsBlock {
  head: Fixed;
  /** Repeats on a continuation page. */
  contHead: Fixed;
  rows: (Fixed & { keepNext?: boolean })[];
}
type Block = Fixed | RowsBlock;
const isRows = (b: Block): b is RowsBlock => 'rows' in b;

// ---- formatting
const money = (minor: number, cur: string) => formatMoney(minor, cur);
const signed = (minor: number, cur: string) => (minor < 0 ? `−${money(-minor, cur)}` : money(minor, cur));
const pct = (n: number) => `${Math.round(n * 100)}%`;
function dayLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd]} ${d} ${MONTH_SHORT[m - 1]}`;
}
const dayMonthYear = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
};
const compare = (now: number, before: number, label: string, higherIsGood: boolean) => {
  if (before <= 0) return '';
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return `same as ${label}`;
  const good = higherIsGood ? change > 0 : change < 0;
  const word = change > 0 ? 'more' : 'less';
  return `<span style="color:${good ? C.income : C.expense}">${pct(Math.abs(change))} ${word}</span> than ${esc(label)}`;
};

// ---- building blocks
const heading = (text: string, note = ''): Fixed => ({
  h: 8,
  html: `<div class="sh"><i class="pill"></i><b>${esc(text)}</b>${note ? `<span>${esc(note)}</span>` : ''}</div>`,
});

const emptyNote = (text: string): Fixed => ({ h: 9, html: `<div class="empty">${esc(text)}</div>` });

function kpis(r: Report): Fixed {
  const cur = r.currency;
  const card = (label: string, value: string, sub: string, tone: 'plain' | 'in' | 'out' = 'plain') =>
    `<div class="kpi ${tone}"><small>${esc(label)}</small><strong>${value}</strong><em>${sub}</em></div>`;
  const prevLabel = r.previous?.label ?? '';
  const row1 = [
    card(
      'Money in',
      esc(money(r.incomeMinor, cur)),
      r.previous ? compare(r.incomeMinor, r.previous.incomeMinor, prevLabel, true) || '&nbsp;' : '&nbsp;',
      'in'
    ),
    card(
      'Spent',
      esc(money(r.spentMinor, cur)),
      r.previous ? compare(r.spentMinor, r.previous.spentMinor, prevLabel, false) || '&nbsp;' : '&nbsp;',
      'out'
    ),
    card(
      'Net',
      `<span style="color:${r.netMinor >= 0 ? C.income : C.expense}">${esc(signed(r.netMinor, cur))}</span>`,
      r.savedShare == null
        ? 'no money in'
        : r.netMinor >= 0
          ? `kept ${pct(r.savedShare)} of what came in`
          : 'spent more than came in'
    ),
  ];
  const third =
    r.noSpendDays != null
      ? card('No-spend days', `${r.noSpendDays} of ${r.elapsedDays}`, 'days with nothing spent')
      : card(
          'Entries',
          String(r.entryCount),
          r.transferCount ? `${r.transferCount} transfers besides` : 'in all'
        );
  const row2 = [
    card(
      'Daily average',
      esc(money(r.avgPerDayMinor, cur)),
      `spent, over ${r.elapsedDays} day${r.elapsedDays === 1 ? '' : 's'}`
    ),
    card(
      'Busiest day',
      r.biggestDay ? esc(money(r.biggestDay.spentMinor, cur)) : '—',
      r.biggestDay ? esc(dayLabel(r.biggestDay.date)) : 'nothing spent'
    ),
    third,
  ];
  return { h: 43, html: `<div class="kgrid">${row1.join('')}${row2.join('')}</div>` };
}

function whereItWent(r: Report): Fixed {
  const cats = r.spendByCategory;
  if (!cats.length)
    return { h: 8 + 9, html: heading('Where it went').html + emptyNote('No spending in this period.').html };
  const top = cats.slice(0, 8);
  const rest = cats.slice(8);
  const restTotal = rest.reduce((s, c) => s + c.totalMinor, 0);
  const total = cats.reduce((s, c) => s + c.totalMinor, 0);
  const segs = [
    ...top.map((c) => ({ w: c.totalMinor, color: safeColor(c.color, C.other) })),
    ...(restTotal ? [{ w: restTotal, color: C.other }] : []),
  ];
  const bar = `<div class="bar">${segs
    .map((s) => `<i style="flex:${Math.max(s.w, total * 0.004)};background:${s.color}"></i>`)
    .join('')}</div>`;
  const row = (dot: string, name: string, count: string, share: string, amt: string) =>
    `<div class="crow"><i class="dot" style="background:${dot}"></i><span class="nm">${esc(name)}</span><span class="ct">${esc(count)}</span><span class="sh2">${esc(share)}</span><b>${esc(amt)}</b></div>`;
  const rows = top.map((c) =>
    row(
      safeColor(c.color, C.other),
      c.name,
      `${c.count} entr${c.count === 1 ? 'y' : 'ies'}`,
      pct(c.share),
      money(c.totalMinor, r.currency)
    )
  );
  if (restTotal)
    rows.push(
      row(
        C.other,
        `${rest.length} more categor${rest.length === 1 ? 'y' : 'ies'}`,
        '',
        pct(restTotal / total),
        money(restTotal, r.currency)
      )
    );
  const h = 8 + 9 + rows.length * 6 + 1;
  return {
    h,
    html: `${heading('Where it went', `${money(total, r.currency)} in all`).html}${bar}<div class="crows">${rows.join('')}</div>`,
  };
}

function seriesChart(r: Report, s: ReportStyle): Fixed {
  const pts = r.series.points;
  const paired = r.series.kind !== 'days';
  const max = Math.max(1, ...pts.map((p) => Math.max(p.spentMinor, paired ? p.incomeMinor : 0)));
  const AREA = 31;
  const bar = (v: number, color: string) =>
    `<i style="height:${mm(Math.max(0.5, (v / max) * AREA))};background:${color}"></i>`;
  const busiest = r.biggestDay ? Number(r.biggestDay.date.slice(8, 10)) : -1;
  let cols: string;
  if (r.series.kind === 'days') {
    cols = pts
      .map((p, i) => {
        const isBusiest = r.period.kind === 'month' && i + 1 === busiest;
        return `<div class="c">${bar(p.spentMinor, isBusiest ? safeColor(s.dot, s.secondary) : s.primary)}</div>`;
      })
      .join('');
  } else {
    cols = pts
      .map(
        (p) => `<div class="c pair">${bar(p.incomeMinor, s.secondary)}${bar(p.spentMinor, s.primary)}</div>`
      )
      .join('');
  }
  const labels =
    r.series.kind === 'days'
      ? pts
          .map((p, i) => {
            const n = i + 1;
            return `<span>${n === 1 || n % 5 === 0 || n === pts.length ? p.label : ''}</span>`;
          })
          .join('')
      : pts.map((p) => `<span>${esc(p.label)}</span>`).join('');
  const title =
    r.series.kind === 'days' ? 'Day by day' : r.series.kind === 'months' ? 'Month by month' : 'Year by year';
  const legend = paired
    ? `<span class="lg"><i style="background:${s.secondary}"></i>in</span><span class="lg"><i style="background:${s.primary}"></i>spent</span>`
    : r.biggestDay
      ? `<span class="lg"><i style="background:${safeColor(s.dot, s.secondary)}"></i>busiest, ${esc(dayLabel(r.biggestDay.date))}</span>`
      : '';
  return {
    h: 8 + AREA + 6,
    html: `${heading(title, '').html.replace('</div>', `<span class="legend">${legend}</span></div>`)}<div class="chart" style="height:${mm(AREA)}">${cols}</div><div class="axis">${labels}</div>`,
  };
}

function weekdayCard(r: Report, s: ReportStyle): Fixed {
  const max = Math.max(1, ...r.weekday.map((d) => d.avgMinor));
  const top = r.weekday.reduce((a, b) => (b.avgMinor > a.avgMinor ? b : a), r.weekday[0]);
  const AREA = 24;
  const cols = r.weekday
    .map(
      (d) =>
        `<div class="wc"><i style="height:${mm(Math.max(0.5, (d.avgMinor / max) * AREA))};background:${d.label === top.label && top.avgMinor > 0 ? safeColor(s.dot, s.secondary) : s.primary}"></i></div>`
    )
    .join('');
  return {
    h: 8 + AREA + 6 + 5,
    html: `${heading('Spending by weekday', 'average').html}<div class="wbars" style="height:${mm(AREA)}">${cols}</div><div class="axis7">${WEEKDAY_SHORT.map((d) => `<span>${d}</span>`).join('')}</div><div class="cap">${top.avgMinor > 0 ? `${esc(top.label)} runs highest, about ${esc(money(top.avgMinor, r.currency))}` : 'Nothing spent'}</div>`,
  };
}

const listRow = (idx: number | null, title: string, sub: string, amt: string, h = 8.4): Fixed => ({
  h,
  html: `<div class="lrow" style="height:${mm(h)}">${idx != null ? `<i class="rank">${idx}</i>` : ''}<div class="lt"><b>${esc(title)}</b><span>${esc(sub)}</span></div><strong>${esc(amt)}</strong></div>`,
});
const stack = (rows: Fixed[]) => rows.map((x) => x.html).join('');

function biggestExpenses(r: Report): Fixed {
  const rows = r.topExpenses.map((e, i) =>
    listRow(i + 1, e.title, `${dayMonthYear(e.tx.date)} · ${e.category}`, money(e.tx.amountMinor, r.currency))
  );
  const body = rows.length ? stack(rows) : emptyNote('No spending yet.').html;
  return { h: 8 + (rows.length ? rows.length * 8.4 : 9), html: heading('Biggest spends').html + body };
}

function oftenCard(r: Report): Fixed {
  const rows = r.frequent.map((f) =>
    listRow(null, f.label, `${f.count} times`, money(f.totalMinor, r.currency))
  );
  const body = rows.length ? stack(rows) : emptyNote('Nothing repeated yet.').html;
  return { h: 8 + (rows.length ? rows.length * 8.4 : 9), html: heading('Most often').html + body };
}

function accountsCard(r: Report): Fixed {
  const shown = r.accountActivity.slice(0, 5);
  const rows = shown.map((a) =>
    listRow(
      null,
      a.name,
      `in ${money(a.incomeMinor, r.currency)} · out ${money(a.spentMinor, r.currency)}`,
      signed(a.balanceMinor, r.currency)
    )
  );
  const more = r.accountActivity.length - shown.length;
  const extra = more > 0 ? `<div class="cap">and ${more} more account${more === 1 ? '' : 's'}</div>` : '';
  const body = rows.length ? stack(rows) + extra : emptyNote('No accounts.').html;
  return {
    h: 8 + (rows.length ? rows.length * 8.4 + (extra ? 5 : 0) : 9),
    html: heading('Accounts', 'balance today').html + body,
  };
}

function incomeSources(r: Report): Fixed | null {
  const cats = r.incomeByCategory.slice(0, 5);
  if (!cats.length) return null;
  const rows = cats.map(
    (c) =>
      `<div class="crow"><i class="dot" style="background:${safeColor(c.color, C.other)}"></i><span class="nm">${esc(c.name)}</span><span class="ct">${c.count} entr${c.count === 1 ? 'y' : 'ies'}</span><span class="sh2">${pct(c.share)}</span><b>${esc(money(c.totalMinor, r.currency))}</b></div>`
  );
  return {
    h: 8 + rows.length * 6 + 1,
    html: `${heading('Where money came from').html}<div class="crows">${rows.join('')}</div>`,
  };
}

const pair = (a: Fixed, b: Fixed): Fixed => ({
  h: Math.max(a.h, b.h),
  html: `<div class="pair2"><div style="height:${mm(Math.max(a.h, b.h))}">${a.html}</div><div style="height:${mm(Math.max(a.h, b.h))}">${b.html}</div></div>`,
});

function monthsTable(r: Report): RowsBlock | null {
  if (!r.months.length) return null;
  const cur = r.currency;
  const head = (cont: boolean): Fixed => ({
    h: 8 + 6.4,
    html: `${heading(cont ? 'Month by month, continued' : 'Month by month').html}<div class="trow th"><span class="c1">Month</span><span>Money in</span><span>Spent</span><span>Net</span><span class="c5">Entries</span></div>`,
  });
  const rows: Fixed[] = r.months.map((m) => ({
    h: 6.2,
    html: `<div class="trow"><span class="c1">${esc(m.label)}</span><span>${esc(money(m.incomeMinor, cur))}</span><span>${esc(money(m.spentMinor, cur))}</span><span style="color:${m.netMinor >= 0 ? C.income : C.expense}">${esc(signed(m.netMinor, cur))}</span><span class="c5">${m.count}</span></div>`,
  }));
  const tin = r.months.reduce((s, m) => s + m.incomeMinor, 0);
  const tsp = r.months.reduce((s, m) => s + m.spentMinor, 0);
  rows.push({
    h: 6.6,
    html: `<div class="trow tt"><span class="c1">Total</span><span>${esc(money(tin, cur))}</span><span>${esc(money(tsp, cur))}</span><span>${esc(signed(tin - tsp, cur))}</span><span class="c5">${r.months.reduce((s, m) => s + m.count, 0)}</span></div>`,
  });
  return { head: head(false), contHead: head(true), rows };
}

function categoryDetail(r: Report): RowsBlock | null {
  const cats = r.spendByCategory;
  if (!cats.length) return null;
  const head = (cont: boolean): Fixed => ({
    h: 8,
    html: heading(cont ? 'Spending by category, continued' : 'Spending by category', 'with subcategories')
      .html,
  });
  const rows: (Fixed & { keepNext?: boolean })[] = [];
  const add = (c: CategoryRow) => {
    rows.push({
      h: 6.6,
      keepNext: c.subs.length > 0,
      html: `<div class="drow top"><i class="dot" style="background:${safeColor(c.color, C.other)}"></i><span class="nm">${esc(c.name)}</span><span class="ct">${c.count} · avg ${esc(money(c.avgMinor, r.currency))}</span><b>${esc(money(c.totalMinor, r.currency))}</b></div>`,
    });
    const subs = c.subs.slice(0, 4);
    for (const s of subs) {
      rows.push({
        h: 5.2,
        html: `<div class="drow sub"><span class="nm">${esc(s.name)}</span><span class="ct">${s.count}</span><span>${esc(money(s.totalMinor, r.currency))}</span></div>`,
      });
    }
    if (c.subs.length > subs.length) {
      rows.push({
        h: 5.2,
        html: `<div class="drow sub"><span class="nm faint">+ ${c.subs.length - subs.length} more</span></div>`,
      });
    }
  };
  cats.forEach(add);
  return { head: head(false), contHead: head(true), rows };
}

function loansBlock(r: Report): RowsBlock | null {
  if (!r.loans.length) return null;
  const head = (cont: boolean): Fixed => ({
    h: 8,
    html: heading(cont ? 'Loans, continued' : 'Loans', 'active').html,
  });
  const rows = r.loans.map((l) => ({
    h: 8.4,
    html: `<div class="lrow" style="height:8.4mm"><div class="lt"><b>${esc(l.counterparty)}</b><span>${l.direction === 'borrowed' ? 'You borrowed' : 'You lent'} · EMI ${esc(money(l.emiAmountMinor, r.currency))} · ${esc(String(l.interestRateAnnualBp / 100))}% a year</span></div><strong style="color:${l.direction === 'borrowed' ? C.expense : C.income}">${esc(money(l.outstandingPrincipalMinor, r.currency))}</strong></div>`,
  }));
  return { head: head(false), contHead: head(true), rows };
}

function peopleBlock(r: Report): RowsBlock | null {
  if (!r.people.length) return null;
  const head = (cont: boolean): Fixed => ({
    h: 8,
    html: heading(cont ? 'Friends & family, continued' : 'Friends & family', 'balance today').html,
  });
  const rows = r.people.map((p) => ({
    h: 7,
    html: `<div class="lrow" style="height:7mm"><div class="lt"><b>${esc(p.name)}</b></div><strong style="color:${p.balanceMinor > 0 ? C.income : C.expense}">${p.balanceMinor > 0 ? 'owes you ' : 'you owe '}${esc(money(Math.abs(p.balanceMinor), r.currency))}</strong></div>`,
  }));
  return { head: head(false), contHead: head(true), rows };
}

function entriesBlock(r: Report): RowsBlock | null {
  if (!r.entries.length) return null;
  const head = (cont: boolean): Fixed => ({
    h: 8,
    html: heading(cont ? 'Every entry, continued' : 'Every entry', `${r.entries.length} in all`).html,
  });
  const rows: (Fixed & { keepNext?: boolean })[] = [];
  let day = '';
  let i = 0;
  while (i < r.entries.length) {
    day = r.entries[i].tx.date.slice(0, 10);
    const group: ReportEntry[] = [];
    while (i < r.entries.length && r.entries[i].tx.date.slice(0, 10) === day) group.push(r.entries[i++]);
    const net = group.reduce((s, e) => {
      if (e.currency !== r.currency) return s;
      const t = e.tx;
      return s + (t.type === 'expense' ? -t.amountMinor : t.type === 'income' ? t.amountMinor : 0);
    }, 0);
    rows.push({
      h: 7,
      keepNext: true,
      html: `<div class="dhead"><b>${esc(dayLabel(day))}</b><span style="color:${net < 0 ? C.expense : net > 0 ? C.income : C.faint}">${net === 0 ? '' : esc(signed(net, r.currency))}</span></div>`,
    });
    for (const e of group) {
      const t = e.tx;
      const color = t.type === 'income' ? C.income : t.type === 'expense' ? C.expense : C.muted;
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
      rows.push({
        h: 8.2,
        html: `<div class="erow"><i class="dot" style="background:${safeColor(e.color, C.other)}"></i><div class="lt"><b>${esc(e.title)}</b><span>${esc(e.detail)}</span></div><strong style="color:${color}">${sign}${esc(money(t.amountMinor, e.currency))}</strong></div>`,
      });
    }
  }
  return { head: head(false), contHead: head(true), rows };
}

// ---- pagination
interface Page {
  html: string[];
  y: number;
}

export function paginate(blocks: Block[]): string[][] {
  const pages: Page[] = [{ html: [], y: FIRST_TOP }];
  let page = pages[0];
  const fresh = () => {
    page = { html: [], y: NEXT_TOP };
    pages.push(page);
  };
  const put = (b: Fixed) => {
    page.html.push(`<div class="blk" style="height:${mm(b.h)};margin-bottom:${mm(0)}">${b.html}</div>`);
    page.y += b.h;
  };
  const gap = () => {
    page.html.push(`<div style="height:${mm(GAP)}"></div>`);
    page.y += GAP;
  };
  const room = (h: number) => page.y + h <= LIMIT;
  const isPageEmpty = () => page.html.length === 0;
  blocks.forEach((b) => {
    if (!isPageEmpty() && page.y > (pages.length === 1 ? FIRST_TOP : NEXT_TOP)) {
      // spacing between blocks, only when something is already on this page
      if (room(GAP)) gap();
    }
    if (!isRows(b)) {
      if (!room(b.h) && !isPageEmpty()) fresh();
      put(b);
      return;
    }
    // Header plus the first two rows must fit, or the section starts on a new page.
    const need = b.head.h + b.rows.slice(0, 2).reduce((s, x) => s + x.h, 0);
    if (!room(need) && !isPageEmpty()) fresh();
    put(b.head);
    for (let k = 0; k < b.rows.length; k++) {
      const row = b.rows[k];
      const next = b.rows[k + 1];
      const needed = row.h + (row.keepNext && next ? next.h : 0);
      if (!room(needed)) {
        fresh();
        put(b.contHead);
      }
      put(row);
    }
  });
  return pages.map((p) => p.html);
}

// ---- assembly
const css = (s: ReportStyle) => `
@font-face{font-family:YF;src:url(data:font/ttf;base64,${s.assets.fredoka}) format('truetype');font-weight:600}
@font-face{font-family:YA;src:url(data:font/ttf;base64,${s.assets.archivo}) format('truetype');font-weight:400}
@font-face{font-family:YA;src:url(data:font/ttf;base64,${s.assets.archivoBold}) format('truetype');font-weight:600}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{background:${C.paper};width:${PAGE_W}mm}
body{font-family:YA,'Noto Sans',Roboto,sans-serif;font-size:8pt;line-height:1.25;color:${C.ink}}
b,strong{font-weight:600}
.page{position:relative;width:${PAGE_W}mm;height:${mm(PAGE_H - 0.4)};overflow:hidden;background:${C.paper};page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.band{position:absolute;left:0;top:0;width:${PAGE_W}mm;height:${BAND_H}mm;background:linear-gradient(110deg,${s.primary},${s.secondary});padding:11mm ${SIDE}mm 0}
.band .kick{font-size:6.8pt;letter-spacing:.22em;text-transform:uppercase;font-weight:600;opacity:.7}
.band h1{font-family:YF,YA,sans-serif;font-weight:600;font-size:26pt;line-height:1.05;margin-top:1.4mm}
.band p{font-size:8pt;margin-top:2mm;opacity:.78}
.run{position:absolute;left:0;top:0;width:${PAGE_W}mm;height:${RUN_H}mm;background:linear-gradient(110deg,${s.primary},${s.secondary});padding:0 ${SIDE}mm;display:flex;align-items:center;justify-content:space-between;font-family:YF,YA,sans-serif;font-weight:600;font-size:10pt}
.run span{font-family:YA,sans-serif;font-size:7pt;font-weight:400;opacity:.75}
.tile{position:absolute;right:${SIDE}mm;width:17mm;height:17mm;border-radius:5.5mm;background:${C.paper};box-shadow:0 0 0 .3mm rgba(18,19,15,.06)}
.band .tile{top:10mm}
.run .tile{position:relative;right:auto;width:7.5mm;height:7.5mm;border-radius:2.4mm}
.tile i{position:absolute;inset:14%;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}
.content{position:absolute;left:${SIDE}mm;width:${CONTENT_W}mm}
.blk{overflow:hidden;width:${CONTENT_W}mm}
.sh{height:8mm;display:flex;align-items:center;gap:2mm;border-bottom:.25mm solid ${C.line};margin-bottom:0}
.sh .pill{width:1.6mm;height:4mm;border-radius:1mm;background:${s.primary};flex:none}
.sh b{font-family:YF,YA,sans-serif;font-weight:600;font-size:11pt}
.sh span{margin-left:auto;font-size:7pt;color:${C.muted}}
.sh .legend{display:flex;gap:3mm}.lg{display:inline-flex;align-items:center;gap:1mm;font-size:6.8pt;color:${C.muted}}.lg i{width:2.4mm;height:2.4mm;border-radius:.7mm}
.empty{height:9mm;display:flex;align-items:center;color:${C.muted};font-size:8pt}
.kgrid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:20mm 20mm;gap:3mm;height:43mm}
.kpi{border:.25mm solid ${C.line};background:${C.card};border-radius:3.2mm;padding:2.6mm 3.4mm;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
.kpi.in{background:${C.incomeTint}}.kpi.out{background:${C.expenseTint}}
.kpi small{font-size:6.8pt;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};font-weight:600}
.kpi strong{font-size:15pt;line-height:1.1;white-space:nowrap}
.kpi em{font-style:normal;font-size:6.8pt;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{display:flex;gap:.5mm;height:6mm;margin:2.5mm 0 0;border-radius:3mm;overflow:hidden}.bar i{display:block;height:100%;min-width:.6mm}
.crows{margin-top:1mm}
.crow,.drow{height:6mm;display:flex;align-items:center;gap:2mm;border-bottom:.2mm solid ${C.line};white-space:nowrap}
.dot{width:2.6mm;height:2.6mm;border-radius:50%;flex:none;display:block}
.nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ct{color:${C.muted};font-size:7pt;width:30mm;text-align:right;flex:none}.sh2{width:11mm;text-align:right;color:${C.muted};flex:none}
.crow b{width:26mm;text-align:right;flex:none}
.drow.top{height:6.6mm;font-weight:600;border-bottom:.2mm solid ${C.line}}.drow.top b{width:26mm;text-align:right;flex:none}
.drow.sub{height:5.2mm;padding-left:5mm;color:${C.muted};font-size:7.4pt;border-bottom:.15mm dotted ${C.line}}.drow.sub span:last-child{width:26mm;text-align:right;flex:none}.drow.sub .ct{width:30mm}.faint{color:${C.faint}}
.chart{display:flex;align-items:flex-end;gap:.7mm;border-bottom:.3mm solid ${C.ink};margin-top:2mm;padding-bottom:0}
.chart .c{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:.4mm;height:100%}.chart .c i{display:block;width:100%;border-radius:.6mm .6mm 0 0}
.axis{display:flex;gap:.7mm;font-size:6.4pt;color:${C.muted};margin-top:.8mm;height:4mm}.axis span{flex:1;text-align:center;overflow:visible;white-space:nowrap}
.wbars{display:flex;align-items:flex-end;gap:2mm;border-bottom:.3mm solid ${C.ink};margin-top:2mm}.wc{flex:1;display:flex;align-items:flex-end;height:100%}.wc i{display:block;width:100%;border-radius:.8mm .8mm 0 0}
.axis7{display:flex;gap:2mm;font-size:6.8pt;color:${C.muted};margin-top:.8mm}.axis7 span{flex:1;text-align:center}
.cap{font-size:7pt;color:${C.muted};margin-top:1.2mm;height:4mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pair2{display:flex;gap:6mm}.pair2>div{flex:1;min-width:0;overflow:hidden}
.lrow{display:flex;align-items:center;gap:2.4mm;border-bottom:.2mm solid ${C.line}}
.lrow .lt,.erow .lt{flex:1;min-width:0;display:flex;flex-direction:column;gap:.3mm}
.lt b{font-weight:600;font-size:8.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lt span{font-size:6.8pt;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrow strong,.erow strong{flex:none;font-size:8.2pt;white-space:nowrap}
.rank{flex:none;width:4.6mm;height:4.6mm;border-radius:50%;background:${s.primary};font-style:normal;font-size:6.6pt;font-weight:600;display:flex;align-items:center;justify-content:center}
.trow{height:6.2mm;display:grid;grid-template-columns:34mm 1fr 1fr 1fr 18mm;gap:2mm;align-items:center;border-bottom:.2mm solid ${C.line};white-space:nowrap}
.trow span:not(.c1){text-align:right}.trow.th{height:6.4mm;color:${C.muted};font-size:7pt;font-weight:600;border-bottom:.3mm solid ${C.ink}}
.trow.tt{height:6.6mm;font-weight:600;background:${C.card};padding:0 1mm;border-bottom:none;border-radius:1.4mm}
.dhead{height:7mm;display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:1mm;border-bottom:.3mm solid ${C.line}}
.dhead b{font-family:YF,YA,sans-serif;font-weight:600;font-size:9.5pt}
.erow{height:8.2mm;display:flex;align-items:center;gap:2.4mm;border-bottom:.15mm solid ${C.line}}
.foot{position:absolute;left:${SIDE}mm;right:${SIDE}mm;bottom:7mm;height:5mm;border-top:.25mm solid ${C.line};padding-top:1.6mm;display:flex;justify-content:space-between;font-size:6.6pt;color:${C.faint}}
`;

function mark(s: ReportStyle, cls = ''): string {
  const layer = (data: string, color: string) =>
    `<i style="background:${color};--m:url(data:image/png;base64,${data})"></i>`;
  return `<div class="tile ${cls}">${layer(s.assets.markCrescent, s.primary === s.secondary ? C.ink : darker(s.primary))}${layer(s.assets.markDot, safeColor(s.dot, s.secondary))}</div>`;
}

/** The pack's pastel primary darkened a little so the mark reads on the paper-white tile. */
function darker(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.max(0, Math.round(((n >> shift) & 255) * 0.9));
  return `#${[16, 8, 0].map((sft) => ch(sft).toString(16).padStart(2, '0')).join('')}`;
}

export function buildReportHtml(r: Report, s: ReportStyle): { html: string; pageCount: number } {
  const blocks: Block[] = [kpis(r), whereItWent(r)];
  const hasMoney = r.series.points.some((p) => p.spentMinor > 0 || p.incomeMinor > 0);
  if (hasMoney) blocks.push(seriesChart(r, s));
  if (r.spentMinor > 0) {
    blocks.push(pair(weekdayCard(r, s), biggestExpenses(r)));
    blocks.push(pair(oftenCard(r), accountsCard(r)));
  } else {
    blocks.push(accountsCard(r));
  }
  const inc = incomeSources(r);
  if (inc) blocks.push(inc);
  for (const b of [monthsTable(r), categoryDetail(r), loansBlock(r), peopleBlock(r), entriesBlock(r)]) {
    if (b) blocks.push(b);
  }
  if (r.otherCurrencyCount > 0) {
    blocks.push({
      h: 11,
      html: `<div class="cap" style="height:auto;white-space:normal;margin-top:2mm">Totals count ${esc(r.currency)} only. ${r.otherCurrencyCount} entr${r.otherCurrencyCount === 1 ? 'y' : 'ies'} in other currencies ${r.otherCurrencyCount === 1 ? 'is' : 'are'} listed under Every entry in ${r.otherCurrencyCount === 1 ? 'its' : 'their'} own currency, never added in.</div>`,
    });
  }
  const pages = paginate(blocks);
  const total = pages.length;
  const label = periodLabel(r.period);
  const span =
    r.period.kind === 'all'
      ? `${dayMonthYear(r.from)} to ${dayMonthYear(r.to)}`
      : r.period.kind === 'year'
        ? `1 Jan to 31 Dec ${r.period.year}`
        : `${dayMonthYear(r.from)} to ${dayMonthYear(r.to)}`;
  const footer = (n: number) =>
    `<div class="foot"><span>Yume · made on this phone, from your own entries. Nothing was sent anywhere.</span><span>Page ${n} of ${total}</span></div>`;
  const body = pages
    .map((blocksHtml, i) => {
      const top = i === 0 ? FIRST_TOP : NEXT_TOP;
      const header =
        i === 0
          ? `<div class="band"><div class="kick">Money report</div><h1>${esc(label)}</h1><p>${esc(span)} · ${r.entryCount + r.transferCount} entr${r.entryCount + r.transferCount === 1 ? 'y' : 'ies'} · made ${esc(dayMonthYear(s.today))}</p>${mark(s)}</div>`
          : `<div class="run"><div style="display:flex;align-items:center;gap:2.5mm">${mark(s)}Yume · ${esc(label)}</div><span>Money report</span></div>`;
      return `<section class="page">${header}<div class="content" style="top:${mm(top)}">${blocksHtml.join('')}</div>${footer(i + 1)}</section>`;
    })
    .join('');
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css(s)}@page{size:A4;margin:0}</style></head><body>${body}</body></html>`,
    pageCount: total,
  };
}
