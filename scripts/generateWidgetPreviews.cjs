const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const Module = require('node:module');
const ts = require('typescript');

// Render the actual synchronous widget components into a browser facsimile of RemoteViews.
// Uses bundled fonts and synthetic data only. Android launcher acceptance remains a device check.
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
const primitives = Object.fromEntries(
  ['FlexWidget', 'TextWidget', 'IconWidget', 'ImageWidget', 'OverlapWidget'].map((name) => [
    name,
    Object.assign(() => null, { __name__: name }),
  ])
);
Module._load = function (request, parent, isMain) {
  if (request === 'react-native-android-widget') return primitives;
  if (request === '@/db/settings') return { getCachedCurrency: () => 'INR' };
  if (request.startsWith('@/')) request = path.join(root, 'src', request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};
for (const ext of ['.ts', '.tsx'])
  require.extensions[ext] = (mod, filename) => {
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
      }).outputText,
      filename
    );
  };
require.extensions['.png'] = (mod, filename) => {
  mod.exports = `data:image/png;base64,${fs.readFileSync(filename).toString('base64')}`;
};
const { heroSlices } = require('../src/features/home/heroSlices');
const { ThisMonthWidget } = require('../src/widgets/ThisMonthWidget');
const { AccountsWidget } = require('../src/widgets/AccountsWidget');
const { QuickAddWidget } = require('../src/widgets/QuickAddWidget');
const { SuuWidget } = require('../src/widgets/SuuWidget');
const { NextDueWidget } = require('../src/widgets/NextDueWidget');
const primary = '#8FCBFF',
  secondary = '#8FE8C8';
