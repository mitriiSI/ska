import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEngine, stem } from '../assets/search-core.js';

const index = JSON.parse(fs.readFileSync(new URL('../assets/search-index.json', import.meta.url), 'utf8'));
const engine = createEngine(index);
const top = (q) => engine.search(q);
const firstHref = (q) => { const r = top(q); return r.kind === 'results' ? r.results[0].href.split('#')[0] : r.kind; };
const anyHref = (q, href) => { const r = top(q); return r.kind === 'results' && r.results.some((x) => x.href.split('#')[0] === href); };

test('стеммер сводит формы слова', () => {
  assert.equal(stem('лекции'), stem('лекций'));
  assert.equal(stem('лекцию'), stem('лекция'));
  assert.equal(stem('рейтинговая'), stem('рейтинговой'));
  assert.equal(stem('экзамену'), stem('экзамен'));
});

test('находит разделы и страницы по обычным вопросам', () => {
  assert.equal(firstHref('рейтинговая система'), 'fgu-rejtingovaya-sistema.html');
  assert.ok(anyHref('как набрать баллы за семестр', 'fgu-rejtingovaya-sistema.html'));
  assert.ok(anyHref('вопросы к экзамену', 'fgu-voprosy-k-ekzamenu.html') || anyHref('вопросы к экзамену', 'mehmat-voprosy-k-ekzamenu.html'));
  assert.ok(anyHref('телефон преподавателя', 'kontakty.html'));
  assert.ok(anyHref('как написать на почту', 'kontakty.html'));
  assert.ok(anyHref('сайты по истории россии', 'sajty.html'));
  assert.ok(anyHref('методика подготовки курсовой работы', 'kursovye-metodika.html'));
  assert.ok(anyHref('индекс', 'kursovye-indeks.html'));
});

test('находит конкретные лекции и слайды презентаций', () => {
  assert.equal(firstHref('лекция 5'), firstHref('лекция 5')); // не падает
  assert.ok(anyHref('лекция 14', 'files/lekciya-14.pptx'));
  const r = top('северо-восточная русь под властью орды');
  assert.equal(r.kind, 'results');
  assert.ok(r.results.some((x) => /^files\/.*lekciya-5\.pptx/.test(x.href)));
});

test('понимает опечатки и ввод по началу слова', () => {
  assert.ok(anyHref('рейтенговая система', 'fgu-rejtingovaya-sistema.html'));
  assert.ok(anyHref('экзаме', 'fgu-voprosy-k-ekzamenu.html') || anyHref('экзаме', 'mehmat-voprosy-k-ekzamenu.html'));
});

test('на вопрос вне сайта честно отвечает, что ничего не нашёл', () => {
  for (const q of ['квантовая гравитация борщ', 'курс доллара сегодня', 'qwertyuiop', 'рецепт шоколадного торта', 'рецепт борща', 'прогноз погоды']) {
    assert.equal(top(q).kind, 'none', q);
  }
});

test('приветствия, благодарности и пустой ввод', () => {
  assert.equal(top('Привет!').kind, 'hello');
  assert.equal(top('спасибо').kind, 'thanks');
  assert.equal(top('   ').kind, 'empty');
  assert.equal(top('???').kind, 'empty');
});

test('в результатах нет мусора: у каждого есть ссылка и заголовок', () => {
  for (const q of ['лекции', 'семинары', 'эссе', 'курсовые работы', 'дебаты']) {
    const r = top(q);
    assert.equal(r.kind, 'results', q);
    for (const x of r.results) { assert.ok(x.href && x.title, q); }
  }
});
