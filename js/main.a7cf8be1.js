/* Экоинжпром — интерфейс сайта (vanilla JS, без зависимостей).
   Меню, модальные формы, отправка заявок, фильтры каталога, галерея, вкладки, поиск, карта.
   Сайт полностью читается без JS: всё содержимое уже в HTML. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
  };
  const goal = (name, params) => { try { if (window.ym && window.YM_ID) window.ym(window.YM_ID, 'reachGoal', name, params); } catch { /* */ } };

  /* ---------------- меню ---------------- */
  const megaBtn = $('[data-mega-btn]');
  const mega = $('[data-mega]');
  const closeAll = (except) => {
    if (mega && except !== mega) { mega.classList.remove('open'); megaBtn?.setAttribute('aria-expanded', 'false'); }
    $$('[data-drop-btn]').forEach((b) => { const d = $('#' + b.getAttribute('aria-controls')); if (d !== except) { d.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); } });
  };
  megaBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !mega.classList.contains('open');
    closeAll(mega);
    mega.classList.toggle('open', open);
    megaBtn.setAttribute('aria-expanded', String(open));
  });
  $$('[data-drop-btn]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const d = $('#' + b.getAttribute('aria-controls'));
    const open = !d.classList.contains('open');
    closeAll(d);
    d.classList.toggle('open', open);
    b.setAttribute('aria-expanded', String(open));
  }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.mega-in, .drop')) closeAll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  const burger = $('[data-burger]');
  const mnav = $('#mnav');
  burger?.addEventListener('click', () => {
    const open = mnav.hidden;
    mnav.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-${open ? 'close' : 'menu'}"/></svg>`;
    document.documentElement.style.overflow = open ? 'hidden' : '';
  });
  mnav?.addEventListener('click', (e) => { if (e.target.closest('a')) { mnav.hidden = true; document.documentElement.style.overflow = ''; burger.setAttribute('aria-expanded', 'false'); } });

  /* ---------------- модальные окна ---------------- */
  const dlg = (id) => document.getElementById('dlg-' + id);
  const openDialog = (id, opts = {}) => {
    const d = dlg(id);
    if (!d) return;
    if (!mnav.hidden) burger.click();
    if (opts.title) { const h = d.querySelector('h2'); h.dataset.orig ??= h.textContent; h.textContent = opts.title; }
    if (opts.descr !== undefined) { const p = d.querySelector('[data-dlg-descr]'); if (p) { p.dataset.orig ??= p.textContent; p.textContent = opts.descr; } }
    if (opts.model !== undefined) { const m = d.querySelector('[name=model]'); if (m) m.value = opts.model; }
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    const first = d.querySelector('input:not([type=hidden]):not([tabindex="-1"]), textarea, [data-site-search]');
    if (first) setTimeout(() => first.focus(), 50);
    if (id === 'search') loadIndex();
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    e.preventDefault();
    openDialog(b.dataset.open, { title: b.dataset.dlgTitle, descr: b.dataset.dlgDescr, model: b.dataset.model });
  });
  $$('dialog.modal').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.addEventListener('close', () => {
      const h = d.querySelector('h2'); if (h?.dataset.orig) { h.textContent = h.dataset.orig; delete h.dataset.orig; }
      const p = d.querySelector('[data-dlg-descr]'); if (p?.dataset.orig !== undefined) { p.textContent = p.dataset.orig; delete p.dataset.orig; }
    });
  });
  // совместимость со ссылками Тильды: #popup:zakazat-zvonok, #popup:…, #order (корзины больше нет — открываем заявку)
  const legacyHash = () => {
    const h = decodeURIComponent(location.hash);
    if (h === '#popup:zakazat-zvonok') openDialog('callback');
    else if (h.startsWith('#popup:')) openDialog('request');
    else if (h === '#order') openDialog('request');
    else if (h === '#opensearch') openDialog('search');
  };
  window.addEventListener('hashchange', legacyHash);
  legacyHash();

  /* ---------------- формы ---------------- */
  const utm = (() => {
    const p = new URLSearchParams(location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const found = Object.fromEntries(keys.filter((k) => p.get(k)).map((k) => [k, p.get(k)]));
    if (Object.keys(found).length) { try { sessionStorage.setItem('utm', JSON.stringify(found)); } catch { /* */ } return found; }
    try { return JSON.parse(sessionStorage.getItem('utm') || '{}'); } catch { return {}; }
  })();
  // маска телефона +7 (000) 000-00-00
  const maskPhone = (v) => {
    let d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = '+7';
    if (p[0]) out += ' (' + p[0] + (p[0].length === 3 ? ')' : '');
    if (p[1]) out += ' ' + p[1];
    if (p[2]) out += '-' + p[2];
    if (p[3]) out += '-' + p[3];
    return out;
  };
  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-mask=phone]')) e.target.value = maskPhone(e.target.value);
    const f = e.target.closest('.field'); if (f) { f.classList.remove('has-err'); const m = f.querySelector('.err-msg'); if (m) m.textContent = ''; }
  });
  const stamp = () => $$('form[data-form]').forEach((f) => { f.ts.value = Date.now(); f.page.value = location.href; });
  stamp();

  const validate = (form) => {
    let ok = true;
    const setErr = (name, msg) => {
      ok = false;
      const m = form.querySelector(`[data-err="${name}"]`);
      if (m) m.textContent = msg;
      const field = form.querySelector(`[name="${name}"]`)?.closest('.field');
      field?.classList.add('has-err');
    };
    $$('input, textarea', form).forEach((el) => {
      if (el.type === 'hidden' || el.name === 'website') return;
      const v = el.value.trim();
      if (el.type === 'checkbox') { if (el.required && !el.checked) setErr(el.name, 'Нужно согласие на обработку персональных данных'); return; }
      if (el.required && !v) return setErr(el.name, 'Заполните поле');
      if (v && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) setErr(el.name, 'Проверьте адрес почты');
      if (v && el.type === 'tel' && v.replace(/\D/g, '').length < 11) setErr(el.name, 'Введите номер полностью');
    });
    if (!ok) form.querySelector('.has-err input, .has-err textarea, [name=consent]:not(:checked)')?.focus();
    return ok;
  };
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const status = form.querySelector('.form-status');
    status.className = 'form-status';
    status.textContent = '';
    if (!validate(form)) return;
    if (document.documentElement.hasAttribute('data-demo')) { // демо на GitHub Pages: PHP там нет
      status.className = 'form-status ok';
      status.textContent = 'Это демонстрационная версия сайта — заявки отсюда не отправляются.';
      return;
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    const fd = new FormData(form);
    for (const [k, v] of Object.entries(utm)) fd.append(k, v);
    try {
      const r = await fetch(form.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      const j = await r.json().catch(() => ({ ok: false, message: 'Сервер не ответил. Позвоните нам, пожалуйста.' }));
      if (j.ok) {
        status.className = 'form-status ok';
        status.textContent = j.message;
        form.reset();
        stamp();
        goal('form_submit', { form: form.dataset.form });
      } else {
        status.className = 'form-status bad';
        status.textContent = j.message || 'Не удалось отправить. Попробуйте ещё раз.';
        for (const [name, msg] of Object.entries(j.fields || {})) { const m = form.querySelector(`[data-err="${name}"]`); if (m) m.textContent = msg; form.querySelector(`[name="${name}"]`)?.closest('.field')?.classList.add('has-err'); }
      }
    } catch {
      status.className = 'form-status bad';
      status.textContent = 'Нет связи с сервером. Проверьте интернет или позвоните нам.';
    } finally { btn.disabled = false; }
  });
  // цели: клики по телефону и почте
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (a) goal(a.href.startsWith('tel:') ? 'phone_click' : 'email_click');
  });

  /* ---------------- каталог: фильтры, сортировка, поиск ---------------- */
  const cat = $('[data-catalog]');
  if (cat) {
    const grid = $('[data-grid]', cat);
    const cards = $$('[data-card]', grid);
    const q = $('[data-q]', cat);
    const sort = $('[data-sort]', cat);
    const found = $('[data-found]', cat);
    const empty = $('[data-empty]');
    const boxes = $$('[data-filter]', cat);
    const panel = $('[data-filters]', cat);
    const original = cards.slice();
    const apply = () => {
      const term = (q.value || '').trim().toLowerCase();
      const active = {};
      boxes.filter((b) => b.checked).forEach((b) => { (active[b.dataset.filter] ||= []).push(b.value); });
      let n = 0;
      cards.forEach((c) => {
        let show = !term || c.dataset.name.includes(term) || c.dataset.sku.includes(term);
        for (const [i, vals] of Object.entries(active)) if (!vals.includes(c.dataset['f' + i])) show = false;
        c.hidden = !show;
        if (show) n++;
      });
      found.textContent = 'Найдено: ' + n;
      empty.hidden = n > 0;
      const s = sort.value;
      const by = {
        'price-asc': (a, b) => (+a.dataset.price || Infinity) - (+b.dataset.price || Infinity),
        'price-desc': (a, b) => (+b.dataset.price || -1) - (+a.dataset.price || -1),
        'name-asc': (a, b) => a.dataset.name.localeCompare(b.dataset.name, 'ru'),
        'name-desc': (a, b) => b.dataset.name.localeCompare(a.dataset.name, 'ru'),
        new: (a, b) => +b.dataset.created - +a.dataset.created,
        old: (a, b) => +a.dataset.created - +b.dataset.created,
      }[s];
      const ordered = by ? cards.slice().sort(by) : original;
      const frag = document.createDocumentFragment();
      ordered.forEach((c) => frag.appendChild(c));
      grid.appendChild(frag);
      // состояние в URL — можно поделиться ссылкой
      const params = new URLSearchParams();
      if (term) params.set('q', term);
      if (s !== 'default') params.set('sort', s);
      boxes.filter((b) => b.checked).forEach((b) => params.append('f' + b.dataset.filter, b.value));
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
      grid.dispatchEvent(new CustomEvent('filtered'));
    };
    // восстановление из URL
    const params = new URLSearchParams(location.search);
    if (params.get('q')) q.value = params.get('q');
    if (params.get('sort')) sort.value = params.get('sort');
    boxes.forEach((b) => { if (params.getAll('f' + b.dataset.filter).includes(b.value)) b.checked = true; });
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 120); });
    sort.addEventListener('change', apply);
    boxes.forEach((b) => b.addEventListener('change', apply));
    $('[data-reset]', cat)?.addEventListener('click', () => { boxes.forEach((b) => { b.checked = false; }); q.value = ''; apply(); });
    const toggle = $('[data-filters-toggle]', cat);
    toggle?.addEventListener('click', () => { const c = panel.dataset.collapsed === 'true'; panel.dataset.collapsed = String(!c); toggle.setAttribute('aria-expanded', String(c)); });
    if (location.search) apply();
  }

  /* ---------------- галерея товара ---------------- */
  const gal = $('[data-gallery]');
  if (gal) {
    const figs = $$('.gallery-main figure', gal);
    const thumbs = $$('[data-thumb]', gal);
    let cur = 0;
    const show = (i) => {
      cur = (i + figs.length) % figs.length;
      figs.forEach((f, k) => { f.classList.toggle('is-on', k === cur); f.setAttribute('aria-hidden', String(k !== cur)); });
      thumbs.forEach((t, k) => t.setAttribute('aria-current', String(k === cur)));
    };
    thumbs.forEach((t) => t.addEventListener('click', () => show(+t.dataset.thumb)));
    let x0 = null;
    const main = $('.gallery-main', gal);
    main.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    main.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) show(cur + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    main.tabIndex = figs.length > 1 ? 0 : -1;
    main.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
  }

  /* ---------------- вкладки (с поддержкой старых адресов #!/tab/2657953001-2) ---------------- */
  const tabs = $('[data-tabs]');
  if (tabs) {
    const btns = $$('[role=tab]', tabs);
    const select = (b, focus) => {
      btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; });
      if (focus) b.focus();
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => { select(b); history.replaceState(null, '', '#' + b.dataset.tab); });
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); select(btns[(i + d + btns.length) % btns.length], true); }
      });
    });
    const fromHash = () => {
      const h = decodeURIComponent(location.hash);
      const b = btns.find((x) => '#' + x.dataset.tab === h || x.dataset.legacy === h);
      if (b) { select(b); if (b.dataset.legacy === h) history.replaceState(null, '', '#' + b.dataset.tab); tabs.scrollIntoView({ block: 'start' }); }
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* ---------------- слайдер в hero ---------------- */
  const slider = $('[data-slider]');
  if (slider) {
    const slides = $$('[data-slide]', slider);
    const dots = $$('[data-dot]', slider);
    const link = $('[data-slide-link]', slider);
    const title = $('[data-slide-title]', slider);
    let cur = 0;
    let timer;
    const go = (i) => {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('is-on', k === cur); s.setAttribute('aria-hidden', String(k !== cur)); });
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === cur)));
      link.href = dots[cur].dataset.href;
      title.textContent = dots[cur].dataset.title;
    };
    dots.forEach((d) => d.addEventListener('click', () => { go(+d.dataset.dot); restart(); }));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const restart = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => { if (!document.hidden) go(cur + 1); }, 6000); };
    slider.addEventListener('pointerenter', () => clearInterval(timer));
    slider.addEventListener('pointerleave', restart);
    restart();
  }

  /* ---------------- карта Яндекса — только по клику ---------------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-map-load]');
    if (!b) return;
    const m = b.closest('[data-map]');
    const { lat, lng, zoom } = m.dataset;
    const f = document.createElement('iframe');
    f.src = `https://yandex.ru/map-widget/v1/?ll=${lng}%2C${lat}&z=${zoom}&pt=${lng}%2C${lat}%2Cpm2blm&l=map`;
    f.title = 'Карта: ' + (m.dataset.title || 'офис');
    f.loading = 'lazy';
    f.allowFullscreen = true;
    m.appendChild(f);
    b.remove();
  });

  /* ---------------- поиск по сайту (индекс грузится лениво) ---------------- */
  let index = null;
  const input = $('[data-site-search]');
  const results = $('[data-site-results]');
  async function loadIndex() {
    if (index) return index;
    try { index = await (await fetch((window.EKO_BASE || '/') + 'search-index.json')).json(); } catch { index = []; }
    return index;
  }
  const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');
  input?.addEventListener('input', async () => {
    const term = norm(input.value.trim());
    const idx = await loadIndex();
    if (term.length < 2) { results.innerHTML = ''; return; }
    const words = term.split(/\s+/);
    const hits = idx.filter((x) => { const hay = norm(`${x.t} ${x.s} ${x.b} ${x.c}`); return words.every((w) => hay.includes(w)); }).slice(0, 30);
    results.innerHTML = hits.length ? hits.map((x) => `<li><a href="${x.u}">${x.i ? `<img src="${x.i}" alt="" width="48" height="48" loading="lazy">` : '<span class="sr-ph"></span>'}<span><b>${x.t.replace(/</g, '&lt;')}</b><small>${[x.c, x.s ? 'арт. ' + x.s : ''].filter(Boolean).join(' · ')}</small></span></a></li>`).join('')
      : '<li class="muted">Ничего не найдено. <button class="linklike" type="button" data-open="request">Оставьте заявку</button> — подберём.</li>';
  });

  /* ---------------- cookie ---------------- */
  const ck = $('[data-cookie]');
  if (ck && !store.get('eko_cookie_ok', false)) { ck.hidden = false; $('[data-cookie-ok]', ck).addEventListener('click', () => { store.set('eko_cookie_ok', true); ck.hidden = true; }); }
})();
