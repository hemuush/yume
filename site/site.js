// The page's behaviour: the light and dark switch, the tour that changes the phone's screen, reveal on scroll and the
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

  // ---------- the tour: one phone, six screens ----------
  const phone = document.querySelector('.phone');
  const fit = $('phone-fit');
  const tabs = Array.from(document.querySelectorAll('.tour button'));
  const TOUR = [
    {
      s: 's-home',
      tab: 'home',
      title: "Know what's <em>free</em> to spend.",
      text: 'One calm number after your bills, your spending and what you set aside. About how much you can spend a day, and whether today is under or over that pace.',
    },
    {
      s: 's-chat',
      tab: '',
      title: 'Add it in a <em>few taps.</em>',
      text: 'Your usual entries fill the category, amount and account in one tap. Or switch to Add by chat and Suu asks one thing at a time, every answer a tap.',
    },
    {
      s: 's-activity',
      tab: 'activity',
      title: 'Everything in <em>its day.</em>',
      text: 'Browse day by day, search by word or amount, filter, and open any entry. The new one lands right where it belongs.',
    },
    {
      s: 's-plan',
      tab: 'plan',
      title: 'Plan the <em>next 14 days.</em>',
      text: 'Bills, budgets and goals before they surprise you, with loans and EMIs showing exactly what is still left to pay.',
    },
    {
      s: 's-reports',
      tab: 'reports',
      title: 'See where it <em>went.</em>',
      text: 'Spending by day and by category, with a PDF or Excel report of any month or year, made on your phone and shared only where you choose.',
    },
    {
      s: 's-home',
      tab: 'home',
      flip: true,
      title: 'Calm in <em>both.</em>',
      text: 'One quiet look in a light and a dark mode that follows your phone. Hide amounts on screen and in widgets whenever you need to.',
    },
  ];
  let current = -1;
  let timer = null;
  function setScene(i) {
    const k = ((i % TOUR.length) + TOUR.length) % TOUR.length;
    const t = TOUR[k];
    current = k;
    tabs.forEach(function (b, n) {
      b.setAttribute('aria-selected', n === k ? 'true' : 'false');
      b.tabIndex = n === k ? 0 : -1;
    });
    if ($('tour-title')) $('tour-title').innerHTML = t.title;
    if ($('tour-p')) $('tour-p').textContent = t.text;
    if (!phone) return;
    document.querySelectorAll('.phone .screen').forEach(function (el) {
      el.classList.toggle('on', el.id === t.s);
    });
    document.querySelectorAll('.phone .tabx').forEach(function (x) {
      x.classList.toggle('on', x.dataset.go === t.tab);
    });
    phone.setAttribute('data-mode', siteDark() !== !!t.flip ? 'dark' : 'light');
  }
  window.setScene = setScene;
  // the tour plays by itself until someone takes over
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function play() {
    if (calm || timer) return;
    timer = setInterval(function () {
      if (!document.hidden) setScene(current + 1);
    }, 5500);
  }
  tabs.forEach(function (b, n) {
    b.addEventListener('click', function () {
      stop();
      setScene(n);
    });
    b.addEventListener('keydown', function (e) {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      stop();
      const next = (n + step + tabs.length) % tabs.length;
      tabs[next].focus();
      setScene(next);
    });
  });
  // a tab on the phone works too
  const TAB_SCENE = { home: 0, activity: 2, plan: 3, reports: 4 };
  document.querySelectorAll('.phone .tabx').forEach(function (x) {
    x.addEventListener('click', function () {
      stop();
      setScene(TAB_SCENE[x.dataset.go]);
    });
  });
  function sizePhone() {
    const box = document.querySelector('.hero-phone');
    if (!box || !fit) return;
    const h = box.clientHeight;
    fit.style.setProperty('--ps', Math.max(0.5, Math.min(1.08, (h - 24) / 620)).toFixed(3));
  }
  addEventListener('resize', sizePhone);

  if (toggle)
    toggle.addEventListener('click', function () {
      const next = siteDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('yume-theme', next);
      } catch {
        /* the choice just lasts until the page closes */
      }
      setScene(current < 0 ? 0 : current);
    });

  sizePhone();
  setScene(0);
  play();

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
      { threshold: 0.08 }
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
