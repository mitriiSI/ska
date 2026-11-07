// Ядро локального поиска по сайту: работает целиком в браузере и в Node (для тестов).
// Ничего не отправляет по сети: ищет по заранее собранному индексу (assets/search-index.json).

const VOWELS = 'аеиоуыэюя';
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

// --- лёгкий русский стеммер (по схеме Snowball) ---------------------------------
const ends = (list) => list.slice().sort((a, b) => b.length - a.length);
const PERFECTIVE1 = ends(['в', 'вши', 'вшись']), PERFECTIVE2 = ends(['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись']);
const REFLEXIVE = ['ся', 'сь'];
const ADJECTIVE = ends(['ее', 'ие', 'ые', 'ое', 'ими', 'ыми', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом', 'его', 'ого', 'ему', 'ому', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею']);
const PARTICIPLE1 = ends(['ем', 'нн', 'вш', 'ющ', 'щ']), PARTICIPLE2 = ends(['ивш', 'ывш', 'ующ']);
const VERB1 = ends(['ла', 'на', 'ете', 'йте', 'ли', 'й', 'л', 'ем', 'н', 'ло', 'но', 'ет', 'ют', 'ны', 'ть', 'ешь', 'нно']);
const VERB2 = ends(['ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ей', 'уй', 'ил', 'ыл', 'им', 'ым', 'ен', 'ило', 'ыло', 'ено', 'ят', 'ует', 'уют', 'ит', 'ыт', 'ены', 'ить', 'ыть', 'ишь', 'ую', 'ю']);
const NOUN = ends(['а', 'ев', 'ов', 'ие', 'ье', 'е', 'иями', 'ями', 'ами', 'еи', 'ии', 'и', 'ией', 'ей', 'ой', 'ий', 'й', 'иям', 'ям', 'ием', 'ем', 'ам', 'ом', 'о', 'у', 'ах', 'иях', 'ях', 'ы', 'ь', 'ию', 'ью', 'ю', 'ия', 'ья', 'я']);

function stripEnding(w, list, needA) {
  for (const e of list) {
    if (w.endsWith(e)) {
      const rest = w.slice(0, w.length - e.length);
      if (needA) { const l = rest[rest.length - 1]; if (l !== 'а' && l !== 'я') continue; }
      return rest;
    }
  }
  return null;
}

export function stem(word) {
  let w = norm(word);
  if (w.length <= 3 || /[^а-я]/.test(w)) return w; // цифры и латиница не трогаем
  let rvStart = 0;
  for (let i = 0; i < w.length; i++) if (VOWELS.includes(w[i])) { rvStart = i + 1; break; }
  const head = w.slice(0, rvStart);
  let rv = w.slice(rvStart);
  const tryStrip = (list, needA, s) => { const r = stripEnding(s, list, needA); return r; };

  let r;
  if ((r = tryStrip(PERFECTIVE2, false, rv)) !== null || (r = tryStrip(PERFECTIVE1, true, rv)) !== null) rv = r;
  else {
    if ((r = tryStrip(REFLEXIVE, false, rv)) !== null) rv = r;
    let done = false;
    for (const e of ADJECTIVE) {
      if (rv.endsWith(e)) {
        let base = rv.slice(0, rv.length - e.length);
        const p = tryStrip(PARTICIPLE2, false, base);
        if (p !== null) base = p; else { const p1 = tryStrip(PARTICIPLE1, true, base); if (p1 !== null) base = p1; }
        rv = base; done = true; break;
      }
    }
    if (!done) {
      if ((r = tryStrip(VERB2, false, rv)) !== null || (r = tryStrip(VERB1, true, rv)) !== null) rv = r;
      else if ((r = tryStrip(NOUN, false, rv)) !== null) rv = r;
    }
  }
  if (rv.endsWith('и')) rv = rv.slice(0, -1);
  if (rv.endsWith('ость')) rv = rv.slice(0, -4); else if (rv.endsWith('ост')) rv = rv.slice(0, -3);
  if (rv.endsWith('ейше')) rv = rv.slice(0, -4); else if (rv.endsWith('ейш')) rv = rv.slice(0, -3);
  if (rv.endsWith('нн')) rv = rv.slice(0, -1);
  if (rv.endsWith('ь')) rv = rv.slice(0, -1);
  const out = head + rv;
  // короткая основа сводит «экзамен» и «экзамену», которые схема Snowball разводит
  return out.length >= 2 ? out.slice(0, 5) : w.slice(0, 5);
}

