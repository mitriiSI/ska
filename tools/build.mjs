import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import * as cheerio from 'cheerio';
import { sanitizePage } from './page-content.mjs';

const OUT = ROOT;
// Версия браузерной очистки из lockfile, без стороннего CDN.
fs.mkdirSync(path.join(ROOT, 'assets/vendor'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'node_modules/dompurify/dist/purify.es.mjs'), path.join(ROOT, 'assets/vendor/purify.es.mjs'));
const pages = JSON.parse(fs.readFileSync(ROOT + '/data/pages.json', 'utf8'));
const assets = JSON.parse(fs.readFileSync(ROOT + '/data/assetmap.json', 'utf8'));
const WIX = 'https://solovyevka.wixsite.com/ska-ruhistory';

const SITE = 'Отечественная история';
const AUTHOR = 'К. А. Соловьёв';
const AUTHOR_GEN = 'К. А. Соловьёва';

// ---- structure -------------------------------------------------------------
// [wixPath, slug, title]
const NAV = [
  { title: 'Важное', items: [
    ['/programma', 'programma', 'Программа курса'],
    ['/metodicheskie-iaterialy', 'metodicheskie-materialy', 'Методические материалы'],
    ['/lekcii', 'lekcii', 'Лекции'],
    ['/sajty-po-istorii-rossii', 'sajty', 'Сайты по истории России'],
    ['/obyavleniya', 'obyavleniya', 'Объявления'],
  ]},
  { title: 'Спецкурс', items: [
    ['/спецкурс', 'speckurs', 'О спецкурсе'],
    ['/занятия', 'speckurs-zanyatiya', 'Занятия'],
    ['/презентации-лекций', 'speckurs-lekcii', 'Презентации лекций'],
    ['/семинары', 'speckurs-seminary', 'Семинары'],
    ['/проблематика-выступлений-на-конференции', 'speckurs-konferenciya', 'Проблематика выступлений на конференции'],
    ['/дебаты-методика', 'speckurs-debaty', 'Дебаты: методика'],
  ]},
  { title: 'ФГУ', items: [
    ['/rejtingovaya-sistema', 'fgu-rejtingovaya-sistema', 'Рейтинговая система'],
    ['/spiski-grupp', 'fgu-gruppa-107', 'Группа 107'],
    ['/zadaniya', 'fgu-zadaniya', 'Задания'],
    ['/seminary-pervogo-semestra', 'fgu-seminary-1', 'Семинары первого семестра'],
    ['/seminary-vtorogo', 'fgu-seminary-2', 'Семинары второго семестра'],
    ['/raboty-studentov', 'fgu-raboty-studentov', 'Работы студентов'],
    ['/rezultaty', 'fgu-rezultaty', 'Результаты'],
    ['/itogi-semestra', 'fgu-itogi-semestra', 'Итоги семестра'],
    ['/voprosy-k-ekzamenu', 'fgu-voprosy-k-ekzamenu', 'Вопросы к экзамену и зачёту'],
  ]},
  { title: 'Мехмат', items: [
    ['/zanyatiya-pervogo-semestra', 'mehmat-temy-seminarov', 'Тематика семинаров'],
    ['/gruppy-2015-i-207', 'mehmat-literatura', 'Литература к семинарам'],
    ['/задания', 'mehmat-zadaniya', 'Задания'],
    ['/zanyatiya-vtorogo-semestra', 'mehmat-zanyatiya-v-gruppah', 'Занятия в группах'],
    ['/esse-metodika', 'mehmat-esse-metodika', 'Эссе: методика'],
    ['/эссе-итоги', 'mehmat-esse-itogi', 'Эссе: итоги'],
    ['/rejting', 'mehmat-rejting', 'Рейтинг'],
    ['/rezultay-rabot', 'mehmat-rezultaty-dz', 'Результаты домашних заданий'],
    ['/итоги-мини-эссе', 'mehmat-itogi-mini-esse', 'Итоги мини-эссе'],
    ['/rezulaty-semestra', 'mehmat-rezultaty-semestra', 'Результаты семестра'],
    ['/voprosy-k-zachetu', 'mehmat-voprosy-k-ekzamenu', 'Вопросы к экзамену'],
  ]},
  { title: 'Курсовые работы', items: [
    ['/seminary', 'kursovye-temy', 'Тематика курсовых работ'],
    ['/metodika-podgotovki-kursovyh-rabot', 'kursovye-metodika', 'Методика подготовки'],
    ['/raspredelenie-tem-kursovyh-rabot', 'kursovye-raspredelenie', 'Распределение тем'],
    ['/indeks', 'kursovye-indeks', 'Индекс'],
  ]},
];
const CONTACT = ['/contact-me', 'kontakty', 'Связаться'];

