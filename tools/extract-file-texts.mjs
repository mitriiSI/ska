// Достаёт текст из презентаций (.pptx) и PDF в data/file-texts.json для поиска по сайту.
// Запуск вручную после добавления файлов: node tools/extract-file-texts.mjs
// Для PDF нужен pdftotext (poppler). Уже обработанные файлы пропускаются (ключ: имя + размер).
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/file-texts.json');
const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Минимальное чтение zip: центральный каталог + inflateRaw.
function zipEntries(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('не zip');
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const map = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    map.set(name, { method, csize, off });
    p += 46 + nlen + xlen + clen;
  }
  return (name) => {
    const m = map.get(name);
    if (!m) return null;
    const start = m.off + 30 + buf.readUInt16LE(m.off + 26) + buf.readUInt16LE(m.off + 28);
    const data = buf.subarray(start, start + m.csize);
    return m.method === 0 ? data : zlib.inflateRawSync(data);
  };
}

function pptxSlides(file) {
  const buf = fs.readFileSync(file);
  const entries = zipEntries(buf);
  // имена слайдов берём из центрального каталога через перебор номеров
  const slides = [];
  for (let n = 1; n < 400; n++) {
    const xml = entries(`ppt/slides/slide${n}.xml`);
    if (!xml) { if (n > 1 && !entries(`ppt/slides/slide${n + 1}.xml`)) break; continue; }
    const paras = [...xml.toString('utf8').matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
      .map((m) => dec([...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('')).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (paras.length) slides.push({ n, text: paras.join('\n') });
  }
  return slides;
}

function pdfPages(file) {
  const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) return [];
  return r.stdout.split('\f').map((t, i) => ({ n: i + 1, text: t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') })).filter((p) => p.text.length > 20);
}

const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const result = {};
for (const f of fs.readdirSync(path.join(ROOT, 'files')).sort()) {
  const full = path.join(ROOT, 'files', f);
  const size = fs.statSync(full).size;
  const key = 'files/' + f;
  if (cache[key] && cache[key].size === size) { result[key] = cache[key]; continue; }
  let parts = [];
  try {
    if (/\.pptx$/i.test(f)) parts = pptxSlides(full);
    else if (/\.pdf$/i.test(f)) parts = pdfPages(full);
  } catch (e) { console.log('ПРОПУСК', f, e.message); }
  result[key] = { size, kind: /\.pdf$/i.test(f) ? 'pdf' : 'pptx', parts };
  console.log(f, parts.length, 'частей');
}
fs.writeFileSync(OUT, JSON.stringify(result));
console.log('готово:', Object.keys(result).length, 'файлов,', (fs.statSync(OUT).size / 1024).toFixed(0), 'КБ');
