// Помощник по сайту: кнопка в углу и окно диалога. Поиск идёт локально по assets/search-index.json.
const BASE = new URL('./', import.meta.url);
const KEY = 'site-helper-v1';
const SUGGEST = ['Рейтинговая система', 'Лекции', 'Вопросы к экзамену', 'Как связаться'];
const TEXT = {
  intro: 'Здравствуйте! Напишите, что нужно найти на сайте: раздел, тему, номер лекции или обычный вопрос.',
  hello: 'Здравствуйте! Напишите, что вы ищете на сайте.',
  thanks: 'Пожалуйста! Если нужно что-то ещё, спрашивайте.',
  bye: 'До свидания!',
  empty: 'Напишите вопрос или несколько слов о том, что нужно найти.',
  none: 'Я не нашёл ответа на этот вопрос. Попробуйте сформулировать иначе: назовите раздел, тему или номер лекции. Если не получится, напишите преподавателю на странице «Связаться».',
  found: 'Вот что я нашёл на сайте:',
  fail: 'Не удалось загрузить данные сайта. Обновите страницу и попробуйте ещё раз.',
};

const store = {
  read() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } },
  write(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* без хранилища работаем без истории */ } },
};

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const svgIcon = (d, size = 24) => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = d; // только собственные константы ниже
  return s;
};
const ICON_BUBBLE = '<path d="M4 5h16v11H11l-5 4v-4H4z"/><circle cx="11.2" cy="10" r="2.4"/><path d="m13 11.8 2.2 2.2"/>';
const ICON_CLOSE = '<path d="M6 6l12 12M18 6 6 18"/>';
const ICON_TRASH = '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>';
const ICON_SEND = '<path d="M4 12 20 4l-5 16-3-6.5z"/>';

let state = store.read();
if (!Array.isArray(state.msgs)) state = { open: false, msgs: [] };
const save = () => { state.msgs = state.msgs.slice(-24); store.write(state); };

// --- разметка ---------------------------------------------------------------------
const fab = el('button', 'hlp-fab');
fab.type = 'button'; fab.setAttribute('aria-label', 'Помощник по сайту'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'hlp-panel');
fab.append(svgIcon(ICON_BUBBLE, 26));

const panel = el('section', 'hlp-panel');
panel.id = 'hlp-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Помощник по сайту');
const head = el('header', 'hlp-head');
head.append(el('strong', '', 'Помощник по сайту'));
const tools = el('div', 'hlp-tools');
const clearBtn = el('button', 'hlp-close'); clearBtn.type = 'button'; clearBtn.title = 'Очистить чат'; clearBtn.setAttribute('aria-label', 'Очистить чат'); clearBtn.append(svgIcon(ICON_TRASH, 18));
const closeBtn = el('button', 'hlp-close'); closeBtn.type = 'button'; closeBtn.title = 'Закрыть'; closeBtn.setAttribute('aria-label', 'Закрыть и очистить чат'); closeBtn.append(svgIcon(ICON_CLOSE, 18));
tools.append(clearBtn, closeBtn);
head.append(tools);
const log = el('div', 'hlp-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.tabIndex = 0;
const chips = el('div', 'hlp-chips');
const form = el('form', 'hlp-form'); form.autocomplete = 'off';
const input = el('input', 'hlp-input'); input.type = 'text'; input.name = 'q'; input.maxLength = 200; input.placeholder = 'Что найти на сайте?'; input.setAttribute('aria-label', 'Ваш вопрос'); input.enterKeyHint = 'search';
const send = el('button', 'hlp-send'); send.type = 'submit'; send.setAttribute('aria-label', 'Отправить'); send.append(svgIcon(ICON_SEND, 20));
form.append(input, send);
panel.append(head, log, chips, form);
document.body.append(panel, fab);

// --- сообщения --------------------------------------------------------------------
function renderSegs(parent, segs) {
  for (const s of segs) {
    if (s.m) parent.append(el('mark', '', s.t)); else parent.append(document.createTextNode(s.t));
  }
}
function renderMsg(m) {
  const row = el('div', 'hlp-msg ' + (m.r === 'user' ? 'hlp-user' : 'hlp-bot'));
  if (m.t) row.append(el('p', '', m.t));
  for (const c of m.cards || []) {
    const card = el('div', 'hlp-card');
    const main = el('a', 'hlp-main'); main.href = c.href;
    main.append(el('strong', '', c.title));
    if (c.sub) main.append(el('small', '', c.sub));
    card.append(main);
    if (c.snippet && c.snippet.length) { const sn = el('p', 'hlp-snip'); renderSegs(sn, c.snippet); card.append(sn); }
    const actions = el('div', 'hlp-actions');
    const go = el('a', 'hlp-go', c.action + ' →'); go.href = c.href; actions.append(go);
    for (const [text, href] of c.links || []) {
      const a = el('a', 'hlp-ext', text.length > 38 ? text.slice(0, 36) + '…' : text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; actions.append(a);
    }
    card.append(actions);
    row.append(card);
  }
  if (m.contact) { const a = el('a', 'hlp-go hlp-pill', 'Перейти к контактам'); a.href = 'kontakty.html'; row.append(a); }
  return row;
}
function add(m, persist = true) {
  log.append(renderMsg(m));
  log.scrollTop = log.scrollHeight;
  if (persist) { state.msgs.push(m); save(); }
  clearBtn.hidden = state.msgs.length === 0;
}
// Полная очистка: сообщения, сохранённая история и подсказки возвращаются в начальное состояние.
function clearChat() {
  state.msgs = []; save();
  log.replaceChildren();
  add({ r: 'bot', t: TEXT.intro }, false);
  chips.hidden = false;
  clearBtn.hidden = true;
}

// --- поиск ------------------------------------------------------------------------
let enginePromise = null;
function loadEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import(new URL('search-core.js', BASE)),
      fetch(new URL('search-index.json', BASE)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]).then(([core, index]) => core.createEngine(index)).catch((e) => { enginePromise = null; throw e; });
  }
  return enginePromise;
}

