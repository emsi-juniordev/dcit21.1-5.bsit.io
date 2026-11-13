/* ---------- 1. DOM helpers ---------- */
const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ---------- 2. Rules: each rule = [field, passes?, message] ---------- */
const Rules = {
  login: [
    ['identifier', v => v.identifier, 'Enter your username or email.'],
    ['password',   v => v.password,   'Enter your password.'],
  ],
  signup: [
    ['username', v => /^\w{3,20}$/.test(v.username),     'Username: 3–20 letters, numbers or _'],
    ['email',    v => /^\S+@\S+\.\S{2,}$/.test(v.email), 'Enter a valid email address.'],
    ['password', v => v.password.length >= 8 && /\d/.test(v.password),
                 'Password needs 8+ characters and a number.'],
    ['confirm',  v => v.confirm === v.password,          'Passwords don’t match.'],
  ],
};

// Returns the first broken rule as { field, message }, or null if all pass
function firstError(rules, values) {
  const broken = rules.find(([, passes]) => !passes(values));
  return broken ? { field: broken[0], message: broken[2] } : null;
}

/* ---------- 3. UI ---------- */
const Views = {
  show(id) {
    $$('.view').forEach(view => view.classList.toggle('show', view.id === id));
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
    $('.msg', form).textContent = message;
    input.focus();
  },
  clearError(form) {
    $$('.bad', form).forEach(box => box.classList.remove('bad'));
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

/* ---------- 5. Wiring + start ---------- */
function bindForms() {
  $('#login').addEventListener('submit',  e => handleSubmit(e, Rules.login, loginAction));
  $('#signup').addEventListener('submit', e => handleSubmit(e, Rules.signup, signupAction));
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

function start() {
  bindForms();
  bindPasswordToggles();
  bindNavigation();
}

start();
