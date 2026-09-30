// Экономика одного кафе: плитки с цифрами и четыре графика в блоке #economics.
//
// ДЕМО-МОДЕЛЬ. Все значения в MODEL условные: это пример расчёта, а не показатели сети.
// Чтобы показать реальные данные, замените значения ниже — плитки, графики, заголовки
// и таблицы пересчитаются сами. После этого уберите пометку «Пример расчёта» в index.html.
const MODEL = {
  avgCheck: 800, // средний чек, ₽
  checksPerDay: 200, // чеков в день на плановой загрузке
  daysPerMonth: 30,
  investment: 15, // вложения на открытие вместе с паушальным взносом, млн ₽
  horizon: 30, // сколько месяцев показывать на графике окупаемости
  // Доля плановой выручки в первые месяцы работы; дальше кафе держит план.
  ramp: [0.5, 0.62, 0.73, 0.81, 0.88, 0.94, 0.98, 1],
  // Расходы как доля плановой выручки. variable — растут вместе с выручкой, остальные постоянные.
  costs: [
    { name: 'Продукты', share: 0.3, variable: true },
    { name: 'Оплата труда', share: 0.22 },
    { name: 'Аренда', share: 0.09 },
    { name: 'Прочее', share: 0.06 },
    { name: 'Роялти', share: 0.05, variable: true },
    { name: 'Налоги', share: 0.04, variable: true },
    { name: 'Маркетинг', share: 0.03, variable: true },
  ],
  // Как чеки распределяются по часам (вес каждого часа; в сумме дают checksPerDay).
  hours: [[9, 9], [10, 14], [11, 13], [12, 12], [13, 15], [14, 14], [15, 11], [16, 12], [17, 15], [18, 19], [19, 22], [20, 20], [21, 15], [22, 9]],
};

