// Theme toggle and the screen tabs. Everything else on the site is plain HTML.
(function () {
  const root = document.documentElement;
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

  const tabs = document.querySelectorAll('[role=tab]');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        const on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });
})();
