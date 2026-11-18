/* ---------- 1. DOM helpers ---------- */
const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ---------- 2. Rules: each rule = [field, passes?, message] ---------- */
// Shared formats (used by sign up and by the forgot-password flow)
const Format = {
  username: /^\w{3,20}$/,
  email:    /^\S+@\S+\.\S{2,}$/,
};

const Rules = {
  login: [
    ['identifier', v => v.identifier, 'Enter your username or email.'],
    ['password',   v => v.password,   'Enter your password.'],
  ],
  signup: [
    ['username', v => Format.username.test(v.username),   'Username: 3–20 letters, numbers or _'],
    ['email',    v => Format.email.test(v.email),         'Enter a valid email address.'],
    ['password', v => v.password.length >= 8 && /\d/.test(v.password),
                 'Password needs 8+ characters and a number.'],
    ['confirm',  v => v.confirm === v.password,          'Passwords don’t match.'],
  ],
  resetRequest: [
    ['identifier', v => Format.email.test(v.identifier) || Format.username.test(v.identifier),
                   'Enter a valid username or email.'],
  ],
  resetConfirm: [
    ['code',     v => /^\d{6}$/.test(v.code),               'Enter the 6-digit code.'],
    ['password', v => v.password.length >= 8 && /\d/.test(v.password),
                 'Password needs 8+ characters and a number.'],
    ['confirm',  v => v.confirm === v.password,              'Passwords don’t match.'],
  ],
};

// Returns the first broken rule as { field, message }, or null if all pass
function firstError(rules, values) {
  const broken = rules.find(([, passes]) => !passes(values));
  return broken ? { field: broken[0], message: broken[2] } : null;
}

/* ---------- 3. UI ---------- */
const Views = {
  show(id, root = document) {            // root = which group of views to switch
    $$('.view', root).forEach(view => view.classList.toggle('show', view.id === id));
  },
};

const FormUI = {
  // { identifier: '...', password: '...' } – keyed by each input's name
  values(form) {
    return Object.fromEntries(
      $$('input', form).map(i => [i.name, i.type === 'password' ? i.value : i.value.trim()])
    );
  },
  showError(form, field, message) {
    const input = $(`[name="${field}"]`, form);
    const box   = input.closest('.field');
    box.classList.remove('bad');
    void box.offsetWidth; // restart the shake animation
    box.classList.add('bad');
    $('.msg', form).classList.remove('ok');
    $('.msg', form).textContent = message;
    input.focus();
  },
  showNotice(form, message) {            // green success text in the same .msg line
    $('.msg', form).classList.add('ok');
    $('.msg', form).textContent = message;
  },
  clearError(form) {
    $$('.bad', form).forEach(box => box.classList.remove('bad'));
    $('.msg', form).classList.remove('ok');
    $('.msg', form).textContent = '';
  },
  setBusy(form, busy) {
    const button = $('.btn', form);
    button.dataset.label ??= button.textContent;
    button.disabled = busy;
    button.textContent = busy ? 'Please wait...' : button.dataset.label;
  },
};

/* ---------- 4. Features ---------- */
function enterHome(name) {
  $('#who').textContent = `Logged in as ${name}`;
  Views.show('home');
}

// Every form follows the same steps: validate -> busy -> run action -> report
async function handleSubmit(event, rules, action) {
  event.preventDefault();
  const form    = event.target;
  const values  = FormUI.values(form);
  FormUI.clearError(form);
  const problem = firstError(rules, values);
  if (problem) return FormUI.showError(form, problem.field, problem.message);

  FormUI.setBusy(form, true);
  await pause(700);                        // short pause so the button feedback is visible
  const failure = await action(values);    // an action returns { field, message } if it fails
  FormUI.setBusy(form, false);

  if (failure) return FormUI.showError(form, failure.field, failure.message);
  form.reset();
}

// No saved accounts: any input that passes the rules is accepted
async function loginAction({ identifier }) {
  enterHome(identifier);
}

