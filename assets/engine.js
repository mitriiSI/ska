// Общая загрузка поискового движка (один индекс на страницу для главной и помощника).
const BASE = new URL('./', import.meta.url);
let promise = null;
export function loadEngine() {
  if (!promise) {
    promise = Promise.all([
      import(new URL('search-core.js', BASE)),
      fetch(new URL('search-index.json', BASE)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]).then(([core, index]) => core.createEngine(index)).catch((e) => { promise = null; throw e; });
  }
  return promise;
}
