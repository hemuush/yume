// Theme toggle, the sample phone, reveal on scroll, the sticky download bar and the checksum copy button.
// The page reads fine without any of it.
(function () {
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    const saved = localStorage.getItem('yume-theme');
    if (saved) root.setAttribute('data-theme', saved);
  } catch {
    /* storage can be blocked: the phone's own light or dark setting still applies */
  }
  const toggle = document.getElementById('theme');
  if (toggle)
    toggle.addEventListener('click', function () {
      const dark =
        root.getAttribute('data-theme') === 'dark' ||
        (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      const next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('yume-theme', next);
      } catch {
        /* the choice just lasts until the page closes */
      }
    });

  // Sample phone: tabs by tap or arrow keys, and a gentle auto-cycle until the visitor picks one.
  const tabs = Array.from(document.querySelectorAll('.picker [role=tab]'));
  let timer;
  function show(tab) {
    tabs.forEach(function (t) {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).classList.toggle('on', on);
      const bar = document.querySelector('.tabx[data-go="' + t.id.slice(2) + '"]');
      if (bar) bar.classList.toggle('on', on);
    });
  }
  // The phone's own tab bar works too.
  document.querySelectorAll('.tabx').forEach(function (bar) {
    bar.addEventListener('click', function () {
      const tab = document.getElementById('b-' + bar.dataset.go);
      if (tab) {
        clearInterval(timer);
        show(tab);
      }
    });
  });

  // The phone has its own light and dark, as the app does. It starts in the site's mode.
  const phone = document.querySelector('.phone');
  const modes = document.querySelectorAll('.mode button');
  function setMode(mode) {
    if (!phone) return;
    phone.setAttribute('data-mode', mode);
    modes.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.set === mode ? 'true' : 'false');
    });
  }
  modes.forEach(function (b) {
    b.addEventListener('click', function () {
      setMode(b.dataset.set);
    });
  });
  const siteDark =
    root.getAttribute('data-theme') === 'dark' ||
    (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  setMode(siteDark ? 'dark' : 'light');
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      clearInterval(timer);
      show(tab);
    });
    tab.addEventListener('keydown', function (e) {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      clearInterval(timer);
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      show(next);
    });
  });
  if (tabs.length) {
    show(tabs[0]);
    if (!calm) {
      let at = 0;
      timer = setInterval(function () {
        at = (at + 1) % tabs.length;
        show(tabs[at]);
      }, 4500);
    }
  }

  // Cards fade in as they scroll into view.
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
      { threshold: 0.12 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add('in-view');
    });
  }

  // The download bar on small screens shows once the top of the page has gone and hides at the download section.
  const sticky = document.getElementById('sticky');
  const hero = document.querySelector('.hero');
  const download = document.getElementById('download');
  if (sticky && hero && 'IntersectionObserver' in window) {
    let heroSeen = true;
    let dlSeen = false;
    const update = function () {
      sticky.classList.toggle('show', !heroSeen && !dlSeen);
    };
    new IntersectionObserver(function (entries) {
      heroSeen = entries[0].isIntersecting;
      update();
    }).observe(hero);
    if (download)
      new IntersectionObserver(function (entries) {
        dlSeen = entries[0].isIntersecting;
        update();
      }).observe(download);
  }

  const copy = document.getElementById('copy');
  const hash = document.getElementById('hash');
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
