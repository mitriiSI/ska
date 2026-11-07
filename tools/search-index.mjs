// Индекс для помощника по сайту: assets/search-index.json.
// Берёт готовые страницы (*.html), режет их на фрагменты и добавляет тексты файлов из data/file-texts.json.
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const SKIP = new Set(['admin.html', 'instrukciya.html']);
const clean = (s) => String(s || '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
const MAX_CHUNK = 650;
const GENERIC = /^(.{0,4}|.*скачать.*|документ|файл|pdf|здесь|ссылка|по ссылке)$/i;

export function buildSearchIndex(root) {
  const pages = [], chunks = [], files = [];
  const fileLabels = new Map(); // href -> [{label, page}]

  const htmlFiles = fs.readdirSync(root).filter((f) => f.endsWith('.html') && !SKIP.has(f)).sort();
  for (const file of htmlFiles) {
    const $ = cheerio.load(fs.readFileSync(path.join(root, file), 'utf8'));
    const panel = $('.content.panel').first();
    if (!panel.length) continue;
    // пробелы между соседними элементами и на месте <br>, чтобы слова не слипались
    panel.find('br').replaceWith(' ');
    panel.find('time, .lec-n, .lec-t, .lec-s, .file-txt strong, .file-txt small, .tile-n').after(' ');
    panel.find('.page-head').first().find('.crumb').remove();
    const isHome = file === 'index.html';
    const title = isHome ? 'Главная' : clean(panel.find('.page-head h1').first().text()) || clean($('title').text());
    const crumbLinks = panel.find('.page-head .crumb a');
    const section = crumbLinks.length > 1 ? clean(crumbLinks.last().text()) : '';
    const pi = pages.push({ title, url: file, section }) - 1;

    let heading = '', buf = [], links = [], first = '';
    const flush = () => {
      const text = clean(buf.join(' '));
      if (text.length > 1) chunks.push({ p: pi, h: heading, t: text, f: first.slice(0, 70), ...(links.length ? { l: links.slice(0, 6) } : {}) });
      buf = []; links = []; first = '';
    };
    const addLinks = (el) => {
      $(el).find('a[href]').each((_, a) => {
        const text = clean($(a).text()), href = $(a).attr('href');
        if (text && href && !href.startsWith('#') && !/^(mailto|tel):/.test(href) && links.length < 6) links.push([text, href]);
      });
    };
    const addBlock = (text, el) => {
      text = clean(text);
      if (!text) return;
      if (!first) first = text;
      if (buf.join(' ').length + text.length > MAX_CHUNK && buf.length) { flush(); first = text; }
      buf.push(text);
      if (el) addLinks(el);
    };

    const walk = (node) => {
      $(node).children().each((_, el) => {
        const tag = el.tagName;
        const $el = $(el);
        if (['script', 'style', 'svg', 'form', 'noscript'].includes(tag)) return;
        if ($el.hasClass('page-head') || $el.hasClass('pager')) return;
        if (/^h[1-3]$/.test(tag)) { flush(); heading = clean($el.text()); return; }
        if (tag === 'a' && /\b(lec|file|hub-tile|tile)\b/.test($el.attr('class') || '')) {
          flush();
          const href = $el.attr('href');
          const text = clean($el.text().replace(/PPTX|PDF|DOCX|·\s*[\d,]+\s*[КМ]Б/g, ' '));
          chunks.push({ p: pi, h: heading, t: text, u: href, f: '' });
          return;
        }
        if (tag === 'table') {
          $el.find('tr').each((__, tr) => addBlock($(tr).find('th,td').map((___, c) => clean($(c).text())).get().filter(Boolean).join(' — '), tr));
          flush(); return;
        }
        if (tag === 'dl') {
          $el.find('dt').each((__, dt) => addBlock(`${clean($(dt).text())}: ${clean($(dt).next('dd').text())}`, $(dt).next('dd')));
          return;
        }
        if (['p', 'li', 'blockquote', 'figcaption', 'caption', 'time'].includes(tag)) {
          if (tag === 'li' && $el.find('p, li').length) { walk(el); return; }
          addBlock($el.text(), el);
          return;
        }
        if (tag === 'img') { addBlock($el.attr('alt') && !/\.png$|\.jpe?g$/i.test($el.attr('alt')) ? $el.attr('alt') : '', null); return; }
        // контейнеры и «голые» блоки с текстом
        if ($el.children().length) walk(el);
        else addBlock($el.text(), el);
      });
    };
    walk(panel);
    flush();
    panel.find('a[href^="files/"]').each((_, a) => {
      const href = $(a).attr('href');
      const label = clean($(a).find('strong, .lec-t').first().text()) || clean($(a).text());
      const prev = fileLabels.get(href);
      if (!prev || (prev.generic && !GENERIC.test(label))) fileLabels.set(href, { label, page: pi, generic: GENERIC.test(label) });
    });
    if (file === 'kontakty.html') {
      chunks.push({ p: pi, h: 'Написать сообщение', t: 'Как связаться с преподавателем: написать сообщение прямо на сайте через форму (имя, email, тема, текст), написать на электронную почту или позвонить по телефону. Связь с Константином Анатольевичем Соловьёвым, контакты, почта, телефон, email.', f: '' });
    }
  }

  // файлы: названия по тому, как они подписаны на страницах
  const fileTexts = fs.existsSync(path.join(root, 'data/file-texts.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data/file-texts.json'), 'utf8')) : {};
  const nameOf = (href, info) => {
    const m = href.match(/files\/(mehmat-|speckurs-)?lekciya-(\d+)\./);
    if (m) return `Лекция ${m[2]}${m[1] === 'mehmat-' ? ' (мехмат)' : m[1] === 'speckurs-' ? ' (спецкурс)' : ' (ФГУ)'}`;
    return (info && !info.generic && info.label) || null;
  };
  for (const [href, data] of Object.entries(fileTexts)) {
    if (!data.parts || !data.parts.length || !fs.existsSync(path.join(root, href))) continue;
    const info = fileLabels.get(href);
    const firstLine = clean(data.parts[0].text.split('\n').find((l) => clean(l).length >= 8) || '').slice(0, 90);
    const fi = files.push({ u: href, title: nameOf(href, info) || firstLine || path.basename(href), kind: data.kind, p: info ? info.page : -1 }) - 1;
    for (const part of data.parts) {
      // длинные страницы PDF режем на куски
      const text = clean(part.text);
      for (let i = 0; i < text.length; i += MAX_CHUNK) {
        const piece = text.slice(i, i + MAX_CHUNK + 60);
        chunks.push({ d: fi, n: part.n, t: piece, f: '' });
        if (i + MAX_CHUNK + 60 >= text.length) break;
      }
    }
  }
  const out = { v: 1, pages, files, chunks };
  fs.writeFileSync(path.join(root, 'assets/search-index.json'), JSON.stringify(out));
  return { pages: pages.length, files: files.length, chunks: chunks.length };
}
