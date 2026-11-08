// Журнал баллов: общая логика для страницы журнала, редактора и тестов.
// Данные лежат в assets/journal.json:
//   { max, endpoint, updated, students: [{ id, name, salt, codeHash, entries: [{ id, pts, at }] }] }

export const MAX_POINTS = 138;
export const SELF_MAX_ENTRY = 30; // за один раз студент может внести не больше

// Оценки по сумме баллов. Цвета: пятёрка зелёная, четвёрка жёлтая, тройка оранжевая.
export const GRADES = [
  { grade: 5, min: 90, key: 'g5', title: 'Пятёрка', range: 'от 90' },
  { grade: 4, min: 75, key: 'g4', title: 'Четвёрка', range: '75–89' },
  { grade: 3, min: 50, key: 'g3', title: 'Тройка', range: '50–74' },
];

export const round2 = (n) => Math.round(n * 100) / 100;

export function gradeOf(total) {
  for (const g of GRADES) if (total >= g.min) return g;
  return null;
}

export const adminTotal = (st) => round2((st.entries || []).reduce((a, e) => a + Number(e.pts || 0), 0));

// selfList: [{ id, sid, pts, ts }] – баллы, которые студенты внесли сами
export const selfTotal = (sid, selfList) => round2((selfList || []).filter((e) => e.sid === sid).reduce((a, e) => a + Number(e.pts || 0), 0));

export const totalOf = (st, selfList) => round2(adminTotal(st) + selfTotal(st.id, selfList));

export function formatPoints(n) {
  return Number.isInteger(n) ? String(n) : String(round2(n)).replace('.', ',');
}

// --- коды студентов ---------------------------------------------------------------
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // без 0/O и 1/I

export function makeCode() {
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  const s = Array.from(a, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return s.slice(0, 5) + '-' + s.slice(5);
}
export const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function hashCode(salt, code) { return sha256Hex(salt + ':' + normalizeCode(code)); }

export function randomHex(n) {
  const a = new Uint8Array(Math.ceil(n / 2));
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, n);
}

// --- разбор ввода -----------------------------------------------------------------
export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
const fold = (s) => cleanName(s).toLowerCase().replace(/ё/g, 'е');

// Список фамилий: по одной в строке (или через «;»). Повторы и пустые строки убираются.
export function parseNames(text, existing = []) {
  const seen = new Set(existing.map((n) => fold(n)));
  const out = [];
  for (const raw of String(text || '').split(/[\n;]+/)) {
    const name = cleanName(raw.replace(/^\s*\d+[.)]\s+/, '')); // «1. Иванов» -> «Иванов»
    if (!name) continue;
    const key = fold(name);
    if (seen.has(key)) continue;
    seen.add(key); out.push(name);
  }
  return out;
}

const NUM = /(?<![\d.,])[-−–]?\d+(?:[.,]\d+)?/g;
const toNumber = (t) => Number(t.replace('−', '-').replace('–', '-').replace(',', '.'));

// «5», «5 3 10», «5, -1» -> [5, 3, 10]. Буквы и прочий текст не допускаются.
export function parsePoints(text) {
  const t = String(text || '').trim();
  if (!t) return { values: [], error: 'Введите число.' };
  if (/[^\d\s.,;+−–-]/.test(t)) return { values: [], error: 'Только числа, например: 5 или 5, 3, 10.' };
  const values = (t.match(NUM) || []).map(toNumber).filter((v) => Number.isFinite(v) && v !== 0);
  if (!values.length) return { values: [], error: 'Введите число.' };
  if (values.length > 20) return { values: [], error: 'За один раз можно внести не больше 20 чисел.' };
  if (values.some((v) => Math.abs(v) > 200)) return { values: [], error: 'Число слишком большое.' };
  return { values: values.map(round2) };
}

// Массовый ввод: строки вида «Иванов 5» или «Петров: 3, 4». Возвращает найденных и ненайденных.
export function parseBulk(text, students) {
  const matched = [], problems = [];
  for (const line of String(text || '').split('\n')) {
    const raw = line.trim();
    if (!raw) continue;
    const m = raw.match(/^(.*?)[\s:–—-]*((?:[-−–]?\d+(?:[.,]\d+)?[\s,;]*)+)$/);
    if (!m || !cleanName(m[1])) { problems.push({ line: raw, why: 'нужна фамилия и число' }); continue; }
    const pts = parsePoints(m[2]);
    if (pts.error) { problems.push({ line: raw, why: pts.error }); continue; }
    const key = fold(m[1]);
    let found = students.filter((s) => fold(s.name) === key);
    if (!found.length) found = students.filter((s) => fold(s.name).startsWith(key));
    if (!found.length) found = students.filter((s) => fold(s.name).includes(key));
    if (found.length === 1) matched.push({ sid: found[0].id, name: found[0].name, values: pts.values });
    else problems.push({ line: raw, why: found.length ? 'подходит несколько фамилий' : 'такой фамилии нет' });
  }
  return { matched, problems };
}

export const byName = (a, b) => a.name.localeCompare(b.name, 'ru');

export function emptyJournal() { return { max: MAX_POINTS, endpoint: '', updated: '', students: [] }; }