const STOP = new Set(('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между ' +
  'найди найти найдите покажи показать покажите хочу хотел хотела хотим нужно нужна нужен нужны подскажи подскажите скажи скажите пожалуйста помоги помогите можете сможешь ищу искать ответ вопрос информация информацию информации страница страницу страницы сайт сайте сайта это эта').split(' '));

export const tokenize = (s) => norm(s).match(/[a-zа-я0-9]+/g) || [];

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const SMALLTALK = [
  { re: /^(привет|здравствуй|здравствуйте|добрый|доброе|добрыи|день|утро|вечер|хай|hello|hi)([^а-яa-z0-9]|$)/, kind: 'hello' },
  { re: /^(спасибо|благодарю|благодарствую|thanks)/, kind: 'thanks' },
  { re: /^(пока|до свидания|досвидания|всего доброго)/, kind: 'bye' },
];

export function createEngine(index) {
  const { pages, files, chunks } = index;
  const N = chunks.length;
  const postings = new Map(); // stem -> Map(chunkIdx -> weighted tf)
  const docLen = new Array(N);
  const normText = new Array(N);
  let totalLen = 0;

  const add = (stemWord, ci, w) => {
    let m = postings.get(stemWord);
    if (!m) postings.set(stemWord, (m = new Map()));
    m.set(ci, (m.get(ci) || 0) + w);
  };
  const titleOf = (c) => {
    if (c.d !== undefined) return files[c.d].title;
    const p = pages[c.p];
    return [p.title, p.section, c.h].filter(Boolean).join(' ');
  };
  chunks.forEach((c, ci) => {
    const body = tokenize(c.t).filter((t) => !STOP.has(t));
    const head = tokenize(titleOf(c)).filter((t) => !STOP.has(t));
    for (const t of body) add(stem(t), ci, 1);
    for (const t of head) add(stem(t), ci, 2.5);
    docLen[ci] = body.length + head.length || 1;
    totalLen += docLen[ci];
    normText[ci] = norm(c.t + ' ' + titleOf(c));
  });
  const avgLen = totalLen / N;

  // Названия страниц и файлов: «лекции» ведёт на страницу «Лекции», «лекция 5» – на файлы лекции 5.
  const titleStems = (text) => new Set(tokenize(text).filter((t) => !STOP.has(t)).map(stem));
  const entities = [];
  pages.forEach((p, pi) => entities.push({ kind: 'page', i: pi, stems: titleStems(p.title + ' ' + (p.alias || '')) }));
  files.forEach((f, fi) => entities.push({ kind: 'file', i: fi, stems: titleStems(f.title) }));
  const firstChunkOfFile = new Map();
  chunks.forEach((c) => { if (c.d !== undefined && !firstChunkOfFile.has(c.d)) firstChunkOfFile.set(c.d, c); });
  const cut = (t, n) => (t.length > n ? t.slice(0, t.lastIndexOf(' ', n) > 40 ? t.lastIndexOf(' ', n) : n) + ' …' : t);
  function pageSummary(pi) {
    const own = chunks.filter((c) => c.p === pi && c.d === undefined);
    const text = own.filter((c) => c.u === undefined).slice(0, 2).map((c) => c.t).join(' ') || own.slice(0, 8).map((c) => c.t).join(' · ');
    return cut(text, 170);
  }

  const vocab = [...postings.keys()];
  const idf = (n) => Math.log(1 + (N - n + 0.5) / (n + 0.5));

  function expandStem(q) {
    // точное совпадение, иначе – ввод по префиксу и опечатки
    if (postings.has(q)) return { stems: [q], weight: 1 };
    if (/\d/.test(q) || q.length < 4) return { stems: [], weight: 0 };
    const pre = vocab.filter((v) => v.startsWith(q));
    if (pre.length && pre.length <= 40) return { stems: pre, weight: 0.8 };
    if (q.length >= 5) {
      const max = q.length >= 9 ? 2 : 1;
      const near = vocab.filter((v) => v.length >= 4 && editDistance(q, v, max) <= max);
      if (near.length) return { stems: near.slice(0, 10), weight: 0.6 };
    }
    return { stems: [], weight: 0 };
  }

  function window(text, matched, maxLen = 230) {
    const re = /[a-zа-яё0-9]+/gi;
    let first = -1, m;
    const marks = [];
    while ((m = re.exec(text))) {
      if (matched.has(stem(m[0]))) { marks.push([m.index, m.index + m[0].length]); if (first < 0) first = m.index; }
    }
    let start = 0;
    if (first > 80) { start = Math.max(0, first - 60); const sp = text.indexOf(' ', start); if (sp > 0 && sp < first) start = sp + 1; }
    let end = Math.min(text.length, start + maxLen);
    if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > start + 40) end = sp; }
    const segs = [];
    let pos = start;
    for (const [a, b] of marks) {
      if (b <= start || a >= end) continue;
      if (a > pos) segs.push({ t: text.slice(pos, a) });
      segs.push({ t: text.slice(Math.max(a, start), Math.min(b, end)), m: true });
      pos = Math.min(b, end);
    }
    if (pos < end) segs.push({ t: text.slice(pos, end) });
    if (start > 0) segs.unshift({ t: '… ' });
    if (end < text.length) segs.push({ t: ' …' });
    return segs;
  }

  function hrefFor(c) {
    if (c.d !== undefined) {
      const f = files[c.d];
      return f.u + (f.kind === 'pdf' && c.n ? '#page=' + c.n : '');
    }
    if (c.u) return c.u;
    const url = pages[c.p].url;
    return c.f ? url + '#:~:text=' + encodeURIComponent(c.f).replace(/-/g, '%2D') : url;
  }

  function buildEntity(e) {
    if (e.kind === 'page') {
      const p = pages[e.i];
      const sum = pageSummary(e.i);
      return { title: p.title, sub: p.section, action: 'Открыть страницу', href: p.url, snippet: sum ? [{ t: sum }] : [], links: [] };
    }
    const f = files[e.i];
    const first = firstChunkOfFile.get(e.i);
    return { title: f.title, sub: f.kind === 'pdf' ? 'Документ PDF' : 'Презентация', action: 'Открыть файл', href: f.u, snippet: first ? [{ t: cut(first.t, 170) }] : [], links: [] };
  }
  function titleMatches(qStems) {
    const hasDigit = qStems.some((q) => /^\d+$/.test(q));
    if (!qStems.some((q) => !/^\d+$/.test(q))) return [];
    const exp = qStems.map((q) => new Set(expandStem(q).stems));
    if (exp.some((x) => !x.size)) return [];
    const found = [];
    for (const e of entities) {
      if (e.kind === 'file' && !hasDigit) continue;
      if (!exp.every((x) => [...x].some((st) => e.stems.has(st)))) continue;
      found.push({ ...e, dist: Math.max(0, e.stems.size - qStems.length) });
    }
    if (!found.length) return [];
    found.sort((a, b) => a.dist - b.dist || (a.kind === b.kind ? a.i - b.i : a.kind === 'page' ? -1 : 1));
    const best = found[0].dist;
    return best > 2 ? [] : found.filter((x) => x.dist <= best + 1);
  }

  function search(query, limit = 3) {
    const q = norm(query).trim();
    if (!q) return { kind: 'empty' };
    for (const s of SMALLTALK) {
      if (s.re.test(q) && tokenize(q).length <= 4) return { kind: s.kind };
    }
    let words = tokenize(q);
    if (!words.length) return { kind: 'empty' };
    let useful = words.filter((w) => !STOP.has(w));
    if (!useful.length) useful = words;
    const qStems = [...new Set(useful.map(stem))];
    const tm = titleMatches(qStems);
    const finish = (bm) => {
      if (!tm.length) return bm.length ? { kind: 'results', results: bm } : { kind: 'none' };
      const out = tm.slice(0, limit).map(buildEntity);
      if (tm[0].dist > 0 && out.length < limit) {
        const seen = new Set(out.map((x) => x.href.split('#')[0]));
        for (const x of bm) {
          const b = x.href.split('#')[0];
          if (/^files\//.test(b) || seen.has(b)) continue;
          seen.add(b); out.push(x);
          if (out.length >= limit) break;
        }
      }
      return { kind: 'results', results: out };
    };

    const scores = new Map(), hits = new Map();
    const matchedStems = new Set();
    let unknown = 0;
    for (const qs of qStems) {
      const { stems, weight } = expandStem(qs);
      if (!stems.length) { unknown++; continue; }
      const seen = new Set();
      for (const st of stems) {
        matchedStems.add(st);
        const post = postings.get(st);
        const w = idf(post.size) * weight;
        for (const [ci, tf] of post) {
          const bm = (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * docLen[ci] / avgLen));
          scores.set(ci, (scores.get(ci) || 0) + bm * w);
          if (!seen.has(ci)) { seen.add(ci); hits.set(ci, (hits.get(ci) || 0) + 1); }
        }
      }
    }
    if (!scores.size || unknown / qStems.length >= 0.5) return finish([]);

    const need = qStems.length <= 2 ? qStems.length - unknown : Math.ceil(qStems.length * 0.6);
    const phrase = useful.join(' ');
    const ranked = [];
    for (const [ci, sc] of scores) {
      if (hits.get(ci) < Math.max(1, need)) continue;
      let s = sc * (0.6 + 0.4 * hits.get(ci) / qStems.length);
      if (chunks[ci].d !== undefined) s *= 0.7; // слайды и документы – после самих страниц сайта
      if (useful.length > 1 && normText[ci].includes(phrase)) s *= 1.6;
      ranked.push([ci, s]);
    }
    if (!ranked.length) return finish([]);
    ranked.sort((a, b) => b[1] - a[1]);

    const perPage = new Map(), results = [], seenHref = new Set();
    const top = ranked[0][1];
    for (const [ci, s] of ranked) {
      if (results.length >= limit) break;
      if (s < top * 0.35) break;
      const c = chunks[ci];
      const key = c.d !== undefined ? 'f' + c.d : 'p' + c.p;
      const cnt = perPage.get(key) || 0;
      if (cnt >= (c.d !== undefined ? 1 : 2)) continue;
      const href = hrefFor(c);
      if (seenHref.has(href)) continue;
      seenHref.add(href);
      perPage.set(key, cnt + 1);
      let title, sub, action;
      if (c.d !== undefined) {
        const f = files[c.d];
        title = f.title;
        sub = f.kind === 'pdf' ? `Документ PDF, стр. ${c.n}` : `Презентация, слайд ${c.n}`;
        action = 'Открыть файл';
      } else {
        const p = pages[c.p];
        const isCard = c.u !== undefined;
        title = isCard ? c.t.replace(/^\d+\s+(?=Лекци)/, '') : p.title;
        sub = [isCard ? p.title : p.section, isCard ? c.h : c.h && c.h !== p.title ? c.h : ''].filter(Boolean).join(' · ');
        action = /^files\//.test(href) ? 'Открыть файл' : 'Открыть страницу';
      }
      results.push({ title, sub, action, href, snippet: c.u !== undefined && c.d === undefined ? [] : window(c.t, matchedStems), links: (c.l || []).filter((l) => /^https?:/.test(l[1])).slice(0, 3) });
    }
    return finish(results);
  }

  return { search };
}