const pathToSlug = { '/': 'index', [CONTACT[0]]: CONTACT[1] };
for (const s of NAV) for (const [p, slug] of s.items) pathToSlug[p] = slug;

// ---- helpers -----------------------------------------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const exists = (rel) => fs.existsSync(`${OUT}/${rel}`);
const sizeOf = (rel) => {
  const b = fs.statSync(`${OUT}/${rel}`).size;
  return b > 1e6 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
};
const plain = (h) => cheerio.load(`<div>${h}</div>`)('div').text().replace(/[\u200b\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();

function localHref(h) {
  if (!h) return h;
  if (h.startsWith(WIX)) {
    let p = decodeURIComponent(h.slice(WIX.length).replace(/[?#].*$/, '')) || '/';
    if (pathToSlug[p]) return pathToSlug[p] === 'index' ? 'index.html' : pathToSlug[p] + '.html';
    return null;
  }
  return h;
}

function cleanRich(html) {
  const $ = cheerio.load(`<div id="r">${html}</div>`, null, false);
  const root = $('#r');
  root.find('span').each((_, e) => { $(e).replaceWith($(e).contents()); });
  root.find('a').each((_, e) => {
    const href = localHref($(e).attr('href'));
    if (!href) { $(e).replaceWith($(e).contents()); return; }
    $(e).attr('href', href);
    if (/^https?:/.test(href)) $(e).attr({ target: '_blank', rel: 'noopener' });
  });
  root.find('h1').each((_, e) => { e.tagName = 'h2'; });
  root.find('h4,h5,h6').each((_, e) => { e.tagName = 'h3'; });
  // drop empty blocks
  for (let i = 0; i < 3; i++) root.find('p,h2,h3,li,strong,em,b,i,u').each((_, e) => {
    if (!$(e).text().replace(/[\u200b\u00a0\s]/g, '') && !$(e).find('img,a').length) $(e).remove();
  });
  root.find('ol,ul').each((_, e) => { if (!$(e).children().length) $(e).remove(); });
  root.find('li > p').each((_, e) => { $(e).replaceWith($(e).contents()); });
  // autolink bare URLs in text nodes
  const walk = (node) => {
    $(node).contents().each((_, c) => {
      if (c.type === 'text') {
        if ($(c).parents('a').length) return;
        const t = c.data;
        if (/https?:\/\/\S+/.test(t)) {
          const out = esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:)»])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
          $(c).replaceWith(out);
        }
      } else if (c.type === 'tag') walk(c);
    });
  };
  walk(root);
  return sanitizePage(root.html().replace(/\u200b/g, '').replace(/&nbsp;/g, ' ').replace(/\n\s*\n/g, '\n').trim());
}

const fileExt = (rel) => rel.split('.').pop().toUpperCase();

function fileCard(rel, label, sub) {
  return `<a class="file" href="${rel}" download>
    <span class="file-ico">${fileExt(rel)}</span>
    <span class="file-txt"><strong>${esc(label)}</strong><small>${esc(sub || fileExt(rel))} · ${sizeOf(rel)}</small></span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>`;
}

// generic block renderer -----------------------------------------------------
function renderGeneric(blocks) {
  let html = '';
  let prev = null;
  for (const b of blocks) {
    if (b.k === 'rt') {
      const c = cleanRich(b.h);
      if (c) html += `<div class="prose">${c}</div>\n`;
    } else if (b.k === 'img') {
      const rel = assets[b.src];
      if (rel && exists(rel) && prev !== 'file') {
        html += `<figure class="shot"><a href="${rel}" target="_blank" rel="noopener"><img src="${rel}" alt="${esc(b.alt || '')}" loading="lazy"></a></figure>\n`;
      }
    } else if (b.k === 'link') {
      const rel = assets[b.href];
      if (rel && exists(rel)) html += `<div class="files">${fileCard(rel, 'Скачать документ', fileExt(rel) === 'PDF' ? 'PDF-файл' : 'Файл')}</div>\n`;
    }
    prev = b.k === 'link' && assets[b.href] ? 'file' : b.k;
  }
  return html;
}

// data ---------------------------------------------------------------------
const readJson = (f, def) => { try { return JSON.parse(fs.readFileSync(ROOT + '/data/' + f, 'utf8')); } catch { return def; } };
const announcements = readJson('announcements.json', []);
const lectureTitles = readJson('lectures.json', {});
const dateKey = (d) => d.split('.').reverse().join('');
const sortedNews = () => [...announcements].sort((x, y) => dateKey(y.date).localeCompare(dateKey(x.date)));

// lectures -----------------------------------------------------------------
// Файлы лекций кладутся в files/ с именами: lekciya-N.pptx (ФГУ), mehmat-lekciya-N.pptx, speckurs-lekciya-N.pptx
function listLectures(prefix) {
  const re = new RegExp('^' + prefix + '(\\d+)\\.(pptx|ppt|pdf)$');
  const out = [];
  for (const f of fs.readdirSync(OUT + '/files')) {
    const m = f.match(re);
    if (m) out.push({ n: +m[1], rel: 'files/' + f, key: prefix + m[1] });
  }
  return out.sort((x, y) => x.n - y.n);
}

function lectureGrid(prefix) {
  let h = '<div class="lec-grid">';
  for (const { n, rel, key } of listLectures(prefix)) {
    const title = lectureTitles[key];
    h += `<a class="lec" href="${rel}" download><span class="lec-n">${n}</span><span class="lec-t">Лекция ${n}${title ? `<em>${esc(title)}</em>` : ''}</span><span class="lec-s">${fileExt(rel)} · ${sizeOf(rel)}</span></a>`;
  }
  return h + '</div>';
}

const lectureCount = () => listLectures('lekciya-').length + listLectures('mehmat-lekciya-').length;

function renderLectures() {
  return `
<p class="lead">Презентации лекций по истории России. Файлы скачиваются прямо с этого сайта.</p>
<h2>ФГУ: IX–XIX века</h2>
${lectureGrid('lekciya-')}
<h2>Мехмат</h2>
${lectureGrid('mehmat-lekciya-')}`;
}

function renderSpeckursLectures() {
  let h = '<p class="lead">Спецкурс «От Просвещения к постмодерну: революция и реакция в русской истории».</p><div class="files wide">';
  for (const { n, rel, key } of listLectures('speckurs-lekciya-')) h += fileCard(rel, `Лекция ${n}. ${lectureTitles[key] || ''}`.trim(), 'Презентация ' + fileExt(rel));
  return h + '</div>';
}

// announcements -----------------------------------------------------------
const newsItems = (list) => list.map((n) => `<li><time>${esc(String(n.date || ''))}</time><span>${sanitizePage(n.html)}</span></li>`).join('');
function renderAnnouncements() {
  return `<ul class="news">${newsItems(sortedNews())}</ul>`;
}

// ---- layout -------------------------------------------------------------------
const flat = [];
for (const s of NAV) for (const [p, slug, title] of s.items) flat.push({ p, slug, title, section: s.title });

const SECTION_SLUG = { 'Важное': 'razdel-dopolnitelno', 'Спецкурс': 'razdel-speckurs', 'ФГУ': 'razdel-fgu', 'Мехмат': 'razdel-mehmat', 'Курсовые работы': 'razdel-kursovye' };
const sectionOfSlug = (slug) => {
  const hub = Object.entries(SECTION_SLUG).find(([, v]) => v === slug);
  if (hub) return hub[0];
  const it = flat.find((x) => x.slug === slug);
  return it && it.section;
};

function navHtml(currentSlug) {
  const cur = sectionOfSlug(currentSlug);
  let h = '<nav class="nav" id="nav" aria-label="Основное меню"><ul>';
  for (const s of NAV) {
    if (!s.items.some(([p]) => built.has(p))) continue;
    h += `<li><a href="${SECTION_SLUG[s.title]}.html"${cur === s.title ? ' aria-current="page"' : ''}>${s.title}</a></li>`;
  }
  h += `<li><a href="kontakty.html"${currentSlug === 'kontakty' ? ' aria-current="page"' : ''}>Связаться</a></li>`;
  return h + '</ul></nav>';
}

const ICONS = {
  book: '<path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h7M8 12h7"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6M3 20h18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M17 15c2.5.5 4 2.5 4 5"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
};
function iconFor(slug) {
  const rules = [[/lekcii|prezent/, 'slides'], [/voprosy/, 'question'], [/sajty/, 'globe'], [/obyavl/, 'megaphone'],
    [/rejting/, 'chart'], [/itogi|rezultaty/, 'check'], [/gruppa/, 'users'], [/esse/, 'pen'], [/debaty|konferenc/, 'chat'],
    [/seminary|zadaniya|temy|zanyatiya|raspredel|indeks/, 'list'], [/raboty/, 'file'], [/metodich|programma|literatura|metodika|speckurs/, 'book']];
  const hit = rules.find(([re]) => re.test(slug));
  return `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[hit ? hit[1] : 'file']}</svg>`;
}

function layout({ slug, title, body, crumb, desc, pager, script }) {
  const t = slug === 'index' ? `${SITE} — сайт ${AUTHOR_GEN}` : `${title} — ${SITE}`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'self'${script ? ' https://formsubmit.co' : ''}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(desc || 'Сайт для студентов МГУ имени М. В. Ломоносова, изучающих отечественную историю: лекции, семинары, задания, результаты.')}">
<meta name="theme-color" content="#0a4dff">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<a class="skip" href="#main">К содержанию</a>
<header class="top">
  <a class="masthead" href="index.html" aria-label="${SITE} — на главную"><span class="mast-t">${SITE}</span><span class="mast-s">К. А. Соловьёв · МГУ имени М. В. Ломоносова</span></a>
  ${slug === 'index' ? '' : `<div class="top-bar"><div class="top-in">
    <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="Меню"><span></span><span></span><span></span></button>
    ${navHtml(slug)}
  </div></div>`}
</header>
<main id="main">
<div class="wrap content panel${slug === 'index' ? ' home-panel' : ''}">
${slug === 'index' ? '' : `<div class="page-head">${crumb ? `<p class="crumb">${crumb}</p>` : ''}<h1>${esc(title)}</h1></div>`}
${body}
${pager || ''}
</div>
</main>
<script src="assets/app.js"></script>
${slug === 'index' ? '' : '<script type="module" src="assets/helper.js"></script>\n'}${slug === 'index' ? '<script type="module" src="assets/home.js"></script>\n' : ''}${script ? `<script src="assets/${script}"></script>\n` : ''}</body>
</html>`;
}

// ---- build pages ------------------------------------------------------------
const built = new Set();
const results = [];
function pageBody(p) {
  const editable = ROOT + '/data/editable/' + pathToSlug[p] + '.json';
  if (exists('data/editable/' + pathToSlug[p] + '.json')) {
    const data = JSON.parse(fs.readFileSync(editable, 'utf8'));
    const content = sanitizePage(data.html);
    return '<div class="prose edited-page">' + (content.trim() || '<p>Материалы ещё не размещены.</p>') + '</div>';
  }
  const pg = pages[p];
  if (!pg) return '';
  if (p === '/lekcii') return renderLectures();
  if (p === '/презентации-лекций') return renderSpeckursLectures();
  if (p === '/obyavleniya') return renderAnnouncements();
  return renderGeneric(pg.blocks);
}
const bodies = {};
for (const it of flat) {
  const b = pageBody(it.p);
  if (b.trim()) { bodies[it.p] = b; built.add(it.p); }
}
built.add(CONTACT[0]);

for (const [idx, it] of flat.entries()) {
  if (!bodies[it.p]) { console.log('SKIP (empty):', it.p); continue; }
  const sectionItems = flat.filter((x) => x.section === it.section && bodies[x.p]);
  const i = sectionItems.indexOf(it);
  const prev = sectionItems[i - 1], next = sectionItems[i + 1];
  const pager = (prev || next) ? `<nav class="pager" aria-label="Соседние страницы">${prev ? `<a class="prev" href="${prev.slug}.html"><small>Назад</small>${prev.title}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.slug}.html"><small>Далее</small>${next.title}</a>` : '<span></span>'}</nav>` : '';
  fs.writeFileSync(`${OUT}/${it.slug}.html`, layout({ slug: it.slug, title: it.title, body: bodies[it.p], crumb: `<a href="index.html">Главная</a> / <a href="${SECTION_SLUG[it.section]}.html">${it.section}</a>`, pager }));
  results.push(it.slug);
}

// section hubs: плитки-иконки для перехода вглубь
for (const sec of NAV) {
  const items = sec.items.filter(([p]) => built.has(p));
  if (!items.length) continue;
  const body = `<div class="hub">${items.map(([, slug, title]) => `<a class="hub-tile" href="${slug}.html">${iconFor(slug)}<span>${title}</span></a>`).join('')}</div>`;
  const slug = SECTION_SLUG[sec.title];
  fs.writeFileSync(`${OUT}/${slug}.html`, layout({ slug, title: sec.title, body, crumb: '<a href="index.html">Главная</a>' }));
}

// contacts
{
  const pg = pages['/contact-me'];
  const body = `<div class="card contact">
  <img class="portrait" src="img/portrait.jpg" alt="Соловьёв К. А." width="220" height="198">
  <div><h2>Соловьёв Константин Анатольевич</h2>
  <dl>
    <dt>Электронная почта</dt><dd><a href="mailto:solovyevka@gmail.com">solovyevka@gmail.com</a></dd>
    <dt>Телефон</dt><dd><a href="tel:+79166082789">+7 (916) 608-27-89</a></dd>
  </dl></div>
</div>
<div class="card cform">
  <h2>Написать сообщение</h2>
  <form id="contact-form" novalidate>
    <label>Имя <span aria-hidden="true">*</span><input name="name" type="text" autocomplete="name" required maxlength="120"></label>
    <label>Email <span aria-hidden="true">*</span><input name="email" type="email" autocomplete="email" required maxlength="200"></label>
    <label>Тема<input name="subject" type="text" maxlength="200"></label>
    <label>Сообщение <span aria-hidden="true">*</span><textarea name="message" rows="6" required maxlength="5000"></textarea></label>
    <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="cform-row"><button class="btn" type="submit">Отправить</button><p id="contact-status" role="status" aria-live="polite"></p></div>
    <noscript><p>Для отправки нужен JavaScript. Или напишите на <a href="mailto:solovyevka@gmail.com">solovyevka@gmail.com</a>.</p></noscript>
  </form>
</div>
<div class="card contact tech">
  <div><h2>Вопросы по работе сайта</h2>
  <p>Не открывается страница, не скачивается файл, что-то отображается неправильно? Напишите в Telegram: <a href="https://t.me/qddwxd" target="_blank" rel="noopener">@qddwxd</a>.</p></div>
</div>`;
  fs.writeFileSync(`${OUT}/kontakty.html`, layout({ slug: 'kontakty', title: 'Контакты', body, crumb: '<a href="index.html">Главная</a>', script: 'contact-form.js' }));
}

// home
{
  const SEC = [
    ['Важное', 'razdel-dopolnitelno.html', 'Программа, лекции, объявления', 'megaphone'],
    ['Спецкурс', 'razdel-speckurs.html', 'Лекции, семинары, дебаты', 'book'],
    ['ФГУ', 'razdel-fgu.html', 'Рейтинг, задания, результаты', 'users'],
    ['Мехмат', 'razdel-mehmat.html', 'Семинары, эссе, экзамен', 'chart'],
    ['Курсовые работы', 'razdel-kursovye.html', 'Темы, методика, индекс', 'pen'],
    ['Связаться', 'kontakty.html', 'Контакты и сообщение', 'chat'],
  ];
  const icon = (k) => `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
  const body = `<section class="home">
<p class="home-lead">Учебный сайт для студентов МГУ имени М. В. Ломоносова. Напишите, что нужно найти, и ответ появится сразу.</p>
<form class="home-search" id="home-search" role="search">
  <input id="home-q" name="q" type="search" autocomplete="off" maxlength="200" placeholder="Например: лекция 5" aria-label="Поиск и помощник по сайту">
  <button type="submit">Найти</button>
</form>
<div class="home-results" id="home-results" role="region" aria-live="polite" aria-label="Результаты поиска" hidden></div>
<div class="hub home-hub" id="home-hub">${SEC.map(([t, href, d, ic]) => `<a class="hub-tile" href="${href}">${icon(ic)}<span>${t}</span><small>${d}</small></a>`).join('')}</div>
</section>`;
  fs.writeFileSync(`${OUT}/index.html`, layout({ slug: 'index', title: SITE, body }));
}

import('./search-index.mjs').then(({ buildSearchIndex }) => {
  const r = buildSearchIndex(ROOT);
  console.log('search index:', r.pages, 'pages,', r.files, 'files,', r.chunks, 'chunks');
});
console.log('built:', results.length + 2, 'pages');
