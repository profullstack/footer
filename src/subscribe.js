// The newsletter form's browser half. Without it the form is a plain POST to pit.world, which
// navigates away, and a site whose CSP says `form-action 'self'` silently drops it: the button
// does nothing at all. With it the form posts JSON to pit.world/api/subscribe (CORS: any origin)
// and says what happened in the form's status line.
//
// wireSubscribe must stay self-contained (no imports, no outer names): render.js inlines it into
// the footer as `(source)(form)`, so it runs on sites that load no script from us.

/**
 * Take over one footer form's submit and report the outcome inline. Safe to call twice.
 * @param {HTMLFormElement | null} form
 */
export function wireSubscribe(form) {
  if (!form || form.getAttribute('data-pfs-wired')) return;
  form.setAttribute('data-pfs-wired', '1');
  var msg = form.querySelector('.pfs-footer__msg');
  var button = form.querySelector('button');
  var reasons = {
    invalid: "that doesn't look like an email address",
    undeliverable: "that address's domain can't receive email",
    failed: 'the confirmation email could not be sent, try again later',
  };
  function say(text, state) {
    if (!msg) return;
    msg.textContent = text;
    msg.setAttribute('data-state', state);
  }
  form.addEventListener('submit', function (event) {
    if (typeof fetch !== 'function') return; // let the plain POST go
    event.preventDefault();
    var data = new FormData(form);
    var email = String(data.get('email') || '').trim();
    // The honeypot: a bot that fills it gets the normal answer and nothing is sent.
    if (data.get('website')) return say('Email confirmation sent. Check your inbox.', 'ok');
    if (button) button.disabled = true;
    say('Sending…', 'busy');
    fetch(new URL('/api/subscribe', form.action).href, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, site: data.get('site') }),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            if (res.ok && body.ok) {
              say('Email confirmation sent to ' + email + '. Check your inbox.', 'ok');
              form.reset();
            } else {
              say('Failed: ' + (body.error || reasons[body.status] || 'pit.world answered ' + res.status), 'error');
            }
          });
      })
      .catch(function (err) {
        say('Failed: could not reach pit.world (' + ((err && err.message) || err) + ')', 'error');
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  });
}
