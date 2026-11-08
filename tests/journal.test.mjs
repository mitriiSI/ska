import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as J from '../assets/journal-core.js';

const students = [
  { id: 's1', name: 'Иванов Иван', entries: [{ id: 'a', pts: 40 }, { id: 'b', pts: 30.5 }] },
  { id: 's2', name: 'Петров Пётр', entries: [] },
  { id: 's3', name: 'Петрова Анна', entries: [] },
];

test('максимум и границы оценок', () => {
  assert.equal(J.MAX_POINTS, 138);
  assert.equal(J.gradeOf(138).grade, 5);
  assert.equal(J.gradeOf(90).grade, 5);
  assert.equal(J.gradeOf(89.5).grade, 4);
  assert.equal(J.gradeOf(75).grade, 4);
  assert.equal(J.gradeOf(74).grade, 3);
  assert.equal(J.gradeOf(50).grade, 3);
  assert.equal(J.gradeOf(49.5), null);
  assert.equal(J.gradeOf(0), null);
  assert.deepEqual(J.GRADES.map((g) => g.key), ['g5', 'g4', 'g3']);
});

test('суммы: баллы администратора плюс внесённые студентом', () => {
  assert.equal(J.adminTotal(students[0]), 70.5);
  const self = [{ id: 'x', sid: 's1', pts: 5 }, { id: 'y', sid: 's2', pts: 7 }, { id: 'z', sid: 's1', pts: 2 }];
  assert.equal(J.selfTotal('s1', self), 7);
  assert.equal(J.totalOf(students[0], self), 77.5);
  assert.equal(J.totalOf(students[1], self), 7);
  assert.equal(J.formatPoints(70.5), '70,5');
  assert.equal(J.formatPoints(70), '70');
});

test('разбор баллов: число, несколько чисел, штраф, мусор', () => {
  assert.deepEqual(J.parsePoints('5').values, [5]);
  assert.deepEqual(J.parsePoints('5, 3 10').values, [5, 3, 10]);
  assert.deepEqual(J.parsePoints('-1').values, [-1]);
  assert.deepEqual(J.parsePoints('2,5').values, [2.5]);
  assert.ok(J.parsePoints('пять').error);
  assert.ok(J.parsePoints('').error);
  assert.ok(J.parsePoints('999').error);
  assert.ok(J.parsePoints('1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1').error);
});

test('разбор списка фамилий: пустые строки, повторы, нумерация', () => {
  assert.deepEqual(J.parseNames('Иванов\n\n  Петров  Пётр \n1. Сидорова\nиванов'), ['Иванов', 'Петров Пётр', 'Сидорова']);
  assert.deepEqual(J.parseNames('Иванов Иван\nНовый', ['иванов иван']), ['Новый']);
});

test('массовый ввод находит фамилии и честно сообщает о проблемах', () => {
  const r = J.parseBulk('Иванов 5\nПетров Пётр: 3, 4\nПетров 2\nСидоров 1\nбез числа', students);
  assert.deepEqual(r.matched.map((m) => [m.sid, m.values]), [['s1', [5]], ['s2', [3, 4]]]);
  assert.equal(r.problems.length, 3); // «Петров» подходит двум, «Сидоров» нет, строка без числа
  assert.ok(r.problems.some((p) => /несколько/.test(p.why)));
  assert.ok(r.problems.some((p) => /нет/.test(p.why)));
});

