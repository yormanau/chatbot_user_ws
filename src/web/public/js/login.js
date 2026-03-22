const btnLogin  = document.getElementById('btn-login');
const inputUser = document.getElementById('input-user');
const inputPin  = document.getElementById('input-pin');
const errorMsg  = document.getElementById('error-msg');

async function login() {
  const user = inputUser.value.trim();
  const pin  = inputPin.value.trim();

  if (!user || !pin) return;

  btnLogin.classList.add('loading');
  btnLogin.disabled = true;
  errorMsg.classList.remove('visible');
  inputUser.classList.remove('error');
  inputPin.classList.remove('error');

  try {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user, pin }),
    });

    if (res.ok) {
      window.location.href = '/';
    } else {
      inputUser.classList.add('error');
      inputPin.classList.add('error');
      errorMsg.classList.add('visible');
      inputPin.value = '';
      inputPin.focus();
    }
  } catch (e) {
    errorMsg.textContent = 'Error de conexión';
    errorMsg.classList.add('visible');
  } finally {
    btnLogin.classList.remove('loading');
    btnLogin.disabled = false;
  }
}

btnLogin.addEventListener('click', login);
[inputUser, inputPin].forEach(el => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
});