const month = {
  monthLabel: 'October',
  daysLeft: 9,
  spentMinor: 1824000,
  savedMinor: 700000,
  dueMinor: 400000,
  freeMinor: 1206000,
  hideSavings: false,
  slices: heroSlices(4130000, 1824000, 700000, 400000),
  pace: { projectedMinor: 2570000, byLabel: '31 Oct' },
  primary,
  secondary,
};
const fixtures = [
  ['this-month', 360, 160, ThisMonthWidget(month)],
  [
    'accounts',
    360,
    160,
    AccountsWidget({
      accounts: [
        {
          name: 'HDFC Bank',
          typeLabel: 'Bank',
          icon: 'bank',
          hue: primary,
          balanceText: '₹1,82,400',
          negative: false,
        },
        {
          name: 'Amex Card',
          typeLabel: 'Credit card',
          icon: 'credit-card',
          hue: '#E0AC3F',
          balanceText: '−₹8,250',
          negative: true,
        },
        {
          name: 'Cash',
          typeLabel: 'Cash',
          icon: 'cash',
          hue: '#E0F0A8',
          balanceText: '₹3,600',
          negative: false,
        },
      ],
      totalText: '₹1,77,750',
    }),
  ],
  [
    'quick-add',
    172,
    172,
    QuickAddWidget({
      primary,
      categories: [
        { id: 'food', name: 'Food', icon: 'food', color: '#F0876A' },
        { id: 'travel', name: 'Travel', icon: 'car', color: secondary },
        { id: 'grocery', name: 'Grocery', icon: 'cart', color: '#E0AC3F' },
        { id: 'cafe', name: 'Cafe', icon: 'coffee', color: '#C5E0A0' },
      ],
    }),
  ],
  [
    'suu',
    172,
    172,
    SuuWidget({
      line: { text: 'Kept 24% of what came in this month. A steady start — keep it up.' },
      dot: '#F0876A',
      primary,
    }),
  ],
  [
    'next-due',
    360,
    80,
    NextDueWidget({
      data: {
        title: 'Home loan EMI',
        subtitle: 'In 3 days',
        amountMinor: 1800000,
        sign: '-',
        route: '/loans',
        dateIso: '2026-10-25',
        tint: primary,
      },
    }),
  ],
];
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
function render(node) {
  if (node == null || node === false) return '';
  if (Array.isArray(node)) return node.map(render).join('');
  const { type, props: p } = node;
  if (!type.__name__) return render(type(p));
  const kind = type.__name__;
  const s = { ...p.style };
  // Check native constraints before drawing a browser approximation.
  if (s.flex !== undefined && (!Number.isInteger(s.flex) || s.flex <= 0)) {
    throw new Error('Android widget flex weights must be positive integers.');
  }
  if (s.backgroundGradient && s.borderWidth) {
    throw new Error('Android widget gradients replace the border; use a solid fill or separate layers.');
  }
  for (const prefix of ['padding', 'margin']) {
    for (const [axis, edges] of [
      ['Horizontal', ['Left', 'Right']],
      ['Vertical', ['Top', 'Bottom']],
    ]) {
      if (s[prefix + axis] !== undefined) {
        for (const edge of edges) s[prefix + edge] = s[prefix + axis];
        delete s[prefix + axis];
      }
    }
  }
  let css =
    kind === 'FlexWidget' || kind === 'OverlapWidget'
      ? 'display:flex;flex-direction:column;'
      : 'display:block;';
  css += 'box-sizing:border-box;min-width:0;flex-shrink:0;';
  for (let [key, value] of Object.entries(s)) {
    if (key === 'adjustsFontSizeToFit' || value === undefined) continue;
    if (key === 'backgroundGradient') {
      css += `background:linear-gradient(to bottom right,${value.from},${value.to});`;
      continue;
    }
    if (value === undefined) continue;
    if (key === 'flex') {
      css += `flex:${value} 1 0px;`;
      continue;
    }
    if (value === 'match_parent') value = '100%';
    if (value === 'wrap_content') value = 'auto';
    if (key === 'fontFamily') value = `'${value}'`;
    if (typeof value === 'number') value += 'px';
    css += `${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${value};`;
  }
  if (Object.keys(s).some((k) => /^border.*Width$/.test(k))) css += 'border-style:solid;';
  if (kind === 'TextWidget') {
    if (p.maxLines === 1) css += 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    else if (p.maxLines)
      css += `display:-webkit-box;-webkit-line-clamp:${p.maxLines};-webkit-box-orient:vertical;overflow:hidden;`;
    return `<div data-fit="${!!s.adjustsFontSizeToFit}" style="${esc(css)}">${esc(p.text)}</div>`;
  }
  if (kind === 'IconWidget')
    return `<div style="font-family:MaterialCommunityIcons;font-size:${p.size}px;line-height:1;${esc(css)}">${esc(p.icon)}</div>`;
  if (kind === 'ImageWidget')
    return `<img src="${p.image}" style="width:${p.imageWidth}px;height:${p.imageHeight}px;${esc(css)}">`;
  if (kind === 'OverlapWidget') css += 'position:relative;';
  const children = render(p.children);
  return `<div${kind === 'OverlapWidget' ? ' class="overlap"' : ''} style="${esc(css)}">${children}</div>`;
}
const fonts = require('../app.json').expo.plugins.find(
  (p) => Array.isArray(p) && p[0] === 'react-native-android-widget'
)[1].fonts;
const fontCss = fonts
  .map(
    (f) =>
      `@font-face{font-family:'${path.basename(f, '.ttf')}';src:url(data:font/ttf;base64,${fs.readFileSync(path.resolve(root, f)).toString('base64')})}`
  )
  .join('');
