const form = document.querySelector('#admin-login');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  const password = document.querySelector('#password');
  const error = document.querySelector('#login-error');
  error.textContent = '';
  button.disabled = true;
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign in failed.');
    location.replace('/');
  } catch (failure) {
    error.textContent = failure.message;
    password.focus();
  } finally {
    button.disabled = false;
  }
});