(() => {
  const section = document.getElementById('economics');
  if (!section) return;

  // ── Расчёт ────────────────────────────────
  const sum = (list) => list.reduce((a, b) => a + b, 0);
  const plan = (MODEL.avgCheck * MODEL.checksPerDay * MODEL.daysPerMonth) / 1e6; // млн ₽ в месяц
  const variableShare = sum(MODEL.costs.filter((c) => c.variable).map((c) => c.share));
  const fixedCosts = sum(MODEL.costs.filter((c) => !c.variable).map((c) => c.share)) * plan;
  const profitShare = 1 - sum(MODEL.costs.map((c) => c.share));
  const revenueAt = (month) => plan * (MODEL.ramp[month - 1] ?? 1); // month с единицы

  // Накопленный денежный поток: cash[0] — до открытия, cash[m] — после m-го месяца.
  const cash = [-MODEL.investment];
  for (let m = 1; m <= MODEL.horizon; m += 1) {
    cash.push(cash[m - 1] + revenueAt(m) * (1 - variableShare) - fixedCosts);
  }
  const paybackMonth = cash.findIndex((v) => v >= 0);
  const planMonth = MODEL.ramp.findIndex((v) => v >= 1) + 1;
  const weights = sum(MODEL.hours.map(([, w]) => w));
  const hourly = MODEL.hours.map(([hour, w]) => [hour, Math.round((w / weights) * MODEL.checksPerDay)]);
  const peak = hourly.reduce((best, item) => (item[1] > best[1] ? item : best));

  // ── Формат ────────────────────────────────
  const NBSP = ' ';
  const num = (v, digits = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const mln = (v, digits = 1) => `${num(v, digits)}${NBSP}млн${NBSP}₽`;
  const signed = (v, digits = 1) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${num(Math.abs(v), digits)}`;
  const plural = (n, forms) => {
    const a = n % 10;
    const b = n % 100;
    return forms[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2];
  };

  // ── Плитки ────────────────────────────────
  const kpis = {
    revenue: mln(plan),
    profit: mln(plan * profitShare),
    payback: paybackMonth > 0 ? `${paybackMonth}${NBSP}мес.` : '—',
    investment: mln(MODEL.investment, 0),
    check: `${num(MODEL.avgCheck)}${NBSP}₽`,
    checks: num(MODEL.checksPerDay),
  };
  section.querySelectorAll('[data-kpi]').forEach((el) => { el.textContent = kpis[el.dataset.kpi]; });

  // ── Общие части графиков ──────────────────
  const NS = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs = {}, text) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text != null) el.textContent = text;
    return el;
  };

  // Подсказка одна на график: сначала значение, под ним — к чему оно относится.
  const tipFor = (plot) => {
    const tip = document.createElement('div');
    const value = document.createElement('b');
    const label = document.createElement('span');
    tip.className = 'chart__tip';
    tip.append(value, label);
    return {
      el: tip,
      show(x, y, valueText, labelText) {
        value.textContent = valueText;
        label.textContent = labelText;
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.max(half, Math.min(plot.clientWidth - half, x))}px`;
        tip.style.top = `${y - 10}px`;
        tip.classList.add('is-on');
      },
      hide() { tip.classList.remove('is-on'); },
    };
  };

  // Сетка и подписи оси Y; возвращает функцию перевода значения в координату.
  const axisY = (svg, { width, top, bottom, left, right, min, max, step }) => {
    const y = (v) => top + ((max - v) / (max - min)) * (bottom - top);
    for (let t = min; t <= max + 1e-9; t += step) {
      svg.append(node('line', { class: Math.abs(t) < 1e-9 ? 'axis' : 'grid', x1: left, x2: width - right, y1: y(t), y2: y(t) }));
      svg.append(node('text', { x: left - 8, y: y(t), dy: '.32em', 'text-anchor': 'end' }, t < 0 ? `−${num(-t)}` : num(t)));
    }
    return y;
  };

  // Таблица с теми же цифрами — под каждым графиком.
  const table = (figure, head, rows) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const tbl = document.createElement('table');
    details.className = 'chart__data';
    summary.textContent = 'Цифры таблицей';
    const row = (cells, tag) => {
      const tr = document.createElement('tr');
      cells.forEach((text) => { const cell = document.createElement(tag); cell.textContent = text; tr.append(cell); });
      return tr;
    };
    tbl.append(row(head, 'th'), ...rows.map((cells) => row(cells, 'td')));
    details.append(summary, tbl);
    figure.append(details);
  };

  // ── Столбцы: одна серия, одна величина ────
  const drawColumns = (plot, { values, labels, step, labelAt, valueText, tipValue, tipLabel, aria }) => {
    const width = plot.clientWidth;
    const height = width < 420 ? 196 : 250;
    const m = { top: 26, right: 4, bottom: 28, left: 30 };
    const max = Math.ceil(Math.max(...values) / step) * step;
    const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': aria });
    const y = axisY(svg, { width, top: m.top, bottom: height - m.bottom, left: m.left, right: m.right, min: 0, max, step });
    const band = (width - m.left - m.right) / values.length;
    const bar = Math.max(4, Math.min(24, band - 2));
    const every = band >= 26 ? 1 : band >= 15 ? 2 : 3;
    const tip = tipFor(plot);
    const base = y(0);

    values.forEach((value, i) => {
      const x = m.left + band * i + (band - bar) / 2;
      const top = y(value);
      const r = Math.min(4, bar / 2, base - top);
      const mark = node('path', {
        class: 'bar',
        style: `--i:${i}`,
        d: `M${x} ${base}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bar - r}Q${x + bar} ${top} ${x + bar} ${top + r}V${base}Z`,
      });
      svg.append(mark);
      if (i % every === 0) svg.append(node('text', { x: x + bar / 2, y: height - 8, 'text-anchor': 'middle' }, labels[i]));
      if (labelAt.includes(i)) {
        // У первого столбца сосед справа выше — подпись прижимаем к правому краю столбца, чтобы не легла на соседа.
        const crowded = i === 0 && values[1] > value;
        svg.append(node('text', { class: 'val late', x: crowded ? x + bar : x + bar / 2, y: top - 8, 'text-anchor': crowded ? 'end' : 'middle' }, valueText(value)));
      }

      // Область наведения шире столбца — вся его полоса.
      const hit = node('rect', { class: 'hit', x: m.left + band * i, y: m.top - 10, width: band, height: base - m.top + 10 });
      hit.addEventListener('pointerenter', () => { mark.classList.add('is-hover'); tip.show(x + bar / 2, top, tipValue(value, i), tipLabel(i)); });
      hit.addEventListener('pointerleave', () => { mark.classList.remove('is-hover'); tip.hide(); });
      svg.append(hit);
    });
    plot.replaceChildren(svg, tip.el);
  };

  // ── Линия относительно нуля ───────────────
  const drawLine = (plot, { values, step, mark, aria }) => {
    const width = plot.clientWidth;
    const height = width < 420 ? 196 : 250;
    const m = { top: 18, right: 12, bottom: 28, left: 36 };
    const min = Math.floor(Math.min(...values) / step) * step;
    const max = Math.ceil(Math.max(...values) / step) * step;
    const last = values.length - 1;
    const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': aria });
    const y = axisY(svg, { width, top: m.top, bottom: height - m.bottom, left: m.left, right: m.right, min, max, step });
    const x = (i) => m.left + ((width - m.left - m.right) * i) / last;
    const points = values.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    const tip = tipFor(plot);
    const monthName = (i) => (i === 0 ? 'До открытия' : `${i}-й месяц`);

    svg.append(node('path', { class: 'area late', d: `M${x(0)} ${y(0)}L${points.join('L')}L${x(last)} ${y(0)}Z` }));
    svg.append(node('path', { class: 'line', pathLength: 1, d: `M${points.join('L')}` }));
    for (let i = 0; i <= last; i += 6) svg.append(node('text', { x: x(i), y: height - 8, 'text-anchor': 'middle' }, String(i)));

    // Подписаны только три точки: старт, окупаемость и конец периода.
    svg.append(node('text', { class: 'val late', x: x(0) + 8, y: y(values[0]) + 20 }, `−${mln(-values[0], 0)}`));
    svg.append(node('circle', { class: 'dot late', cx: x(last), cy: y(values[last]), r: 5 }));
    svg.append(node('text', { class: 'val late', x: x(last), y: y(values[last]) - 12, 'text-anchor': 'end' }, `${signed(values[last])}${NBSP}млн${NBSP}₽`));
    if (mark > 0) {
      svg.append(node('circle', { class: 'dot dot--mark late', cx: x(mark), cy: y(values[mark]), r: 5 }));
      svg.append(node('text', { class: 'val late', x: x(mark) - 10, y: y(values[mark]) - 12, 'text-anchor': 'end' }, monthName(mark)));
    }

    // Перекрестие: указатель ищет месяц, а не двухпиксельную линию.
    const cross = node('line', { class: 'cross', y1: m.top, y2: height - m.bottom, visibility: 'hidden' });
    const focus = node('circle', { class: 'dot', r: 5, visibility: 'hidden' });
    const hit = node('rect', { class: 'hit', x: m.left, y: 0, width: width - m.left - m.right, height: height - m.bottom });
    const move = (event) => {
      const px = event.clientX - svg.getBoundingClientRect().left;
      const i = Math.max(0, Math.min(last, Math.round(((px - m.left) / (width - m.left - m.right)) * last)));
      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      focus.setAttribute('cx', x(i));
      focus.setAttribute('cy', y(values[i]));
      cross.setAttribute('visibility', 'visible');
      focus.setAttribute('visibility', 'visible');
      tip.show(x(i), y(values[i]) - 6, `${signed(values[i])}${NBSP}млн${NBSP}₽`, monthName(i));
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); focus.setAttribute('visibility', 'hidden'); tip.hide(); });
    svg.append(cross, focus, hit);
    plot.replaceChildren(svg, tip.el);
  };

  // ── Горизонтальные полосы: одна выделена, остальные серые ──
  const drawBars = (plot, items) => {
    const max = Math.max(...items.map((item) => item.value));
    const tip = tipFor(plot);
    const rows = items.map((item, i) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      const track = document.createElement('span');
      const fill = document.createElement('i');
      const value = document.createElement('b');
      row.className = `hbar${item.accent ? ' hbar--accent' : ''}`;
      name.className = 'hbar__name';
      track.className = 'hbar__track';
      fill.style.cssText = `--share:${(item.value / max).toFixed(4)};--i:${i}`;
      name.textContent = item.name;
      value.textContent = item.label;
      track.append(fill, value);
      row.append(name, track);
      row.addEventListener('pointerenter', () => tip.show(track.offsetLeft + fill.offsetWidth / 2, row.offsetTop, item.tip, item.name));
      row.addEventListener('pointerleave', tip.hide);
      return row;
    });
    plot.replaceChildren(...rows, tip.el);
  };

  // ── Четыре графика ────────────────────────
  const rampValues = Array.from({ length: 12 }, (_, i) => revenueAt(i + 1));
  const costItems = [
    ...MODEL.costs.map((c) => ({ name: c.name, value: c.share })),
    { name: 'Прибыль', value: profitShare, accent: true },
  ].sort((a, b) => b.value - a.value).map((item) => ({
    ...item,
    label: `${num(item.value * 100)}%`,
    tip: `${mln(item.value * plan, 2)} в месяц`,
  }));

  const charts = {
    ramp: {
      title: `Выручка выходит на план к${NBSP}${planMonth}-му месяцу`,
      draw: (plot) => drawColumns(plot, {
        values: rampValues,
        labels: rampValues.map((_, i) => String(i + 1)),
        step: 1,
        labelAt: [0, planMonth - 1],
        valueText: (v) => num(v, 1),
        tipValue: (v) => mln(v),
        tipLabel: (i) => `${i + 1}-й месяц`,
        aria: `Столбчатый график: выручка растёт с ${mln(rampValues[0])} в первый месяц до ${mln(plan)} к ${planMonth}-му месяцу.`,
      }),
      table: [['Месяц', 'Выручка, млн ₽'], rampValues.map((v, i) => [String(i + 1), num(v, 2)])],
    },
    payback: {
      title: `Вложения возвращаются на${NBSP}${paybackMonth}-й месяц`,
      draw: (plot) => drawLine(plot, {
        values: cash,
        step: 5,
        mark: paybackMonth,
        aria: `Линейный график: накопленный денежный поток растёт с −${mln(MODEL.investment, 0)} до нуля на ${paybackMonth}-й месяц.`,
      }),
      table: [['Месяц', 'Накопленный поток, млн ₽'], cash.map((v, i) => [i === 0 ? 'До открытия' : String(i), signed(v, 2)])],
    },
    hours: {
      title: `Гости идут весь день, пик — в${NBSP}${peak[0]}:00`,
      draw: (plot) => drawColumns(plot, {
        values: hourly.map(([, n]) => n),
        labels: hourly.map(([hour]) => String(hour)),
        step: 5,
        labelAt: [hourly.indexOf(peak)],
        valueText: (v) => num(v),
        tipValue: (v) => `${num(v)}${NBSP}${plural(v, ['чек', 'чека', 'чеков'])}`,
        tipLabel: (i) => `${hourly[i][0]}:00–${hourly[i][0] + 1}:00`,
        aria: `Столбчатый график: чеки по часам с ${hourly[0][0]}:00 до ${hourly[hourly.length - 1][0] + 1}:00, пик в ${peak[0]}:00 — ${peak[1]}.`,
      }),
      table: [['Час', 'Чеков'], hourly.map(([hour, n]) => [`${hour}:00–${hour + 1}:00`, num(n)])],
    },
    costs: {
      title: `Прибыль — ${num(profitShare * 100)}% выручки`,
      draw: (plot) => drawBars(plot, costItems),
      table: [['Статья', 'Доля выручки', 'В месяц, млн ₽'], costItems.map((item) => [item.name, item.label, num(item.value * plan, 2)])],
    },
  };

  section.querySelectorAll('[data-chart]').forEach((figure) => {
    const chart = charts[figure.dataset.chart];
    const plot = figure.querySelector('.chart__plot');
    figure.querySelector('h3').textContent = chart.title;
    table(figure, chart.table[0], chart.table[1]);

    // Рисуем по ширине карточки и перерисовываем, когда она меняется.
    let drawn = 0;
    const render = () => {
      if (!plot.clientWidth || plot.clientWidth === drawn) return;
      drawn = plot.clientWidth;
      chart.draw(plot);
    };
    render();
    new ResizeObserver(render).observe(plot);
  });
})();
