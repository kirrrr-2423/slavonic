'use strict';
/* Веб-версия: здесь то, что в программе для компьютера делает Electron —
   шрифт, буфер обмена, внешние ссылки, горячие клавиши; плюс меню для телефона,
   установка и работа без интернета (service worker). */
(() => {
  const nav = navigator;
  const P = nav.userAgentData && nav.userAgentData.platform ? nav.userAgentData.platform : (nav.platform || nav.userAgent);
  const platform = /mac|iphone|ipad|ipod/i.test(P) ? 'darwin' : /win/i.test(P) ? 'win32' : 'linux';
  const root = document.documentElement;
  root.classList.add('web');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  if (standalone()) root.classList.add('standalone');

  /* ---------- шрифт Ponomar: Google Fonts (SIL OFL), service worker хранит его для работы без интернета ---------- */
  const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Ponomar&text=%20%21%22%23%24%25%26%27%28%29%2A%2B%2C-.%2F0123456789%3A%3B%3C%3D%3E%3F%40ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%C2%AB%C2%B7%C2%BB%CC%80%CC%81%CC%82%CC%83%CC%84%CC%85%CC%86%CC%87%CC%88%CC%89%CC%8A%CC%8B%CC%8C%CC%8D%CC%8E%CC%8F%CC%90%CC%91%CC%92%CC%93%CC%94%CC%95%CC%96%CC%97%CC%98%CC%99%CC%9A%CC%9B%CC%9C%CC%9D%CC%9E%CC%9F%CC%A0%CC%A1%CC%A2%CC%A3%CC%A4%CC%A5%CC%A6%CC%A7%CC%A8%CC%A9%CC%AA%CC%AB%CC%AC%CC%AD%CC%AE%CC%AF%CC%B0%CC%B1%CC%B2%CC%B3%CC%B4%CC%B5%CC%B6%CC%B7%CC%B8%CC%B9%CC%BA%CC%BB%CC%BC%CC%BD%CC%BE%CC%BF%CD%80%CD%81%CD%82%CD%83%CD%84%CD%85%CD%86%CD%87%CD%88%CD%89%CD%8A%CD%8B%CD%8C%CD%8D%CD%8E%CD%8F%CD%90%CD%91%CD%92%CD%93%CD%94%CD%95%CD%96%CD%97%CD%98%CD%99%CD%9A%CD%9B%CD%9C%CD%9D%CD%9E%CD%9F%CD%A0%CD%A1%CD%A2%CD%A3%CD%A4%CD%A5%CD%A6%CD%A7%CD%A8%CD%A9%CD%AA%CD%AB%CD%AC%CD%AD%CD%AE%CD%AF%D0%80%D0%81%D0%82%D0%83%D0%84%D0%85%D0%86%D0%87%D0%88%D0%89%D0%8A%D0%8B%D0%8C%D0%8D%D0%8E%D0%8F%D0%90%D0%91%D0%92%D0%93%D0%94%D0%95%D0%96%D0%97%D0%98%D0%99%D0%9A%D0%9B%D0%9C%D0%9D%D0%9E%D0%9F%D0%A0%D0%A1%D0%A2%D0%A3%D0%A4%D0%A5%D0%A6%D0%A7%D0%A8%D0%A9%D0%AA%D0%AB%D0%AC%D0%AD%D0%AE%D0%AF%D0%B0%D0%B1%D0%B2%D0%B3%D0%B4%D0%B5%D0%B6%D0%B7%D0%B8%D0%B9%D0%BA%D0%BB%D0%BC%D0%BD%D0%BE%D0%BF%D1%80%D1%81%D1%82%D1%83%D1%84%D1%85%D1%86%D1%87%D1%88%D1%89%D1%8A%D1%8B%D1%8C%D1%8D%D1%8E%D1%8F%D1%90%D1%91%D1%92%D1%93%D1%94%D1%95%D1%96%D1%97%D1%98%D1%99%D1%9A%D1%9B%D1%9C%D1%9D%D1%9E%D1%9F%D1%A0%D1%A1%D1%A2%D1%A3%D1%A4%D1%A5%D1%A6%D1%A7%D1%A8%D1%A9%D1%AA%D1%AB%D1%AC%D1%AD%D1%AE%D1%AF%D1%B0%D1%B1%D1%B2%D1%B3%D1%B4%D1%B5%D1%B6%D1%B7%D1%B8%D1%B9%D1%BA%D1%BB%D1%BC%D1%BD%D1%BE%D1%BF%D2%80%D2%81%D2%82%D2%83%D2%84%D2%85%D2%86%D2%87%D2%88%D2%89%D2%8A%D2%8B%D2%8C%D2%8D%D2%8E%D2%8F%D2%90%D2%91%D2%92%D2%93%D2%94%D2%95%D2%96%D2%97%D2%98%D2%99%D2%9A%D2%9B%D2%9C%D2%9D%D2%9E%D2%9F%D2%A0%D2%A1%D2%A2%D2%A3%D2%A4%D2%A5%D2%A6%D2%A7%D2%A8%D2%A9%D2%AA%D2%AB%D2%AC%D2%AD%D2%AE%D2%AF%D2%B0%D2%B1%D2%B2%D2%B3%D2%B4%D2%B5%D2%B6%D2%B7%D2%B8%D2%B9%D2%BA%D2%BB%D2%BC%D2%BD%D2%BE%D2%BF%D3%80%D3%81%D3%82%D3%83%D3%84%D3%85%D3%86%D3%87%D3%88%D3%89%D3%8A%D3%8B%D3%8C%D3%8D%D3%8E%D3%8F%D3%90%D3%91%D3%92%D3%93%D3%94%D3%95%D3%96%D3%97%D3%98%D3%99%D3%9A%D3%9B%D3%9C%D3%9D%D3%9E%D3%9F%D3%A0%D3%A1%D3%A2%D3%A3%D3%A4%D3%A5%D3%A6%D3%A7%D3%A8%D3%A9%D3%AA%D3%AB%D3%AC%D3%AD%D3%AE%D3%AF%D3%B0%D3%B1%D3%B2%D3%B3%D3%B4%D3%B5%D3%B6%D3%B7%D3%B8%D3%B9%D3%BA%D3%BB%D3%BC%D3%BD%D3%BE%D3%BF%E1%B2%80%E1%B2%81%E1%B2%82%E1%B2%83%E1%B2%84%E1%B2%85%E1%B2%86%E1%B2%87%E1%B2%88%E2%80%93%E2%80%94%E2%80%A6%E2%83%9D%E2%84%96%E2%86%90%E2%86%92%E2%B7%A0%E2%B7%A1%E2%B7%A2%E2%B7%A3%E2%B7%A4%E2%B7%A5%E2%B7%A6%E2%B7%A7%E2%B7%A8%E2%B7%A9%E2%B7%AA%E2%B7%AB%E2%B7%AC%E2%B7%AD%E2%B7%AE%E2%B7%AF%E2%B7%B0%E2%B7%B1%E2%B7%B2%E2%B7%B3%E2%B7%B4%E2%B7%B5%E2%B7%B6%E2%B7%B7%E2%B7%B8%E2%B7%B9%E2%B7%BA%E2%B7%BB%E2%B7%BC%E2%B7%BD%E2%B7%BE%E2%B7%BF%E2%B8%AF%EA%99%80%EA%99%81%EA%99%82%EA%99%83%EA%99%84%EA%99%85%EA%99%86%EA%99%87%EA%99%88%EA%99%89%EA%99%8A%EA%99%8B%EA%99%8C%EA%99%8D%EA%99%8E%EA%99%8F%EA%99%90%EA%99%91%EA%99%92%EA%99%93%EA%99%94%EA%99%95%EA%99%96%EA%99%97%EA%99%98%EA%99%99%EA%99%9A%EA%99%9B%EA%99%9C%EA%99%9D%EA%99%9E%EA%99%9F%EA%99%A0%EA%99%A1%EA%99%A2%EA%99%A3%EA%99%A4%EA%99%A5%EA%99%A6%EA%99%A7%EA%99%A8%EA%99%A9%EA%99%AA%EA%99%AB%EA%99%AC%EA%99%AD%EA%99%AE%EA%99%AF%EA%99%B0%EA%99%B1%EA%99%B2%EA%99%B3%EA%99%B4%EA%99%B5%EA%99%B6%EA%99%B7%EA%99%B8%EA%99%B9%EA%99%BA%EA%99%BB%EA%99%BC%EA%99%BD%EA%99%BE%EA%99%BF%EA%9A%80%EA%9A%81%EA%9A%82%EA%9A%83%EA%9A%84%EA%9A%85%EA%9A%86%EA%9A%87%EA%9A%88%EA%9A%89%EA%9A%8A%EA%9A%8B%EA%9A%8C%EA%9A%8D%EA%9A%8E%EA%9A%8F%EA%9A%90%EA%9A%91%EA%9A%92%EA%9A%93%EA%9A%94%EA%9A%95%EA%9A%96%EA%9A%97%EA%9A%98%EA%9A%99%EA%9A%9A%EA%9A%9B%EA%9A%9C%EA%9A%9D%EA%9A%9E%EA%9A%9F';
  const withTimeout = (ms) => {
    const c = typeof AbortController === 'function' ? new AbortController() : null;
    if (c) setTimeout(() => c.abort(), ms);
    return c ? { signal: c.signal } : {};
  };
  async function loadPonomar() {
    try {
      const css = await (await fetch(FONT_CSS, withTimeout(10000))).text();
      const m = css.match(/url\((https:[^)]+)\)/);
      if (!m) return null;
      const res = await fetch(m[1].replace(/^['"]|['"]$/g, ''), withTimeout(15000));
      return res.ok ? await res.arrayBuffer() : null;
    } catch (e) {
      return null;
    }
  }
  function pickFont() {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.ttf,.otf,.woff,.woff2';
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        resolve(f ? await f.arrayBuffer() : null);
      });
      inp.click();
    });
  }

  /* ---------- буфер обмена ---------- */
  async function copy(text) {
    text = String(text);
    if (nav.clipboard && window.isSecureContext) {
      try { await nav.clipboard.writeText(text); return true; } catch (e) { /* ниже — запасной способ */ }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy failed');
    return true;
  }

  /* ---------- горячие клавиши (те же, что в меню программы) ---------- */
  const SECTIONS = ['azbuka', 'znaki', 'pravopisanie', 'titla', 'cifir', 'chisla', 'chtenie', 'grammatika', 'imena'];
  const handlers = [];
  document.addEventListener('keydown', (e) => {
    const mod = platform === 'darwin' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!mod || e.altKey) return;
    let cmd = null;
    let arg = null;
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit && !e.shiftKey) { cmd = 'nav'; arg = SECTIONS[Number(digit[1]) - 1]; }
    else if (e.code === 'KeyK' && !e.shiftKey) { cmd = 'nav'; arg = 'klaviatura'; }
    else if (e.code === 'KeyP' && e.shiftKey) { cmd = 'nav'; arg = 'proverka'; }
    else if (e.code === 'KeyD' && !e.shiftKey) { cmd = 'nav'; arg = 'slovar'; }
    else if (e.code === 'KeyF' && !e.shiftKey) { cmd = 'search'; }
    if (!cmd) return;
    e.preventDefault();
    closeMenu();
    handlers.forEach((h) => h(cmd, arg));
  });

  window.slavApi = {
    platform,
    web: true,
    getFont: loadPonomar,
    downloadFont: loadPonomar,
    pickFont,
    copy,
    openExternal: (url) => { window.open(url, '_blank', 'noopener'); return true; },
    onMenu: (cb) => handlers.push(cb)
  };

  /* ---------- меню разделов на узком экране ---------- */
  const side = document.querySelector('.side');
  const brand = document.querySelector('.brand');
  const navEl = document.getElementById('nav');
  const fontEl = document.getElementById('fontstatus');
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  navEl.parentNode.insertBefore(drawer, navEl);
  drawer.appendChild(navEl);
  drawer.appendChild(fontEl);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.setAttribute('aria-label', 'Разделы');
  btn.setAttribute('aria-controls', 'drawer');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  brand.appendChild(btn);
  function closeMenu() {
    root.classList.remove('nav-open');
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', () => {
    const open = !root.classList.contains('nav-open');
    root.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
  navEl.addEventListener('click', (e) => { if (e.target.closest('.navbtn')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', (e) => { if (root.classList.contains('nav-open') && !side.contains(e.target)) closeMenu(); });
  document.getElementById('search').addEventListener('focus', closeMenu);

  /* ---------- широкие таблицы на телефоне прокручиваются вбок ---------- */
  const wrapTables = (rootEl) => {
    rootEl.querySelectorAll('table').forEach((t) => {
      if (t.parentElement && t.parentElement.classList.contains('tscroll')) return;
      const w = document.createElement('div');
      w.className = 'tscroll';
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });
  };
  const content = document.getElementById('content');
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => wrapTables(content)).observe(content, { childList: true, subtree: true });
  }

  /* ---------- установка как программы (Chrome, Edge, Android) ---------- */
  let deferred = null;
  const inst = document.createElement('button');
  inst.type = 'button';
  inst.className = 'btn small install-btn';
  inst.hidden = true;
  inst.textContent = 'Установить как программу';
  drawer.insertBefore(inst, fontEl);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    inst.hidden = false;
  });
  inst.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* окно закрыто */ }
    deferred = null;
    inst.hidden = true;
  });
  window.addEventListener('appinstalled', () => { inst.hidden = true; });

  /* ---------- работа без интернета и обновления ---------- */
  if ('serviceWorker' in nav && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const hadController = !!nav.serviceWorker.controller;
    nav.serviceWorker.register('sw.js').catch(() => { /* без офлайна */ });
    nav.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || document.getElementById('updbar')) return;
      const bar = document.createElement('div');
      bar.id = 'updbar';
      bar.className = 'update-bar';
      bar.setAttribute('role', 'status');
      bar.innerHTML = 'Вышла новая версия. <button type="button" class="btn small">Обновить</button>';
      bar.querySelector('button').addEventListener('click', () => location.reload());
      document.body.appendChild(bar);
    });
  }
})();
