// The download section: say who it is for, and keep the link, version and checksum on the newest release.
// The page already holds the last known release, so nothing here is needed for it to work.
(function () {
  const btn = document.getElementById('dl-btn');
  if (!btn) return;
  const sub = document.getElementById('dl-sub');
  const hash = document.getElementById('hash');
  const note = document.getElementById('dl-note');

  // An iPhone or a computer cannot install an APK: say so kindly and offer the link.
  const ua = navigator.userAgent || '';
  if (note && !/Android/i.test(ua)) {
    note.hidden = false;
    note.textContent = /iPhone|iPad|iPod/i.test(ua)
      ? 'Yume is for Android phones, so it will not install on an iPhone or iPad. Open this page on an Android phone to get it.'
      : 'Yume installs on Android phones. Open this page on your phone, or send yourself the link.';
    const share = document.createElement('button');
    share.type = 'button';
    share.textContent = navigator.share ? 'Share link' : 'Copy link';
    share.addEventListener('click', function () {
      const url = location.href.split('#')[0];
      if (navigator.share) navigator.share({ title: 'Yume', url: url }).catch(function () {});
      else
        navigator.clipboard
          .writeText(url)
          .then(function () {
            share.textContent = 'Copied';
          })
          .catch(function () {
            share.textContent = 'Select the address bar';
          });
    });
    note.appendChild(share);
  }

  function apply(rel) {
    const apk = (rel.assets || []).find(function (a) {
      return /\.apk$/i.test(a.name);
    });
    if (!apk) return;
    const version = String(rel.tag_name || '').replace(/^v/i, '');
    const arm = /arm64/i.test(apk.name) ? ' (arm64)' : '';
    const when = rel.published_at
      ? new Date(rel.published_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';
    if (sub)
      sub.textContent =
        'Version ' +
        version +
        ' for Android phones' +
        arm +
        ', about ' +
        Math.round(apk.size / 1048576) +
        ' MB.' +
        (when ? ' Released ' + when + '.' : '');
    btn.href = apk.browser_download_url;
    btn.textContent = 'Download Yume ' + version + ' (.apk)';
    const sum = /SHA-256:\s*([0-9a-f]{64})/i.exec(rel.body || '');
    if (hash)
      hash.textContent = sum ? sum[1].toLowerCase() : 'Not listed for this release. See the release page.';
  }

  let cached = null;
  try {
    cached = JSON.parse(sessionStorage.getItem('yume-release') || 'null');
  } catch {
    /* storage can be blocked */
  }
  if (cached && Date.now() - cached.at < 600000) return apply(cached.rel);
  fetch('https://api.github.com/repos/hemuush/yume/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then(function (r) {
      return r.ok ? r.json() : Promise.reject(new Error('no release'));
    })
    .then(function (rel) {
      apply(rel);
      try {
        sessionStorage.setItem(
          'yume-release',
          JSON.stringify({
            at: Date.now(),
            rel: {
              tag_name: rel.tag_name,
              published_at: rel.published_at,
              body: rel.body,
              assets: (rel.assets || []).map(function (a) {
                return { name: a.name, size: a.size, browser_download_url: a.browser_download_url };
              }),
            },
          })
        );
      } catch {
        /* the next visit just asks again */
      }
    })
    .catch(function () {
      /* offline or rate limited: the page keeps the last known release */
    });
})();
