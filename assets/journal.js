// Страница «Журнал баллов»: таблица всех участников и форма, где студент вносит баллы по своему коду.
import { MAX_POINTS, SELF_MAX_ENTRY, GRADES, gradeOf, totalOf, selfTotal, formatPoints, byName, hashCode } from './journal-core.js';

const JSON_URL = new URL('journal.json', import.meta.url);
const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const fold = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
const ERRORS = {
  code: 'Код не подходит. Проверьте, что выбрана ваша фамилия.',
  points: 'Можно вносить целое число от 1 до ' + SELF_MAX_ENTRY + ' за один раз.',
  cap: 'Нельзя набрать больше ' + MAX_POINTS + ' баллов.',
  rate: 'Слишком часто. Попробуйте позже.',
  student: 'Такой фамилии нет в журнале. Обновите страницу.',
};

const state = { journal: null, self: [], sort: 'name', filter: '' };

async function loadJournal() {
  const r = await fetch(JSON_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error('journal ' + r.status);
  return r.json();
}
const endpointOf = (j) => (j && ENDPOINT_RE.test(j.endpoint || '') ? j.endpoint : '');

async function loadSelf(endpoint) {
  if (!endpoint) return [];
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(endpoint + '?action=list', { cache: 'no-store', signal: ctl.signal });
    clearTimeout(timer);
    const data = await r.json();
    return data && data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch { return []; }
}

function ruDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU');
}

function pointsCell(total) {
  const td = el('td', 'jr-pts-cell');
  td.append(el('span', 'jr-pts', formatPoints(total)));
  const bar = el('span', 'jr-bar');
  const fill = el('i');
  fill.style.width = Math.min(100, Math.max(0, (total / MAX_POINTS) * 100)) + '%';
  bar.append(fill);
  for (const g of GRADES) { const tick = el('b'); tick.style.left = (g.min / MAX_POINTS) * 100 + '%'; bar.append(tick); }
  td.append(bar);
  return td;
}

function render() {
  const { journal, self } = state;
  const body = $('jr-body');
  body.replaceChildren();
  const students = journal.students || [];
  $('jr-tools').hidden = !students.length;
  if (!students.length) {
    body.append(el('p', 'jr-empty', 'Журнал пока пуст. Преподаватель добавит участников и баллы.'));
    return;
  }
  let rows = students.map((st) => ({ st, total: totalOf(st, self), own: selfTotal(st.id, self) }));
  const q = fold(state.filter.trim());
  if (q) rows = rows.filter((r) => fold(r.st.name).includes(q));
  rows.sort(state.sort === 'pts' ? (a, b) => b.total - a.total || byName(a.st, b.st) : (a, b) => byName(a.st, b.st));

  // сводка по оценкам
  const counts = GRADES.map((g) => [g, students.filter((st) => { const x = gradeOf(totalOf(st, self)); return x && x.grade === g.grade; }).length]);
  const stat = el('p', 'jr-stat');
  stat.append(document.createTextNode('Участников: ' + students.length + '. '));
  for (const [g, n] of counts) { const c = el('span', 'jr-chip ' + g.key, g.grade + ': ' + n); stat.append(c, document.createTextNode(' ')); }
  body.append(stat);

  if (!rows.length) { body.append(el('p', 'jr-empty', 'Такой фамилии нет.')); return; }

  const table = el('table', 'jr-table');
  const head = el('tr');
  for (const t of ['№', 'Фамилия', 'Баллы', 'Оценка']) head.append(el('th', '', t));
  const thead = el('thead'); thead.append(head); table.append(thead);
  const tbody = el('tbody');
  rows.forEach((r, i) => {
    const g = gradeOf(r.total);
    const tr = el('tr', g ? g.key : 'g0');
    tr.append(el('td', 'jr-n', String(i + 1)));
    const name = el('td', 'jr-name', r.st.name);
    if (r.own) name.append(el('small', '', 'из них внесено самостоятельно: ' + formatPoints(r.own)));
    tr.append(name, pointsCell(r.total));
    const grade = el('td', 'jr-grade');
    grade.append(el('span', 'jr-badge ' + (g ? g.key : 'g0'), g ? String(g.grade) : '–'));
    tr.append(grade);
    tbody.append(tr);
  });
  table.append(tbody);
  const wrap = el('div', 'jr-scroll'); wrap.append(table);
  body.append(wrap);
  if (journal.updated && ruDate(journal.updated)) body.append(el('p', 'jr-updated', 'Обновлено: ' + ruDate(journal.updated)));
}

function fillSelect() {
  const sel = $('jr-who');
  sel.replaceChildren();
  const first = el('option', '', 'Выберите фамилию'); first.value = ''; first.disabled = true; first.selected = true;
  sel.append(first);
  for (const st of [...state.journal.students].sort(byName)) { const o = el('option', '', st.name); o.value = st.id; sel.append(o); }
}

async function submitSelf(e) {
  e.preventDefault();
  const msg = $('jr-msg');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'jr-msg ' + (kind || ''); };
  const sid = $('jr-who').value;
  const st = state.journal.students.find((s) => s.id === sid);
  const code = $('jr-code').value;
  const pts = Number($('jr-pts').value);
  if (!st) return say('Выберите свою фамилию.', 'err');
  if (!code.trim()) return say('Введите код.', 'err');
  if (!Number.isInteger(pts) || pts < 1 || pts > SELF_MAX_ENTRY) return say(ERRORS.points, 'err');
  // код проверяем сразу в браузере по хэшу из журнала, чтобы не ждать сервер
  if (!st.salt || (await hashCode(st.salt, code)) !== st.codeHash) return say(ERRORS.code, 'err');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; say('Вношу…');
  try {
    const r = await fetch(endpointOf(state.journal), {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'add', sid: st.id, code, pts }),
    });
    const data = await r.json();
    if (!data.ok) return say(ERRORS[data.error] || 'Не удалось внести баллы. Попробуйте ещё раз.', 'err');
    state.self = await loadSelf(endpointOf(state.journal));
    render();
    const total = totalOf(st, state.self);
    const g = gradeOf(total);
    say('Добавлено: +' + pts + '. Теперь у вас ' + formatPoints(total) + ' из ' + MAX_POINTS + (g ? ', оценка ' + g.grade : '') + '.', 'ok');
    $('jr-pts').value = '';
  } catch {
    say('Нет связи с сервером. Баллы не внесены, попробуйте ещё раз.', 'err');
  } finally { btn.disabled = false; }
}

async function start() {
  try { state.journal = await loadJournal(); } catch {
    $('jr-body').replaceChildren(el('p', 'jr-empty', 'Не удалось загрузить журнал. Обновите страницу.'));
    return;
  }
  const endpoint = endpointOf(state.journal);
  state.self = await loadSelf(endpoint);
  render();
  if (endpoint) { fillSelect(); $('jr-self').hidden = false; $('jr-form').addEventListener('submit', submitSelf); }
  $('jr-filter').addEventListener('input', (e) => { state.filter = e.target.value; render(); });
  for (const b of document.querySelectorAll('.jr-sort button')) {
    b.addEventListener('click', () => {
      state.sort = b.dataset.sort;
      for (const x of document.querySelectorAll('.jr-sort button')) x.setAttribute('aria-pressed', String(x === b));
      render();
    });
  }
}
if ($('jr-body')) start();