async function answer(q) {
  let engine;
  try { engine = await loadEngine(); } catch { return { r: 'bot', t: TEXT.fail }; }
  const res = engine.search(q);
  switch (res.kind) {
    case 'hello': return { r: 'bot', t: TEXT.hello };
    case 'thanks': return { r: 'bot', t: TEXT.thanks };
    case 'bye': return { r: 'bot', t: TEXT.bye };
    case 'empty': return { r: 'bot', t: TEXT.empty };
    case 'none': return { r: 'bot', t: TEXT.none, contact: true };
    default: return { r: 'bot', t: TEXT.found, cards: res.results };
  }
}

async function ask(q) {
  q = q.trim();
  if (!q) return;
  add({ r: 'user', t: q });
  chips.hidden = true;
  const pending = el('div', 'hlp-msg hlp-bot hlp-typing', '…');
  log.append(pending); log.scrollTop = log.scrollHeight;
  const m = await answer(q);
  pending.remove();
  add(m);
}

// --- открытие / закрытие ----------------------------------------------------------
function setOpen(open, focus = true) {
  if (!open && !panel.hidden) clearChat(); // при закрытии окна чат удаляется
  state.open = open; save();
  panel.hidden = !open;
  fab.setAttribute('aria-expanded', String(open));
  fab.classList.toggle('hlp-fab-open', open);
  if (open) {
    if (!log.childElementCount) { add({ r: 'bot', t: TEXT.intro }, false); }
    chips.hidden = state.msgs.length > 0;
    log.scrollTop = log.scrollHeight;
    if (focus) input.focus();
    loadEngine().catch(() => {}); // подгружаем данные заранее
  } else if (focus) fab.focus();
}

for (const s of SUGGEST) {
  const b = el('button', 'hlp-chip', s); b.type = 'button';
  b.addEventListener('click', () => ask(s));
  chips.append(b);
}
fab.addEventListener('click', () => setOpen(panel.hidden));
closeBtn.addEventListener('click', () => setOpen(false));
clearBtn.addEventListener('click', () => { clearChat(); input.focus(); });
form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

// восстановление после перехода на другую страницу
for (const m of state.msgs) log.append(renderMsg(m));
clearBtn.hidden = state.msgs.length === 0;
if (state.open) setOpen(true, false);
