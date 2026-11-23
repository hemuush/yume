// The interactive parts of the story: scroll motion, the feature finder, and Meet Suu (her lines, the Add chat and the garden).
// Everything here is optional: the page reads fine without it.
(function () {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const money = (n) => '₹' + Number(n).toLocaleString('en-IN');

  // ---------- scroll: the top bar and the day timeline ----------
  const bar = document.querySelector('.progress');
  const timeline = $('daytl');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.setProperty('--scroll', max > 0 ? Math.min(1, scrollY / max).toFixed(3) : '0');
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const p = (innerHeight * 0.6 - r.top) / r.height;
      timeline.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
    }
  }
  addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  // ---------- numbers that count up ----------
  document.querySelectorAll('[data-count]').forEach(function (el) {
    const to = Number(el.dataset.count);
    if (calm || !to) return;
    const start = performance.now();
    const ms = 1100;
    (function step(now) {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = money(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    })(start);
  });

  // ---------- the feature finder ----------
  const finder = document.querySelectorAll('.finder button');
  const tiles = document.querySelectorAll('.tile[data-tags]');
  finder.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const tag = btn.dataset.tag;
      finder.forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      tiles.forEach(function (t) {
        const show = tag === 'all' || t.dataset.tags.split(' ').indexOf(tag) >= 0;
        t.classList.toggle('off', !show);
        if (show) {
          t.classList.remove('pop');
          void t.offsetWidth;
          t.classList.add('pop');
          t.classList.add('in-view');
        }
      });
    });
  });

  // ---------- Meet Suu ----------
  const suu = $('suu');
  if (!suu) return;
  const poses = document.querySelectorAll('.suu-stage .segs button');
  function pose(p) {
    suu.dataset.pose = p;
    poses.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.pose === p ? 'true' : 'false');
    });
  }
  poses.forEach(function (b) {
    b.addEventListener('click', function () {
      pose(b.dataset.pose);
    });
  });
  suu.addEventListener('click', function () {
    suu.classList.remove('hop');
    void suu.offsetWidth;
    suu.classList.add('hop');
    if (suu.dataset.pose === 'sleepy') pose('awake');
  });

  // tabs
  const tabs = Array.from(document.querySelectorAll('.panel2 [role=tab]'));
  function openTab(tab) {
    tabs.forEach(function (t) {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      const pane = $(t.getAttribute('aria-controls'));
      pane.hidden = !on;
      pane.classList.toggle('on', on);
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      openTab(tab);
    });
    tab.addEventListener('keydown', function (e) {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      openTab(next);
    });
  });

  // Says: Suu's own lines for each kind of month
  const lines = [
    ['A fresh start', 'Log a few days and I’ll spot trends.'],
    ['Spent more than came in', 'Spending passed income this month.'],
    ['Spending went up', 'Spending up 12%'],
    ['A healthy month', '24% of income unspent.'],
    ['Steady', 'Spending is within income.'],
    ['Amounts hidden', 'Spending is below income.'],
  ];
  const chips = $('says-chips');
  const said = $('says-line');
  function say(i) {
    said.textContent = lines[i][1];
    said.classList.remove('swap');
    void said.offsetWidth;
    said.classList.add('swap');
    Array.from(chips.children).forEach(function (c, j) {
      c.setAttribute('aria-pressed', j === i ? 'true' : 'false');
    });
  }
  lines.forEach(function (l, i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = l[0];
    b.addEventListener('click', function () {
      say(i);
    });
    chips.appendChild(b);
  });
  say(3);

  // Asks: a small version of the Add chat
  const chat = $('chat');
  const cats = { Food: [120, 250, 480], Travel: [60, 150, 400], Shopping: [499, 999, 1999] };
  const usual = { label: 'Chai', cat: 'Food', amt: 60, acct: 'Cash' };
  let entry = {};
  const add = (cls, text) => {
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.textContent = text;
    chat.appendChild(d);
    return d;
  };
  function options(list, onPick, extraClass) {
    const row = document.createElement('div');
    row.className = 'opts';
    list.forEach(function (o) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      if (o.usual) b.className = 'usual';
      b.addEventListener('click', function () {
        row.remove();
        add('you', o.label);
        onPick(o);
      });
      row.appendChild(b);
    });
    if (extraClass) row.classList.add(extraClass);
    chat.appendChild(row);
    return row;
  }
  function ask(question, list, onPick) {
    add('bot', question);
    options(list, onPick);
  }
  function summary() {
    add('bot', 'Here is what I have. Check it before I save it.');
    const card = document.createElement('div');
    card.className = 'sumcard';
    card.innerHTML = '<b></b><small></small>';
    card.firstChild.textContent = money(entry.amt);
    card.lastChild.textContent = entry.cat + ' · ' + entry.acct + ' · ' + entry.day;
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn main';
    save.textContent = 'Save';
    save.addEventListener('click', function () {
      card.remove();
      add('bot', 'Saved. ' + money(entry.amt) + ' on ' + entry.cat + ', from ' + entry.acct + '.');
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'restart';
      again.textContent = 'Add another';
      again.addEventListener('click', start);
      chat.appendChild(again);
    });
    card.appendChild(save);
    chat.appendChild(card);
  }
  function when() {
    ask('When was it?', [{ label: 'Today' }, { label: 'Yesterday' }], function (o) {
      entry.day = o.label;
      summary();
    });
  }
  function start() {
    chat.textContent = '';
    entry = {};
    ask(
      'What was it for?',
      [
        { label: usual.label + ' · ' + money(usual.amt) + ' · ' + usual.acct, usual: true },
        { label: 'Food' },
        { label: 'Travel' },
        { label: 'Shopping' },
      ],
      function (o) {
        if (o.usual) {
          entry = { cat: usual.cat, amt: usual.amt, acct: usual.acct };
          when();
          return;
        }
        entry.cat = o.label;
        ask(
          'How much?',
          cats[o.label].map(function (n) {
            return { label: money(n), n: n };
          }),
          function (a) {
            entry.amt = a.n;
            ask('From which account?', [{ label: 'Cash' }, { label: 'HDFC Bank' }], function (c) {
              entry.acct = c.label;
              when();
            });
          }
        );
      }
    );
  }
  start();

  // Grows: Suu's garden. A day counts when it ends at or under the daily goal; 1-2 days sprout, 3-6 sapling, 7+ bloom.
  const days = $('days');
  const kept = [1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1].map(Boolean);
  const names = ['Seed', 'Sprout', 'Sapling', 'Bloom'];
  const stageFor = (n) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 6 ? 2 : 3);
  const heights = [0, 16, 21, 25];
  const leaves = [0, 0.55, 0.8, 1];
  function plant(stage) {
    const h = heights[stage];
    const s = leaves[stage];
    const top = 46 - h;
    let g = '<ellipse cx="22" cy="47" rx="14" ry="3" fill="#cdb79a" opacity=".6"/>';
    if (stage === 0) {
      g += '<circle cx="22" cy="44" r="2.2" fill="#8b6b4a"/>';
    } else {
      g += '<path d="M22 46 V' + top + '" stroke="#2fb98a" stroke-width="2.4" stroke-linecap="round"/>';
      const lw = 7 * s;
      const lh = 3.4 * s;
      g +=
        '<ellipse cx="' +
        (22 - lw) +
        '" cy="' +
        (top + 4) +
        '" rx="' +
        lw +
        '" ry="' +
        lh +
        '" transform="rotate(-28 ' +
        (22 - lw) +
        ' ' +
        (top + 4) +
        ')" fill="#8fe8c8" stroke="#2fb98a" stroke-width="1"/>';
      g +=
        '<ellipse cx="' +
        (22 + lw) +
        '" cy="' +
        (top + 8) +
        '" rx="' +
        lw +
        '" ry="' +
        lh +
        '" transform="rotate(28 ' +
        (22 + lw) +
        ' ' +
        (top + 8) +
        ')" fill="#8fe8c8" stroke="#2fb98a" stroke-width="1"/>';
    }
    if (stage === 3) {
      [0, 72, 144, 216, 288].forEach(function (a) {
        g +=
          '<circle cx="22" cy="' +
          (top - 5) +
          '" r="3.2" fill="#ffd6cc" transform="rotate(' +
          a +
          ' 22 ' +
          top +
          ')"/>';
      });
      g += '<circle cx="22" cy="' + top + '" r="3.4" fill="#fc7b5e"/>';
    }
    g += '<path d="M12 47 h20 l-2 9 h-16 z" fill="#9ec5fc"/>';
    return '<g class="grown">' + g + '</g>';
  }
  function grow() {
    let streak = 0;
    for (let i = kept.length - 1; i >= 0 && kept[i]; i--) streak++;
    const stage = stageFor(streak);
    $('plant').innerHTML = plant(stage);
    $('stage').textContent = names[stage];
    $('streak').textContent =
      streak === 0
        ? 'A day went over the goal, so the streak starts again. Tap a day to keep it.'
        : streak +
          (streak === 1 ? ' day' : ' days') +
          ' kept in a row' +
          (stage < 3 ? '. Seven days make it bloom.' : '. In full bloom.');
    Array.from(days.children).forEach(function (b, i) {
      b.setAttribute('aria-pressed', kept[i] ? 'true' : 'false');
      b.classList.toggle('deep', kept[i] && streak >= 7 && i >= kept.length - streak);
    });
  }
  kept.forEach(function (_, i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = i + 1;
    b.setAttribute('aria-label', 'Day ' + (i + 1));
    b.addEventListener('click', function () {
      kept[i] = !kept[i];
      grow();
    });
    days.appendChild(b);
  });
  grow();
})();
