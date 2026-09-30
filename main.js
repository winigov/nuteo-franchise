// Настройки заявки.
// endpoint — адрес, куда форма отправляет заявку (POST, JSON). Пока он пустой,
// заявка уходит сообщением в WhatsApp на номер ниже.
const CONFIG = {
  endpoint: '',
  whatsapp: '79894788585',
};

const root = document.documentElement;
// Классы ставит скрипт в <head>: .js — анимации включены, .calm — «уменьшить движение»,
// тогда блоки только проявляются, а параллакс, счётчики и бегущая строка выключены.
const animated = root.classList.contains('js');
const motion = animated && !root.classList.contains('calm');
window.nuteoReady = true;

// Плашка спокойного режима: «Включить анимацию» запоминает выбор и перезагружает страницу,
// крестик прячет плашку. Без localStorage (частный режим) включаем через параметр в адресе.
const remember = (value) => {
  try { localStorage.setItem('nuteo-motion', value); return true; } catch (e) { return false; }
};
document.querySelector('.motion-note__on').addEventListener('click', () => {
  if (remember('on')) location.reload();
  else location.search = `${location.search ? `${location.search}&` : '?'}motion=on`;
});
document.querySelector('.motion-note__off').addEventListener('click', () => {
  remember('off');
  root.classList.add('calm-quiet');
});

// ── Шапка и мобильное меню ──────────────────
const header = document.querySelector('.header');
const burger = document.querySelector('.burger');
const nav = document.getElementById('nav');

const setNav = (open) => {
  root.classList.toggle('nav-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
};
burger.addEventListener('click', () => setNav(!root.classList.contains('nav-open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

// ── Прокрутка: прогресс страницы и параллакс ─
// Каждому видимому [data-scroll] записываем --p: положение его центра
// относительно центра окна, от 1 (у нижнего края) до -1 (у верхнего).
const tracked = new Set();
let scrollFrame = 0;

const updateScroll = () => {
  scrollFrame = 0;
  const y = window.scrollY;
  const vh = window.innerHeight;
  const max = root.scrollHeight - vh;

  header.classList.toggle('is-stuck', y > 8);
  root.classList.toggle('show-top', y > vh * 0.8);
  root.style.setProperty('--scroll', max > 0 ? (y / max).toFixed(4) : '0');
  if (!motion) return;

  root.style.setProperty('--sy', String(Math.round(y)));
  tracked.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const p = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
    el.style.setProperty('--p', Math.max(-1, Math.min(1, p)).toFixed(4));
    // Для рисованных элементов: тот же сдвиг, но в пикселях и без ограничения.
    if (el.classList.contains('doodles')) el.style.setProperty('--py', (rect.top + rect.height / 2 - vh / 2).toFixed(1));
  });
};
const requestScrollUpdate = () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
};

if (motion) {
  const visibility = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) tracked.add(entry.target);
      else tracked.delete(entry.target);
    });
    requestScrollUpdate();
  }, { rootMargin: '20% 0px' });
  document.querySelectorAll('[data-scroll]').forEach((el) => visibility.observe(el));
}
// Каждому рисованному элементу — его место в секции (от её середины, в пикселях),
// чтобы сдвиг считался от центра окна и не зависел от высоты секции.
const placeDoodles = () => {
  if (!motion) return;
  document.querySelectorAll('.doodles').forEach((layer) => {
    const height = layer.offsetHeight;
    layer.querySelectorAll('.doodle').forEach((el) => {
      // Верх задан в процентах через --y; у SVG нет offsetTop, а его рамка уже сдвинута параллаксом.
      const top = (parseFloat(el.style.getPropertyValue('--y')) / 100) * height;
      el.style.setProperty('--oy', (top + el.getBoundingClientRect().height / 2 - height / 2).toFixed(1));
    });
  });
};
placeDoodles();
window.addEventListener('load', placeDoodles);

window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', () => { placeDoodles(); requestScrollUpdate(); });
updateScroll();

// ── Появление блоков ────────────────────────
if (motion) {
  // Заголовки секций режем на слова: каждое выезжает из-под маски.
  // Делим только по обычным пробелам — неразрывные держат слова вместе.
  document.querySelectorAll('h2').forEach((heading) => {
    if (heading.children.length) return;
    const words = heading.textContent.trim().split(/[ \n\t]+/);
    heading.textContent = '';
    words.forEach((word, i) => {
      const mask = document.createElement('span');
      const inner = document.createElement('span');
      mask.className = 'w';
      inner.textContent = word;
      inner.style.setProperty('--i', i);
      mask.append(inner);
      heading.append(mask, i < words.length - 1 ? ' ' : '');
    });
    heading.classList.add('split');
  });
}

