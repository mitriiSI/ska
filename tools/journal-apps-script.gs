/**
 * Журнал баллов: сервер для самостоятельного внесения баллов студентами.
 * Работает в Google Apps Script и хранит записи в Google Таблице (лист «Баллы студентов»).
 *
 * Как подключить (один раз, около 5 минут):
 *  1. Откройте https://sheets.new, назовите таблицу «Журнал баллов».
 *  2. Меню «Расширения» → «Apps Script». Удалите всё, вставьте этот файл целиком, сохраните.
 *  3. Слева «Настройки проекта» (шестерёнка) → «Свойства скрипта» → «Добавить свойство»:
 *     имя ADMIN_KEY, значение: придуманный вами пароль (нужен, чтобы удалять записи студентов).
 *  4. Справа вверху «Развернуть» → «Новое развертывание» → тип «Веб-приложение»:
 *     «Выполнять от имени»: Я; «У кого есть доступ»: Все. Нажмите «Развернуть», разрешите доступ.
 *  5. Скопируйте «URL веб-приложения» (заканчивается на /exec) и вставьте в редакторе сайта,
 *     вкладка «Журнал», поле «Адрес сервера». Нажмите «Опубликовать журнал».
 *
 * Как это работает: студент вводит фамилию, код и число баллов. Скрипт скачивает опубликованный
 * assets/journal.json, проверяет код по хэшу, затем записывает баллы в таблицу. Сайт показывает
 * сумму баллов, внесённых администратором, и баллов, внесённых студентом самостоятельно.
 */

var JOURNAL_URL = 'https://mitriisi.github.io/ska/assets/journal.json'; // где опубликован журнал
var SHEET_NAME = 'Баллы студентов';
var MAX_ENTRY = 30;      // не больше баллов за один раз
var MAX_PER_HOUR = 12;   // не больше внесений в час на одного студента
var DEFAULT_MAX = 138;   // максимум баллов, если в журнале не указан другой

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(['id', 'sid', 'pts', 'ts']); }
  return sh;
}

function rows_() {
  var values = sheet_().getDataRange().getValues();
  values.shift();
  return values.filter(function (r) { return r[0]; }).map(function (r) {
    return { id: String(r[0]), sid: String(r[1]), pts: Number(r[2]), ts: String(r[3]) };
  });
}

function journal_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('journal');
  if (cached) return JSON.parse(cached);
  var res = UrlFetchApp.fetch(JOURNAL_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('journal');
  var text = res.getContentText();
  var data = JSON.parse(text);
  cache.put('journal', text, 60);
  return data;
}

function sha256_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function normCode_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function round2_(n) { return Math.round(n * 100) / 100; }
function sum_(list) { return list.reduce(function (a, x) { return a + Number(x.pts || 0); }, 0); }

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return jsonOut_({ ok: true, entries: rows_() });
  return jsonOut_({ ok: false, error: 'unknown' });
}

function add_(body) {
  var journal = journal_();
  var st = (journal.students || []).filter(function (s) { return s.id === String(body.sid || ''); })[0];
  if (!st) return { ok: false, error: 'student' };
  var pts = Number(body.pts);
  if (!isFinite(pts) || Math.floor(pts) !== pts || pts < 1 || pts > MAX_ENTRY) return { ok: false, error: 'points' };
  if (sha256_(st.salt + ':' + normCode_(body.code)) !== st.codeHash) return { ok: false, error: 'code' };
  var now = Date.now();
  var mine = rows_().filter(function (r) { return r.sid === st.id; });
  var recent = mine.filter(function (r) { return now - Date.parse(r.ts) < 3600000; }).length;
  if (recent >= MAX_PER_HOUR) return { ok: false, error: 'rate' };
  var total = round2_(sum_(st.entries || []) + sum_(mine) + pts);
  if (total > (Number(journal.max) || DEFAULT_MAX)) return { ok: false, error: 'cap' };
  var id = 'e' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  sheet_().appendRow([id, st.id, pts, new Date(now).toISOString()]);
  return { ok: true, id: id, total: total };
}

function remove_(body) {
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key || String(body.adminKey || '') !== key) return { ok: false, error: 'admin' };
  var list = rows_();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === String(body.id || '')) { sheet_().deleteRow(i + 2); return { ok: true }; }
  }
  return { ok: false, error: 'missing' };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'add') return jsonOut_(add_(body));
    if (body.action === 'remove') return jsonOut_(remove_(body));
    return jsonOut_({ ok: false, error: 'unknown' });
  } catch (err) {
    return jsonOut_({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}