function html(body) {
  return `<!doctype html><meta charset="utf-8"><style>${fontCss}html,body{margin:0;overflow:hidden;background:transparent;font-family:Archivo_400Regular;line-height:1.2}.overlap>*{position:absolute;flex-shrink:0}</style>${body}`;
}
async function main() {
  const browser =
    process.env.WIDGET_PREVIEW_BROWSER ||
    [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ].find(fs.existsSync);
  if (!browser) throw new Error('Set WIDGET_PREVIEW_BROWSER to a Chromium executable.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yume-widget-previews-'));
  const proc = spawn(
    browser,
    [
      '--headless=new',
      '--no-first-run',
      '--remote-debugging-port=0',
      `--user-data-dir=${path.join(temp, 'profile')}`,
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
  );
  let ws;
  let call;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let startupOutput = '';
      const timer = setTimeout(() => reject(new Error('Browser start timed out')), 60000);
      proc.stderr.on('data', (b) => {
        startupOutput += String(b);
        const match = startupOutput.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      proc.once('error', reject);
    });
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    let id = 0;
    const pending = new Map();
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (pending.has(msg.id)) {
        const [resolve, reject] = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    call = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const key = ++id;
        pending.set(key, [resolve, reject]);
        ws.send(JSON.stringify({ id: key, method, params, sessionId }));
      });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    await call('Page.enable', {}, sessionId);
    await call(
      'Emulation.setDefaultBackgroundColorOverride',
      { color: { r: 0, g: 0, b: 0, a: 0 } },
      sessionId
    );
    const minimum = process.argv.includes('--minimum');
    const waitForFonts = async () => {
      const families = fonts.map((f) => path.basename(f, '.ttf'));
      const result = await call(
        'Runtime.evaluate',
        {
          expression: `(async()=>{await document.fonts.ready;const loaded=await Promise.all(${JSON.stringify(families)}.map(name=>document.fonts.load('16px "'+name+'"')));if(loaded.some(faces=>faces.length!==1))throw new Error('A bundled widget font did not load');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true})()`,
          awaitPromise: true,
          returnByValue: true,
        },
        sessionId
      );
      if (result.exceptionDetails || result.result.value !== true)
        throw new Error('Widget preview font loading failed');
    };
    const output = path.join(root, minimum ? 'design-preview/widget-minimum' : 'assets/widget-preview');
    fs.mkdirSync(output, { recursive: true });
    const previews = minimum
      ? fixtures.map(([name, , , tree]) => [
          name,
          ['quick-add', 'suu'].includes(name) ? 140 : 250,
          name === 'next-due' ? 70 : 140,
          tree,
        ])
      : fixtures;
    for (const [name, width, height, tree] of previews) {
      const doc = path.join(temp, `${name}.html`);
      fs.writeFileSync(doc, html(`<main style="width:${width}px;height:${height}px">${render(tree)}</main>`));
      await call(
        'Emulation.setDeviceMetricsOverride',
        { width, height, deviceScaleFactor: 2, mobile: false },
        sessionId
      );
      await call('Page.navigate', { url: require('node:url').pathToFileURL(doc).href }, sessionId);
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await call(
          'Runtime.evaluate',
          {
            expression: 'document.readyState === "complete" && document.fonts.status === "loaded"',
            returnByValue: true,
          },
          sessionId
        );
        if (result.result.value) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await waitForFonts();
      await call(
        'Runtime.evaluate',
        {
          expression: `for(const el of document.querySelectorAll('[data-fit="true"]')){let size=parseFloat(getComputedStyle(el).fontSize);while(el.scrollWidth>el.clientWidth&&size>8)el.style.fontSize=(size-=.5)+'px'}`,
          returnByValue: true,
        },
        sessionId
      );
      const { data } = await call(
        'Page.captureScreenshot',
        { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } },
        sessionId
      );
      fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`Updated ${name}.png (${width * 2}×${height * 2})`);
    }
    const reviewDir = path.join(root, 'design-preview');
    fs.mkdirSync(reviewDir, { recursive: true });
    const tile = ([name, width, height, tree]) =>
      `<section><p style="margin:0 0 8px;color:#5B5748;font-size:12px">${name}</p><div style="width:${width}px;height:${height}px">${render(tree)}</div></section>`;
    const gallery = html(
      `<div style="width:776px;padding:20px;background:#F4F0E7;box-sizing:border-box"><h2 style="font-family:Fredoka_600SemiBold;margin:0 0 18px">Yume widgets</h2><div style="display:flex;gap:16px">${tile(fixtures[0])}${tile(fixtures[1])}</div><div style="display:flex;gap:16px;margin-top:20px"><div style="display:flex;gap:16px;width:360px">${tile(fixtures[2])}${tile(fixtures[3])}</div>${tile(fixtures[4])}</div></div>`
    );
    const galleryPath = path.join(reviewDir, 'widgets.html');
    fs.writeFileSync(galleryPath, gallery);
    await call(
      'Emulation.setDeviceMetricsOverride',
      { width: 776, height: 500, deviceScaleFactor: 2, mobile: false },
      sessionId
    );
    await call('Page.navigate', { url: require('node:url').pathToFileURL(galleryPath).href }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await waitForFonts();
    const overview = await call(
      'Page.captureScreenshot',
      { format: 'png', clip: { x: 0, y: 0, width: 776, height: 500, scale: 1 } },
      sessionId
    );
    fs.writeFileSync(path.join(reviewDir, 'widgets.png'), Buffer.from(overview.data, 'base64'));
    console.log('Review: design-preview/widgets.png');
    await call('Browser.close');
  } finally {
    if (call && ws?.readyState === WebSocket.OPEN)
      await Promise.race([
        call('Browser.close').catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    ws?.close();
    proc.kill();
    // Profile is in the OS temp directory; keep it out of the repository.
  }
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