if (animated) {
  // Блоки, попавшие в окно одновременно, появляются по очереди.
  const reveal = new IntersectionObserver((entries) => {
    const shown = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    shown.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    shown.forEach((el, i) => {
      el.style.setProperty('--d', `${Math.min(i, 8) * 80}ms`);
      el.classList.add('is-in');
      reveal.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  document.querySelectorAll('[data-reveal], .split, .doodle').forEach((el) => reveal.observe(el));
}

if (motion) {
  // Цифры на первом экране набегают от нуля.
  const count = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(target * (1 - (1 - t) ** 3)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counters = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      counters.unobserve(entry.target);
      count(entry.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => counters.observe(el));
}

// ── Бегущая строка ──────────────────────────
// Едет сама, а при прокрутке ускоряется и разворачивается вслед за её направлением.
const ticker = document.querySelector('.ticker');
const track = ticker.querySelector('.ticker__track');
if (motion) {
  ticker.classList.add('is-js');
  let x = 0;
  let loop = 0;
  let velocity = 0;
  let lastY = window.scrollY;
  let lastTime = 0;
  let frame = 0;

  // Дорожка состоит из двух одинаковых половин; сдвиг на одну половину незаметен.
  const measure = () => {
    loop = (track.scrollWidth + parseFloat(getComputedStyle(track).columnGap)) / 2;
  };
  const step = (now) => {
    const dt = Math.min(64, now - lastTime) / 16.67;
    lastTime = now;
    velocity += (window.scrollY - lastY - velocity) * 0.12;
    lastY = window.scrollY;
    x -= (0.7 + velocity * 0.5) * dt;
    if (x <= -loop) x += loop;
    else if (x > 0) x -= loop;
    track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    frame = requestAnimationFrame(step);
  };

  measure();
  window.addEventListener('resize', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !frame) {
      lastTime = performance.now();
      lastY = window.scrollY;
      frame = requestAnimationFrame(step);
    } else if (!entry.isIntersecting && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }).observe(ticker);
}

// ── Видео-сцены ─────────────────────────────
// Ролик разложен на кадры. Пока сцена закреплена под шапкой, прокрутка листает их на canvas.
// В спокойном режиме сцена не закрепляется и показывает один кадр (data-still).
const scenes = [...document.querySelectorAll('.cinema')].map((el) => ({
  el,
  stage: el.querySelector('.cinema__stage'),
  canvas: el.querySelector('canvas'),
  count: Number(el.dataset.frames),
  still: Number(el.dataset.still || 1) - 1,
  frames: [],
  current: motion ? 0 : Number(el.dataset.still || 1) - 1,
  drawn: -1,
  dirty: true,
  near: false,
}));
let sceneFrame = 0;

const loadScene = (scene) => {
  if (scene.frames.length) return;
  const indexes = motion ? [...Array(scene.count).keys()] : [scene.still];
  indexes.forEach((i) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { scene.dirty = true; };
    img.src = `${scene.el.dataset.src}/${String(i + 1).padStart(3, '0')}.webp`;
    scene.frames[i] = img;
  });
};

const sizeScene = (scene) => {
  const rect = scene.canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2, 1600 / rect.width);
  scene.canvas.width = Math.round(rect.width * ratio);
  scene.canvas.height = Math.round(rect.height * ratio);
  scene.stickyTop = parseFloat(getComputedStyle(scene.stage).top) || 0;
  scene.dirty = true;
};

const drawScene = (scene, index) => {
  // Пока нужный кадр не загрузился, показываем ближайший готовый.
  const ready = (i) => scene.frames[i] && scene.frames[i].complete && scene.frames[i].naturalWidth;
  let i = index;
  while (i > 0 && !ready(i)) i -= 1;
  if (!ready(i)) { i = index; while (i < scene.count && !ready(i)) i += 1; }
  if (!ready(i)) return;

  // Кадр заполняет canvas целиком, по центру — как object-fit: cover.
  const img = scene.frames[i];
  const { width, height } = scene.canvas;
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  scene.canvas.getContext('2d').drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  scene.drawn = index;
  scene.dirty = i !== index;
};

const tickScenes = () => {
  let active = false;
  scenes.forEach((scene) => {
    if (!scene.near) return;
    active = true;
    if (motion) {
      const rect = scene.el.getBoundingClientRect();
      // От момента, когда сцена поднялась на треть экрана, до конца закрепления.
      const start = window.innerHeight * 0.35;
      const end = scene.stickyTop - (rect.height - scene.stage.offsetHeight);
      const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
      const target = progress * (scene.count - 1);
      scene.current += (target - scene.current) * 0.2;
      if (Math.abs(target - scene.current) < 0.05) scene.current = target;
      scene.stage.style.setProperty('--progress', progress.toFixed(3));
    }
    const index = Math.round(scene.current);
    if (index !== scene.drawn || scene.dirty) drawScene(scene, index);
  });
  sceneFrame = active ? requestAnimationFrame(tickScenes) : 0;
};

if (scenes.length) {
  const nearby = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const scene = scenes.find((item) => item.el === entry.target);
      scene.near = entry.isIntersecting;
      if (scene.near) { loadScene(scene); sizeScene(scene); }
    });
    if (!sceneFrame) sceneFrame = requestAnimationFrame(tickScenes);
  }, { rootMargin: '150% 0px' });
  scenes.forEach((scene) => nearby.observe(scene.el));
  window.addEventListener('resize', () => scenes.forEach(sizeScene));
}

