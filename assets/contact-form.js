// Форма «Связаться»: отправка через Formsubmit.co (письмо уходит на почту преподавателя)
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var status = document.getElementById('contact-status');
  var btn = form.querySelector('button[type="submit"]');
  var ENDPOINT = 'https://formsubmit.co/ajax/solovyevka@gmail.com';

  function say(text, ok) {
    status.textContent = text;
    status.className = ok === true ? 'ok' : ok === false ? 'err' : '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var name = f.name.value.trim(), email = f.email.value.trim(), message = f.message.value.trim();
    if (!name || !email || !message) { say('Заполните имя, email и сообщение.', false); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Проверьте адрес электронной почты.', false); return; }
    if (f._honey.value) { say('Сообщение отправлено. Спасибо!', true); form.reset(); return; }

    btn.disabled = true;
    say('Отправляю…');
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        message: message,
        _subject: 'Сайт «Отечественная история»: ' + (f.subject.value.trim() || 'сообщение от ' + name),
        _replyto: email,
        _template: 'table',
        _captcha: 'false'
      })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && String(res.d.success) === 'true') {
          say('Сообщение отправлено. Спасибо!', true);
          form.reset();
        } else {
          say('Не удалось отправить. Напишите на solovyevka@gmail.com.', false);
        }
      })
      .catch(function () { say('Нет связи с сервером. Напишите на solovyevka@gmail.com.', false); })
      .then(function () { btn.disabled = false; });
  });
})();
