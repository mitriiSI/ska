// Главная: живой поиск по сайту прямо на странице. Использует тот же локальный индекс, что и помощник.
import { loadEngine } from './engine.js';

const form = document.getElementById('home-search');
if (form) {
  const input = document.getElementById('home-q');
  const box = document.getElementById('home-results');
  const hub = document.getElementById('home-hub');
  const EXAMPLES = ['лекция 5', 'рейтинг', 'экзамен', 'контакты', 'программа курса'];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  const SAY = {
    hello: 'Здравствуйте! Напишите, что вы ищете на сайте.',
    thanks: 'Пожалуйста! Если нужно что-то ещё, спрашивайте.',
    bye: 'До свидания!',
  };
  function say(text) {
    box.replaceChildren(el('p', 'home-say', text));
    box.hidden = false; hub.hidden = true;
  }
  function show(res) {
    box.replaceChildren();
    if (res.kind === 'results') {
      box.append(el('p', 'home-say', 'Вот что я нашёл на сайте:'));
      for (const r of res.results) {
        const a = el('a', 'home-res'); a.href = r.href;
        const top = el('div', 'home-res-top');
        top.append(el('strong', '', r.title));
        if (r.sub) top.append(el('small', '', r.sub));
        a.append(top);
        if (r.snippet && r.snippet.length) {
          const p = el('p', 'home-res-snip');
          for (const s of r.snippet) p.append(s.m ? el('mark', '', s.t) : document.createTextNode(s.t));
          a.append(p);
        }
        a.append(el('span', 'home-res-go', r.action + ' →'));
        box.append(a);
      }
    } else {
      const msg = el('div', 'home-none');
      msg.append(el('p', '', 'Я не нашёл ответа на этот вопрос. Попробуйте назвать раздел, тему или номер лекции. Если не получится, напишите преподавателю.'));
      const a = el('a', 'home-ask', 'Перейти к контактам'); a.href = 'kontakty.html';
      msg.append(a);
      box.append(msg);
    }
    box.hidden = false; hub.hidden = true;
  }
  function reset() { box.hidden = true; box.replaceChildren(); hub.hidden = false; }

  let timer = 0;
  async function run(q) {
    q = q.trim();
    if (!q) { reset(); return; }
    try {
      const engine = await loadEngine();
      const res = engine.search(q, 4);
      if (res.kind === 'empty') { reset(); return; }
      if (SAY[res.kind]) { say(SAY[res.kind]); return; }
      show(res);
    } catch { box.replaceChildren(el('p', 'home-none', 'Не удалось загрузить данные сайта. Обновите страницу.')); box.hidden = false; hub.hidden = true; }
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(input.value), 130); });
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); run(input.value); });
  input.addEventListener('focus', () => { loadEngine().catch(() => {}); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape' && document.activeElement === input && input.value) { input.value = ''; reset(); }
  });

  // подсказки в поле меняются сами, пока оно пустое
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let i = 0;
    setInterval(() => {
      if (input.value || document.activeElement === input) return;
      i = (i + 1) % EXAMPLES.length;
      input.placeholder = 'Найти: ' + EXAMPLES[i];
    }, 2800);
  }
}