test('код: формат, нормализация и хэш не зависят от регистра и дефиса', async () => {
  const code = J.makeCode();
  assert.match(code, /^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  const salt = J.randomHex(16);
  assert.equal(salt.length, 16);
  const h = await J.hashCode(salt, code);
  assert.equal(h, await J.hashCode(salt, code.toLowerCase().replace('-', ' ')));
  assert.notEqual(h, await J.hashCode(salt, 'AAAAA-AAAAA'));
  assert.equal(await J.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('опубликованный файл журнала корректен', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../assets/journal.json', import.meta.url), 'utf8'));
  assert.equal(j.max, 138);
  assert.ok(Array.isArray(j.students));
  for (const s of j.students) assert.ok(s.id && s.name && Array.isArray(s.entries));
});

// --- серверный скрипт Google Apps Script в имитации окружения ----------------------
async function makeServer(journal, props = { ADMIN_KEY: 'секрет' }) {
  const sheetRows = [['id', 'sid', 'pts', 'ts']];
  const cache = new Map();
  const code = fs.readFileSync(new URL('../tools/journal-apps-script.gs', import.meta.url), 'utf8');
  const nodeCrypto = await import('node:crypto');
  const sandbox = {
    console, JSON, Math, Date, Number, String, Array, isFinite, Error, parseInt,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({
      appendRow: (r) => sheetRows.push(r), getDataRange: () => ({ getValues: () => sheetRows.map((r) => r.slice()) }),
      deleteRow: (n) => sheetRows.splice(n - 1, 1) }), insertSheet: () => null }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(journal) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a, text) => Array.from(nodeCrypto.createHash('sha256').update(text, 'utf8').digest(), (b) => (b > 127 ? b - 256 : b)),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const post = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).t);
  const list = () => JSON.parse(sandbox.doGet({ parameter: { action: 'list' } }).t);
  return { post, list, sheetRows };
}

test('сервер: внесение баллов по коду, отказы и удаление', async () => {
  const salt = 'abc123';
  const code = 'ABCDE-FGHJK';
  const journal = { max: 138, students: [
    { id: 's1', name: 'Иванов', salt, codeHash: await J.hashCode(salt, code), entries: [{ id: 'a', pts: 100 }] },
    { id: 's2', name: 'Петров', salt, codeHash: await J.hashCode(salt, 'ZZZZZ-ZZZZZ'), entries: [] },
  ] };
  const srv = await makeServer(journal);

  assert.deepEqual(srv.list(), { ok: true, entries: [] });
  assert.equal(srv.post({ action: 'add', sid: 's1', code: 'неверный', pts: 5 }).error, 'code');
  assert.equal(srv.post({ action: 'add', sid: 'нет', code, pts: 5 }).error, 'student');
  assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 0 }).error, 'points');
  assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 31 }).error, 'points');
  assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 2.5 }).error, 'points');

  const ok = srv.post({ action: 'add', sid: 's1', code: 'abcde fghjk', pts: 20 }); // регистр и пробел не важны
  assert.equal(ok.ok, true);
  assert.equal(ok.total, 120);
  assert.equal(srv.list().entries.length, 1);

  // потолок 138: 100 + 20 + 30 > 138
  assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 30 }).error, 'cap');
  assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 18 }).total, 138);

  // удаление только с ключом администратора
  const id = srv.list().entries[0].id;
  assert.equal(srv.post({ action: 'remove', id }).error, 'admin');
  assert.equal(srv.post({ action: 'remove', id, adminKey: 'чужой' }).error, 'admin');
  assert.equal(srv.post({ action: 'remove', id, adminKey: 'секрет' }).ok, true);
  assert.equal(srv.list().entries.length, 1);
  assert.equal(srv.post({ action: 'frob' }).error, 'unknown');
});

test('сервер: не больше 12 внесений в час и без ключа администратора удалять нельзя', async () => {
  const salt = 's'; const code = 'AAAAA-BBBBB';
  const journal = { max: 138, students: [{ id: 's1', name: 'Иванов', salt, codeHash: await J.hashCode(salt, code), entries: [] }] };
  const srv = await makeServer(journal, {});
  for (let i = 0; i < 12; i++) assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 1 }).ok, true);
  assert.equal(srv.post({ action: 'add', sid: 's1', code, pts: 1 }).error, 'rate');
  const id = srv.list().entries[0].id;
  assert.equal(srv.post({ action: 'remove', id, adminKey: '' }).error, 'admin'); // ключ не задан в свойствах
});