async function signupAction({ username }) {
  Views.show('login');
  $('#login [name="identifier"]').value = username;
}

function logout() {
  Views.show('login');
}

/* ---------- 4b. Forgot password ----------
   Flow: link -> modal step 1 (who?) -> step 2 (code + new password) -> back to login.
   There is no backend, so the "sent" code lives in memory and is shown on screen. */
const Reset = { identifier: '', code: '' };

const modal = () => $('#reset');

function makeCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1e6;
  return String(n).padStart(6, '0');
}

// Creates a new code and shows it in the UI.
// REAL API: delete this body. The server generates the code and emails/texts it,
//           so the browser never sees it and #demo-code is removed from the HTML.
function issueCode() {
  Reset.code = makeCode();
  $('#demo-code').textContent = Reset.code;
}

function openReset() {
  modal().hidden = false;
  Views.show('reset-request', modal());
  $('#reset-request [name="identifier"]').focus();
}

function closeReset() {
  modal().hidden = true;
  $$('form', modal()).forEach(form => {
    form.reset();
    FormUI.clearError(form);
  });
  $$('[name="password"]', modal()).forEach(input => input.type = 'password');
  Reset.identifier = Reset.code = '';
}

// Step 1 action
// REAL API: await fetch('/api/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) })
//           and return { field: 'identifier', message } when the server rejects it.
async function requestCodeAction({ identifier }) {
  Reset.identifier = identifier;
  issueCode();
  $('#sent-to').textContent = identifier;
  Views.show('reset-confirm', modal());
  $('#reset-confirm [name="code"]').focus();
}

// Step 2 action
// REAL API: await fetch('/api/reset-password', { method: 'POST',
//             body: JSON.stringify({ identifier: Reset.identifier, code, password }) })
//           and return { field: 'code', message } when the server says the code is wrong.
async function resetPasswordAction({ code }) {
  if (code !== Reset.code) return { field: 'code', message: 'Wrong code. Check it and try again.' };

  const identifier = Reset.identifier;
  closeReset();
  Views.show('login');
  $('#login [name="identifier"]').value = identifier;
  FormUI.showNotice($('#login'), 'Password updated — sign in with your new password.');
  $('#login [name="password"]').focus();
}

function resendCode() {
  const form = $('#reset-confirm');
  issueCode();
  FormUI.clearError(form);
  $('[name="code"]', form).value = '';
  $('[name="code"]', form).focus();
}

/* ---------- 5. Wiring + start ---------- */
function bindForms() {
  $('#login').addEventListener('submit',  e => handleSubmit(e, Rules.login, loginAction));
  $('#signup').addEventListener('submit', e => handleSubmit(e, Rules.signup, signupAction));
  $('#reset-request').addEventListener('submit', e => handleSubmit(e, Rules.resetRequest, requestCodeAction));
  $('#reset-confirm').addEventListener('submit', e => handleSubmit(e, Rules.resetConfirm, resetPasswordAction));
  $('#out').addEventListener('click', logout);
  $$('input').forEach(input => input.addEventListener('input', () => FormUI.clearError(input.form)));
}

function bindPasswordToggles() {
  $$('.eye').forEach(button => button.addEventListener('click', () => {
    const input = $('input', button.parentNode);
    input.type = input.type === 'password' ? 'text' : 'password';
  }));
}

function bindNavigation() {
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-go]');
    if (!link) return;
    event.preventDefault();
    Views.show(link.dataset.go);
  });
}

function bindReset() {
  $('#forgot').addEventListener('click', e => { e.preventDefault(); openReset(); });
  $('#resend').addEventListener('click', e => { e.preventDefault(); resendCode(); });
  $('#reset-close').addEventListener('click', closeReset);
  modal().addEventListener('click', e => { if (e.target === modal()) closeReset(); });   // backdrop
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal().hidden) closeReset(); });
}

function start() {
  bindForms();
  bindPasswordToggles();
  bindNavigation();
  bindReset();
}

start();