/* Экоинжпром — анимации (ES-модуль, грузится после контента и ничего не блокирует).
   Правила: только transform/opacity (и пересчёт контура шестерёнки), финальное состояние задано в CSS,
   prefers-reduced-motion — без анимаций вообще, без JS — всё видно сразу. */
const LOGO = {"cx":573,"cy":368,"rx":311,"ry":240,"teeth":12,"rTip":1,"rRoot":0.865,"tipHalf":0.15009831567151233,"rootHalf":0.1884955592153876};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 767px)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Контур шестерёнки при повороте theta (рад). Та же формула, что в scripts/logo.py:
   зубцы на окружности проецируются на эллипс rx×ry — поворот выглядит как вращение наклонённой шестерёнки. */
function gearPath(theta) {
  const { cx, cy, rx, ry, teeth, rTip, rRoot, tipHalf, rootHalf } = LOGO;
  const P = (a, r) => `${(cx + rx * r * Math.cos(a)).toFixed(1)} ${(cy + ry * r * Math.sin(a)).toFixed(1)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = -Math.PI / 2 + theta + (i * 2 * Math.PI) / teeth;
    if (i === 0) d += `M${P(a - rootHalf, rRoot)}`;
    d += `L${P(a - tipHalf, rTip)}L${P(a + tipHalf, rTip)}L${P(a + rootHalf, rRoot)}`;
    const n = a + (2 * Math.PI) / teeth;
    d += `A${(rx * rRoot).toFixed(1)} ${(ry * rRoot).toFixed(1)} 0 0 1 ${P(n - rootHalf, rRoot)}`;
  }
  return d + 'Z';
}
const ease = (t) => 1 - Math.pow(1 - t, 4); // мягкое замедление

/* ---------------- 1. Вступление логотипа в hero (один раз за сессию) ---------------- */
function intro() {
  const box = document.querySelector('[data-intro]');
  if (!box || !LOGO.cx) return;
  let seen = false;
  try { seen = sessionStorage.getItem('eko_intro') === '1'; sessionStorage.setItem('eko_intro', '1'); } catch { seen = true; }
  if (seen || reduce) return; // финальное состояние уже нарисовано в HTML/CSS

  const gear = box.querySelector('.gear-spin');
  const title = box.querySelector('.lg-title');
  const inner = box.querySelector('.lg-inner');
  const dur = mobile ? 750 : 1350;
  const spin = mobile ? 0 : Math.PI; // пол-оборота на десктопе, без вращения на мобильном
  const gearPart = mobile ? 0 : 0.62; // доля времени на вращение
  let raf = 0;
  let start = 0;
  const finish = () => {
    cancelAnimationFrame(raf);
    gear.setAttribute('d', gearPath(0));
    title.style.cssText = inner.style.cssText = box.style.cssText = '';
    ['pointerdown', 'wheel', 'keydown', 'touchstart', 'scroll'].forEach((ev) => removeEventListener(ev, finish, true));
  };
  const frame = (now) => {
    start ||= now;
    const t = Math.min(1, (now - start) / dur);
    // шестерёнка: поворот -π → 0 с замедлением
    if (spin) {
      const g = Math.min(1, t / gearPart);
      gear.setAttribute('d', gearPath(-spin * (1 - ease(g))));
    }
    // овал и надпись проявляются: opacity + сдвиг/маска слева направо
    const tt = Math.max(0, Math.min(1, (t - (spin ? gearPart * 0.55 : 0)) / (1 - (spin ? gearPart * 0.55 : 0))));
    const e = ease(tt);
    title.style.opacity = e;
    title.style.clipPath = `inset(0 ${(1 - e) * 100}% 0 0)`;
    title.style.transform = `translateX(${(1 - e) * -14}px)`;
    inner.style.opacity = Math.min(1, e * 1.6);
    if (mobile) box.style.transform = `scale(${0.96 + 0.04 * ease(t)})`;
    if (t < 1) raf = requestAnimationFrame(frame); else finish();
  };
  // старт с «нулевого» кадра без мигания: стили ставим синхронно
  title.style.opacity = 0;
  inner.style.opacity = 0;
  if (spin) gear.setAttribute('d', gearPath(-spin));
  ['pointerdown', 'wheel', 'keydown', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, finish, { capture: true, passive: true, once: true }));
  raf = requestAnimationFrame(frame);
}

/* ---------------- 2. Шестерёнка в шапке поворачивается при прокрутке ---------------- */
function headerGear() {
  const gear = document.querySelector('.hdr-logo .gear-spin');
  if (!gear || reduce || !LOGO.cx) return;
  let target = 0;
  let cur = 0;
  let ticking = false;
  const step = () => {
    cur += (target - cur) * 0.18; // плавное догоняние без рывков
    gear.setAttribute('d', gearPath(cur));
    if (Math.abs(target - cur) > 0.0005) requestAnimationFrame(step); else ticking = false;
  };
  addEventListener('scroll', () => {
    target = (scrollY / 900) * (Math.PI / 3); // 60° на 900 px прокрутки
    if (!ticking) { ticking = true; requestAnimationFrame(step); }
  }, { passive: true });
}

/* ---------------- 3. Появление секций ---------------- */
function reveals() {
  if (reduce || !('IntersectionObserver' in window)) return;
  const els = [...document.querySelectorAll('.reveal')];
  // элементы, уже видимые на первом экране, не прячем (контент никогда не скрыт до запуска анимаций)
  const vh = innerHeight;
  const below = els.filter((el) => el.getBoundingClientRect().top > vh * 0.92);
  if (!below.length) return;
  document.documentElement.classList.add('motion');
  els.filter((el) => !below.includes(el)).forEach((el) => el.classList.add('in'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  below.forEach((el) => io.observe(el));
}

/* ---------------- 4. Параллакс-глубина фото (только десктоп) ---------------- */
function parallax() {
  if (reduce || mobile || !fine) return;
  const items = [...document.querySelectorAll('[data-parallax]')];
  if (!items.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1
      el.querySelectorAll('img').forEach((img) => { img.style.transform = `translate3d(0, ${(k * -28).toFixed(1)}px, 0) scale(1.08)`; });
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------------- 5. Счётчики цифр ---------------- */
function counters() {
  if (reduce || !('IntersectionObserver' in window)) return;
  const els = [...document.querySelectorAll('[data-count]')];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target;
      const to = +el.dataset.count;
      const t0 = performance.now();
      const d = mobile ? 700 : 1300;
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / d);
        el.textContent = Math.round(to * ease(t)).toLocaleString('ru-RU');
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

/* ---------------- 6. Плавное переключение фильтров каталога ---------------- */
function filterFade() {
  const grid = document.querySelector('[data-grid]');
  if (!grid || reduce) return;
  grid.addEventListener('filtered', () => {
    grid.querySelectorAll('[data-card]:not([hidden])').forEach((c, i) => {
      c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: Math.min(i, 8) * 25, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'backwards' });
    });
  });
}

intro();
headerGear();
reveals();
parallax();
counters();
filterFade();
