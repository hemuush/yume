// The page's behaviour: the light and dark switch, the pinned phone that follows the story, reveal on scroll and the
// checksum copy button. The page reads fine without any of it.
(function () {
  const root = document.documentElement;
  root.classList.add('js');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  // ---------- light and dark ----------
  try {
    const saved = localStorage.getItem('yume-theme');
    if (saved) root.setAttribute('data-theme', saved);
  } catch {
    /* storage can be blocked: the phone's own light or dark setting still applies */
  }
  const siteDark = () =>
    root.getAttribute('data-theme') === 'dark' ||
    (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  const toggle = $('theme');

  // ---------- the pinned phone ----------
  const phone = document.querySelector('.phone');
  const fit = $('phone-fit');
  const scenes = Array.from(document.querySelectorAll('.scene'));
  // scene -> the phone screen it shows, and whether the phone shows the opposite colour mode
  const SHOW = [
    { s: 's-home', tab: 'home' },
    { s: 's-chat', tab: '' },
    { s: 's-activity', tab: 'activity' },
    { s: 's-plan', tab: 'plan' },
    { s: 's-reports', tab: 'reports' },
    { s: 's-home', tab: 'home', flip: true },
  ];
  // the step panels are numbered 0 (hero) to 6; the last two share the Home screen in opposite modes
  const MAP = [0, 0, 1, 2, 3, 4, 5];
  let current = -1;
  function setScene(i) {
    const idx = MAP[Math.max(0, Math.min(MAP.length - 1, i))];
    scenes.forEach(function (el, k) {
      el.classList.toggle('active', k === i);
    });
    if (!phone || (idx === current && phone.dataset.scene === String(i))) return;
    current = idx;
    phone.dataset.scene = String(i);
    const show = SHOW[idx];
    document.querySelectorAll('.phone .screen').forEach(function (el) {
      el.classList.toggle('on', el.id === show.s);
    });
    document.querySelectorAll('.phone .tabx').forEach(function (t) {
      t.classList.toggle('on', t.dataset.go === show.tab);
    });
    const dark = siteDark() !== !!show.flip;
    phone.setAttribute('data-mode', dark ? 'dark' : 'light');
  }
  window.setScene = setScene;
  function sizePhone() {
    const col = document.querySelector('.phone-sticky');
    if (!col || !fit) return;
    const h = col.clientHeight;
    fit.style.setProperty('--ps', Math.max(0.5, Math.min(1.1, (h - 40) / 640)).toFixed(3));
  }
  // the scene whose middle is nearest the reading line wins: lower on a phone, where the phone sits above the text
  let ticking = false;
  function pick() {
    ticking = false;
    const line = innerWidth < 960 ? innerHeight * 0.86 : innerHeight * 0.5;
    let best = 0;
    let bd = Infinity;
    scenes.forEach(function (el, k) {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - line);
      if (r.bottom > 0 && r.top < innerHeight && d < bd) {
        bd = d;
        best = k;
      }
    });
    setScene(best);
  }
  addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(pick);
      }
    },
    { passive: true }
  );
  addEventListener('resize', function () {
    sizePhone();
    pick();
  });
  // a tab on the phone takes you to its step
  const TAB_SCENE = { home: 0, activity: 3, plan: 4, reports: 5 };
  document.querySelectorAll('.phone .tabx').forEach(function (t) {
    t.addEventListener('click', function () {
      const k = TAB_SCENE[t.dataset.go];
      setScene(k);
      const el = scenes[k];
      if (el) el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    });
  });

  if (toggle)
    toggle.addEventListener('click', function () {
      const next = siteDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('yume-theme', next);
      } catch {
        /* the choice just lasts until the page closes */
      }
      current = -1;
      pick();
    });

  sizePhone();
  pick();

  // ---------- reveal on scroll ----------
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !calm) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add('in-view');
    });
  }

  // ---------- the checksum copy button ----------
  const copy = $('copy');
  const hash = $('hash');
  if (copy && hash)
    copy.addEventListener('click', function () {
      navigator.clipboard
        .writeText(hash.textContent.trim())
        .then(function () {
          copy.textContent = 'Copied';
        })
        .catch(function () {
          copy.textContent = 'Select and copy';
        });
      setTimeout(function () {
        copy.textContent = 'Copy';
      }, 2000);
    });
})();