document.getElementById('year').textContent = new Date().getFullYear();

// ── Форма заявки ────────────────────────────
const form = document.getElementById('lead-form');
const fields = form.querySelector('.form__fields');
const done = form.querySelector('.form__done');
const errorBox = form.querySelector('.form__error');
const hint = form.querySelector('.form__hint');
const submit = form.querySelector('button[type="submit"]');
const phone = form.elements.phone;

if (!CONFIG.endpoint) {
  hint.textContent = 'Заявка откроется в WhatsApp — останется нажать «Отправить».';
}

// +7 900 000-00-00
const formatPhone = (value) => {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits[0] !== '7') digits = '7' + digits;
  digits = digits.slice(0, 11);
  const p = [digits.slice(1, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)];
  let out = '+7';
  if (p[0]) out += ' ' + p[0];
  if (p[1]) out += ' ' + p[1];
  if (p[2]) out += '-' + p[2];
  if (p[3]) out += '-' + p[3];
  return out;
};
phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });

const validate = () => {
  const problems = [];
  const mark = (el, bad) => el.closest('label').classList.toggle('is-invalid', bad);

  const nameBad = form.elements.name.value.trim().length < 2;
  const phoneBad = phone.value.replace(/\D/g, '').length !== 11;
  const cityBad = form.elements.city.value.trim().length < 2;
  const consentBad = !form.elements.consent.checked;

  mark(form.elements.name, nameBad);
  mark(phone, phoneBad);
  mark(form.elements.city, cityBad);
  mark(form.elements.consent, consentBad);

  if (nameBad) problems.push('имя');
  if (phoneBad) problems.push('телефон полностью');
  if (cityBad) problems.push('город');
  if (problems.length) return `Укажите ${problems.join(', ')}.`;
  if (consentBad) return 'Отметьте согласие на обработку данных.';
  return '';
};

const showDone = (title, text) => {
  done.querySelector('h3').textContent = title;
  done.querySelector('p').textContent = text;
  fields.hidden = true;
  done.hidden = false;
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = validate();
  errorBox.textContent = error;
  errorBox.hidden = !error;
  if (error) return;

  const data = {
    name: form.elements.name.value.trim(),
    phone: phone.value,
    city: form.elements.city.value.trim(),
    comment: form.elements.comment.value.trim(),
    page: location.href,
  };

  if (!CONFIG.endpoint) {
    const text = [
      'Здравствуйте! Хочу получить финмодель франшизы nuteo.',
      `Имя: ${data.name}`,
      `Телефон: ${data.phone}`,
      `Город: ${data.city}`,
      data.comment && `Комментарий: ${data.comment}`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    showDone('Осталось отправить сообщение', 'Мы открыли WhatsApp с готовым текстом заявки. Нажмите «Отправить» — и мы свяжемся с вами.');
    return;
  }

  submit.disabled = true;
  try {
    const response = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(String(response.status));
    showDone('Заявка отправлена', 'Спасибо! Свяжемся с вами, уточним детали и пришлём финансовую модель.');
  } catch (err) {
    errorBox.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или напишите нам в WhatsApp.';
    errorBox.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
