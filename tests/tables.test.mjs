import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePage } from '../tools/page-content.mjs';

// Так выглядит таблица, скопированная из Word: классы, стили, лишние обёртки.
const WORD = '<table class="MsoTableGrid" border="1" cellspacing="0" style="border-collapse:collapse;border:none"><tbody>' +
  '<tr><td width="120" style="border:solid windowtext 1.0pt;background:#D9E2F3"><p class="MsoNormal"><span style="font-size:12pt">Студент</span></p></td>' +
  '<td style="width:60pt"><p class="MsoNormal"><b>Баллы</b></p></td></tr>' +
  '<tr><td><p class="MsoNormal">Иванов И.</p></td><td colspan="1"><p class="MsoNormal">5</p></td></tr></tbody></table>';
// Excel и Google Таблицы добавляют атрибуты data-* и служебные теги.
const EXCEL = '<google-sheets-html-origin><style>td{border:1px solid}</style><table xmlns="http://www.w3.org/1999/xhtml" data-sheets-root="1"><colgroup><col width="100"></colgroup><tbody><tr><td data-sheets-value="x">A</td><td>B</td></tr></tbody></table></google-sheets-html-origin>';

test('таблица из Word сохраняется без чужого оформления', () => {
  const out = sanitizePage(WORD);
  assert.match(out, /<table>/);
  assert.equal((out.match(/<tr>/g) || []).length, 2);
  assert.match(out, /Студент/);
  assert.match(out, /Иванов И\./);
  assert.doesNotMatch(out, /style=|class=|width=|border=|background/);
});

test('таблица из Excel и Google Таблиц очищается от служебных тегов', () => {
  const out = sanitizePage(EXCEL);
  assert.match(out, /<table>/);
  assert.doesNotMatch(out, /data-|<style|<colgroup|google-sheets|xmlns/);
  assert.match(out, /<td>A<\/td>/);
});

test('объединённые ячейки сохраняются, а опасные значения нет', () => {
  const out = sanitizePage('<table><tr><td colspan="2" rowspan="9999">x</td><td colspan="2">y</td></tr></table>');
  assert.match(out, /colspan="2"/);
  assert.doesNotMatch(out, /9999/);
});
